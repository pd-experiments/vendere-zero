import os
import time
from typing import List
from openai import OpenAI
from helpers import get_supabase_client
from models import Keywords, GPTStructuredMarketResearch
from prompts import KEYWORD_GENERATION_PROMPT
import dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from multiprocessing import Pool, cpu_count
from tqdm import tqdm

# Load environment variables
dotenv.load_dotenv("../../.env.local")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def generate_keywords_for_research(args) -> None:
    """Generate keywords for a single research item"""
    research_data, image_url, keywords = args
    if keywords:
        print(f"Keywords already generated for {image_url}")
        return

    time_start = time.time()

    try:
        research = GPTStructuredMarketResearch.model_validate(research_data)

        # Create research summary for context
        research_context = {
            "intent": research.intent_summary,
            "audience": [seg.model_dump() for seg in research.target_audience],
            "pain_points": research.pain_points,
            "stage": research.buying_stage,
            "features": [feat.model_dump() for feat in research.key_features],
            "advantages": research.competitive_advantages,
        }

        # Get ad description
        supabase = get_supabase_client()
        ad_description = (
            supabase.table("ad_structured_output")
            .select("image_description")
            .eq("image_url", image_url)
            .execute()
            .data[0]["image_description"]
        )

        # Generate keywords
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        completion = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": KEYWORD_GENERATION_PROMPT},
                {
                    "role": "user",
                    "content": f"Generate long-tail keywords for this ad based on this market research: {research_context} and ad description: {ad_description}",
                },
            ],
            response_format=Keywords,
            temperature=0.7,
        )

        keywords = completion.choices[0].message.parsed
        if keywords:
            # Update the record with generated keywords
            supabase.table("market_research_v2").update(
                {"keywords": keywords.model_dump()["keywords"]}
            ).eq("image_url", image_url).execute()

    except Exception as e:
        print(f"Error processing research for {image_url}: {e}")
    finally:
        print(f"Time taken: {time.time() - time_start:.2f} seconds")


def main():
    """Process all market research and generate keywords"""
    # Get all research data
    supabase = get_supabase_client()
    research_data = supabase.table("market_research_v2").select("*").execute().data

    # Prepare work items
    work_items = [(r, r["image_url"], r["keywords"]) for r in research_data]

    # Use multiprocessing pool
    num_processes = min(cpu_count(), 10)  # Use at most 10 processes
    print(f"Starting pool with {num_processes} processes")

    with Pool(num_processes) as pool:
        list(
            tqdm(
                pool.imap_unordered(generate_keywords_for_research, work_items),
                total=len(work_items),
                desc="Generating keywords",
            )
        )


if __name__ == "__main__":
    main()
