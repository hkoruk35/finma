import logging
import psutil
from typing import Dict, Any, List
from app.services.redis_service import redis_service

logger = logging.getLogger(__name__)

class ResilienceService:
    """
    Self-Healing Engine for FinMA v5.0.
    Protects the system from overload and manages state recovery.
    """
    CPU_THRESHOLD = 85.0
    RAM_THRESHOLD = 90.0
    SNAPSHOT_PREFIX = "finma:snapshot:"

    def get_system_health(self) -> Dict[str, Any]:
        """Check CPU, RAM and and Redis health"""
        cpu = psutil.cpu_percent()
        ram = psutil.virtual_memory().percent
        
        status = "healthy"
        if cpu > self.CPU_THRESHOLD or ram > self.RAM_THRESHOLD:
            status = "strained"
            
        return {
            "status": status,
            "cpu": cpu,
            "ram": ram,
            "degradation_required": status == "strained"
        }

    async def should_downgrade_ai(self) -> bool:
        """
        Decision point for Graceful Degradation.
        If True, Tier 2 (Deep Analysis) should be bypassed.
        """
        health = self.get_system_health()
        if health["degradation_required"]:
            logger.warning("🚨 [Backpressure] System strained (CPU: %.1f%%). Degrading AI depth.", health['cpu'])
            return True
        return False

    async def create_snapshot(self, key: str, state: Dict[str, Any]):
        """Save a state snapshot to Redis for recovery"""
        try:
            client = await redis_service.get_client()
            import json
            await client.set(f"{self.SNAPSHOT_PREFIX}{key}", json.dumps(state), ex=3600) # 1 hour TTL
            logger.info("💾 State snapshot created for: %s", key)
        except Exception as e:
            logger.error("Error creating snapshot: %s", e)

    async def recover_state(self, key: str) -> Optional[Dict[str, Any]]:
        """Recover state from latest snapshot"""
        try:
            client = await redis_service.get_client()
            data = await client.get(f"{self.SNAPSHOT_PREFIX}{key}")
            if data:
                import json
                return json.loads(data)
        except Exception as e:
            logger.error("Error recovering state: %s", e)
        return None

# Singleton
resilience_service = ResilienceService()
