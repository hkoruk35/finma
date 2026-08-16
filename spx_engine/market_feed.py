"""
SPX Live Engine — Market Feed & Data Quality Monitor
Handles high-frequency candle ingestion, staleness checking, age tracking, ES-SPX Basis calculation, and fail-safe warnings.
"""

import datetime
import pandas as pd
import logging
from typing import Dict, Optional, Tuple
from spx_engine.data_provider import MarketDataProvider, YFinanceProvider, get_futures_front_contract_symbol
from spx_engine.time_session import NY_TZ, SPXSessionClock, SPXSessionPhase

logger = logging.getLogger("spx_engine.market_feed")

class DataQualityStatus:
    LIVE = "LIVE"
    DELAYED = "DELAYED"
    STALE = "STALE"
    MISSING = "MISSING"

class SPXMarketFeedManager:
    def __init__(self, provider: Optional[MarketDataProvider] = None):
        self.provider = provider or YFinanceProvider()
        self.clock = SPXSessionClock()
        self.stale_threshold_ms = 180000  # 3 minutes
        self.delayed_threshold_ms = 90000  # 1.5 minutes
        self._candle_cache: Dict[str, Dict[str, pd.DataFrame]] = {}
        self._feed_metadata: Dict[str, Dict[str, dict]] = {}
        self.es_spx_basis: float = 0.0

    def set_provider(self, provider: MarketDataProvider):
        self.provider = provider

    def get_front_contract(self, root: str = "ES", dt: datetime.datetime = None) -> str:
        return get_futures_front_contract_symbol(root, dt)

    def update_symbol_candles(self, symbol: str, interval: str = "1m", lookback_days: int = 5) -> Tuple[pd.DataFrame, dict]:
        now = datetime.datetime.now(NY_TZ)
        df = self.provider.fetch_intraday_candles(symbol, interval=interval, lookback_days=lookback_days)
        
        meta = {
            "symbol": symbol,
            "interval": interval,
            "source": getattr(self.provider, "source_name", "Unknown"),
            "received_at": now.isoformat(),
            "source_timestamp": None,
            "age_ms": 9999999,
            "status": DataQualityStatus.MISSING,
            "candle_count": len(df)
        }

        if not df.empty:
            last_ts = df.index[-1].to_pydatetime()
            if last_ts.tzinfo is None:
                last_ts = NY_TZ.localize(last_ts)
            else:
                last_ts = last_ts.astimezone(NY_TZ)

            age_ms = max(0, int((now - last_ts).total_seconds() * 1000))
            meta["source_timestamp"] = last_ts.isoformat()
            meta["age_ms"] = age_ms

            phase = self.clock.get_session_phase(now)
            if phase == SPXSessionPhase.OFF_HOURS:
                meta["status"] = DataQualityStatus.LIVE  # Market closed, last available session data is valid
            elif age_ms <= self.delayed_threshold_ms:
                meta["status"] = DataQualityStatus.LIVE
            elif age_ms <= self.stale_threshold_ms:
                meta["status"] = DataQualityStatus.DELAYED
            else:
                meta["status"] = DataQualityStatus.STALE
        else:
            meta["status"] = DataQualityStatus.MISSING

        if symbol not in self._candle_cache:
            self._candle_cache[symbol] = {}
            self._feed_metadata[symbol] = {}

        self._candle_cache[symbol][interval] = df
        self._feed_metadata[symbol][interval] = meta

        self._update_es_spx_basis()

        return df, meta

    def _update_es_spx_basis(self):
        es_df = self.get_cached_candles("ES", "1m")
        spx_df = self.get_cached_candles("SPX", "1m")
        
        if not es_df.empty and not spx_df.empty:
            es_last = float(es_df.iloc[-1]['close'])
            spx_last = float(spx_df.iloc[-1]['close'])
            self.es_spx_basis = round(es_last - spx_last, 2)

    def get_es_spx_basis(self) -> float:
        return self.es_spx_basis

    def get_cached_candles(self, symbol: str, interval: str) -> pd.DataFrame:
        return self._candle_cache.get(symbol, {}).get(interval, pd.DataFrame())

    def get_feed_metadata(self, symbol: str, interval: str = "1m") -> dict:
        return self._feed_metadata.get(symbol, {}).get(interval, {
            "symbol": symbol,
            "interval": interval,
            "status": DataQualityStatus.MISSING,
            "age_ms": 9999999
        })

    def evaluate_overall_data_integrity(self) -> Tuple[bool, str, dict]:
        now = datetime.datetime.now(NY_TZ)
        phase = self.clock.get_session_phase(now)
        
        critical_symbols = ["ES", "SPX"]
        integrity_details = {}
        is_valid = True
        message = "All critical feeds operational."

        for sym in critical_symbols:
            meta = self.get_feed_metadata(sym, "1m")
            status = meta.get("status", DataQualityStatus.MISSING)
            integrity_details[sym] = meta

            if phase != SPXSessionPhase.OFF_HOURS and status in (DataQualityStatus.STALE, DataQualityStatus.MISSING):
                is_valid = False
                message = f"MARKET DATA INTEGRITY WARNING: {sym} feed is {status} (Age: {meta.get('age_ms', 0)/1000:.1f}s)"

        return is_valid, message, integrity_details
