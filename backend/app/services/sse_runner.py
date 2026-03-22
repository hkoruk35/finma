import asyncio
import logging
import json
from app.services.base_consumer import BaseConsumer
from app.services.sse_manager import sse_manager
from app.schemas.events import EventType

logger = logging.getLogger(__name__)

class SSERunner:
    """
    Bridge between Redis Streams and SSE Broadcasts.
    Listens to ALL production streams and pushes to connected users.
    """
    def __init__(self):
        self.consumers = []

    async def start(self):
        """
        Start parallel consumers for different streams
        """
        tasks = [
            self._start_price_consumer(),
            self._start_signal_consumer()
        ]
        await asyncio.gather(*tasks)

    async def _start_price_consumer(self):
        """Listen to Price Stream and broadcast to everyone"""
        consumer = BaseConsumer("finma:price_stream", "sse_group", "price_sse_worker")
        await consumer.start(self._broadcast_price)

    async def _start_signal_consumer(self):
        """Listen to Signal Stream and broadcast to everyone (or specific users)"""
        consumer = BaseConsumer("finma:signal_stream", "sse_group", "signal_sse_worker")
        await consumer.start(self._broadcast_signal)

    async def _broadcast_price(self, data: dict):
        """Callback for price data"""
        await sse_manager.broadcast("PRICE_UPDATE", data, user_id="global")

    async def _broadcast_signal(self, data: dict):
        """Callback for signal data"""
        # Future: Use metadata.tenant_id or user_id for targeted broadcast
        await sse_manager.broadcast("SIGNAL_CREATED", data, user_id="global")

# Singleton
sse_runner = SSERunner()
