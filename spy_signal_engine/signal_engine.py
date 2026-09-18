"""
SPY 5M Trend + Filter -> 1M Trigger -> Sinyal Motoru

Verbatim per tasks/active/014-spy-signal-engine-realtime.md — do not modify
the math/thresholds here. Only import/wrap this module from elsewhere.
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
    session = df["session"].iloc[-1] if "session" in df.columns else None
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


def support_resistance(df, lookback=40):
    recent = df.tail(lookback)
    return recent["low"].min(), recent["high"].max()


class SignalEngine:
    def analyze(self, bars_5m, bars_1m, symbol="SPY"):
        df5 = bars_to_df(bars_5m)
        df1 = bars_to_df(bars_1m)
        if len(df5) < 30 or len(df1) < 5:
            return {"decision": "NO TRADE", "reason": "Yetersiz veri."}

        df5["ema21"] = ema(df5["close"], 21)
        df5["rsi14"] = rsi(df5["close"], 14)
        _, _, hist = macd(df5["close"])
        df5["macd_hist"] = hist
        df5["vol_avg20"] = df5["volume"].rolling(20, min_periods=5).mean()

        last5, prev5 = df5.iloc[-1], df5.iloc[-2]

        ema_trend_up = last5["close"] > last5["ema21"] and last5["ema21"] >= prev5["ema21"]
        ema_trend_down = last5["close"] < last5["ema21"] and last5["ema21"] <= prev5["ema21"]
        rsi_up = last5["rsi14"] > prev5["rsi14"]
        macd_up = last5["macd_hist"] > prev5["macd_hist"]

        up_score = sum([ema_trend_up, rsi_up and last5["rsi14"] > 50, macd_up and last5["macd_hist"] > 0])
        down_score = sum([ema_trend_down, (not rsi_up) and last5["rsi14"] < 50, (not macd_up) and last5["macd_hist"] < 0])
        trend = "UP" if up_score >= 2 else ("DOWN" if down_score >= 2 else "FLAT")

        vol_ratio = last5["volume"] / last5["vol_avg20"] if last5["vol_avg20"] and not np.isnan(last5["vol_avg20"]) else np.nan
        vwap = session_vwap(df5)
        above_vwap = last5["close"] > vwap if not np.isnan(vwap) else None
        shape, _, _ = candle_structure(last5, prev5)
        support, resistance = support_resistance(df5)
        near_resistance = (resistance - last5["close"]) / last5["close"] < 0.0015
        near_support = (last5["close"] - support) / last5["close"] < 0.0015

        filter_ok_call = (not np.isnan(vol_ratio) and vol_ratio >= 1.1) and (above_vwap is True) and not near_resistance
        filter_ok_put = (not np.isnan(vol_ratio) and vol_ratio >= 1.1) and (above_vwap is False) and not near_support

        df1["ema9_1m"] = ema(df1["close"], 9)
        last1, prev1 = df1.iloc[-1], df1.iloc[-2]
        trigger_up = last1["close"] > last1["ema9_1m"] and last1["close"] > last1["open"] and last1["close"] >= prev1["close"]
        trigger_down = last1["close"] < last1["ema9_1m"] and last1["close"] < last1["open"] and last1["close"] <= prev1["close"]

        decision = "NO TRADE"
        if trend == "UP" and filter_ok_call and trigger_up:
            decision = "CALL SETUP"
        elif trend == "DOWN" and filter_ok_put and trigger_down:
            decision = "PUT SETUP"

        return {
            "symbol": symbol,
            "time_utc": last5["begins_at"].strftime("%Y-%m-%d %H:%M"),
            "decision": decision,
            "trend": trend,
            "rsi_prev": round(prev5["rsi14"], 1),
            "rsi_now": round(last5["rsi14"], 1),
            "macd_dir": "yukselen" if macd_up else "dusen",
            "vol_ratio_pct": None if np.isnan(vol_ratio) else round((vol_ratio - 1) * 100),
            "vwap": None if np.isnan(vwap) else round(vwap, 2),
            "above_vwap": None if above_vwap is None else bool(above_vwap),
            "candle_shape": shape,
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "trigger_1m": "ON" if (trigger_up or trigger_down) else "OFF",
            "last_close": round(last5["close"], 2),
            "entry_zone": f"{round(last5['close']-0.05,2)}-{round(last5['close']+0.05,2)}",
        }
