"""
YahooDataSource — SPY 5m/1m bar fetcher for spy_signal_engine.

Same API/pattern already used by spy_0dte_options_sync.py at repo root and
frontend/lib/spyengine/market.ts: Yahoo Finance's v8 chart endpoint
(https://query1.finance.yahoo.com/v8/finance/chart/SPY). No new data source,
no robin_stocks/IBKR — plain HTTP.

get_bars() reshapes Yahoo's timestamp/indicators.quote[0] arrays into the
same Robinhood-historicals-shaped dict this repo's other Python code already
expects (begins_at ISO string, open_price/close_price/high_price/low_price,
volume, session) — see robinhood_spy_sync.py for the shape this mirrors.
"""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
NY_TZ = ZoneInfo("America/New_York")

# Yahoo intraday `range` ceilings: 1m data is only kept ~7 days; 5m/other
# interval data goes back much further, but we only ever need a small
# lookback window here so we stay well inside both limits.
_RANGE_BY_INTERVAL = {
    "1m": "5d",
    "2m": "5d",
    "5m": "1mo",
    "15m": "1mo",
}

_HEADERS = {
    # Yahoo's chart endpoint 429s anonymous requests without a browser-like UA.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def _range_for(interval: str, lookback_minutes: int) -> str:
    """Pick a Yahoo `range` value that safely covers lookback_minutes for
    the given interval, capped at what Yahoo actually serves for that
    interval (1m: ~7d max; 5m: up to 60d)."""
    if interval == "1m":
        # Yahoo caps 1m history at ~7 days regardless of what we ask for.
        if lookback_minutes <= 60 * 6:
            return "1d"
        return "5d"
    if interval == "5m":
        if lookback_minutes <= 60 * 6:
            return "5d"
        if lookback_minutes <= 60 * 24 * 20:
            return "1mo"
        return "60d"
    # Fallback for any other interval we might be asked for later.
    return "1mo"


def _session_for(ts_utc: datetime) -> str:
    """pre / regular / post, from NYSE hours (9:30-16:00 America/New_York),
    no external market-calendar dependency — matches the session tagging
    convention already used by robinhood_spy_sync.py bars."""
    ny = ts_utc.astimezone(NY_TZ)
    minutes = ny.hour * 60 + ny.minute
    if minutes < 9 * 60 + 30:
        return "pre"
    if minutes >= 16 * 60:
        return "post"
    return "regular"


class YahooDataSource:
    """Fetches SPY (or any symbol) 5m/1m bars from Yahoo Finance's public
    chart API and reshapes them into the Robinhood-historicals bar shape
    used throughout this repo's Python bots."""

    def __init__(self, timeout: float = 10.0):
        self._client = httpx.Client(timeout=timeout, headers=_HEADERS)

    def close(self) -> None:
        self._client.close()

    def get_bars(self, symbol: str, interval: str, lookback_minutes: int) -> list[dict]:
        rng = _range_for(interval, lookback_minutes)
        url = YAHOO_CHART_URL.format(symbol=symbol)
        resp = self._client.get(
            url,
            params={"interval": interval, "range": rng, "includePrePost": "true"},
        )
        resp.raise_for_status()
        payload = resp.json()

        result = (payload.get("chart") or {}).get("result") or []
        if not result:
            return []
        chart = result[0]

        timestamps = chart.get("timestamp") or []
        indicators = (chart.get("indicators") or {}).get("quote") or []
        if not timestamps or not indicators:
            return []
        quote = indicators[0]

        opens = quote.get("open") or []
        closes = quote.get("close") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        volumes = quote.get("volume") or []

        bars: list[dict] = []
        for i, ts in enumerate(timestamps):
            o = opens[i] if i < len(opens) else None
            c = closes[i] if i < len(closes) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            v = volumes[i] if i < len(volumes) else None
            if o is None or c is None or h is None or l is None:
                # Yahoo pads gaps (halts, thin pre/post liquidity) with nulls.
                continue
            ts_utc = datetime.fromtimestamp(ts, tz=timezone.utc)
            bars.append({
                "begins_at": ts_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "open_price": float(o),
                "close_price": float(c),
                "high_price": float(h),
                "low_price": float(l),
                "volume": float(v) if v is not None else 0.0,
                "session": _session_for(ts_utc),
            })

        # Keep only the trailing lookback window (rough cut by bar count,
        # scheduler/signal_engine only ever look at the tail anyway).
        interval_minutes = {"1m": 1, "2m": 2, "5m": 5, "15m": 15}.get(interval, 5)
        max_bars = max(30, (lookback_minutes // interval_minutes) + 10)
        if len(bars) > max_bars:
            bars = bars[-max_bars:]
        return bars
