"""
SPX Live Engine — Categorized Scoring, NetScore Arbitration & Hysteresis State Machine
Determines Long/Short scores (0-7), NetScore arbitration, qualitative confidence, and 15 signal state transitions.
"""

import logging
from typing import Dict, Any, Tuple, Optional
from spx_engine.structure_engine import MarketStructureType, BreakoutState

logger = logging.getLogger("spx_engine.scoring_state")

class SignalState:
    NEUTRAL = "NEUTRAL"
    WATCH_LONG = "WATCH_LONG"
    WATCH_SHORT = "WATCH_SHORT"
    EARLY_LONG = "EARLY_LONG"
    EARLY_SHORT = "EARLY_SHORT"
    CONFIRMED_LONG = "CONFIRMED_LONG"
    CONFIRMED_SHORT = "CONFIRMED_SHORT"
    STRONG_LONG = "STRONG_LONG"
    STRONG_SHORT = "STRONG_SHORT"
    LONG_WEAKENING = "LONG_WEAKENING"
    SHORT_WEAKENING = "SHORT_WEAKENING"
    FAILED_LONG = "FAILED_LONG"
    FAILED_SHORT = "FAILED_SHORT"
    CHOP = "CHOP"
    NO_TRADE = "NO_TRADE"
    DATA_STALE = "DATA_STALE"
    EVENT_LOCKOUT = "EVENT_LOCKOUT"

class ConfidenceTier:
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"

class DirectionalProbabilityBucket:
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


