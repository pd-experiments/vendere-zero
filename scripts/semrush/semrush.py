import asyncio
import os
from urllib.parse import urlencode
import aiohttp
import logging
import dotenv

dotenv.load_dotenv("../.env.local")

logging.basicConfig(level=logging.INFO)


async def get_organic_results(keyword: str, database: str = "us") -> list[str]:
    api_key = os.getenv("SEMRUSH_API_KEY")
    if not api_key:
        raise ValueError("SEMRUSH_API_KEY is not set")

    base_url = "https://api.semrush.com/"
    params = {
        "type": "phrase_organic",
        "key": api_key,
        "phrase": keyword,
        "database": database,
        "export_columns": "Ur",  # Just get URLs
        "display_limit": "10",  # Limit to top 10 results
    }
    url = f"{base_url}?{urlencode(params)}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if not response.ok:
                    raise ValueError(f"Semrush API error: {response.status}")

                data = await response.text()
                logging.info(data)
                # Skip header row and split into lines
                lines = data.split("\n")[1:]
                # Filter out empty lines and return URLs
                return [line.strip() for line in lines if line.strip()]
    except Exception as error:
        logging.error("Error fetching organic results: %s", error)
        return []


async def get_paid_results(keyword: str, database: str = "us") -> list[str]:
    api_key = os.getenv("SEMRUSH_API_KEY")
    if not api_key:
        raise ValueError("SEMRUSH_API_KEY is not set")

    base_url = "https://api.semrush.com/"
    params = {
        "type": "phrase_adwords",
        "key": api_key,
        "phrase": keyword,
        "database": database,
        "export_columns": "Ur",  # Just get URLs
        "display_limit": "10",  # Limit to top 10 results
    }
    url = f"{base_url}?{urlencode(params)}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if not response.ok:
                    raise ValueError(f"Semrush API error: {response.status}")

                data = await response.text()
                print(data)
                # Skip header row and split into lines
                lines = data.split("\n")[1:]
                # Filter out empty lines and return URLs
                return [line.strip() for line in lines if line.strip()]
    except Exception as error:
        logging.error("Error fetching paid results: %s", error)
        return []


if __name__ == "__main__":
    organic_results = asyncio.run(get_organic_results("python"))
    print(organic_results)
    paid_results = asyncio.run(get_paid_results("python"))
    print(paid_results)
