import os
import time
from typing import List, Optional, Tuple
from openai import OpenAI
from helpers import get_supabase_client
from models import ImprovedHeadlines, OriginalImageHeadlines
import dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from multiprocessing import Pool, cpu_count, Manager
from tqdm import tqdm
from prompts import (
    AD_COPY_GENERATION_PROMPT,
    HEADLINE_EXTRACTION_PROMPT,
    HEADLINE_IMPROVEMENT_PROMPT,
)

# Load environment variables
dotenv.load_dotenv("../../.env.local")


def update_database(results: dict) -> None:
    """Update database with results"""
    if not results["success"]:
        return

    try:
        supabase = get_supabase_client()
        supabase.table("market_research_v2").update(
            {
                "original_headlines": [
                    h.model_dump(mode="json") for h in results["original_headlines"]
                ],
                "new_headlines": [
                    h.model_dump(mode="json") for h in results["new_headlines"]
                ],
            }
        ).eq("image_url", results["image_url"]).execute()
    except Exception as e:
        print(f"Error updating database for {results['image_url']}: {e}")


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=15),
)
def process_and_update(
    args: Tuple[str, Optional[List[str]], Optional[str], Optional[List[str]], dict]
) -> dict:
    """Process a single ad, update database, and track stats"""
    image_url, existing_headlines, intent_summary, pain_points, stats = args
    results = {
        "image_url": image_url,
        "success": False,
        "error": None,
        "original_headlines": None,
        "new_headlines": None,
        "time_taken": 0,
    }

    if existing_headlines:
        results["success"] = True
        results["original_headlines"] = existing_headlines
        with stats["lock"]:
            stats["processed"] += 1
            stats["successful"] += 1
        return results

    time_start = time.time()
    try:
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Extract original headlines
        completion = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": HEADLINE_EXTRACTION_PROMPT,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Generate compelling headlines for this ad that align with its visual elements and marketing goals.",
                        },
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                },
            ],
            max_tokens=2048,
            response_format=OriginalImageHeadlines,
        )

        original_headlines = completion.choices[0].message.parsed
        if not original_headlines:
            raise ValueError("No original headlines found")

        results["original_headlines"] = original_headlines.headlines
        # print(f"Original headlines: {original_headlines.headlines}")

        # Generate improved headlines
        new_completion = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": HEADLINE_IMPROVEMENT_PROMPT,
                },
                {
                    "role": "user",
                    "content": f"Original headlines: {original_headlines}\nIntent summary: {intent_summary}\nPain points: {pain_points}",
                },
            ],
            max_tokens=2048,
            response_format=ImprovedHeadlines,
        )

        new_headlines = new_completion.choices[0].message.parsed
        if not new_headlines:
            raise ValueError("No improved headlines found")

        results["new_headlines"] = new_headlines.headlines
        # print(f"New headlines: {new_headlines.headlines}")
        results["success"] = True

        # Update database immediately
        update_database(results)

        # Update stats
        with stats["lock"]:
            stats["successful"] += 1

    except Exception as e:
        results["error"] = str(e)
        print(f"Error processing ad {image_url}: {e}")
        with stats["lock"]:
            stats["failed"].append((image_url, str(e)))
    finally:
        results["time_taken"] = time.time() - time_start
        print(f"Time taken for {image_url}: {results['time_taken']:.2f} seconds")
        with stats["lock"]:
            stats["processed"] += 1
        return results


def main():
    """Process all ads and generate headlines"""
    # Get all research data
    supabase = get_supabase_client()
    research_data = supabase.table("market_research_v2").select("*").execute().data

    # Set up shared stats tracking
    manager = Manager()
    stats = manager.dict(
        {
            "processed": 0,
            "successful": 0,
            "failed": manager.list(),
            "lock": manager.Lock(),
        }
    )

    # Prepare work items
    work_items = [
        (
            r["image_url"],
            r.get("headlines"),
            r.get("intent_summary"),
            r.get("pain_points"),
            stats,
        )
        for r in research_data
    ]

    # Use multiprocessing pool
    num_processes = min(cpu_count(), 10)  # Use at most 10 processes
    print(f"Starting pool with {num_processes} processes")

    with Pool(num_processes) as pool:
        # Process ads with progress tracking
        for _ in tqdm(
            pool.imap_unordered(process_and_update, work_items),
            total=len(work_items),
            desc="Processing ads",
        ):
            # Print current stats
            print(
                f"\rProcessed: {stats['processed']}/{len(work_items)} "
                f"(Success: {stats['successful']}, "
                f"Failed: {len(stats['failed'])})",
                end="",
            )

    # Print final summary
    print("\n\nProcessing complete:")
    print(f"Total processed: {stats['processed']}")
    print(f"Successful: {stats['successful']}")
    print(f"Failed: {len(stats['failed'])}")
    if stats["failed"]:
        print("\nFailed URLs:")
        for url, error in stats["failed"]:
            print(f"{url}: {error}")


if __name__ == "__main__":
    main()
