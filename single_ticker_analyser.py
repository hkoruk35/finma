import yfinance as yf
import pandas as pd
import numpy as np
import json
import sys
import os
from datetime import datetime
from ta.volatility import AverageTrueRange
from ta.trend import EMAIndicator

def calculate_zones(ticker):
    try:
        # Fetch data
        stock = yf.Ticker(ticker)
        
        # 1D data for ATR
        df_1d = stock.history(period="60d", interval="1d")
        if df_1d.empty:
            return {"error": f"Could not fetch 1d data for {ticker}"}
            
        # 1H data for S/R
        df_1h = stock.history(period="10d", interval="1h")
        if df_1h.empty:
            return {"error": f"Could not fetch 1h data for {ticker}"}

        # 15M data for micro levels
        df_15m = stock.history(period="5d", interval="15m")

        current_price = float(df_1d['Close'].iloc[-1])
        
        # ATR Calculation (1D)
        atr_obj = AverageTrueRange(df_1d['High'], df_1d['Low'], df_1d['Close'], window=14)
        atr_1d = float(atr_obj.average_true_range().iloc[-1])
        atr_pct = (atr_1d / current_price) * 100

        # Support / Resistance (1H based - last 40 bars)
        lookback_h = min(len(df_1h), 40)
        support_1h = float(df_1h['Low'].tail(lookback_h).min())
        resist_1h = float(df_1h['High'].tail(lookback_h).max())

        # EMA for trend
        ema20_1d = EMAIndicator(df_1d['Close'], 20).ema_indicator().iloc[-1]
        ema50_1d = EMAIndicator(df_1d['Close'], 50).ema_indicator().iloc[-1]

        # Swing114 Logic for Zones
        # 1. Buy Zone
        # If price is near support, or breaking out.
        # We'll use the "Pullback" logic primarily for the mini-bot.
        buy_zone_low = round(support_1h + (atr_1d * 0.1), 2)
        buy_zone_high = round(current_price + (atr_1d * 0.05), 2)
        
        # Safety for buy zone
        if buy_zone_low >= buy_zone_high:
            buy_zone_low = round(current_price * 0.99, 2)
            buy_zone_high = round(current_price * 1.01, 2)

        # 2. Stop Loss (Below support)
        stop_high = round(support_1h - (atr_1d * 0.5), 2)
        stop_low = round(stop_high - (atr_1d * 0.2), 2)

        # 3. Profit Target (2:1 R/R min or Resistance)
        avg_entry = current_price
        risk = max(avg_entry - stop_high, atr_1d * 1.0)
        
        # Realistic Target (1.6x ATR to 2.0x ATR)
        reward = risk * 2.2
        target_price = avg_entry + reward
        
        # Cap target if it's too far (>15%)
        if (target_price - avg_entry) / avg_entry > 0.15:
            target_price = avg_entry * 1.15

        sell_zone_low = round(target_price * 0.98, 2)
        sell_zone_high = round(target_price, 2)

        # Performance
        perf_1d = ((current_price - df_1d['Close'].iloc[-2]) / df_1d['Close'].iloc[-2]) * 100

        result = {
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "change_1d": round(perf_1d, 2),
            "atr_1d": round(atr_1d, 2),
            "atr_pct": round(atr_pct, 2),
            "support_1h": round(support_1h, 2),
            "resistance_1h": round(resist_1h, 2),
            "buy_zone": {"low": buy_zone_low, "high": buy_zone_high},
            "sell_zone": {"low": sell_zone_low, "high": sell_zone_high},
            "stop_zone": {"low": stop_low, "high": stop_high},
            "ema20_1d": round(ema20_1d, 2),
            "ema50_1d": round(ema50_1d, 2),
            "generated_at": datetime.now().isoformat(),
            "timeframes_used": ["1d", "1h", "15m"]
        }
        
        return result

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No ticker provided"}))
        sys.exit(1)
        
    ticker = sys.argv[1].upper()
    analysis = calculate_zones(ticker)
    
    # Save to archive
    archive_dir = "archive/single_analysis"
    os.makedirs(archive_dir, exist_ok=True)
    
    file_path = os.path.join(archive_dir, f"{ticker}.json")
    with open(file_path, "w") as f:
        json.dump(analysis, f, indent=2)
        
    print(json.dumps(analysis))
