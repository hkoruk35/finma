import logging
from typing import Dict, List, Any
from collections import Counter

logger = logging.getLogger(__name__)

class RiskService:
    """
    Shield Engine for FinMA v5.0.
    Manages portfolio concentration risk and system health metrics.
    """
    SECTOR_LIMIT = 30.0 # Maximum 30% exposure per sector

    def analyze_concentration(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze portfolio exposure across sectors.
        """
        if not trades:
            return {"status": "ok", "exposure": {}}

        total_value = sum(trade.get('price', 0) * trade.get('quantity', 0) for trade in trades)
        if total_value == 0:
            return {"status": "ok", "exposure": {}}

        sector_values = Counter()
        for trade in trades:
            sector = trade.get('sector', 'Unknown')
            value = trade.get('price', 0) * trade.get('quantity', 0)
            sector_values[sector] += value

        exposure = {}
        alerts = []
        for sector, value in sector_values.items():
            pct = (value / total_value) * 100
            exposure[sector] = round(pct, 2)
            if pct > self.SECTOR_LIMIT:
                alerts.append(f"High Concentration: {sector} ({pct:.1f}%) exceeds {self.SECTOR_LIMIT}% limit.")

        return {
            "status": "warning" if alerts else "ok",
            "exposure": exposure,
            "alerts": alerts,
            "diversification_score": self._calculate_diversification(exposure)
        }

    def _calculate_diversification(self, exposure: Dict[str, float]) -> int:
        """Score 0-100 based on number of sectors and balance"""
        num_sectors = len(exposure)
        if num_sectors == 0: return 0
        if num_sectors >= 5: return 100
        if num_sectors >= 3: return 70
        return 40

    def monitor_latency(self, layer: str, latency_ms: float) -> Dict[str, Any]:
        """
        Monitor latency against defined budgets.
        Budgets:
        - Ingestion: < 100ms
        - Signal Generation: < 500ms
        - AI Inference: < 3000ms
        """
        budgets = {
            "ingestion": 100,
            "signal": 500,
            "ai": 3000
        }
        
        limit = budgets.get(layer, 1000)
        status = "ok" if latency_ms <= limit else "slow"
        
        if status == "slow":
            logger.warning(f"🚨 Latency Alert [%s]: %.2fms exceeds budget of %dms", layer, latency_ms, limit)
            
        return {
            "layer": layer,
            "latency": latency_ms,
            "budget": limit,
            "status": status
        }

# Singleton
risk_service = RiskService()
