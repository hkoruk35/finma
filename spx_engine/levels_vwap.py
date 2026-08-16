"""
SPX Live Engine — Deterministic Level & VWAP Calculation Engine
Calculates Globex ONH/ONL, Premarket H/L, PDH/PDL/PDC, OR5 (09:30-09:35 ET), ES VWAP, SPY VWAP proxy, and VWAP chop detector.
"""

import pandas as pd
import datetime
import logging
from typing import Dict, Any, Optional
from spx_engine.time_session import SPXSessionClock, NY_TZ, localize_ny

logger = logging.getLogger("spx_engine.levels_vwap")

def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    if df.empty or 'volume' not in df.columns:
        return pd.Series(dtype=float)

    typical_price = (df['high'] + df['low'] + df['close']) / 3.0
    tp_vol = typical_price * df['volume']
    
    cum_tp_vol = tp_vol.cumsum()
    cum_vol = df['volume'].cumsum()
    
    cum_vol = cum_vol.replace(0, float('nan'))
    vwap = cum_tp_vol / cum_vol
    return vwap.ffill().bfill()


class SPXLevelEngine:
    def __init__(self, clock: Optional[SPXSessionClock] = None):
        self.clock = clock or SPXSessionClock()

    def compute_all_levels(self, es_1m_df: pd.DataFrame, spx_1m_df: pd.DataFrame,
                           spy_1m_df: Optional[pd.DataFrame] = None,
                           dt: Optional[datetime.datetime] = None) -> Dict[str, Any]:
        if dt is None:
            dt = self.clock.get_ny_now()
        else:
            dt = self.clock.to_ny(dt)

        levels = {
            "timestamp": dt.isoformat(),
            "es": self._compute_es_levels(es_1m_df, dt),
            "spx": self._compute_spx_levels(spx_1m_df, dt),
            "spy": self._compute_spy_vwap(spy_1m_df, dt) if spy_1m_df is not None and not spy_1m_df.empty else None
        }
        return levels

    def _compute_es_levels(self, df: pd.DataFrame, dt: datetime.datetime) -> Dict[str, Any]:
        result = {
            "onh": 0.0,
            "onl": 0.0,
            "overnight_mid": 0.0,
            "premarket_high": 0.0,
            "premarket_low": 0.0,
            "pdh": 0.0,
            "pdl": 0.0,
            "pdc": 0.0,
            "session_high": 0.0,
            "session_low": 0.0,
            "vwap": 0.0,
            "vwap_slope": "FLAT",
            "is_vwap_chop": False,
            "price_vs_vwap": "FLAT"
        }

        if df.empty:
            return result

        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC").tz_convert(NY_TZ)

        on_start, on_end = self.clock.get_globex_overnight_window(dt)
        on_df = df[(df.index >= on_start) & (df.index <= on_end)]
        if not on_df.empty:
            onh = float(on_df['high'].max())
            onl = float(on_df['low'].min())
            result["onh"] = onh
            result["onl"] = onl
            result["overnight_mid"] = round((onh + onl) / 2.0, 2)

        pm_start, pm_end = self.clock.get_premarket_window(dt)
        pm_df = df[(df.index >= pm_start) & (df.index <= pm_end)]
        if not pm_df.empty:
            result["premarket_high"] = float(pm_df['high'].max())
            result["premarket_low"] = float(pm_df['low'].min())

        today_date = dt.date()
        prev_days_df = df[df.index.date < today_date]
        if not prev_days_df.empty:
            last_prev_date = prev_days_df.index.date[-1]
            last_day_df = prev_days_df[prev_days_df.index.date == last_prev_date]
            result["pdh"] = float(last_day_df['high'].max())
            result["pdl"] = float(last_day_df['low'].min())
            result["pdc"] = float(last_day_df['close'].iloc[-1])

        today_df = df[df.index.date == today_date]
        if not today_df.empty:
            result["session_high"] = float(today_df['high'].max())
            result["session_low"] = float(today_df['low'].min())

            vwap_series = calculate_vwap(today_df)
            if not vwap_series.empty:
                current_vwap = float(vwap_series.iloc[-1])
                result["vwap"] = round(current_vwap, 2)
                last_price = float(today_df['close'].iloc[-1])

                if last_price > current_vwap + 0.5:
                    result["price_vs_vwap"] = "ABOVE"
                elif last_price < current_vwap - 0.5:
                    result["price_vs_vwap"] = "BELOW"
                else:
                    result["price_vs_vwap"] = "AT_VWAP"

                if len(vwap_series) >= 5:
                    vwap_delta = vwap_series.iloc[-1] - vwap_series.iloc[-5]
                    if vwap_delta > 0.25:
                        result["vwap_slope"] = "RISING"
                    elif vwap_delta < -0.25:
                        result["vwap_slope"] = "FALLING"
                    else:
                        result["vwap_slope"] = "FLAT"

                if len(today_df) >= 10:
                    recent_closes = today_df['close'].iloc[-10:]
                    recent_vwaps = vwap_series.iloc[-10:]
                    crosses = 0
                    for i in range(1, len(recent_closes)):
                        prev_rel = recent_closes.iloc[i-1] > recent_vwaps.iloc[i-1]
                        curr_rel = recent_closes.iloc[i] > recent_vwaps.iloc[i]
                        if prev_rel != curr_rel:
                            crosses += 1
                    if crosses >= 4:
                        result["is_vwap_chop"] = True

        return result

    def _compute_spx_levels(self, df: pd.DataFrame, dt: datetime.datetime) -> Dict[str, Any]:
        result = {
            "pdh": 0.0,
            "pdl": 0.0,
            "pdc": 0.0,
            "session_high": 0.0,
            "session_low": 0.0,
            "orh": 0.0,
            "orl": 0.0,
            "or_mid": 0.0,
            "or_size": 0.0,
            "is_or_defined": False
        }

        if df.empty:
            return result

        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC").tz_convert(NY_TZ)

        today_date = dt.date()
        
        prev_days_df = df[df.index.date < today_date]
        if not prev_days_df.empty:
            last_prev_date = prev_days_df.index.date[-1]
            last_day_df = prev_days_df[prev_days_df.index.date == last_prev_date]
            result["pdh"] = float(last_day_df['high'].max())
            result["pdl"] = float(last_day_df['low'].min())
            result["pdc"] = float(last_day_df['close'].iloc[-1])

        today_df = df[df.index.date == today_date]
        if not today_df.empty:
            result["session_high"] = float(today_df['high'].max())
            result["session_low"] = float(today_df['low'].min())

            or_start = localize_ny(datetime.datetime.combine(today_date, datetime.time(9, 30, 0)))
            or_end = localize_ny(datetime.datetime.combine(today_date, datetime.time(9, 34, 59)))
            or_df = today_df[(today_df.index >= or_start) & (today_df.index <= or_end)]
            
            if not or_df.empty and len(or_df) >= 3:
                orh = float(or_df['high'].max())
                orl = float(or_df['low'].min())
                result["orh"] = orh
                result["orl"] = orl
                result["or_mid"] = round((orh + orl) / 2.0, 2)
                result["or_size"] = round(orh - orl, 2)
                result["is_or_defined"] = True

        return result

    def _compute_spy_vwap(self, df: pd.DataFrame, dt: datetime.datetime) -> float:
        if df.empty:
            return 0.0
        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC").tz_convert(NY_TZ)
            
        today_date = dt.date()
        today_df = df[df.index.date == today_date]
        if today_df.empty:
            return 0.0

        vwap_series = calculate_vwap(today_df)
        if not vwap_series.empty:
            return round(float(vwap_series.iloc[-1]), 2)
        return 0.0
