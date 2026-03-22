import logging
import json
from typing import Optional, Any, Dict, List
import redis.asyncio as redis
from app.config import get_settings

logger = logging.getLogger(__name__)

class RedisService:
    """
    Centralized Redis Service for FinMA v5.0.
    Handles connections, streams, and caching.
    """
    _instance: Optional['RedisService'] = None
    _client: Optional[redis.Redis] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisService, cls).__new__(cls)
        return cls._instance

    async def get_client(self) -> redis.Redis:
        """Get or create the Redis client"""
        if self._client is None:
            settings = get_settings()
            if not settings.redis_url:
                logger.error("❌ Redis URL is not configured")
                raise ValueError("Redis URL is missing")
            
            try:
                self._client = redis.from_url(
                    settings.redis_url, 
                    decode_responses=True,
                    socket_timeout=5,
                    retry_on_timeout=True
                )
                await self._client.ping()
                logger.info("✅ Connected to Redis successfully")
            except Exception as e:
                logger.error(f"❌ Failed to connect to Redis: {e}")
                raise
        return self._client

    async def publish_event(self, stream_name: str, event_data: Dict[str, Any]):
        """Publish an event to a Redis Stream (XADD)"""
        try:
            client = await self.get_client()
            # Redis Streams expect string keys/values or a flat dict
            # We convert the entire event to a JSON string under the 'data' key
            await client.xadd(stream_name, {"data": json.dumps(event_data)})
        except Exception as e:
            logger.error(f"❌ Failed to publish event to {stream_name}: {e}")

    async def create_consumer_group(self, stream_name: str, group_name: str):
        """Create a consumer group if it doesn't exist (XGROUP CREATE)"""
        try:
            client = await self.get_client()
            await client.xgroup_create(stream_name, group_name, id="0", mkstream=True)
            logger.info(f"✅ Consumer group {group_name} created for stream {stream_name}")
        except redis.exceptions.ResponseError as e:
            if "already exists" in str(e).lower():
                pass # Already exists, ignore
            else:
                logger.error(f"❌ Error creating consumer group: {e}")

    async def close(self):
        """Close the Redis connection"""
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("📡 Redis connection closed")

# Singleton instance
redis_service = RedisService()
