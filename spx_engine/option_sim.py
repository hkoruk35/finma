"""
SPX Live Engine — Option Research & 5 Multi-Model Runner Simulation Module
Calculates ATM + 7 OTM strikes, tracks 0DTE/1DTE options via Ask-entry/Bid-exit, and evaluates 5 runner exit models.
"""

import datetime
import logging
from typing import Dict, Any, List, Optional
from spx_engine.time_session import NY_TZ

logger = logging.getLogger("spx_engine.option_sim")

class SPXOptionResearchEngine:
    def __init__(self):
        self.strike_offsets = [0, 5, 10, 15, 20, 25, 30]

    def calculate_candidate_strikes(self, spx_price: float, direction: str = "LONG") -> List[dict]:
        if spx_price <= 0.0:
            return []

        atm_strike = round(spx_price / 5.0) * 5.0
        candidates = []

        for offset in self.strike_offsets:
            if direction == "LONG":
                strike = atm_strike + offset
                opt_type = "CALL"
                dist_pts = strike - spx_price
            else:
                strike = atm_strike - offset
                opt_type = "PUT"
                dist_pts = spx_price - strike

            dist_pct = round((dist_pts / spx_price) * 100.0, 2)
            
            candidates.append({
                "strike": strike,
                "option_type": opt_type,
                "label": "ATM" if offset == 0 else f"{offset} OTM",
                "distance_otm_points": round(dist_pts, 2),
                "distance_otm_pct": dist_pct
            })

        return candidates

    def evaluate_5_runner_models(self, entry_ask: float, current_bid: float,
                                current_spx_price: float, initial_spx_price: float,
                                max_bid_seen: float, is_structure_broken: bool = False) -> Dict[str, float]:
        if entry_ask <= 0.0:
            return {"model_a": 0.0, "model_b": 0.0, "model_c": 0.0, "model_d": 0.0, "model_e": 0.0}

        cost_basis_2_contracts = entry_ask * 2.0 * 100.0
        target_50_pct = entry_ask * 1.50
        target_100_pct = entry_ask * 2.00

        if current_bid >= target_50_pct:
            model_a_pnl = (target_50_pct * 2.0 * 100.0) - cost_basis_2_contracts
        else:
            model_a_pnl = (current_bid * 2.0 * 100.0) - cost_basis_2_contracts

        if current_bid >= target_50_pct:
            contract_1_value = target_50_pct * 100.0
            runner_stop = entry_ask
            contract_2_value = max(runner_stop, current_bid) * 100.0
            model_b_pnl = (contract_1_value + contract_2_value) - cost_basis_2_contracts
        else:
            model_b_pnl = (current_bid * 2.0 * 100.0) - cost_basis_2_contracts

        if current_bid >= target_100_pct:
            contract_1_value = target_100_pct * 100.0
            runner_stop = target_50_pct
            contract_2_value = max(runner_stop, current_bid) * 100.0
            model_c_pnl = (contract_1_value + contract_2_value) - cost_basis_2_contracts
        else:
            model_c_pnl = model_b_pnl

        if max_bid_seen >= target_100_pct:
            contract_1_value = target_100_pct * 100.0
            trailing_stop_bid = max_bid_seen * 0.80
            contract_2_value = max(trailing_stop_bid, current_bid) * 100.0
            model_d_pnl = (contract_1_value + contract_2_value) - cost_basis_2_contracts
        else:
            model_d_pnl = model_b_pnl

        if current_bid >= target_100_pct:
            contract_1_value = target_100_pct * 100.0
            if is_structure_broken:
                contract_2_value = current_bid * 100.0
            else:
                contract_2_value = max_bid_seen * 100.0
            model_e_pnl = (contract_1_value + contract_2_value) - cost_basis_2_contracts
        else:
            model_e_pnl = model_b_pnl

        return {
            "model_a": round(model_a_pnl, 2),
            "model_b": round(model_b_pnl, 2),
            "model_c": round(model_c_pnl, 2),
            "model_d": round(model_d_pnl, 2),
            "model_e": round(model_e_pnl, 2)
        }
