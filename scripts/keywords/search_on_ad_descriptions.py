from functools import lru_cache
import asyncio
from brave_search import brave_web_search
from models import (
    AdStructuredOutput,
    CombinedMarketResearch,
    GPTStructuredMarketResearch,
    MarketResearch,
    SearchQueries,
)
from playwright.async_api import async_playwright, Page
import os
import dotenv
from openai import OpenAI
from datetime import datetime
from helpers import get_supabase_client
from typing import Optional, Dict
from prompts import (
    VISUAL_AD_ANALYSIS,
    MARKET_RESEARCH_ANALYSIS,
    STRUCTURED_OUTPUT_PROMPT,
    SEARCH_QUERY_GENERATION,
    PERPLEXITY_MARKET_ANALYSIS,
)
from openai.types.chat import (
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from tenacity import retry, stop_after_attempt, wait_exponential
from worker_pool import WorkerPool
from tqdm import tqdm
import httpx

# Load environment variables
dotenv.load_dotenv("../../.env.local")

# Initialize clients

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")


def truncate_to_token_limit(text: str, max_tokens: int = 2000) -> str:
    """Truncate text to stay within token limit"""
    return text[: max_tokens * 4]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def analyze_page_content(
    url: str, content: str, query: str
) -> MarketResearch | None:
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    """Analyze page content using GPT-4 and return structured market research"""

    completion = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": MARKET_RESEARCH_ANALYSIS},
            {
                "role": "user",
                "content": f"""Analyze this content from {url} for the search 
            query "{query}". Content: {content}""",
            },
        ],
        temperature=0.7,
        seed=42,
    )

    research_data = completion.choices[0].message.content

    if not research_data:
        raise ValueError("No research data found")

    structured_output = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": STRUCTURED_OUTPUT_PROMPT},
            {"role": "user", "content": research_data},
        ],
        response_format=MarketResearch,
    )

    return structured_output.choices[0].message.parsed


@lru_cache(maxsize=1000)
async def process_content_cached(
    url: str, query: str, image_url: str, content: str
) -> None:
    """Cached version of content processing"""
    try:
        research = await analyze_page_content(
            url, truncate_to_token_limit(content, 500), query
        )
        if research:
            supabase = get_supabase_client()
            supabase.table("market_research").insert(
                {
                    **research.model_dump(),
                    "image_url": image_url,
                    "site_url": url,
                }
            ).execute()
    except Exception as e:
        print(f"Error processing content for {url}: {e}")


async def process_content(content: str, context: Dict):
    """Callback function that uses the cached version"""
    await process_content_cached(
        context["url"], context["query"], context["image_url"], content
    )


@lru_cache(maxsize=1000)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def search_on_ad_descriptions(
    query: str, image_url: str, worker_pool: WorkerPool
):
    """Search and analyze pages for market research using worker pool"""
    results = await brave_web_search(query, 2)

    for result in results.web.results:
        context = {"query": query, "image_url": image_url, "url": result.url}
        worker_pool.add_work(result.url, process_content, context)


