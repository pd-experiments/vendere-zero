from functools import lru_cache
import time
from playwright.async_api import Browser, async_playwright
import asyncio
from typing import Optional, Callable, Any, Union, Awaitable
import os
from dataclasses import dataclass


@dataclass
class WorkItem:
    url: str
    callback: Union[Callable[[str, Any], None], Callable[[str, Any], Awaitable[None]]]
    context: Any = None


class BrowserWorker:
    def __init__(self, worker_id: int):
        self.worker_id = worker_id
        self.browser: Optional[Browser] = None
        self.queue: asyncio.Queue[WorkItem] = asyncio.Queue()
        self.running = True

    async def initialize(self):
        p = await async_playwright().start()
        # self.browser = await p.chromium.connect_over_cdp(
        #     f"wss://connect.browserbase.com?apiKey={os.getenv('BROWSERBASE_API_KEY')}"
        # )
        self.browser = await p.chromium.launch()
        print(f"Browser {self.worker_id} initialized")

    @lru_cache(maxsize=1000)
    async def extract_content(self, url: str) -> Optional[str]:
        if not self.browser:
            raise ValueError("Browser not initialized")
        page = await self.browser.new_page()
        start_time = time.time()
        try:
            await page.goto(url, wait_until="load")
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
            return content
        except Exception as e:
            print(f"Worker {self.worker_id} error extracting content from {url}: {e}")
            return None
        finally:
            end_time = time.time()
            print(
                f"Worker {self.worker_id} took {end_time - start_time} seconds to extract content from {url}"
            )
            await page.close()

    async def process_queue(self):
        while self.running:
            try:
                work_item = await self.queue.get()
                # print(f"Worker {self.worker_id} processing {work_item.url}")
                content = await self.extract_content(work_item.url)
                # print(f"Worker {self.worker_id} extracted content")
                if content:
                    if asyncio.iscoroutinefunction(work_item.callback):
                        await work_item.callback(content, work_item.context)
                        # print(
                        #     f"Worker {self.worker_id} async processed {work_item.url}"
                        # )
                    else:
                        work_item.callback(content, work_item.context)
                        # print(f"Worker {self.worker_id} sync processed {work_item.url}")
                else:
                    print(f"Worker {self.worker_id} no content for {work_item.url}")
                self.queue.task_done()
            except Exception as e:
                print(f"Worker {self.worker_id} error processing queue: {e}")

    async def stop(self):
        self.running = False
        if self.browser:
            await self.browser.close()
