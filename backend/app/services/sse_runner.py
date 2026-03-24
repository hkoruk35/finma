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
            self._start_signal_consumer(),
            self._start_finma514_consumer(),
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

    async def _start_finma514_consumer(self):
        """Listen to FinMA514 scan completed stream → broadcast FINMA514_UPDATED"""
        consumer = BaseConsumer("finma:finma514_stream", "sse_group", "finma514_sse_worker")
        await consumer.start(self._broadcast_finma514)

    async def _broadcast_price(self, data: dict):
        """Callback for price data"""
        await sse_manager.broadcast("PRICE_UPDATE", data, user_id="global")

    async def _broadcast_signal(self, data: dict):
        """Callback for signal data"""
        await sse_manager.broadcast("SIGNAL_CREATED", data, user_id="global")

    async def _broadcast_finma514(self, data: dict):
        """Callback for FinMA514 scan completed event"""
        try:
            payload_str = data.get("payload", "{}")
            if isinstance(payload_str, str):
                payload = json.loads(payload_str)
            else:
                payload = payload_str
        except Exception:
            payload = data

        logger.info(
            f"FinMA514 SSE yayını: {payload.get('market_date')} "
            f"— {payload.get('stock_count', 0)} hisse"
        )
        await sse_manager.broadcast("FINMA514_UPDATED", payload, user_id="global")

# Singleton
sse_runner = SSERunner()
