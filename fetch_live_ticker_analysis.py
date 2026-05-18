#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_live_ticker_analysis.py
-----------------------------
Fetches real-time price history, financials, and company metrics from Yahoo Finance.
Calculates all technical indicators, BOGA scores, and entry/exit strategy parameters
matching 100% of the swing117_boga timing, 1H pivot support/resist, and 15m direction rules.
"""

import sys
import os
import json
import math
from datetime import datetime
import pandas as pd
import numpy as np
import yfinance as yf

# Replicate EMA calculation
def calculate_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

def check_15m_micro_trend(df_15m: pd.DataFrame) -> dict:
    """
    15m zaman diliminde son 8 mumun (2 saat) gürültüsüz yön analizini yapar.
    """
    if df_15m is None or len(df_15m) < 10:
        return {'is_valid': True, 'score_bonus': 0.0, 'msg': "⚠️ 15m veri yetersiz (nötr)"}

    recent_15m = df_15m.tail(8)
    close_prices = recent_15m['Close'].values
    open_prices = recent_15m['Open'].values
    
    net_change_pct = (close_prices[-1] - close_prices[0]) / close_prices[0] * 100
    green_candles = sum(1 for i in range(8) if close_prices[i] > open_prices[i])
    
    highs = recent_15m['High'].values
    is_bleeding = (highs[-1] < highs[-3]) and (highs[-3] < highs[-6])

    if net_change_pct < -1.0 and green_candles <= 3 and is_bleeding:
        return {'is_valid': False, 'score_bonus': -10.0, 'msg': "🚨 15m KANAMA: Son 2 saatte yoğun dağıtım (İptal)"}
    
    if net_change_pct > 0.5 and green_candles >= 5:
        return {'is_valid': True, 'score_bonus': 4.0, 'msg': f"🔥 15m ONAY: Son 2 saat net trend (+{net_change_pct:.2f}%)"}
    
    if net_change_pct < 0 and green_candles < 4:
        return {'is_valid': True, 'score_bonus': -2.0, 'msg': "⚠️ 15m Uyarı: Son 2 saat yön aşağı"}

    return {'is_valid': True, 'score_bonus': 1.0, 'msg': "⚖️ 15m Yatay/Sıkışma: Gürültü yok"}

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame, current_price: float) -> dict:
    """
    BOGA AI TIMING ENGINE (100% Swing117 Python replication)
    """
    close_1d = df_1d['Close']
    high_1d  = df_1d['High']
    low_1d   = df_1d['Low']
    
    # ATR
    high_low = high_1d - low_1d
    high_cp = np.abs(high_1d - close_1d.shift(1))
    low_cp = np.abs(low_1d - close_1d.shift(1))
    tr = pd.concat([high_low, high_cp, low_cp], axis=1).max(axis=1)
    atr_series = tr.rolling(14).mean()
    atr_1d = float(atr_series.iloc[-1]) if not atr_series.empty else current_price * 0.03
    atr_pct = atr_1d / current_price

    macro_support = float(low_1d.tail(10).min())
    macro_resist  = float(high_1d.tail(15).max())

    support_1h = macro_support
    resist_1h  = macro_resist

    entry_valid = False
    entry_type = "WAITING_FOR_VOLUME_OR_SWEEP"
    entry_confidence = 0

    if df_1h is not None and len(df_1h) >= 20:
        low_1h   = df_1h['Low']
        high_1h  = df_1h['High']
        close_1h = df_1h['Close']
        open_1h  = df_1h['Open']
        vol_1h   = df_1h['Volume']

        curr_c = float(close_1h.iloc[-1])
        curr_o = float(open_1h.iloc[-1])
        curr_h = float(high_1h.iloc[-1])
        curr_l = float(low_1h.iloc[-1])
        curr_v = float(vol_1h.iloc[-1])

        prev_c = float(close_1h.iloc[-2])
        prev_o = float(open_1h.iloc[-2])

        # 1H Pivot / Noise Filter
        lows, highs = low_1h.tail(50), high_1h.tail(50)
        pivot_lows = [float(lows.iloc[i]) for i in range(2, len(lows)-2) if lows.iloc[i] < lows.iloc[i-1] and lows.iloc[i] < lows.iloc[i+1]]
        pivot_highs = [float(highs.iloc[i]) for i in range(2, len(highs)-2) if highs.iloc[i] > highs.iloc[i-1] and highs.iloc[i] > highs.iloc[i+1]]

        supports_below = [p for p in pivot_lows if p < current_price - (atr_1d * 0.4)]
        if supports_below:
            support_1h = max(max(supports_below), macro_support)
        
        resists_above = [p for p in pivot_highs if p > current_price + (atr_1d * 0.5)]
        if resists_above:
            resist_1h = min(min(resists_above), macro_resist)

        # Vol spike
        vol_avg_20 = float(vol_1h.rolling(20).mean().iloc[-1])
        is_green_candle = curr_c > curr_o
        volume_spike_breakout = (curr_v > vol_avg_20 * 1.3) and is_green_candle
        volume_spike_sweep = (curr_v > vol_avg_20 * 1.8) and is_green_candle

        # Candle wicks
        body = abs(curr_c - curr_o)
        lower_wick = min(curr_c, curr_o) - curr_l
        upper_wick = curr_h - max(curr_c, curr_o)
        
        is_pinbar = (lower_wick > body * 2.0) and (upper_wick < body * 0.5)
        is_bullish_engulfing = is_green_candle and (prev_c < prev_o) and (curr_c > prev_o) and (curr_o < prev_c)

        is_liquidity_sweep = (curr_l < support_1h) and (curr_c > support_1h)
        recent_local_high = float(high_1h.iloc[-11:-1].max()) if len(high_1h) >= 11 else float(high_1h.iloc[:-1].max())
        is_bos = (curr_c > recent_local_high) and volume_spike_breakout

        is_pullback = (support_1h <= curr_l <= support_1h + (atr_1d * 0.3))

        # Early momentum check via EMA20
        try:
            ema20_1h_series = calculate_ema(close_1h, 20)
            ema20_1h_val = float(ema20_1h_series.iloc[-1])
            roc_1h = ((curr_c - prev_c) / prev_c) * 100 if prev_c > 0 else 0.0
            is_early_momentum = (curr_c > ema20_1h_val) and (roc_1h > 0.8) and (curr_v > vol_avg_20 * 1.15)
        except Exception:
            is_early_momentum = False

        if is_liquidity_sweep and (is_pinbar or volume_spike_sweep):
            entry_valid = True
            entry_type = "REVERSAL (Liquidity Sweep)"
            entry_confidence = 95
        elif is_bos:
            entry_valid = True
            entry_type = "BREAKOUT (BOS)"
            entry_confidence = 85
        elif is_early_momentum:
            entry_valid = True
            entry_type = "EARLY MOMENTUM"
            entry_confidence = 80
        elif is_pullback and (is_pinbar or is_bullish_engulfing) and volume_spike_breakout:
            entry_valid = True
            entry_type = "PULLBACK"
            entry_confidence = 80

    if (current_price - support_1h) < (atr_1d * 0.6):
        support_1h = current_price - (atr_1d * 0.8)

    is_momentum_entry = entry_valid and entry_type in ("BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)")

    if is_momentum_entry:
        buy_zone_low  = round(current_price - (atr_1d * 0.25), 2)
        buy_zone_high = round(current_price + (atr_1d * 0.15), 2)
    elif entry_valid and entry_type == "PULLBACK":
        buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
        buy_zone_high = round(current_price + (atr_1d * 0.1), 2)
    else:
        buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
        buy_zone_high = round(current_price + (atr_1d * 0.1), 2)

    if buy_zone_low >= buy_zone_high:
        buy_zone_low = round(buy_zone_high - (atr_1d * 0.3), 2)

    stop_high = round(support_1h - (atr_1d * 0.5), 2)
    stop_low  = round(stop_high - (atr_1d * 0.2), 2)

    avg_entry = (current_price * 0.995) if entry_valid else ((buy_zone_low + buy_zone_high) / 2)
    risk = max(avg_entry - stop_high, atr_1d * 1.0)
    
    structural_reward = resist_1h - avg_entry
    reward = max(risk * 2.0, structural_reward) if structural_reward > 0 else risk * 2.5
    
    rr_cap = 4.0
    if reward > risk * rr_cap:
        reward = risk * rr_cap

    sell_zone_low  = round(avg_entry + reward * 0.85, 2)
    sell_zone_high = round(avg_entry + reward, 2)

    actual_risk   = avg_entry - stop_high
    actual_reward = sell_zone_high - avg_entry
    rr_ratio = round(actual_reward / actual_risk, 2) if actual_risk > 0 else 0.0

    return {
        "entry_engine": {
            "valid": entry_valid,
            "type": entry_type,
            "confidence": entry_confidence
        },
        "buy_zone":  {"low": buy_zone_low,  "high": buy_zone_high},
        "sell_zone": {"low": sell_zone_low,  "high": sell_zone_high},
        "stop_zone": {"low": stop_low,        "high": stop_high},
        "support_1h":  round(support_1h, 2),
        "resist_1h":   round(resist_1h, 2),
        "atr_1d":      round(atr_1d, 2),
        "atr_pct":     round(atr_pct * 100, 2),
        "rr_ratio":    rr_ratio,
        "risk_usd":    round(actual_risk, 2),
        "reward_usd":  round(actual_reward, 2)
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No ticker provided"}))
        sys.exit(1)
        
    ticker = sys.argv[1].strip().upper()
    
    try:
        stock = yf.Ticker(ticker)
        
        # 1D History
        df_1d = stock.history(period="252d", interval="1d")
        if df_1d.empty:
            print(json.dumps({"error": f"No daily data found for {ticker} in Yahoo Finance. Ticker might be invalid."}))
            sys.exit(1)
            
        df_1d.columns = [c.capitalize() for c in df_1d.columns]
        
        # 1H History
        df_1h = stock.history(period="10d", interval="1h")
        if not df_1h.empty:
            df_1h.columns = [c.capitalize() for c in df_1h.columns]
            
        # 15M History
        df_15m = stock.history(period="5d", interval="15m")
        if not df_15m.empty:
            df_15m.columns = [c.capitalize() for c in df_15m.columns]
            
        # Fetch stock details info
        info = stock.info
        if not info or not isinstance(info, dict):
            info = {}
            
        # Get last close price
        current_price = float(df_1d['Close'].iloc[-1])
        prev_close = float(df_1d['Close'].iloc[-2]) if len(df_1d) >= 2 else current_price
        change_pct = ((current_price - prev_close) / prev_close) * 100
        
        # Compute Technical Indicators
        ema_20_series = calculate_ema(df_1d['Close'], 20)
        ema_50_series = calculate_ema(df_1d['Close'], 50)
        ema_200_series = calculate_ema(df_1d['Close'], 200)
        
        ema_20 = float(ema_20_series.iloc[-1])
        ema_50 = float(ema_50_series.iloc[-1])
        ema_200 = float(ema_200_series.iloc[-1])
        
        ema_stack_bullish = (ema_20 > ema_50) and (ema_50 > ema_200)
        
        # RSI
        rsi_series = calculate_rsi(df_1d['Close'], 14)
        rsi_14 = float(rsi_series.iloc[-1])
        
        # ATR
        high_low = df_1d['High'] - df_1d['Low']
        high_cp = np.abs(df_1d['High'] - df_1d['Close'].shift(1))
        low_cp = np.abs(df_1d['Low'] - df_1d['Close'].shift(1))
        tr = pd.concat([high_low, high_cp, low_cp], axis=1).max(axis=1)
        atr_series = tr.rolling(14).mean()
        atr = float(atr_series.iloc[-1]) if not atr_series.empty else current_price * 0.03
        atr_pct = (atr / current_price) * 100
        
        # Relative Volume (RVOL)
        volume = df_1d['Volume']
        avg_vol_5d = float(volume.tail(5).mean())
        avg_vol_30d = float(volume.tail(30).mean())
        rvol = (avg_vol_5d / avg_vol_30d) if avg_vol_30d > 0 else 1.0
        
        # 52w Metrics
        high_52w = float(df_1d['High'].max())
        low_52w = float(df_1d['Low'].min())
        
        # MACD
        exp1 = df_1d['Close'].ewm(span=12, adjust=False).mean()
        exp2 = df_1d['Close'].ewm(span=26, adjust=False).mean()
        macd_val = exp1 - exp2
        macd_signal_val = macd_val.ewm(span=9, adjust=False).mean()
        macd_hist_val = macd_val - macd_signal_val
        
        macd = float(macd_val.iloc[-1])
        macd_signal = float(macd_signal_val.iloc[-1])
        macd_histogram = float(macd_hist_val.iloc[-1])
        
        # Bollinger Bands
        bb_middle_series = df_1d['Close'].rolling(20).mean()
        bb_std = df_1d['Close'].rolling(20).std()
        bb_upper_series = bb_middle_series + (bb_std * 2)
        bb_lower_series = bb_middle_series - (bb_std * 2)
        
        bb_upper = float(bb_upper_series.iloc[-1]) if not bb_upper_series.empty else current_price * 1.05
        bb_lower = float(bb_lower_series.iloc[-1]) if not bb_lower_series.empty else current_price * 0.95
        bb_middle = float(bb_middle_series.iloc[-1]) if not bb_middle_series.empty else current_price
        
        # Timing engine calculation (Replicates swing117 exactly!)
        timing = calculate_support_resistance_1h(df_1h, df_1d, current_price)
        
        # 15m micro trend
        micro15 = check_15m_micro_trend(df_15m)
        
        # Fundamental metrics
        market_cap = info.get("marketCap", info.get("market_cap", 0))
        pe_ratio = info.get("trailingPE", info.get("trailing_pe", 0)) or 0.0
        pb_ratio = info.get("priceToBook", info.get("price_to_book", 0)) or 0.0
        gross_margin = info.get("grossMargins", 0.0) or 0.0
        operating_margin = info.get("operatingMargins", 0.0) or 0.0
        net_margin = info.get("profitMargins", 0.0) or 0.0
        revenue_growth = info.get("revenueGrowth", 0.0) or 0.0
        fcf_yield = 0.0
        fcf = info.get("freeCashflow", 0) or 0
        if fcf and market_cap:
            fcf_yield = fcf / market_cap
            
        # Compute BOGA Scores
        t_score = 30.0
        if current_price > ema_20: t_score += 15
        if current_price > ema_50: t_score += 15
        if current_price > ema_200: t_score += 15
        if ema_stack_bullish: t_score += 15
        if 45 <= rsi_14 <= 65: t_score += 10
        elif rsi_14 < 30: t_score += 10
        if rvol > 1.3: t_score += 5
        t_score = max(10, min(100, t_score))
        
        f_score = 40.0
        if gross_margin > 0.40: f_score += 15
        if net_margin > 0.10: f_score += 15
        if fcf_yield > 0.04: f_score += 15
        if revenue_growth > 0.08: f_score += 15
        f_score = max(10, min(100, f_score))
        
        roc_1w = ((current_price - df_1d['Close'].iloc[-6]) / df_1d['Close'].iloc[-6]) * 100 if len(df_1d) >= 6 else 0.0
        roc_1m = ((current_price - df_1d['Close'].iloc[-21]) / df_1d['Close'].iloc[-21]) * 100 if len(df_1d) >= 21 else 0.0
        m_score = 50.0
        if roc_1w > 2.0: m_score += 15
        if roc_1m > 5.0: m_score += 15
        if rsi_14 > 50: m_score += 10
        if rvol > 1.2: m_score += 10
        m_score = max(10, min(100, m_score))
        
        inst_ownership = info.get("heldPercentInstitutions", 0.0) or 0.0
        short_float = info.get("shortPercentOfFloat", 0.0) or 0.0
        s_score = 50.0
        if inst_ownership > 0.60: s_score += 15
        if short_float > 0.15: s_score += 15
        elif short_float > 0.08: s_score += 5
        s_score = max(10, min(100, s_score))
        
        # Master score (incorporate 15m micro trend score bonus!)
        master_score = (t_score * 0.40) + (f_score * 0.25) + (m_score * 0.20) + (s_score * 0.15)
        master_score += micro15['score_bonus']
        master_score = max(10.0, min(100.0, master_score))
        
        # Hard Reject handling if toxic distribution
        if not micro15['is_valid']:
            master_score = min(35.0, master_score)
            
        if master_score >= 68:
            signal_type = "STRONG_BUY"
        elif master_score >= 56:
            signal_type = "BUY"
        elif master_score <= 40:
            signal_type = "STRONG_SELL"
        elif master_score <= 48:
            signal_type = "SELL"
        else:
            signal_type = "NEUTRAL"
            
        # Strategy zones
        entry_low = timing["buy_zone"]["low"]
        entry_high = timing["buy_zone"]["high"]
        stop_loss = timing["stop_zone"]["high"]
        target_low = timing["sell_zone"]["low"]
        target_high = timing["sell_zone"]["high"]
        rr_ratio = timing["rr_ratio"]
        
        # Assemble final JSON
        report = {
            "ticker": ticker,
            "company": info.get("longName", info.get("companyName", f"{ticker} Corp.")),
            "date": datetime.today().strftime("%Y-%m-%d"),
            "generated_at": datetime.now().isoformat(),
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "price": {
                "current": round(current_price, 2),
                "open": round(float(df_1d['Open'].iloc[-1]), 2),
                "high": round(float(df_1d['High'].iloc[-1]), 2),
                "low": round(float(df_1d['Low'].iloc[-1]), 2),
                "prev_close": round(prev_close, 2),
                "change_pct": round(change_pct, 2),
                "change_pct_1w": round(roc_1w, 2),
                "change_pct_1m": round(roc_1m, 2),
                "change_pct_1y": round(((current_price - df_1d['Close'].iloc[0]) / df_1d['Close'].iloc[0]) * 100 if len(df_1d) >= 200 else 0.0, 2),
                "volume": int(df_1d['Volume'].iloc[-1]),
                "avg_volume_30d": int(volume.tail(30).mean())
            },
            "scores": {
                "master_score": round(master_score, 1),
                "technical_score": round(t_score, 1),
                "fundamental_score": round(f_score, 1),
                "momentum_score": round(m_score, 1),
                "sentiment_score": round(s_score, 1),
                "signal_type": signal_type,
                "micro_15m": micro15
            },
            "technical": {
                "rsi_14": round(rsi_14, 2),
                "macd": round(macd, 4),
                "macd_signal": round(macd_signal, 4),
                "macd_histogram": round(macd_histogram, 4),
                "ema_20": round(ema_20, 2),
                "ema_50": round(ema_50, 2),
                "ema_200": round(ema_200, 2),
                "ema_stack_bullish": bool(ema_stack_bullish),
                "bb_upper": round(bb_upper, 2),
                "bb_middle": round(bb_middle, 2),
                "bb_lower": round(bb_lower, 2),
                "bb_width": round((bb_upper - bb_lower) / bb_middle * 100, 2),
                "atr": round(atr, 2),
                "atr_pct": round(atr_pct, 2),
                "rvol": round(rvol, 2),
                "52w_high": round(high_52w, 2),
                "52w_low": round(low_52w, 2)
            },
            "fundamental": {
                "pe_ratio": round(pe_ratio, 2),
                "pb_ratio": round(pb_ratio, 2),
                "gross_margin": round(gross_margin, 4),
                "operating_margin": round(operating_margin, 4),
                "net_margin": round(net_margin, 4),
                "market_cap": int(market_cap) if market_cap else 0,
                "revenue_growth_ttm": round(revenue_growth, 4),
                "fcf_yield": round(fcf_yield, 4),
                "institutional_ownership_pct": round(inst_ownership, 4)
            },
            "scores_detail": {
                "entry_range_low": round(entry_low, 2),
                "entry_range_high": round(entry_high, 2),
                "target_range_low": round(target_low, 2),
                "target_range_high": round(target_high, 2),
                "stop_loss": round(stop_loss, 2),
                "risk_reward_ratio": round(rr_ratio, 2),
                "entry_engine": timing["entry_engine"]
            }
        }
        
        # Save to target directories
        target_dirs = [
            "data/latest/stocks",
            "frontend/public/data/latest/stocks"
        ]
        
        for d in target_dirs:
            os.makedirs(d, exist_ok=True)
            path = os.path.join(d, f"{ticker}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
                
        # Output final JSON
        print(json.dumps(report, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": f"Analysis execution failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
