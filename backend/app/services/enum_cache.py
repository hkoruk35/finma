"""
FinMA V6+ Enum Translation Cache Service
3-Tier caching strategy for enum translations:
  L1: In-memory dict (app startup, <1ms)
  L2: Redis cache (24h TTL, <10ms)
  L3: Supabase DB (persistent, >100ms, fallback only)

Usage:
  cache = EnumTranslationCache(redis_client, supabase_client)
  await cache.init()  # Load all translations at startup
  value = cache.translate_enum('sector_key', 'tech', 'es')  # "Tecnología"
"""

import json
import logging
from typing import Optional, Dict, Any
import asyncio

logger = logging.getLogger(__name__)

class EnumTranslationCache:
    def __init__(self, redis_client=None, supabase_client=None):
        """Initialize cache with Redis and Supabase clients

        Args:
            redis_client: redis.Redis instance (optional)
            supabase_client: supabase.Client instance (optional)
        """
        self.redis = redis_client
        self.supabase = supabase_client
        self.memory_cache: Dict[str, str] = {}  # L1: In-memory
        self._initialized = False

    async def init(self) -> bool:
        """Initialize L1 and L2 caches at app startup

        Returns:
            True if successful, False otherwise
        """
        try:
            await self.get_all_translations()
            self._initialized = True
            logger.info(f"✅ EnumTranslationCache initialized with {len(self.memory_cache)} entries")
            return True
        except Exception as e:
            logger.error(f"❌ EnumTranslationCache init failed: {e}")
            return False

    async def get_all_translations(self) -> Dict[str, str]:
        """Load ALL enum_translations into memory at startup

        Priority:
          1. L1 (memory) - already loaded
          2. L2 (Redis) - check cached dump
          3. L3 (Supabase) - full database query

        Returns:
            Dictionary of all translations: {enum_type:enum_key:language} → display_value
        """
        # If already in memory, return immediately
        if self.memory_cache:
            return self.memory_cache

        # Try Redis (L2)
        if self.redis:
            try:
                cached = self.redis.get('enum:all:translations')
                if cached:
                    self.memory_cache = json.loads(cached)
                    logger.info(f"L2 cache hit: Loaded {len(self.memory_cache)} from Redis")
                    return self.memory_cache
            except Exception as e:
                logger.debug(f"L2 cache miss: {e}")

        # Fallback to Supabase (L3)
        translations = await self._query_db_all_translations()
        self.memory_cache = translations

        # Store in Redis for next time (24h TTL)
        if self.redis and self.memory_cache:
            try:
                self.redis.setex(
                    'enum:all:translations',
                    86400,  # 24 hours
                    json.dumps(self.memory_cache)
                )
                logger.debug(f"L2 cache written: {len(self.memory_cache)} entries")
            except Exception as e:
                logger.warning(f"Failed to write L2 cache: {e}")

        return self.memory_cache

    def translate_enum(
        self,
        enum_type: str,
        enum_key: str,
        lang: str = 'tr'
    ) -> str:
        """Fast enum translation with 3-tier fallback

        Args:
            enum_type: Type of enum (e.g., 'sector_key', 'daily_scores_tier')
            enum_key: Enum key (e.g., 'tech', 'strong')
            lang: Language code (e.g., 'tr', 'en', 'es')

        Returns:
            Display value in specified language, or enum_key if not found
        """
        lookup_key = f"{enum_type}:{enum_key}:{lang}"

        # L1: Memory cache (0 latency) - FASTEST
        if lookup_key in self.memory_cache:
            return self.memory_cache[lookup_key]

        # L2: Redis cache (10-50ms)
        if self.redis:
            try:
                redis_result = self.redis.get(f"enum:{lookup_key}")
                if redis_result:
                    value = redis_result if isinstance(redis_result, str) else redis_result.decode()
                    self.memory_cache[lookup_key] = value  # Refresh L1
                    return value
            except Exception as e:
                logger.debug(f"L2 cache lookup failed for {lookup_key}: {e}")

        # L3: Database query (100ms+) - SLOWEST, should be rare
        try:
            value = self._query_db_single_sync(enum_type, enum_key, lang)
            if value:
                self.memory_cache[lookup_key] = value
                # Update Redis for future use
                if self.redis:
                    try:
                        self.redis.setex(f"enum:{lookup_key}", 86400, value)
                    except Exception:
                        pass
                return value
        except Exception as e:
            logger.debug(f"L3 cache lookup failed for {lookup_key}: {e}")

        # Fallback: Return enum_key if no translation found
        logger.warning(f"Translation not found: {lookup_key}")
        return enum_key

    def _query_db_single_sync(
        self,
        enum_type: str,
        enum_key: str,
        lang: str
    ) -> Optional[str]:
        """Synchronous database query for a single translation

        Only called when cache misses, so performance here is acceptable
        """
        if not self.supabase:
            return None

        try:
            result = (
                self.supabase.table('enum_translations')
                .select('display_value')
                .eq('enum_type', enum_type)
                .eq('enum_key', enum_key)
                .eq('language', lang)
                .single()
                .execute()
            )
            if result.data:
                return result.data.get('display_value')
        except Exception as e:
            logger.debug(f"Supabase query failed: {e}")

        return None

    async def _query_db_all_translations(self) -> Dict[str, str]:
        """Asynchronous full database query for all translations

        Called during initialization to populate L1 and L2 caches
        """
        if not self.supabase:
            logger.warning("Supabase client not available for enum cache initialization")
            return {}

        try:
            result = self.supabase.table('enum_translations').select('*').execute()
            translations = {}
            for row in result.data:
                key = f"{row['enum_type']}:{row['enum_key']}:{row['language']}"
                translations[key] = row['display_value']

            logger.info(f"Loaded {len(translations)} translations from Supabase")
            return translations
        except Exception as e:
            logger.error(f"Failed to load translations from Supabase: {e}")
            return {}

    def invalidate_cache(self) -> None:
        """Clear all caches after enum_translations table is updated

        Called when translations are updated in the database
        """
        try:
            # Clear L1
            self.memory_cache.clear()

            # Clear L2
            if self.redis:
                self.redis.delete('enum:all:translations')
                # Clear individual keys too
                keys = self.redis.keys('enum:*')
                if keys:
                    self.redis.delete(*keys)

            logger.info("Enum translation caches invalidated")
        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring

        Returns:
            Dictionary with cache info
        """
        return {
            'l1_size': len(self.memory_cache),
            'l1_initialized': self._initialized,
            'l2_available': self.redis is not None,
            'l3_available': self.supabase is not None,
        }


# Global cache instance (initialized at app startup)
_enum_cache: Optional[EnumTranslationCache] = None


def get_enum_cache() -> Optional[EnumTranslationCache]:
    """Get global enum translation cache instance"""
    return _enum_cache


def set_enum_cache(cache: EnumTranslationCache) -> None:
    """Set global enum translation cache instance (called at app startup)"""
    global _enum_cache
    _enum_cache = cache
