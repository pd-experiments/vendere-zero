import os
from urllib.parse import urlencode
import aiohttp
import logging
import dotenv
import asyncio
from models import BraveWebSearchResponse

# Load environment variables
dotenv.load_dotenv("../.env.local")

# Configure logging
logging.basicConfig(level=logging.INFO)


async def brave_web_search(query: str, count: int = 5) -> BraveWebSearchResponse:
    """
    Performs web searches using Brave's Search API

    Args:
        query: The search query string p
        count: Number of results to return (default: 5)

    Returns:
        BraveWebSearchResponse containing web search results from Brave API

    Raises:
        ValueError: If API key is missing or API request fails
    """
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        raise ValueError("BRAVE_API_KEY is not set")

    params = {"q": query, "count": str(count)}
    url = f"https://api.search.brave.com/res/v1/web/search?{urlencode(params)}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers={"Accept": "application/json", "X-Subscription-Token": api_key},
            ) as response:
                if not response.ok:
                    raise ValueError(
                        f"Brave Search API error: {response.status} {response.reason}"
                    )

                data = await response.json()
                return BraveWebSearchResponse.model_validate(data)

    except Exception as error:
        logging.error("Error in brave web search: %s", error)
        raise


if __name__ == "__main__":

    async def main():
        # Test web search
        web_results = await brave_web_search("women's running shoes", 10)
        print("Web Search Results:")
        print(web_results.model_dump_json(indent=2))

    asyncio.run(main())
