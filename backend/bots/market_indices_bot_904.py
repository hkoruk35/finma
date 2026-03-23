"""
Bot 904 — Market Indices Bot
SP500 başta olmak üzere endeks/kripto/emtia verilerini önceden cache'e yazar.
Schedule: Her 60 saniyede bir (bot_runner.py'den çağrılır)
"""
import json
import logging
import os
import sys
import time
from datetime import datetime

import yfinance as yf

logger = logging.getLogger("bot_904_indices")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT_904] %(levelname)s: %(message)s")

# ^ prefix'li ticker KULLANILMAZ. ES=F = S&P 500 Futures (display: SPX)
SYMBOLS = [
    "ES=F",    # SPX — S&P 500 Futures (HER ZAMAN İLK)
    "YM=F",    # DJI — Dow Jones Futures
    "NQ=F",    # NDX — Nasdaq 100 Futures
    "RTY=F",   # RUT — Russell 2000 Futures
    "^VIX",    # VIX (tek ^ prefix kalan)
    "BTC-USD", # BTC
    "ETH-USD", # ETH
    "GC=F",    # GC — Gold Futures
    "SI=F",    # SI — Silver Futures
    "CL=F",    # CL — Crude Oil Futures
]

DISPLAY_MAP = {
    "ES=F":    "SPX",
    "YM=F":    "DJI",
    "NQ=F":    "NDX",
    "RTY=F":   "RUT",
    "^VIX":    "VIX",
    "BTC-USD": "BTC",
    "ETH-USD": "ETH",
    "GC=F":    "GC",
    "SI=F":    "SI",
    "CL=F":    "CL",
}

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "output", "indices_904.json")


def fetch_indices():
    results = []
    try:
        tickers_obj = yf.Tickers(" ".join(SYMBOLS))
        for symbol in SYMBOLS:
            try:
                t = tickers_obj.tickers[symbol]
                fast = t.fast_info

                price = 0.0
                try:
                    price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
                except (TypeError, ValueError):
                    pass

                if price <= 0:
                    hist = t.history(period="1d")
                    if not hist.empty:
                        price = float(hist["Close"].iloc[-1])

                prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
                if prev <= 0:
                    hist_prev = t.history(period="5d")
                    if len(hist_prev) >= 2:
                        prev = float(hist_prev["Close"].iloc[-2])

                change = price - prev if prev else 0
                change_pct = (change / prev * 100) if prev else 0

                if price <= 0:
                    continue

                display = DISPLAY_MAP.get(symbol, symbol.replace("^", "").replace("-USD", "").replace("=F", ""))
                results.append({
                    "symbol": display,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 4),
                })
            except Exception as e:
                logger.warning(f"Error fetching {symbol}: {e}")
                continue
    except Exception as e:
        logger.error(f"Batch fetch error: {e}")

    return results


def run():
    logger.info("Bot 904 — Market Indices Bot starting...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    indices = fetch_indices()
    if not indices:
        logger.warning("No indices data fetched")
        return

    output = {
        "updated_at": datetime.utcnow().isoformat(),
        "indices": indices
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    logger.info(f"Bot 904 — Saved {len(indices)} indices to {OUTPUT_FILE}")


if __name__ == "__main__":
    run()
