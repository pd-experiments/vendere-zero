import asyncio
from typing import Optional
from openai import OpenAI
import os
from helpers import get_supabase_client
from models import MarketResearch
from worker_pool import WorkerPool
from prompts import MARKET_RESEARCH_ANALYSIS, STRUCTURED_OUTPUT_PROMPT
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm
import dotenv

# Load environment variables
dotenv.load_dotenv("../../.env.local")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def analyze_citation_content(url: str, content: str) -> Optional[MarketResearch]:
    """Analyze citation content using GPT-4 and return structured research"""
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
        return None

    structured_output = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": STRUCTURED_OUTPUT_PROMPT},
            {"role": "user", "content": research_data},
        ],
        response_format=MarketResearch,
    )

    return structured_output.choices[0].message.parsed


async def process_citation(content: str, context: dict):
    """Process extracted content from citation"""
    try:
        research = await analyze_citation_content(context["url"], content)
        if research:
            supabase = get_supabase_client()
            supabase.table("citation_research").insert(
                {
                    **research.model_dump(),
                    "image_url": context["image_url"],
                    "site_url": context["url"],
                    "user_id": "97d82337-5d25-4258-b47f-5be8ea53114c",
                }
            ).execute()
    except Exception as e:
        print(f"Error processing citation {context['url'][:50]}...: {e}")


async def main():
    worker_pool = WorkerPool(8)
    await worker_pool.initialize()

    try:
        supabase = get_supabase_client()
        research = (
            supabase.table("market_research_v2")
            .select("image_url, citations")
            .execute()
            .data
        )

        url_citation_pairs = [
            (r["image_url"], citation) for r in research for citation in r["citations"]
        ]

        # Add work to queue
        for image_url, citation in url_citation_pairs:
            context = {
                "url": citation,
                "image_url": image_url,
            }
            worker_pool.add_work(citation, process_citation, context)

        # Create progress bar and monitor completion
        with tqdm(total=len(url_citation_pairs), desc="Processing citations") as pbar:
            total_remaining = worker_pool.get_queue_size()
            while total_remaining > 0:
                await asyncio.sleep(0.1)
                new_remaining = worker_pool.get_queue_size()
                if new_remaining < total_remaining:
                    pbar.update(total_remaining - new_remaining)
                total_remaining = new_remaining

        await worker_pool.wait_completion()

    finally:
        await worker_pool.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
