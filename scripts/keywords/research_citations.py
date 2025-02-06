import asyncio
import time
from typing import Optional
from openai import OpenAI
import os
import httpx
from bs4 import BeautifulSoup
from helpers import get_supabase_client
from models import MarketResearch
from prompts import MARKET_RESEARCH_ANALYSIS, STRUCTURED_OUTPUT_PROMPT
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm
import dotenv
from multiprocessing import Pool, cpu_count
from functools import partial

# Load environment variables
dotenv.load_dotenv("../../.env.local")


def extract_content(url: str) -> Optional[str]:
    """Extract main content from URL"""
    try:
        with httpx.Client(
            timeout=10.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
        ) as client:
            response = client.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")
            for tag in soup(
                ["script", "style", "nav", "footer", "header", "iframe", "noscript"]
            ):
                tag.decompose()

            main = soup.find("main") or soup.find("article") or soup.find("body")
            if not main:
                return None

            text = " ".join(main.stripped_strings)
            return text if len(text.strip()) > 100 else None

    except Exception as e:
        print(f"Error extracting content from {url}: {e}")
        return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def process_citation(args) -> None:
    """Process a single citation's content"""
    image_url, url = args
    time_start = time.time()

    try:
        # Extract content
        content = extract_content(url)
        if not content:
            return

        # Analyze content
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": MARKET_RESEARCH_ANALYSIS},
                {
                    "role": "user",
                    "content": f"Analyze this content from {url}. Content: {content[:2000]}",
                },
            ],
            temperature=0,
        )

        research_data = completion.choices[0].message.content
        if not research_data:
            return

        structured_output = openai_client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": STRUCTURED_OUTPUT_PROMPT},
                {"role": "user", "content": research_data},
            ],
            response_format=MarketResearch,
        )

        research = structured_output.choices[0].message.parsed
        if research:
            supabase = get_supabase_client()
            supabase.table("citation_research").insert(
                {
                    **research.model_dump(),
                    "image_url": image_url,
                    "site_url": url,
                    "user_id": "97d82337-5d25-4258-b47f-5be8ea53114c",
                }
            ).execute()

    except Exception as e:
        print(f"Error processing citation {url[:50]}...: {e}")
    finally:
        print(f"Time taken: {time.time() - time_start} seconds")


def main():
    # Get citations from market_research_v2
    supabase = get_supabase_client()
    research = (
        supabase.table("market_research_v2")
        .select("image_url, citations")
        .execute()
        .data
    )

    # Create list of work items
    citations = [
        (r["image_url"], citation) for r in research for citation in r["citations"]
    ]

    # Use multiprocessing pool
    num_processes = min(cpu_count(), 10)  # Use at most 10 processes
    print(f"Starting pool with {num_processes} processes")

    with Pool(num_processes) as pool:
        list(
            tqdm(
                pool.imap_unordered(process_citation, citations),
                total=len(citations),
                desc="Processing citations",
            )
        )


if __name__ == "__main__":
    main()
