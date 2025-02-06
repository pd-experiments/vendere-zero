from functools import lru_cache
import time
import httpx
from typing import Optional, Callable, Any, Union, Awaitable
import asyncio
from dataclasses import dataclass
from bs4 import BeautifulSoup


@dataclass
class WorkItem:
    url: str
    callback: Union[Callable[[str, Any], None], Callable[[str, Any], Awaitable[None]]]
    context: Any = None


class BrowserWorker:
    def __init__(self, worker_id: int):
        self.worker_id = worker_id
        self.queue: asyncio.Queue[WorkItem] = asyncio.Queue()
        self.running = True
        self.client = httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            },
        )

    async def initialize(self):
        print(f"Worker {self.worker_id} initialized")

    @lru_cache(maxsize=1000)
    async def extract_content(self, url: str) -> Optional[str]:
        start_time = time.time()
        retries = 2
        try:
            response = await self.client.get(url)
            response.raise_for_status()

            for attempt in range(retries):
                # Parse with BeautifulSoup
                soup = BeautifulSoup(response.text, "html.parser")

                # Remove unwanted elements
                for tag in soup(
                    ["script", "style", "nav", "footer", "header", "iframe", "noscript"]
                ):
                    tag.decompose()

                # Get main content
                main = soup.find("main") or soup.find("article") or soup.find("body")
                if not main:
                    return None

                # Extract text content
                text = " ".join(main.stripped_strings)
                if len(text.strip()) > 100:  # Check if we got meaningful content
                    return text

                # If content is too short, wait and retry
                if attempt < retries - 1:
                    await asyncio.sleep(1)
                    response = await self.client.get(url)
                    response.raise_for_status()

            return None  # Return None if we couldn't get meaningful content

        except Exception as e:
            print(f"Worker {self.worker_id} error extracting content from {url}: {e}")
            return None

        finally:
            duration = time.time() - start_time
            if duration > 3:
                print(
                    f"Warning: Worker {self.worker_id} took {duration:.2f}s to extract content from {url}"
                )

    async def process_queue(self):
        while self.running:
            try:
                work_item = await self.queue.get()
                content = await self.extract_content(work_item.url)
                if content:
                    if asyncio.iscoroutinefunction(work_item.callback):
                        await work_item.callback(content, work_item.context)
                    else:
                        work_item.callback(content, work_item.context)
                else:
                    print(f"Worker {self.worker_id} no content for {work_item.url}")
                self.queue.task_done()
            except Exception as e:
                print(f"Worker {self.worker_id} error processing queue: {e}")

    async def stop(self):
        self.running = False
        await self.client.aclose()