@lru_cache(maxsize=1000)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def get_perplexity_insights(description: str) -> tuple[str, list[str]]:
    """Get market insights from Perplexity with citations"""
    # print(f"Getting perp insights for {description[:20]}...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            payload = {
                "model": "sonar",
                "messages": [
                    {
                        "role": "system",
                        "content": PERPLEXITY_MARKET_ANALYSIS,
                    },
                    {"role": "user", "content": description[:2000]},
                ],
                "max_tokens": 2048,
                "temperature": 0,
                "return_citations": True,
            }
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

            if response.status_code != 200:
                print(f"Error response: {response.text}")
                response.raise_for_status()

            data = response.json()

            if "choices" not in data or not data["choices"]:
                raise ValueError(f"Invalid response format: {data}")

            content = data["choices"][0]["message"].get("content", "")
            citations: list[str] = data.get("citations", [])

            if not content:
                raise ValueError("Empty content in response")

            return content, citations

        except httpx.HTTPError as e:
            print(f"HTTP Error: {str(e)}")
            print(
                f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}"
            )
            raise
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            print(f"Error type: {type(e)}")
            raise


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def summarize_ad(ad: AdStructuredOutput) -> str | None:
    if ad.image_description:
        return ad.image_description
    if not ad.image_url:
        raise ValueError("Image URL is required")

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    completion = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": VISUAL_AD_ANALYSIS},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Provide a detailed visual analysis of this ad. Focus on how the visual elements work together to achieve marketing goals.",
                    },
                    {"type": "image_url", "image_url": {"url": ad.image_url}},
                ],
            },
        ],
        max_tokens=1024,
    )

    return completion.choices[0].message.content


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
async def generate_search_queries(ad: AdStructuredOutput) -> list[str]:
    if not ad.image_description:
        raise ValueError("Ad description is required")

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    completion = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SEARCH_QUERY_GENERATION},
            {"role": "user", "content": ad.image_description},
        ],
        response_format=SearchQueries,
    )

    obj = completion.choices[0].message.parsed
    if obj is None:
        print("No search queries found")
        return []
    return obj.queries


async def process_ad(ad: AdStructuredOutput) -> None:
    """Process a single ad through the pipeline"""
    supabase = get_supabase_client()

    # Get or generate ad summary
    summary = await summarize_ad(ad)
    if summary != ad.image_description:
        supabase.table("ad_structured_output").update(
            {"image_description": summary}
        ).eq("image_url", ad.image_url).execute()

    # Get market insights from Perplexity
    if summary:
        insights, citations = await get_perplexity_insights(summary)

    # Structure the insights using GPT-4
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    structured_output = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": STRUCTURED_OUTPUT_PROMPT},
            {"role": "user", "content": insights},
        ],
        response_format=GPTStructuredMarketResearch,
    )

    research = structured_output.choices[0].message.parsed
    if research:
        # Save to market_research_v2 table
        supabase.table("market_research_v2").insert(
            {
                **research.model_dump(),
                "image_url": ad.image_url,
                "citations": citations,
                "perplexity_insights": insights,
                "user_id": "97d82337-5d25-4258-b47f-5be8ea53114c",
            }
        ).execute()


async def pipeline():
    """Main pipeline to process all ads with concurrent workers"""
    supabase = get_supabase_client()
    ads = (
        supabase.table("ad_structured_output")
        .select("*")
        .eq("user", "97d82337-5d25-4258-b47f-5be8ea53114c")
        .execute()
        .data
    )

    # Create a queue for ads
    queue = asyncio.Queue()
    for ad in ads:
        queue.put_nowait(ad)

    async def worker(worker_id: int):
        while True:
            try:
                # Get ad from queue
                ad = await queue.get()
                try:
                    # print(
                    #     f"Worker {worker_id} processing ad {ad.get('image_url')[:20]}..."
                    # )
                    ad_obj = AdStructuredOutput.model_validate(ad)
                    await process_ad(ad_obj)
                except Exception as e:
                    print(
                        f"Worker {worker_id} error processing ad {ad.get('image_url')[:20]}...: {e}"
                    )
                finally:
                    queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Worker {worker_id} unexpected error: {e}")

    # Create progress bar
    pbar = tqdm(total=len(ads), desc="Processing ads")

    # Start workers
    num_workers = 8
    workers = [asyncio.create_task(worker(i)) for i in range(num_workers)]

    # Monitor progress
    async def update_progress():
        last_size = queue.qsize()
        while not queue.empty():
            current_size = queue.qsize()
            if current_size != last_size:
                pbar.update(last_size - current_size)
                last_size = current_size
            await asyncio.sleep(0.1)
        pbar.update(last_size)  # Update remaining

    progress_task = asyncio.create_task(update_progress())

    try:
        # Wait for all ads to be processed
        await queue.join()
    finally:
        # Cancel workers and progress monitor
        for w in workers:
            w.cancel()
        progress_task.cancel()

        # Wait for workers to finish
        await asyncio.gather(*workers, return_exceptions=True)
        pbar.close()


if __name__ == "__main__":
    asyncio.run(pipeline())
