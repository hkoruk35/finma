"""
SPX Live Engine — Market Structure & Configurable Breakout Acceptance Engine
Calculates multi-timeframe candle structures (15m, 5m, 1m) and evaluates breakout states deterministically.
"""

import pandas as pd
import datetime
import logging
from typing import Dict, Any, Optional
from spx_engine.time_session import NY_TZ

logger = logging.getLogger("spx_engine.structure_engine")

class MarketStructureType:
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"

class BreakoutState:
    NONE = "NONE"
    TOUCH = "TOUCH"
    BREAK = "BREAK"
    ACCEPTANCE = "ACCEPTANCE"
    STRONG_ACCEPTANCE = "STRONG_ACCEPTANCE"
    RETEST = "RETEST"
    SUCCESSFUL_RETEST = "SUCCESSFUL_RETEST"
    FAILED_BREAKOUT = "FAILED_BREAKOUT"

class BreakoutConfig:
    def __init__(self, acceptance_body_pct: float = 0.60,
                 min_close_beyond_pct: float = 0.0002,
                 strong_acceptance_tf: str = "5m",
                 retest_max_candles: int = 15,
                 failed_breakout_window: int = 3):
        self.acceptance_body_pct = acceptance_body_pct
        self.min_close_beyond_pct = min_close_beyond_pct
        self.strong_acceptance_tf = strong_acceptance_tf
        self.retest_max_candles = retest_max_candles
        self.failed_breakout_window = failed_breakout_window


class SPXStructureEngine:
    def __init__(self, config: Optional[BreakoutConfig] = None):
        self.config = config or BreakoutConfig()

    def identify_candle_structure(self, df: pd.DataFrame, num_candles: int = 5) -> str:
        if df.empty or len(df) < num_candles:
            return MarketStructureType.NEUTRAL

        sub_df = df.iloc[-num_candles:]
        highs = sub_df['high'].values
        lows = sub_df['low'].values

        hh_count = 0
        hl_count = 0
        lh_count = 0
        ll_count = 0

        for i in range(1, len(sub_df)):
            if highs[i] > highs[i-1]:
                hh_count += 1
            elif highs[i] < highs[i-1]:
                lh_count += 1

            if lows[i] > lows[i-1]:
                hl_count += 1
            elif lows[i] < lows[i-1]:
                ll_count += 1

        if (hh_count + hl_count >= 5) and ll_count <= 1:
            return MarketStructureType.BULLISH
        elif (lh_count + ll_count >= 5) and hh_count <= 1:
            return MarketStructureType.BEARISH

        return MarketStructureType.NEUTRAL

    def evaluate_level_breakout(self, df_1m: pd.DataFrame, level: float, direction: str = "LONG",
                                df_5m: Optional[pd.DataFrame] = None) -> str:
        if df_1m.empty or level <= 0.0:
            return BreakoutState.NONE

        last_1m = df_1m.iloc[-1]
        close = float(last_1m['close'])
        high = float(last_1m['high'])
        low = float(last_1m['low'])
        open_price = float(last_1m['open'])
        body_size = abs(close - open_price)

        if direction == "LONG":
            if high >= level - 0.25 and close < level:
                return BreakoutState.TOUCH

            if close <= level and high > level:
                return BreakoutState.BREAK

            if close > level:
                body_above = max(0.0, close - max(open_price, level))
                body_ratio = (body_above / body_size) if body_size > 0 else 1.0

                if len(df_1m) >= self.config.failed_breakout_window + 1:
                    prev_candles = df_1m.iloc[-(self.config.failed_breakout_window + 1):-1]
                    was_above = any(prev_candles['close'] > level)
                    if was_above and close < level:
                        return BreakoutState.FAILED_BREAKOUT

                if df_5m is not None and not df_5m.empty:
                    last_5m_close = float(df_5m.iloc[-1]['close'])
                    if last_5m_close > level:
                        return BreakoutState.STRONG_ACCEPTANCE

                if body_ratio >= self.config.acceptance_body_pct:
                    if low <= level + 0.50 and close > level:
                        return BreakoutState.SUCCESSFUL_RETEST
                    return BreakoutState.ACCEPTANCE

                return BreakoutState.BREAK

        elif direction == "SHORT":
            if low <= level + 0.25 and close > level:
                return BreakoutState.TOUCH

            if close >= level and low < level:
                return BreakoutState.BREAK

            if close < level:
                body_below = max(0.0, min(open_price, level) - close)
                body_ratio = (body_below / body_size) if body_size > 0 else 1.0

                if len(df_1m) >= self.config.failed_breakout_window + 1:
                    prev_candles = df_1m.iloc[-(self.config.failed_breakout_window + 1):-1]
                    was_below = any(prev_candles['close'] < level)
                    if was_below and close > level:
                        return BreakoutState.FAILED_BREAKOUT

                if df_5m is not None and not df_5m.empty:
                    last_5m_close = float(df_5m.iloc[-1]['close'])
                    if last_5m_close < level:
                        return BreakoutState.STRONG_ACCEPTANCE

                if body_ratio >= self.config.acceptance_body_pct:
                    if high >= level - 0.50 and close < level:
                        return BreakoutState.SUCCESSFUL_RETEST
                    return BreakoutState.ACCEPTANCE

                return BreakoutState.BREAK

        return BreakoutState.NONE

    def build_multi_timeframe_summary(self, es_15m: pd.DataFrame, es_5m: pd.DataFrame, es_1m: pd.DataFrame,
                                     spx_5m: pd.DataFrame, spx_1m: pd.DataFrame) -> Dict[str, str]:
        return {
            "es_15m": self.identify_candle_structure(es_15m, num_candles=4),
            "es_5m": self.identify_candle_structure(es_5m, num_candles=5),
            "es_1m": self.identify_candle_structure(es_1m, num_candles=6),
            "spx_5m": self.identify_candle_structure(spx_5m, num_candles=5),
            "spx_1m": self.identify_candle_structure(spx_1m, num_candles=6)
        }
