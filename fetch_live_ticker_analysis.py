#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_live_ticker_analysis.py
-----------------------------
Fetches real-time price history, financials, and company metrics from Yahoo Finance.
Calculates all technical indicators, BOGA scores, and entry/exit strategy parameters.
Saves the results in JSON format and outputs to stdout.
"""

import sys
import os
import json
import math
from datetime import datetime
import pandas as pd
import numpy as np
import yfinance as yf

# Replicate EMA calculation to avoid dependency on ta-lib/ta packages
def calculate_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No ticker provided"}))
        sys.exit(1)
        
    ticker = sys.argv[1].strip().upper()
    
    try:
        # 1. Fetch info and history
        stock = yf.Ticker(ticker)
        
        # 1D History for technical indicators and 52-week metrics
        df_1d = stock.history(period="252d", interval="1d")
        if df_1d.empty:
            print(json.dumps({"error": f"No daily data found for {ticker} in Yahoo Finance. Ticker might be invalid."}))
            sys.exit(1)
            
        # Clean columns caps
        df_1d.columns = [c.capitalize() for c in df_1d.columns]
        
        # 1H History for precise entry/exit zones and S/R levels
        df_1h = stock.history(period="10d", interval="1h")
        if not df_1h.empty:
            df_1h.columns = [c.capitalize() for c in df_1h.columns]
            
        # Fetch stock details info
        info = stock.info
        if not info or not isinstance(info, dict):
            info = {}
            
        # Get last close price
        current_price = float(df_1d['Close'].iloc[-1])
        prev_close = float(df_1d['Close'].iloc[-2]) if len(df_1d) >= 2 else current_price
        change_pct = ((current_price - prev_close) / prev_close) * 100
        
        # 2. Compute Technical Indicators
        # EMA
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
        
        # 3. Support & Resistance Levels
        if not df_1h.empty:
            support_1h = float(df_1h['Low'].tail(40).min())
            resist_1h = float(df_1h['High'].tail(40).max())
        else:
            support_1h = float(df_1d['Low'].tail(15).min())
            resist_1h = float(df_1d['High'].tail(15).max())
            
        support_level = support_1h
        resistance_level = resist_1h
        
        # 4. Fundamental metrics
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
            
        # 5. Compute BOGA Scores
        # Technical score (10 to 100)
        t_score = 30.0
        if current_price > ema_20: t_score += 15
        if current_price > ema_50: t_score += 15
        if current_price > ema_200: t_score += 15
        if ema_stack_bullish: t_score += 15
        if 45 <= rsi_14 <= 65: t_score += 10
        elif rsi_14 < 30: t_score += 10
        if rvol > 1.3: t_score += 5
        t_score = max(10, min(100, t_score))
        
        # Fundamental score (10 to 100)
        f_score = 40.0
        if gross_margin > 0.40: f_score += 15
        if net_margin > 0.10: f_score += 15
        if fcf_yield > 0.04: f_score += 15
        if revenue_growth > 0.08: f_score += 15
        f_score = max(10, min(100, f_score))
        
        # Momentum score (10 to 100)
        roc_1w = ((current_price - df_1d['Close'].iloc[-6]) / df_1d['Close'].iloc[-6]) * 100 if len(df_1d) >= 6 else 0.0
        roc_1m = ((current_price - df_1d['Close'].iloc[-21]) / df_1d['Close'].iloc[-21]) * 100 if len(df_1d) >= 21 else 0.0
        m_score = 50.0
        if roc_1w > 2.0: m_score += 15
        if roc_1m > 5.0: m_score += 15
        if rsi_14 > 50: m_score += 10
        if rvol > 1.2: m_score += 10
        m_score = max(10, min(100, m_score))
        
        # Sentiment score
        inst_ownership = info.get("heldPercentInstitutions", 0.0) or 0.0
        short_float = info.get("shortPercentOfFloat", 0.0) or 0.0
        s_score = 50.0
        if inst_ownership > 0.60: s_score += 15
        if short_float > 0.15: s_score += 15 # potential short squeeze target
        elif short_float > 0.08: s_score += 5
        s_score = max(10, min(100, s_score))
        
        # Master score (weighted sum)
        master_score = (t_score * 0.45) + (f_score * 0.25) + (m_score * 0.20) + (s_score * 0.10)
        master_score = max(10.0, min(100.0, master_score))
        
        # Signal type
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
            
        # 6. Strategy Planning (Entry, Target, Stop Loss)
        # Entry range
        entry_low = support_level * 0.99
        entry_high = support_level * 1.015
        if current_price < entry_low:
            entry_low = current_price * 0.985
            entry_high = current_price * 1.005
            
        stop_loss = support_level * 0.95
        if stop_loss >= current_price:
            stop_loss = current_price * 0.94
            
        target_low = resistance_level * 1.01
        target_high = resistance_level * 1.06
        if target_low <= current_price:
            target_low = current_price * 1.08
            target_high = current_price * 1.15
            
        rr_ratio = (target_low - entry_high) / (entry_high - stop_loss) if (entry_high - stop_loss) > 0 else 2.5
        rr_ratio = max(1.5, min(4.0, rr_ratio))
        
        # Get historical returns
        ret_1w = ((current_price - df_1d['Close'].iloc[-6]) / df_1d['Close'].iloc[-6]) * 100 if len(df_1d) >= 6 else 0.0
        ret_1m = ((current_price - df_1d['Close'].iloc[-21]) / df_1d['Close'].iloc[-21]) * 100 if len(df_1d) >= 21 else 0.0
        ret_1y = ((current_price - df_1d['Close'].iloc[0]) / df_1d['Close'].iloc[0]) * 100 if len(df_1d) >= 200 else 0.0
        
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
                "change_pct_1w": round(ret_1w, 2),
                "change_pct_1m": round(ret_1m, 2),
                "change_pct_1y": round(ret_1y, 2),
                "volume": int(df_1d['Volume'].iloc[-1]),
                "avg_volume_30d": int(volume.tail(30).mean())
            },
            "scores": {
                "master_score": round(master_score, 1),
                "technical_score": round(t_score, 1),
                "fundamental_score": round(f_score, 1),
                "momentum_score": round(m_score, 1),
                "sentiment_score": round(s_score, 1),
                "signal_type": signal_type
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
                "risk_reward_ratio": round(rr_ratio, 2)
            }
        }
        
        # Save to targets
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
