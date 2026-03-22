import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SaaSService:
    """
    Monetization Engine for FinMA v5.0.
    Manages tiers, entitlements, and add-on logic.
    """
    TIERS = {
        "FREE": {"symbols": 3, "ai_calls": 5, "screeners": 1},
        "PRO": {"symbols": 15, "ai_calls": 50, "screeners": 10},
        "ENTERPRISE": {"symbols": 100, "ai_calls": 1000, "screeners": 100}
    }

    def get_user_limits(self, user_profile: Dict[str, Any]) -> Dict[str, int]:
        """
        Calculate total limits including base tier + add-ons.
        """
        tier = user_profile.get('tier', 'FREE')
        base_limits = self.TIERS.get(tier, self.TIERS["FREE"])
        
        # Add-ons (e.g. +5 extra stock tracks)
        extra_symbols = user_profile.get('addon_symbols', 0)
        extra_ai = user_profile.get('addon_ai', 0)
        
        return {
            "symbols": base_limits["symbols"] + extra_symbols,
            "ai_calls": base_limits["ai_calls"] + extra_ai,
            "screeners": base_limits["screeners"]
        }

    def is_trial_active(self, created_at: datetime) -> bool:
        """Check if 7-day trial is still valid"""
        trial_end = created_at + timedelta(days=7)
        return datetime.now() < trial_end

    def can_perform_action(self, action_type: str, current_usage: int, limits: Dict[str, int]) -> bool:
        """Verify if user has enough credits/slots for an action"""
        limit = limits.get(action_type, 0)
        return current_usage < limit

    def calculate_credits_needed(self, symbol: str, complexity: str = 'standard') -> int:
        """Calculate credit cost for specific actions (AI, advanced scans)"""
        costs = {
            'standard': 1,
            'deep_dive': 3,
            'backtest': 10
        }
        return costs.get(complexity, 1)

# Singleton
saas_service = SaaSService()
