from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional
from uuid import uuid4
from datetime import datetime
from enum import Enum

class EventType(str, Enum):
    PRICE_UPDATE = "PRICE_UPDATE"
    SIGNAL_CREATED = "SIGNAL_CREATED"
    AI_ANALYSIS_READY = "AI_ANALYSIS_READY"
    POSITION_UPDATED = "POSITION_UPDATED"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    FINMA514_UPDATED = "FINMA514_UPDATED"   # FinMA514 yeni tarama tamamlandı

class EventMetadata(BaseModel):
    priority: str = "medium" # low, medium, high
    source: str = "finma_core"
    tenant_id: str = "default"
    client_id: Optional[str] = None

class FinMAEvent(BaseModel):
    """
    FinMA v5.0 Master Event Schema.
    Ensures versioning, structure and idempotency.
    """
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_version: str = "1.0"
    event_type: EventType
    symbol: str
    timestamp: float = Field(default_factory=lambda: datetime.utcnow().timestamp())
    payload: Dict[str, Any] = Field(default_factory=dict)
    metadata: EventMetadata = Field(default_factory=EventMetadata)

    @validator('symbol')
    def uppercase_symbol(cls, v):
        return v.upper()

    def to_redis_dict(self) -> Dict[str, str]:
        """Convert the event to a flat dictionary for Redis XADD"""
        return {
            "event_id": self.event_id,
            "event_version": self.event_version,
            "event_type": self.event_type.value,
            "symbol": self.symbol,
            "timestamp": str(self.timestamp),
            "payload": json.dumps(self.payload),
            "metadata": self.metadata.json()
        }

import json
