import abc
import hashlib
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class MarketDataProvider(abc.ABC):
    @abc.abstractmethod
    def get_1m_bar(self, ticker: str) -> Dict[str, Any]:
        """Must return dict with 'open', 'high', 'low', 'close', 'timestamp'"""
        pass

class YFinanceProvider(MarketDataProvider):
    def get_1m_bar(self, ticker: str) -> Dict[str, Any]:
        # Implementation to be added. Mocked for now.
        return {"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "timestamp": datetime.now(timezone.utc)}


class RiskEngine:
    MAX_POSITIONS = 3
    PORTFOLIO_LIMIT_PCT = 0.35
    RISK_BUDGET_PCT = 0.015
    MAX_TOTAL_OPEN_RISK_PCT = 0.04
    
    @classmethod
    def calculate_position_size(cls, 
                                current_equity: float, 
                                available_cash: float, 
                                entry_price: float, 
                                stop_price: float, 
                                requested_allocation: float,
                                all_open_position_risks: List[float],
                                risk_state: str = 'NORMAL') -> Dict[str, Any]:
        """
        Calculates the strict maximum allowed position size based on units (shares).
        """
        if risk_state in ['LOCKED', 'STOPPED']:
            return {"approved": False, "reason": f"No new positions allowed in risk state: {risk_state}"}
            
        if entry_price <= stop_price:
            return {"approved": False, "reason": "Stop price must be strictly lower than entry price for LONG positions."}
            
        # Drawdown adjustment
        budget_pct = cls.RISK_BUDGET_PCT if risk_state == 'NORMAL' else 0.0075
        
        # 1. Calculate risk budget ($)
        risk_budget = current_equity * budget_pct
        
        # 2. Risk per share
        risk_per_share = entry_price - stop_price
        
        # 3. Maximum shares permitted by individual risk budget
        shares_by_risk = risk_budget / risk_per_share
        
        # 4. Maximum shares requested by AI
        shares_by_allocation = requested_allocation / entry_price
        
        # 5. Maximum shares permitted by overall portfolio exposure limit (35%)
        shares_by_portfolio_limit = (current_equity * cls.PORTFOLIO_LIMIT_PCT) / entry_price
        
        # 6. Maximum shares limited by physical cash
        shares_by_cash = available_cash / entry_price
        
        # Strict MIN function bounds the position
        approved_shares = min(shares_by_risk, shares_by_allocation, shares_by_portfolio_limit, shares_by_cash)
        
        # Floor to 4 decimals
        approved_shares = int(approved_shares * 10000) / 10000.0
        
        if approved_shares <= 0:
            return {"approved": False, "reason": "Calculated share size is zero."}
            
        proposed_trade_risk = approved_shares * risk_per_share
        
        # Total portfolio risk check
        total_open_risk = sum(all_open_position_risks)
        if (total_open_risk + proposed_trade_risk) / current_equity > cls.MAX_TOTAL_OPEN_RISK_PCT:
             # Reduce position size to fit the remaining portfolio risk buffer
             available_portfolio_risk_budget = (current_equity * cls.MAX_TOTAL_OPEN_RISK_PCT) - total_open_risk
             if available_portfolio_risk_budget <= 0:
                 return {"approved": False, "reason": "Total portfolio open risk limit (4%) exceeded. Trade rejected."}
                 
             reduced_shares = available_portfolio_risk_budget / risk_per_share
             approved_shares = min(approved_shares, reduced_shares)
             approved_shares = int(approved_shares * 10000) / 10000.0
             proposed_trade_risk = approved_shares * risk_per_share
             
             if approved_shares <= 0:
                 return {"approved": False, "reason": "Calculated share size is zero after total portfolio risk adjustment."}
        
        approved_allocation = approved_shares * entry_price
        
        return {
            "approved": True,
            "shares": approved_shares,
            "allocation": approved_allocation,
            "trade_risk": proposed_trade_risk,
            "reason": f"Approved {approved_shares} shares. Trade Risk: ${proposed_trade_risk:.2f}"
        }


class PortfolioAccountingEngine:
    @staticmethod
    def evaluate_portfolio(cash_balance: float, reserved_cash: float, peak_equity: float, positions: List[Dict]) -> Dict[str, Any]:
        """
        Recomputes total portfolio equity, PnL, available cash, and Drawdown states.
        """
        open_market_value = 0.0
        unrealized_pnl = 0.0
        
        for pos in positions:
            if pos["status"] == "OPEN":
                mv = pos["shares"] * pos["current_price"]
                open_market_value += mv
                unrealized_pnl += mv - (pos["shares"] * pos["average_cost"])
                
        current_equity = cash_balance + open_market_value
        available_cash = cash_balance - reserved_cash
        
        new_peak_equity = max(peak_equity, current_equity)
        drawdown_pct = 0.0
        if new_peak_equity > 0:
            drawdown_pct = (new_peak_equity - current_equity) / new_peak_equity
            
        risk_state = 'NORMAL'
        if drawdown_pct >= 0.10:
            risk_state = 'STOPPED'
        elif drawdown_pct >= 0.075:
            risk_state = 'LOCKED'
        elif drawdown_pct >= 0.05:
            risk_state = 'REDUCED'
            
        return {
            "current_equity": current_equity,
            "available_cash": available_cash,
            "unrealized_pnl": unrealized_pnl,
            "peak_equity": new_peak_equity,
            "drawdown_pct": drawdown_pct,
            "risk_state": risk_state
        }


def compute_canonical_hash(payload_dict: Dict[str, Any], previous_hash: Optional[str]) -> str:
    """
    Computes a canonical SHA-256 hash for the immutable ledger.
    """
    canonical_payload = {
        "sequence_number": payload_dict.get("sequence_number"),
        "challenge_id": str(payload_dict.get("challenge_id")),
        "event_type": payload_dict.get("event_type"),
        "market_timestamp": str(payload_dict.get("market_timestamp")),
        "decision_id": str(payload_dict.get("decision_id")),
        "order_id": str(payload_dict.get("order_id")),
        "position_id": str(payload_dict.get("position_id")),
        "requested_action": payload_dict.get("requested_action"),
        "approved_action": payload_dict.get("approved_action"),
        "quantity": float(payload_dict.get("quantity", 0)),
        "execution_price": float(payload_dict.get("execution_price", 0)) if payload_dict.get("execution_price") else None,
        "previous_hash": previous_hash
    }
    
    json_str = json.dumps(canonical_payload, sort_keys=True)
    return hashlib.sha256(json_str.encode('utf-8')).hexdigest()