class SPXScoringStateEngine:
    def __init__(self):
        self.current_state = SignalState.NEUTRAL
        self.last_state_change_candle_idx = 0

    def compute_scores(self, levels_data: dict, structure_data: dict,
                       nq_direction: str = "NEUTRAL", vix_direction: str = "FLAT",
                       breadth_positive: bool = True,
                       spx_breakout_state_long: str = BreakoutState.NONE,
                       spx_breakout_state_short: str = BreakoutState.NONE) -> Tuple[float, float, float, dict]:
        es_lvl = levels_data.get("es", {})
        
        long_score = 0.0
        short_score = 0.0

        long_factors = []
        short_factors = []
        conflicts = []

        es_price_vs_vwap = es_lvl.get("price_vs_vwap", "FLAT")
        if es_price_vs_vwap == "ABOVE":
            long_score += 1.0
            long_factors.append("ES Price > Session VWAP")
        elif es_price_vs_vwap == "BELOW":
            short_score += 1.0
            short_factors.append("ES Price < Session VWAP")

        es_5m_struct = structure_data.get("es_5m", MarketStructureType.NEUTRAL)
        if es_5m_struct == MarketStructureType.BULLISH:
            long_score += 1.0
            long_factors.append("ES 5m Bullish Structure (HH/HL)")
        elif es_5m_struct == MarketStructureType.BEARISH:
            short_score += 1.0
            short_factors.append("ES 5m Bearish Structure (LL/LH)")

        if spx_breakout_state_long in (BreakoutState.ACCEPTANCE, BreakoutState.STRONG_ACCEPTANCE, BreakoutState.SUCCESSFUL_RETEST):
            long_score += 1.0
            long_factors.append("SPX Breakout & Acceptance above ORH")
        elif spx_breakout_state_short in (BreakoutState.ACCEPTANCE, BreakoutState.STRONG_ACCEPTANCE, BreakoutState.SUCCESSFUL_RETEST):
            short_score += 1.0
            short_factors.append("SPX Breakdown & Acceptance below ORL")

        if nq_direction == MarketStructureType.BULLISH:
            long_score += 1.0
            long_factors.append("NQ Futures Directional Bullish Alignment")
        elif nq_direction == MarketStructureType.BEARISH:
            short_score += 1.0
            short_factors.append("NQ Futures Directional Bearish Alignment")

        if vix_direction in ("DOWN", "BELOW_VWAP"):
            long_score += 1.0
            long_factors.append("VIX Declining / Risk-On Behavior")
        elif vix_direction in ("UP", "ABOVE_VWAP"):
            short_score += 1.0
            short_factors.append("VIX Rising / Risk-Off Behavior")

        if breadth_positive:
            long_score += 1.0
            long_factors.append("NYSE Breadth Positive (ADD > 0)")
        else:
            short_score += 1.0
            short_factors.append("NYSE Breadth Negative (ADD < 0)")

        es_on_mid = es_lvl.get("overnight_mid", 0.0)
        es_vwap = es_lvl.get("vwap", 0.0)
        if es_vwap > 0 and es_on_mid > 0:
            if es_vwap > es_on_mid:
                long_score += 1.0
                long_factors.append("ES > Globex Overnight Midpoint")
            else:
                short_score += 1.0
                short_factors.append("ES < Globex Overnight Midpoint")

        net_score = round(long_score - short_score, 2)

        if long_score >= 4.0 and short_score >= 4.0:
            conflicts.append("High Long and Short Score overlap (Market Chop)")
        if es_price_vs_vwap == "ABOVE" and vix_direction in ("UP", "ABOVE_VWAP"):
            conflicts.append("VIX Rising despite Bullish ES Price Structure")

        score_breakdown = {
            "long_score": long_score,
            "short_score": short_score,
            "net_score": net_score,
            "long_factors": long_factors,
            "short_factors": short_factors,
            "conflicts": conflicts
        }

        return long_score, short_score, net_score, score_breakdown

    def determine_confidence_and_probability(self, long_score: float, short_score: float, net_score: float) -> Tuple[str, str]:
        abs_net = abs(net_score)
        max_score = max(long_score, short_score)

        if max_score >= 7.0 and abs_net >= 6.0:
            return ConfidenceTier.VERY_HIGH, DirectionalProbabilityBucket.VERY_HIGH
        elif max_score >= 5.5 and abs_net >= 4.0:
            return ConfidenceTier.HIGH, DirectionalProbabilityBucket.HIGH
        elif max_score >= 3.5 and abs_net >= 2.0:
            return ConfidenceTier.MEDIUM, DirectionalProbabilityBucket.MODERATE
        else:
            return ConfidenceTier.LOW, DirectionalProbabilityBucket.LOW

    def evaluate_state_transition(self, prev_state: str, long_score: float, short_score: float,
                                  net_score: float, session_phase: str,
                                  is_data_stale: bool = False, is_macro_lockout: bool = False) -> Tuple[str, bool]:
        if is_data_stale:
            return SignalState.DATA_STALE, prev_state != SignalState.DATA_STALE

        if is_macro_lockout:
            return SignalState.EVENT_LOCKOUT, prev_state != SignalState.EVENT_LOCKOUT

        if long_score >= 4.0 and short_score >= 4.0 and abs(net_score) < 3.0:
            new_state = SignalState.CHOP
            return new_state, prev_state != new_state

        target_state = prev_state

        if prev_state in (SignalState.NEUTRAL, SignalState.CHOP, SignalState.NO_TRADE):
            if net_score >= 5.0 and long_score >= 6.0:
                target_state = SignalState.STRONG_LONG
            elif net_score >= 4.0 and long_score >= 5.0:
                target_state = SignalState.CONFIRMED_LONG
            elif net_score >= 2.5 and long_score >= 4.0:
                target_state = SignalState.EARLY_LONG
            elif net_score >= 1.5 and long_score >= 3.0:
                target_state = SignalState.WATCH_LONG
            elif net_score <= -5.0 and short_score >= 6.0:
                target_state = SignalState.STRONG_SHORT
            elif net_score <= -4.0 and short_score >= 5.0:
                target_state = SignalState.CONFIRMED_SHORT
            elif net_score <= -2.5 and short_score >= 4.0:
                target_state = SignalState.EARLY_SHORT
            elif net_score <= -1.5 and short_score >= 3.0:
                target_state = SignalState.WATCH_SHORT
            else:
                target_state = SignalState.NEUTRAL

        elif prev_state in (SignalState.WATCH_LONG, SignalState.EARLY_LONG, SignalState.CONFIRMED_LONG, SignalState.STRONG_LONG):
            if long_score <= 2.5 or net_score < 1.0:
                target_state = SignalState.FAILED_LONG
            elif long_score <= 4.0 or net_score < 2.5:
                target_state = SignalState.LONG_WEAKENING
            elif net_score >= 5.0 and long_score >= 6.0:
                target_state = SignalState.STRONG_LONG
            elif net_score >= 4.0 and long_score >= 5.0:
                target_state = SignalState.CONFIRMED_LONG
            elif net_score >= 2.5:
                target_state = SignalState.EARLY_LONG

        elif prev_state in (SignalState.WATCH_SHORT, SignalState.EARLY_SHORT, SignalState.CONFIRMED_SHORT, SignalState.STRONG_SHORT):
            if short_score <= 2.5 or net_score > -1.0:
                target_state = SignalState.FAILED_SHORT
            elif short_score <= 4.0 or net_score > -2.5:
                target_state = SignalState.SHORT_WEAKENING
            elif net_score <= -5.0 and short_score >= 6.0:
                target_state = SignalState.STRONG_SHORT
            elif net_score <= -4.0 and short_score >= 5.0:
                target_state = SignalState.CONFIRMED_SHORT
            elif net_score <= -2.5:
                target_state = SignalState.EARLY_SHORT

        elif prev_state in (SignalState.LONG_WEAKENING, SignalState.FAILED_LONG, SignalState.SHORT_WEAKENING, SignalState.FAILED_SHORT):
            if abs(net_score) < 2.0:
                target_state = SignalState.NEUTRAL

        state_changed = (target_state != prev_state)
        self.current_state = target_state
        return target_state, state_changed
