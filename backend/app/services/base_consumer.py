import logging
import asyncio
import json
import time
from typing import Optional, List, Any, Dict, Callable
import redis.asyncio as redis
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class BaseConsumer:
    """
    Standard Base Consumer for FinMA v5.0 Redis Streams.
    Handles Consumer Groups, ACK, and Pending message recovery.
    """
    def __init__(self, stream_name: str, group_name: str, consumer_name: str):
        self.stream_name = stream_name
        self.group_name = group_name
        self.consumer_name = consumer_name
        self.is_running = False

    async def start(self, process_callback: Callable[[Dict[str, Any]], Any]):
        """
        Start the consumption loop.
        - group creation
        - auto-claim for pending messages
        - blocking read loop
        """
        self.is_running = True
        logger.info(f"🚀 Starting consumer {self.consumer_name} on {self.stream_name} (Group: {self.group_name})")
        
        # 1. Ensure Consumer Group exists
        await redis_service.create_consumer_group(self.stream_name, self.group_name)
        
        client = await redis_service.get_client()

        while self.is_running:
            try:
                # 2. XAUTOCLAIM: Recover messages that are stuck in PENDING state (e.g. from crashed workers)
                # Claim messages older than 30 seconds
                await self._recover_pending_messages(client, process_callback)

                # 3. XREADGROUP: Read new messages (blocking for 5 seconds)
                # Using '>' means only new messages that haven't been delivered to any consumer in the group
                response = await client.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_name: ">"},
                    count=5,
                    block=5000
                )

                if response:
                    for stream, messages in response:
                        for msg_id, data in messages:
                            await self._handle_message(client, msg_id, data, process_callback)

            except Exception as e:
                logger.error(f"❌ Error in consumer {self.consumer_name} loop: {e}")
                await asyncio.sleep(1) # Backoff in case of error

    async def _handle_message(self, client: redis.Redis, msg_id: str, data: Dict[str, Any], callback: Callable):
        """Process a single message and ACK it"""
        try:
            # Parse data from 'data' field (JSON string) or raw fields
            event_data = data
            if "data" in data:
                event_data = json.loads(data["data"])
            
            # Execute business logic callback
            await callback(event_data)
            
            # XACK: Acknowledge the message so it's removed from PEL (Pending Entires List)
            await client.xack(self.stream_name, self.group_name, msg_id)
            logger.debug(f"✅ Message {msg_id} ACKed by {self.consumer_name}")
            
        except Exception as e:
            logger.error(f"❌ Failed to process message {msg_id}: {e}")
            # Note: We do NOT ACK if it fails. It will stay in PENDING list and XAUTOCLAIM will pick it up or it can be DLQed.

    async def _recover_pending_messages(self, client: redis.Redis, callback: Callable):
        """Auto-claim stalled messages from other consumers or previous crashes"""
        try:
            # XAUTOCLAIM stream group consumer min-idle-time start [COUNT count]
            # Claims messages that have been in PENDING state for > 60 seconds
            claimed = await client.xautoclaim(
                self.stream_name, self.group_name, self.consumer_name, 
                min_idle_time=60000, start_id="0-0", count=5
            )
            # claimed[1] contains the list of messages id, data
            if claimed and len(claimed) > 1 and claimed[1]:
                logger.info(f"🚑 Recovered {len(claimed[1])} stalled messages from PEL")
                for msg_id, data in claimed[1]:
                    await self._handle_message(client, msg_id, data, callback)
        except Exception as e:
            logger.warning(f"⚠️ XAUTOCLAIM failed: {e}")

    def stop(self):
        self.is_running = False
        logger.info(f"🛑 Stopping consumer {self.consumer_name}")
