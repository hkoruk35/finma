import hashlib
import json
import logging
from typing import Optional, Dict, Any
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class AICache:
    """
    Cost Optimization Engine for FinMA v5.0.
    Hashes technical setups to avoid redundant AI inference.
    """
    CACHE_PREFIX = "finma:ai_cache:"
    DEFAULT_TTL = 21600 # 6 hours

    def generate_setup_hash(self, symbol: str, technical_data: Dict[str, Any]) -> str:
        """
        Create a unique MD5 hash for a specific symbol + indicator setup.
        We only include indicators that define a 'regime' or 'pattern'.
        """
        # Select stable keys for hashing
        hash_keys = ['ema20', 'ema50', 'ema200', 'rsi', 'macd']
        stable_data = {k: technical_data.get(k) for k in hash_keys}
        
        # Add symbol and round values slightly to handle minor noise
        # e.g. RSI 56.4 and 56.5 might be considered 'the same setup'
        for k, v in stable_data.items():
            if isinstance(v, (int, float)):
                stable_data[k] = round(v, 1)

        raw_str = f"{symbol}:{json.dumps(stable_data, sort_keys=True)}"
        return hashlib.md5(raw_str.encode()).hexdigest()

    async def get_cached_analysis(self, setup_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached AI analysis if available"""
        try:
            client = await redis_service.get_client()
            cached = await client.get(f"{self.CACHE_PREFIX}{setup_hash}")
            if cached:
                logger.info(f"🎯 AI Cache Hit for hash: {setup_hash}")
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Error reading AI cache: {e}")
        return None

    async def set_cached_analysis(self, setup_hash: str, analysis: Dict[str, Any], ttl: int = DEFAULT_TTL):
        """Save AI analysis report to cache"""
        try:
            client = await redis_service.get_client()
            await client.set(
                f"{self.CACHE_PREFIX}{setup_hash}",
                json.dumps(analysis),
                ex=ttl
            )
            logger.debug(f"💾 Cached AI analysis for hash: {setup_hash}")
        except Exception as e:
            logger.error(f"Error saving AI cache: {e}")

# Singleton
ai_cache = AICache()
