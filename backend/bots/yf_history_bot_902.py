"""
Bot 902 — Yahoo Finance Historical Data Bot
60 hissenin OHLCV geçmişini önceden indirir. Chart endpoint'leri için hazır tutar.
Schedule: Her 15 dakikada bir
"""
import json
import logging
import os
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger("bot_902_history")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT_902] %(levelname)s: %(message)s")

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output", "history_902")
SWING113_FILE = os.path.join(os.path.dirname(__file__), "output", "swing113_latest.json")
MOVERS_FILE = os.path.join(os.path.dirname(__file__), "output", "movers_901.json")

PERIODS = ["1d", "5d", "1mo", "3mo", "1y"]


def load_tickers_from_swing113():
    try:
        if os.path.exists(SWING113_FILE):
            with open(SWING113_FILE) as f:
                data = json.load(f)
            return [o["ticker"] for o in data.get("opportunities", [])[:10]]
    except Exception as e:
        logger.warning(f"Could not load swing113 tickers: {e}")
    return []


def load_tickers_from_movers():
    try:
        if os.path.exists(MOVERS_FILE):
            with open(MOVERS_FILE) as f:
                data = json.load(f)
            tickers = []
            for group in ["gainers", "losers", "volume"]:
                tickers += [m["symbol"] for m in data.get(group, [])]
            return list(dict.fromkeys(tickers))  # deduplicate preserving order
    except Exception as e:
        logger.warning(f"Could not load movers tickers: {e}")
    return []


def download_history(ticker: str, period: str):
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval="1d" if period in ["1mo","3mo","1y"] else "1h")
        if df.empty:
            return None

        records = []
        for idx, row in df.iterrows():
            records.append({
                "time": int(idx.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] else 0,
            })
        return records
    except Exception as e:
        logger.warning(f"History error {ticker}/{period}: {e}")
        return None


def run():
    logger.info("Bot 902 — Historical Data Bot starting...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    swing113_tickers = load_tickers_from_swing113()
    movers_tickers = load_tickers_from_movers()

    # Combine, deduplicate, max 60
    all_tickers = list(dict.fromkeys(swing113_tickers + movers_tickers))[:60]
    logger.info(f"Processing {len(all_tickers)} tickers across {len(PERIODS)} periods")

    saved = 0
    for ticker in all_tickers:
        for period in PERIODS:
            try:
                data = download_history(ticker, period)
                if data:
                    fname = os.path.join(OUTPUT_DIR, f"{ticker}_{period}.json")
                    with open(fname, "w") as f:
                        json.dump({
                            "ticker": ticker,
                            "period": period,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "candles": data
                        }, f)
                    saved += 1
            except Exception as e:
                logger.warning(f"Save error {ticker}/{period}: {e}")

    logger.info(f"Bot 902 — Saved {saved} history files to {OUTPUT_DIR}")


if __name__ == "__main__":
    run()
