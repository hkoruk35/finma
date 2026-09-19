"""
SPY 30m Rejim + 15m Tetik + 5m Zamanlama Sinyal Motoru

v2 mimarisi (bkz. tasks/active/014-spy-signal-engine-realtime.md ve
docs/plan "toasty-sleeping-boot.md" section 3): 30 dakikalik acilis mumu
gunun rejimini (LONG/SHORT bias) belirler ve gun boyunca kalici olur; 15
dakikalik mumlar ana tetik zaman dilimidir (yon + kirilim + hacim + ATR/govde
sartlarinin hepsi saglanmali); 5 dakikalik mumlar SADECE onaylanmis bir 15m
tetik mumu icinde giris zamanlamasini inceltmek icin kullanilir, bagimsiz
sinyal veya stop uretmez.
"""
import pandas as pd
import numpy as np


def bars_to_df(bars):
    df = pd.DataFrame(bars)
    if "interpolated" in df.columns:
        df = df[df["interpolated"] != True].copy()
    for col in ["open_price", "close_price", "high_price", "low_price", "volume"]:
        df[col] = df[col].astype(float)
    df["begins_at"] = pd.to_datetime(df["begins_at"])
    df = df.sort_values("begins_at").reset_index(drop=True)
    df = df.rename(columns={
        "open_price": "open", "close_price": "close",
        "high_price": "high", "low_price": "low"
    })
    return df


def ema(series, span):
    return series.ewm(span=span, adjust=False).mean()


def rsi(series, period=14):
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return out.fillna(50)


def macd(series, fast=12, slow=26, signal=9):
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def session_vwap(df):
    session = df["session"].iloc[-1] if "session" in df.columns and len(df) else None
    sub = df[df["session"] == session].copy() if session is not None else df.copy()
    tp = (sub["high"] + sub["low"] + sub["close"]) / 3
    cum_vp = (tp * sub["volume"]).cumsum()
    cum_vol = sub["volume"].cumsum().replace(0, np.nan)
    vwap = cum_vp / cum_vol
    return vwap.iloc[-1] if len(vwap) else np.nan


def candle_structure(last_row, prev_row):
    body = abs(last_row["close"] - last_row["open"])
    rng = max(last_row["high"] - last_row["low"], 1e-9)
    upper_wick = last_row["high"] - max(last_row["close"], last_row["open"])
    lower_wick = min(last_row["close"], last_row["open"]) - last_row["low"]
    body_ratio = body / rng
    bullish = last_row["close"] > last_row["open"]
    engulfing = False
    if prev_row is not None:
        prev_body_low = min(prev_row["open"], prev_row["close"])
        prev_body_high = max(prev_row["open"], prev_row["close"])
        if bullish and last_row["open"] <= prev_body_low and last_row["close"] >= prev_body_high:
            engulfing = True
        if (not bullish) and last_row["open"] >= prev_body_high and last_row["close"] <= prev_body_low:
            engulfing = True
    if body_ratio > 0.6:
        shape = "guclu govde (momentum mumu)"
    elif body_ratio < 0.25:
        shape = "kararsizlik / dogi benzeri"
    elif bullish and lower_wick > body:
        shape = "alt golgeli (alici destegi)"
    elif (not bullish) and upper_wick > body:
        shape = "ust golgeli (satici baskisi)"
    else:
        shape = "notr"
    if engulfing:
        shape += " + yutan mum"
    return shape, bullish, body_ratio


def resample_bars(df, rule):
    """Aggregates a finer-timeframe OHLCV dataframe (as produced by
    bars_to_df) up to a coarser timeframe using pandas resample. Index must
    be the tz-aware `begins_at` timestamp column."""
    if df.empty:
        return df.copy()
    d = df.set_index("begins_at")
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    out = d.resample(rule, label="left", closed="left").agg(agg)
    out = out.dropna(subset=["open"]).reset_index()
    return out


def atr(df, period=14):
    """Wilder ATR: TR = max(h-l, |h-prev_close|, |l-prev_close|), then
    Wilder-smoothed (alpha=1/period) average of TR."""
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def swing_pivots(df, n=3):
    """A bar is a pivot high/low if its high/low is the max/min of its own
    +/- n bar window. Returns (pivot_high: bool Series, pivot_low: bool Series)
    aligned to df's index."""
    highs, lows = df["high"], df["low"]
    pivot_high = pd.Series(False, index=df.index)
    pivot_low = pd.Series(False, index=df.index)
    n_rows = len(df)
    if n_rows < (2 * n + 1):
        return pivot_high, pivot_low
    for pos in range(n, n_rows - n):
        idx = df.index[pos]
        window_h = highs.iloc[pos - n: pos + n + 1]
        window_l = lows.iloc[pos - n: pos + n + 1]
        if highs.iloc[pos] == window_h.max():
            pivot_high.loc[idx] = True
        if lows.iloc[pos] == window_l.min():
            pivot_low.loc[idx] = True
    return pivot_high, pivot_low


