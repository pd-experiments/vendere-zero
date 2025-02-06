from functools import lru_cache
import asyncio
from brave_search import brave_web_search
from models import CombinedMarketResearch, GoogleAd, MarketResearch, SearchQueries
from playwright.async_api import async_playwright, Page
import os
import dotenv
from openai import OpenAI
from datetime import datetime
from helpers import get_supabase_client
from typing import Optional
from prompts import (
    VISUAL_AD_ANALYSIS,
    MARKET_RESEARCH_ANALYSIS,
    STRUCTURED_OUTPUT_PROMPT,
    SEARCH_QUERY_GENERATION,
)
from openai.types.chat import (
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

# Load environment variables
dotenv.load_dotenv("../../.env.local")

# Initialize clients


def truncate_to_token_limit(text: str, max_tokens: int = 2000) -> str:
    """Truncate text to stay within token limit"""
    return text[: max_tokens * 4]


async def extract_page_content(page: Page) -> Optional[str]:
    """Extract main content from page, avoiding navigation and footer"""
    try:
        # Remove script tags, style tags, and nav elements
        await page.evaluate(
            """() => {
            const elements = document.querySelectorAll('script, style, nav, footer, header');
            elements.forEach(el => el.remove());
        }"""
        )

        # Get main content
        content = await page.evaluate(
            """() => {
            const main = document.querySelector('main') || document.querySelector('article') || document.body;
            return main.innerText;
        }"""
        )

        return truncate_to_token_limit(content)
    except Exception as e:
        print(f"Error extracting content: {e}")
        return None


@lru_cache(maxsize=1000)
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
async def search_on_ad_descriptions(
    query: str, advertisement_url: str, ad_description: str | None
):
    """Search and analyze pages for market research"""
    # Get search results
    results = await brave_web_search(query, 1)
    research_results = []

    for idx, result in enumerate(results.web.results):
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(
                "wss://connect.browserbase.com?apiKey="
                + os.getenv("BROWSERBASE_API_KEY", "")
            )
            page = await browser.new_page()
            try:
                await page.goto(result.url, wait_until="load")
                content = await extract_page_content(page)

                if content:
                    research = await analyze_page_content(result.url, content, query)
                    if research is None:
                        raise ValueError("No research data found")
                    research_results.append(research)

                    # Save to Supabase
                    supabase = get_supabase_client()
                    supabase.table("market_research").insert(
                        {
                            **research.model_dump(),
                            "advertisement_url": advertisement_url,
                            "ad_description": ad_description,
                        }
                    ).execute()

            except Exception as e:
                print(
                    f"Error processing {idx} of {len(results.web.results)}: {result.url}: {e}"
                )
            finally:
                await page.close()
                await browser.close()

    return research_results


async def summarize_ad(ad: GoogleAd) -> str | None:
    if ad.ad_description:
        return ad.ad_description
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
                        "text": f"Provide a detailed visual analysis of this ad from {ad.advertiser_name}. Focus on how the visual elements work together to achieve marketing goals.",
                    },
                    {"type": "image_url", "image_url": {"url": ad.image_url}},
                ],
            },
        ],
        max_tokens=1024,
    )

    return completion.choices[0].message.content


async def generate_search_queries(ad: GoogleAd) -> list[str]:
    if not ad.ad_description:
        raise ValueError("Ad description is required")

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    completion = openai_client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SEARCH_QUERY_GENERATION},
            {"role": "user", "content": ad.ad_description},
        ],
        response_format=SearchQueries,
    )

    obj = completion.choices[0].message.parsed
    if obj is None:
        print("No search queries found")
        return []
    return obj.queries


async def pipeline():
    supabase = get_supabase_client()
    ads = supabase.table("google_image_ads").select("*").execute().data
    for ad in ads[:1]:
        google_ad = GoogleAd.model_validate(ad)
        summary = await summarize_ad(google_ad)
        google_ad.ad_description = summary
        supabase.table("google_image_ads").update({"ad_description": summary}).eq(
            "advertisement_url", google_ad.advertisement_url
        ).execute()
        search_queries = await generate_search_queries(google_ad)
        print("search_queries", search_queries)
        for query in search_queries[:1]:
            research = await search_on_ad_descriptions(
                query, google_ad.advertisement_url, google_ad.ad_description
            )


if __name__ == "__main__":
    asyncio.run(pipeline())
