"""
5m-candle-aligned scheduler + a more frequent refinement loop for the SPY
signal engine (v2: 30m opening-range regime -> 15m primary trigger -> 5m
entry-timing refinement — see signal_engine.py).

- 5m loop: checks datetime.now() every ~1s; fires when minute % 5 == 0 and
  second >= 5 (small delay so the just-closed 5m bar is actually final on
  Yahoo's side). Dedupes by last-processed 5m `begins_at` so the same
  closed candle is never reprocessed.
- 1m loop: re-runs the (5m-bar-based) analysis every minute while the last
  known 30m regime is YUKARI or AŞAĞI (skipped when BELİRSİZ, to save
  requests/CPU) so `refinement_5m`/entry timing stays current between 5m
  bar closes without waiting a full 5 minutes.
- Runs through market-closed hours too (keeps the panel's heartbeat alive
  overnight) but tags every result with `market_status` (open/closed/pre/
  post) so the frontend can show a low-confidence banner instead of a dead
  panel.
- Every result (CALL SETUP, PUT SETUP, and NO TRADE) is written to
  `spy_signals` via db.insert_signal AND broadcast over the WebSocket, so
  the panel always has a live heartbeat, not just alerts.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from spy_signal_engine import db
from spy_signal_engine.data_source import YahooDataSource
from spy_signal_engine.signal_engine import SignalEngine

logger = logging.getLogger("spy_signal_engine.scheduler")

NY_TZ = ZoneInfo("America/New_York")

SYMBOL = os.environ.get("SYMBOL", "SPY")
LOOKBACK_5M_BARS = int(os.environ.get("LOOKBACK_5M_BARS", "80"))


def market_status(now_utc: datetime) -> str:
    ny = now_utc.astimezone(NY_TZ)
    if ny.weekday() >= 5:  # Sat/Sun
        return "closed"
    minutes = ny.hour * 60 + ny.minute
    if minutes < 4 * 60:
        return "closed"
    if minutes < 9 * 60 + 30:
        return "pre"
    if minutes < 16 * 60:
        return "open"
    if minutes < 20 * 60:
        return "post"
    return "closed"


class SpySignalScheduler:
    """Owns the polling loops and hands every result to a broadcast
    callback (the FastAPI app wires this to its WebSocket manager)."""

    def __init__(self, broadcast_fn=None):
        self._broadcast_fn = broadcast_fn
        self._data_source = YahooDataSource()
        self._engine = SignalEngine()
        self._last_5m_begins_at: str | None = None
        self._last_regime: str | None = None
        self._running = False

    async def _broadcast(self, result: dict) -> None:
        if self._broadcast_fn is None:
            return
        try:
            maybe_coro = self._broadcast_fn(result)
            if asyncio.iscoroutine(maybe_coro):
                await maybe_coro
        except Exception:
            logger.exception("broadcast basarisiz")

    def _run_analysis(self) -> dict | None:
        try:
            bars_5m = self._data_source.get_bars(SYMBOL, "5m", LOOKBACK_5M_BARS * 5)
        except Exception:
            logger.exception("Yahoo veri cekme hatasi")
            return None

        if not bars_5m:
            return None

        latest_5m_begins_at = bars_5m[-1]["begins_at"]
        result = self._engine.analyze(bars_5m, symbol=SYMBOL)
        result["market_status"] = market_status(datetime.now(timezone.utc))
        self._last_5m_begins_at = latest_5m_begins_at
        self._last_regime = result.get("regime_30m")
        return result

    async def _persist_and_broadcast(self, result: dict) -> None:
        if "time_utc" not in result:
            # signal_engine's "yetersiz veri" short-circuit path — still
            # broadcast so the panel shows a heartbeat, but don't write a
            # half-populated row to Supabase (would violate NOT NULL cols).
            await self._broadcast(result)
            return
        try:
            payload = {
                "time_utc": result["time_utc"],
                "symbol": result.get("symbol", SYMBOL),
                "decision": result["decision"],
                "regime_30m": result.get("regime_30m"),
                "trigger_15m": result.get("trigger_15m"),
                "chop_band_hi": result.get("chop_band_hi"),
                "chop_band_lo": result.get("chop_band_lo"),
                "atr_15m": result.get("atr_15m"),
                "avg_vol_8_15m": result.get("avg_vol_8_15m"),
                "vol_ratio_15m_pct": result.get("vol_ratio_15m_pct"),
                "stop_spy": result.get("stop_spy"),
                "stop_premium": result.get("stop_premium"),
                "refinement_5m": result.get("refinement_5m"),
                "rsi_5m_prev": result.get("rsi_5m_prev"),
                "rsi_5m_now": result.get("rsi_5m_now"),
                "vwap": result.get("vwap"),
                "above_vwap": result.get("above_vwap"),
                "candle_shape": result.get("candle_shape"),
                "last_close": result.get("last_close"),
                "entry_zone": result.get("entry_zone"),
                "reason": result.get("reason"),
            }
            db.insert_signal(payload)
        except Exception:
            logger.exception("Supabase yazma hatasi (yayin yine de devam ediyor)")
        await self._broadcast(result)

    async def _five_minute_loop(self) -> None:
        while self._running:
            now = datetime.now(timezone.utc)
            if now.minute % 5 == 0 and now.second >= 5:
                result = await asyncio.to_thread(self._run_analysis)
                if result is not None:
                    latest_begins_at = result.get("time_utc")
                    already_done = (
                        latest_begins_at is not None
                        and latest_begins_at == self._last_processed_marker
                    )
                    if not already_done:
                        self._last_processed_marker = latest_begins_at
                        await self._persist_and_broadcast(result)
                await asyncio.sleep(55)  # past this 5s window, avoid re-firing
            else:
                await asyncio.sleep(1)

    async def _one_minute_loop(self) -> None:
        last_minute_fired = -1
        while self._running:
            now = datetime.now(timezone.utc)
            if now.second >= 2 and now.minute != last_minute_fired:
                if self._last_regime in ("YUKARI", "AŞAĞI"):
                    last_minute_fired = now.minute
                    result = await asyncio.to_thread(self._run_analysis)
                    if result is not None:
                        latest_begins_at = result.get("time_utc")
                        if latest_begins_at != self._last_processed_marker:
                            self._last_processed_marker = latest_begins_at
                            await self._persist_and_broadcast(result)
            await asyncio.sleep(1)

    _last_processed_marker: str | None = None

    async def start(self) -> None:
        self._running = True
        # Run an immediate analysis on boot so the panel isn't empty while
        # waiting for the next 5-minute boundary.
        result = await asyncio.to_thread(self._run_analysis)
        if result is not None:
            self._last_processed_marker = result.get("time_utc")
            await self._persist_and_broadcast(result)
        asyncio.create_task(self._five_minute_loop())
        asyncio.create_task(self._one_minute_loop())

    def stop(self) -> None:
        self._running = False
        self._data_source.close()