def chop_band(df15, n=3):
    """Returns (last_pivot_high, last_pivot_low) from df15 — the chop-band
    boundaries a 15m trigger candle's close must break outside of. NaN when
    there isn't yet a detected pivot of that type."""
    pivot_high, pivot_low = swing_pivots(df15, n=n)
    high_positions = np.where(pivot_high.to_numpy())[0]
    low_positions = np.where(pivot_low.to_numpy())[0]
    last_high = df15["high"].iloc[high_positions[-1]] if len(high_positions) else np.nan
    last_low = df15["low"].iloc[low_positions[-1]] if len(low_positions) else np.nan
    return last_high, last_low


def rolling_volume_avg(df, window=8):
    """Simple rolling mean of volume over the last `window` CLOSED bars —
    shifted by one so the current (in-progress/just-closed) bar is never
    included in its own average."""
    return df["volume"].shift(1).rolling(window, min_periods=1).mean()


def opening_range_regime(df5_session):
    """Aggregates the session's first 6 5m bars into one 30m bar and
    compares close vs open and close vs the VWAP over that same 30m window
    to decide the day's regime. Persists for the rest of the day once set."""
    if len(df5_session) < 6:
        return {"regime": "BELİRSİZ", "range_high": np.nan, "range_low": np.nan}
    first6 = df5_session.iloc[:6]
    o = first6["open"].iloc[0]
    c = first6["close"].iloc[-1]
    range_high = first6["high"].max()
    range_low = first6["low"].min()
    vwap30 = session_vwap(first6)
    up = c > o and (np.isnan(vwap30) or c > vwap30)
    down = c < o and (np.isnan(vwap30) or c < vwap30)
    if up:
        regime = "YUKARI"
    elif down:
        regime = "AŞAĞI"
    else:
        regime = "BELİRSİZ"
    return {"regime": regime, "range_high": range_high, "range_low": range_low}


def trigger_15m(df15, regime, chop_band_vals, avg_vol, atr15):
    """The 15m trigger's 4 required conditions, all must hold:
    1) direction_ok  — candle closes in the regime's direction
    2) breakout_ok   — close breaks the last significant swing high/low
                        outside the chop band (in the regime's direction)
    3) volume_ok     — volume >= 1.15x the rolling avg of the last 8 15m bars
    4) body_atr_ok   — candle body <= 2x the 15m ATR (avoids blow-off bars)
    Returns a dict with `fired`, `side` and each condition's boolean, for
    debugging/telemetry.
    """
    if len(df15) == 0:
        return {"fired": False, "side": None, "direction_ok": False,
                "breakout_ok": False, "volume_ok": False, "body_atr_ok": False}

    last = df15.iloc[-1]
    hi, lo = chop_band_vals
    body = abs(last["close"] - last["open"])

    if regime == "YUKARI":
        side = "LONG"
        direction_ok = bool(last["close"] > last["open"])
        breakout_ok = bool((not np.isnan(hi)) and last["close"] > hi)
    elif regime == "AŞAĞI":
        side = "SHORT"
        direction_ok = bool(last["close"] < last["open"])
        breakout_ok = bool((not np.isnan(lo)) and last["close"] < lo)
    else:
        side = None
        direction_ok = False
        breakout_ok = False

    last_avg_vol = avg_vol.iloc[-1] if len(avg_vol) else np.nan
    volume_ok = bool((not np.isnan(last_avg_vol)) and last_avg_vol > 0
                      and last["volume"] >= 1.15 * last_avg_vol)

    last_atr = atr15.iloc[-1] if len(atr15) else np.nan
    body_atr_ok = bool((not np.isnan(last_atr)) and body <= 2 * last_atr)

    fired = direction_ok and breakout_ok and volume_ok and body_atr_ok
    return {
        "fired": fired,
        "side": side if fired else None,
        "direction_ok": direction_ok,
        "breakout_ok": breakout_ok,
        "volume_ok": volume_ok,
        "body_atr_ok": body_atr_ok,
    }


def stop_spy(swing_level, atr15, side):
    """Stop_SPY = last_valid_15m_swing_low/high -/+ 0.25*ATR_15m
    (LONG: swing_level - 0.25*ATR; SHORT: swing_level + 0.25*ATR)."""
    if side == "SHORT":
        return swing_level + 0.25 * atr15
    return swing_level - 0.25 * atr15


def stop_premium(entry_prem, spy_entry, spy_stop, delta, side):
    """Stop_prem = entry_prem - (spy_move)*|delta| + 0.10, where spy_move is
    the adverse SPY move to the stop (LONG: spy_entry - spy_stop; SHORT:
    spy_stop - spy_entry)."""
    if side == "SHORT":
        spy_move = spy_stop - spy_entry
    else:
        spy_move = spy_entry - spy_stop
    return entry_prem - spy_move * abs(delta) + 0.10


