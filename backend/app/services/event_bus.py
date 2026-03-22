import logging
import json
import time
from typing import Optional, Dict, Any
from app.schemas.events import FinMAEvent, EventType
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class EventBus:
    """
    The central event distribution engine for FinMA v5.0.
    Handles partitioning, idempotency, and reliability.
    """

    # Stream Partition Map
    STREAM_MAP = {
        EventType.PRICE_UPDATE: "finma:price_stream",
        EventType.SIGNAL_CREATED: "finma:signal_stream",
        EventType.AI_ANALYSIS_READY: "finma:ai_stream",
        EventType.POSITION_UPDATED: "finma:position_stream",
        EventType.SYSTEM_ALERT: "finma:alert_stream"
    }

    DLQ_STREAM = "finma:dlq_stream"
    IDEMPOTENCY_KEY_PREFIX = "finma:processed_events:"

    async def emit(self, event: FinMAEvent):
        """
        Emit an event with idempotency check and partitioned routing.
        """
        try:
            client = await redis_service.get_client()

            # 1. Idempotency Check (Distributed Lock/Set)
            # Use SET NX with TTL to avoid duplicate processing of the same event_id
            idempotency_key = f"{self.IDEMPOTENCY_KEY_PREFIX}{event.event_id}"
            is_new = await client.set(idempotency_key, "1", nx=True, ex=3600) # 1 hour TTL
            
            if not is_new:
                logger.debug(f"⚠️ Duplicate event detected: {event.event_id} - Skipping")
                return

            # 2. Routing Logic (Partitioning)
            # Future: Could add per-symbol partitioning here e.g. stream:TSLA
            stream_name = self.STREAM_MAP.get(event.event_type, "finma:general_stream")

            # 3. Publish to Redis Stream
            # We use the flat dict for XADD
            event_dict = event.dict()
            event_dict['payload'] = json.dumps(event_dict['payload'])
            event_dict['metadata'] = json.dumps(event_dict['metadata'])
            
            await client.xadd(stream_name, event_dict)
            logger.debug(f"✅ Event {event.event_id} emitted to {stream_name}")

        except Exception as e:
            logger.error(f"❌ Failed to emit event {event.event_id}: {e}")
            await self._send_to_dlq(event, str(e))

    async def _send_to_dlq(self, event: FinMAEvent, error_msg: str):
        """Redirect failed events to the Dead Letter Queue"""
        try:
            client = await redis_service.get_client()
            payload = event.dict()
            payload['error'] = error_msg
            payload['failed_at'] = time.time()
            
            # Flatten to JSON for DLQ
            await client.xadd(self.DLQ_STREAM, {"data": json.dumps(payload)})
            logger.warning(f"🚑 Event {event.event_id} moved to DLQ due to: {error_msg}")
        except Exception as dlq_e:
            logger.critical(f"🚨 CRITICAL: Failed to write to DLQ: {dlq_e}. Event data might be lost: {event.event_id}")

# Singleton
event_bus = EventBus()
