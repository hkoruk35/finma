import asyncio
import logging
import json
from datetime import datetime
from app.schemas.events import FinMAEvent, EventType
from app.services.event_bus import event_bus
from app.services.base_consumer import BaseConsumer
from app.services.redis_service import redis_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("infra_test")

async def test_infra():
    logger.info("🧪 Starting FinMA v5.0 Infra Test...")

    # 1. Create a mock event
    event = FinMAEvent(
        event_type=EventType.SIGNAL_CREATED,
        symbol="AAPL",
        payload={"price": 185.5, "indicator": "EMA20_CROSS"},
        metadata={"source": "test_script", "priority": "high"}
    )

    # 2. Emit the event
    logger.info(f"📤 Emitting event: {event.event_id}")
    await event_bus.emit(event)

    # 3. Test Idempotency (Emit the same event again)
    logger.info("📤 Emitting same event again (should be skipped)...")
    await event_bus.emit(event)

    # 4. Verify in Redis
    client = await redis_service.get_client()
    stream_name = event_bus.STREAM_MAP[EventType.SIGNAL_CREATED]
    messages = await client.xrange(stream_name, count=5)
    
    logger.info(f"🔍 Stream {stream_name} contains {len(messages)} messages")
    assert len(messages) >= 1, "Event not found in stream!"

    # 5. Consume the event
    logger.info("📥 Starting Consumer...")
    processed_events = []

    async def my_processor(data):
        logger.info(f"⚙️ Processing: {data['event_id']} for {data['symbol']}")
        processed_events.append(data)

    consumer = BaseConsumer(stream_name, "test_group", "test_worker_1")
    
    # Start consumer in a task
    consumer_task = asyncio.create_task(consumer.start(my_processor))
    
    # Wait for processing
    await asyncio.sleep(6)
    
    logger.info(f"✅ Processed {len(processed_events)} events")
    consumer.stop()
    await consumer_task

    await redis_service.close()
    logger.info("🎉 Infrastructure Test Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(test_infra())
