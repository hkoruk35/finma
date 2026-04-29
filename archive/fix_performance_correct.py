#!/usr/bin/env python3
"""
fix_performance_correct.py
──────────────────────────
Doğru hesaplama:

1. 30 gün içinde peak >= entry → WIN
   - days = peak'e ulaştığı gün
   - return% = (peak - entry) / entry * 100
   - close_price = peak

2. Peak < entry AND day 30 close < entry → LOSS
   - days = 30
   - return% = (close_30 - entry) / entry * 100
   - close_price = day_30_close

3. Peak < entry BUT day 30 close >= entry → WIN
   - days = 30
   - return% = (close_30 - entry) / entry * 100
   - close_price = day_30_close
"""

import json
import logging
from datetime import datetime, timedelta
import pandas as pd
import yfinance as yf

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/fix_performance_correct.log", encoding="utf-8"),
    ]
)
log = logging.getLogger(__name__)

PERFORMANCE_FILE = "frontend/public/swing_performance.json"
MAX_HOLD_DAYS = 30
SLEEP = 0.3

def load():
    with open(PERFORMANCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save(data):
    with open(PERFORMANCE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def fetch_history(ticker, start_date):
    """Fetch 30-day history from entry date"""
    end_date = min(start_date + timedelta(days=MAX_HOLD_DAYS), datetime.now())
    try:
        hist = yf.Ticker(ticker).history(
            start=start_date.strftime("%Y-%m-%d"),
            end=(end_date + timedelta(days=1)).strftime("%Y-%m-%d")
        )
        if hist.empty:
            return None
        hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
        mask = hist.index.normalize() >= pd.Timestamp(start_date)
        hist = hist[mask]
        return hist if not hist.empty else None
    except Exception as e:
        log.warning(f"Fetch error: {e}")
        return None

def main():
    import time

    data = load()
    history = data.get("history", [])
    log.info(f"Toplam kayıt: {len(history)}")

    updated = errors = 0

    for i, record in enumerate(history, 1):
        try:
            entry_price = float(record.get("entry", 0))
            if entry_price <= 0:
                continue

            entry_date = datetime.strptime(record["date"], "%Y-%m-%d")
            ticker = record["ticker"]

            hist = fetch_history(ticker, entry_date)
            if hist is None or hist.empty:
                errors += 1
                time.sleep(SLEEP)
                continue

            # Find peak within 30 days and track day 30 close
            peak_price = entry_price
            peak_date = None
            day_30_close = entry_price

            for ts, row in hist.iterrows():
                day = ts.normalize()
                high = float(row["High"])
                close = float(row["Close"])

                # Always update to the last close (which will be day 30 or whenever hist ends)
                day_30_close = close

                # Find peak
                if high > peak_price:
                    peak_price = high
                    peak_date = day

            # Calculate result and days
            entry_ts = pd.Timestamp(entry_date)

            if peak_price >= entry_price:
                # Peak >= entry → WIN (use peak price)
                result = "WIN"
                if peak_date:
                    days = int((peak_date - entry_ts).days)
                else:
                    days = 0
                close_price = peak_price
            else:
                # Peak < entry → check day 30 close
                if day_30_close < entry_price:
                    # Peak < entry AND day 30 < entry → LOSS
                    result = "LOSS"
                    days = 30
                    close_price = day_30_close
                else:
                    # Peak < entry BUT day 30 >= entry → WIN
                    result = "WIN"
                    days = 30
                    close_price = day_30_close

            return_pct = round(((close_price - entry_price) / entry_price) * 100, 2)

            # Update record
            record["result"] = result
            record["days"] = days
            record["close_price"] = round(close_price, 2)
            record["return_pct"] = return_pct
            record["max_price"] = round(peak_price, 2)
            if peak_date:
                record["peak_date"] = peak_date.strftime("%Y-%m-%d")

            updated += 1

            if i % 50 == 0:
                log.info(f"[{i}/{len(history)}] {ticker}")

            time.sleep(SLEEP)

        except Exception as e:
            log.warning(f"Error processing {record.get('ticker')}: {e}")
            errors += 1
            continue

    # Calculate stats
    total = len(history)
    wins = sum(1 for x in history if x.get("result") == "WIN")
    losses = sum(1 for x in history if x.get("result") == "LOSS")
    pending = sum(1 for x in history if x.get("result") == "PENDING")

    settled = total - pending
    win_rate = round(wins / settled * 100, 1) if settled > 0 else 0
    loss_rate = round(losses / settled * 100, 1) if settled > 0 else 0
    avg_return = round(sum(x.get("return_pct", 0) for x in history) / total, 2) if total > 0 else 0

    data["stats"] = {
        "total_picks": total,
        "wins": wins,
        "losses": losses,
        "pending": pending,
        "win_rate": win_rate,
        "loss_rate": loss_rate,
        "avg_return_pct": avg_return,
        "period_days": 180,
    }
    data["generated_at"] = datetime.now().isoformat()

    save(data)

    log.info(f"Tamamlandı. Updated={updated}, Errors={errors}")
    log.info(f"Wins={wins} ({win_rate}%) | Losses={losses} ({loss_rate}%) | Pending={pending}")
    log.info(f"Avg Return: {avg_return}%")

if __name__ == "__main__":
    main()