class SignalEngine:
    def analyze(self, bars_5m, symbol="SPY"):
        df5 = bars_to_df(bars_5m)
        if len(df5) < 30:
            return {"decision": "NO TRADE", "reason": "Yetersiz veri."}

        df5["rsi5"] = rsi(df5["close"], 14)
        vwap = session_vwap(df5)
        last5, prev5 = df5.iloc[-1], df5.iloc[-2]
        above_vwap = last5["close"] > vwap if not np.isnan(vwap) else None
        shape, _, _ = candle_structure(last5, prev5)

        # --- 30m opening-range regime (persists for the day) ---
        ny = df5["begins_at"].dt.tz_convert("America/New_York")
        ny_date = ny.dt.date
        today = ny_date.iloc[-1]
        if "session" in df5.columns:
            session_today = df5[(ny_date == today) & (df5["session"] == "regular")]
        else:
            session_today = df5[ny_date == today]
        regime_info = opening_range_regime(session_today)
        regime = regime_info["regime"]

        # --- 15m primary trigger timeframe ---
        df15 = resample_bars(df5, "15min")
        if len(df15) < 10:
            return {
                "symbol": symbol,
                "time_utc": last5["begins_at"].strftime("%Y-%m-%d %H:%M"),
                "decision": "NO TRADE",
                "regime_30m": regime,
                "trigger_15m": "OFF",
                "chop_band_hi": None,
                "chop_band_lo": None,
                "atr_15m": None,
                "avg_vol_8_15m": None,
                "vol_ratio_15m_pct": None,
                "stop_spy": None,
                "stop_premium": None,
                "refinement_5m": "WAIT",
                "rsi_5m_prev": round(prev5["rsi5"], 1),
                "rsi_5m_now": round(last5["rsi5"], 1),
                "vwap": None if np.isnan(vwap) else round(vwap, 2),
                "above_vwap": None if above_vwap is None else bool(above_vwap),
                "candle_shape": shape,
                "last_close": round(last5["close"], 2),
                "entry_zone": f"{round(last5['close']-0.05,2)}-{round(last5['close']+0.05,2)}",
                "reason": "Yetersiz 15m veri.",
            }

        atr15_series = atr(df15, 14)
        avg_vol8 = rolling_volume_avg(df15, window=8)
        chop_hi, chop_lo = chop_band(df15, n=3)
        trig = trigger_15m(df15, regime, (chop_hi, chop_lo), avg_vol8, atr15_series)

        last_atr15 = atr15_series.iloc[-1] if len(atr15_series) else np.nan
        last_avg_vol8 = avg_vol8.iloc[-1] if len(avg_vol8) else np.nan
        last15_volume = df15["volume"].iloc[-1]
        vol_ratio_15m_pct = (
            None if np.isnan(last_avg_vol8) or last_avg_vol8 == 0
            else round((last15_volume / last_avg_vol8 - 1) * 100)
        )

        decision = "NO TRADE"
        spy_stop = None
        if trig["fired"] and trig["side"] == "LONG":
            decision = "CALL SETUP"
            if not np.isnan(chop_lo) and not np.isnan(last_atr15):
                spy_stop = stop_spy(chop_lo, last_atr15, "LONG")
        elif trig["fired"] and trig["side"] == "SHORT":
            decision = "PUT SETUP"
            if not np.isnan(chop_hi) and not np.isnan(last_atr15):
                spy_stop = stop_spy(chop_hi, last_atr15, "SHORT")

        # --- 5m refinement (entry timing ONLY, no independent signal/stop) ---
        if trig["fired"]:
            if trig["side"] == "LONG":
                refinement = "READY" if last5["close"] >= last5["open"] else "WAIT"
            else:
                refinement = "READY" if last5["close"] <= last5["open"] else "WAIT"
        else:
            refinement = "WAIT"

        if trig["fired"]:
            reason = f"15m tetik onaylandi ({trig['side']})."
        else:
            failed = [k for k in ("direction_ok", "breakout_ok", "volume_ok", "body_atr_ok") if not trig.get(k)]
            reason = f"Rejim={regime}, eksik sartlar: {', '.join(failed) if failed else 'yok'}."

        return {
            "symbol": symbol,
            "time_utc": last5["begins_at"].strftime("%Y-%m-%d %H:%M"),
            "decision": decision,
            "regime_30m": regime,
            "trigger_15m": "ON" if trig["fired"] else "OFF",
            "chop_band_hi": None if np.isnan(chop_hi) else round(chop_hi, 2),
            "chop_band_lo": None if np.isnan(chop_lo) else round(chop_lo, 2),
            "atr_15m": None if np.isnan(last_atr15) else round(last_atr15, 4),
            "avg_vol_8_15m": None if np.isnan(last_avg_vol8) else round(last_avg_vol8, 1),
            "vol_ratio_15m_pct": vol_ratio_15m_pct,
            "stop_spy": None if spy_stop is None else round(spy_stop, 2),
            "stop_premium": None,
            "refinement_5m": refinement,
            "rsi_5m_prev": round(prev5["rsi5"], 1),
            "rsi_5m_now": round(last5["rsi5"], 1),
            "vwap": None if np.isnan(vwap) else round(vwap, 2),
            "above_vwap": None if above_vwap is None else bool(above_vwap),
            "candle_shape": shape,
            "last_close": round(last5["close"], 2),
            "entry_zone": f"{round(last5['close']-0.05,2)}-{round(last5['close']+0.05,2)}",
            "reason": reason,
        }
