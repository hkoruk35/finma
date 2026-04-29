#!/usr/bin/env python3
"""
update_swing_prices.py
---------------------
Daily job: fetches current live prices for all tickers in swing_performance.json
and updates the current_price field. Entry prices remain unchanged.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

OUTPUT = Path("frontend/public/swing_performance.json")


def fetch_current_price(ticker: str) -> tuple[str, float | None]:
    """Fetch current price for a ticker. Returns (ticker, price or None)."""
    try:
        data = yf.Ticker(ticker).fast_info
        price = getattr(data, "currentPrice", None)
        return ticker, price
    except Exception as e:
        log.warning(f"Failed to fetch price for {ticker}: {e}")
        return ticker, None


def main():
    if not OUTPUT.exists():
        log.error(f"{OUTPUT} not found")
        return

    # Load current data
    with open(OUTPUT, encoding="utf-8") as f:
        perf_data = json.load(f)

    history = perf_data.get("history", [])
    if not history:
        log.error("No history found in swing_performance.json")
        return

    # Collect all unique tickers
    tickers = list(set(t.get("ticker") for t in history if t.get("ticker")))
    log.info(f"Updating {len(tickers)} tickers...")

    # Fetch prices in parallel
    prices = {}
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(fetch_current_price, ticker): ticker for ticker in tickers}
        done = 0
        for f in as_completed(futures):
            ticker, price = f.result()
            if price:
                prices[ticker] = price
            done += 1
            if done % 50 == 0:
                log.info(f"Progress: {done}/{len(tickers)}")

    # Update history with current prices
    updated_count = 0
    for trade in history:
        ticker = trade.get("ticker")
        if ticker in prices:
            trade["current_price"] = round(prices[ticker], 2)
            updated_count += 1

    # Update timestamp
    perf_data["stats"]["last_updated"] = datetime.now().isoformat()

    # Save
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)

    log.info(f"Done. Updated {updated_count}/{len(history)} records")
    log.info(f"Next update: {perf_data['stats']['last_updated']}")


if __name__ == "__main__":
    main()
