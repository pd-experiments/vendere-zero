import asyncio
from typing import Any, Callable, List, Awaitable, Union
from browser_worker import BrowserWorker, WorkItem
from dataclasses import dataclass


class WorkerPool:
    def __init__(self, num_workers: int = 8):
        self.workers: List[BrowserWorker] = []
        self.num_workers = num_workers
        self._next_worker = 0
        self._id = id(self)  # Use object id for hashing

    def __hash__(self) -> int:
        return self._id

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, WorkerPool):
            return NotImplemented
        return self._id == other._id

    async def initialize(self):
        for i in range(self.num_workers):
            worker = BrowserWorker(i)
            await worker.initialize()
            self.workers.append(worker)

        # Start processing queues
        self.tasks = [
            asyncio.create_task(worker.process_queue()) for worker in self.workers
        ]

    def add_work(
        self,
        url: str,
        callback: Union[
            Callable[[str, Any], None], Callable[[str, Any], Awaitable[None]]
        ],
        context: Any = None,
    ):
        # Round-robin work distribution
        worker = self.workers[self._next_worker]
        self._next_worker = (self._next_worker + 1) % self.num_workers
        worker.queue.put_nowait(WorkItem(url=url, callback=callback, context=context))

    async def wait_completion(self):
        # Wait for all queues to be empty
        await asyncio.gather(*(worker.queue.join() for worker in self.workers))

    async def shutdown(self):
        # Stop all workers
        for worker in self.workers:
            await worker.stop()
        # Cancel all tasks
        for task in self.tasks:
            task.cancel()

    def get_queue_size(self) -> int:
        """Get total number of items remaining in all worker queues"""
        return sum(worker.queue.qsize() for worker in self.workers)
