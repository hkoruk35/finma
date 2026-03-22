import asyncio
import logging
import json
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class SSEManager:
    """
    Manages Server-Sent Events (SSE) for FinMA v5.0.
    Handles per-user or global broadcast queues.
    """
    def __init__(self):
        # Dictionary of user_id -> List[asyncio.Queue]
        self.user_queues: Dict[str, List[asyncio.Queue]] = {}

    async def subscribe(self, user_id: str = "global") -> asyncio.Queue:
        """Register a new subscriber and return their queue"""
        queue = asyncio.Queue()
        if user_id not in self.user_queues:
            self.user_queues[user_id] = []
        self.user_queues[user_id].append(queue)
        logger.info(f"🔌 New SSE Subscriber for user: {user_id} (Total: {len(self.user_queues[user_id])})")
        return queue

    async def unsubscribe(self, queue: asyncio.Queue, user_id: str = "global"):
        """Remove a subscriber and their queue"""
        if user_id in self.user_queues and queue in self.user_queues[user_id]:
            self.user_queues[user_id].remove(queue)
            if not self.user_queues[user_id]:
                del self.user_queues[user_id]
            logger.info(f"🔌 SSE Subscriber disconnected for user: {user_id}")

    async def broadcast(self, event_type: str, data: Any, user_id: str = "global"):
        """Broadcast an event to all subscribers of a user (or global)"""
        if user_id not in self.user_queues:
            return

        message = json.dumps({
            "type": event_type,
            "data": data,
            "timestamp": asyncio.get_event_loop().time()
        })

        # Send to all active queues for this user
        for queue in self.user_queues[user_id]:
            await queue.put(message)

# Singleton instance
sse_manager = SSEManager()
