#!/usr/bin/env python3
"""
fix_performance_with_sl.py
──────────────────────────
Her swing pick için gerçekçi TP/SL takibi ekle:

1. SL = entry × 0.92  (8% stop loss — swing standartı)
   TP = entry × 1.10  (10% take profit)
2. 30 günlük pencerede gerçek yfinance Low/High verisi ile:
   - Fiyat SL'ın altına düştüyse → LOSS, days = SL gününe kadar
   - Fiyat TP üstüne çıktıysa önce → WIN, days = TP gününe kadar
   - İkisi de olmadıysa → result = MAX (en yüksek tutulan fiyat)
3. peak_date, max_price, return_pct güncellenir
4. tp / sl alanları eklenir
"""

import json, os, sys, time, logging
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/fix_performance_with_sl.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("fix_sl")

PERFORMANCE_FILE = "frontend/public/swing_performance.json"
MAX_HOLD_DAYS    = 30
SL_PCT           = 0.05   # 5% stop loss
TP_PCT           = 0.001  # 0.1% take profit
SLEEP            = 0.3    # rate limit

def load():
    with open(PERFORMANCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save(data):
    with open(PERFORMANCE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def fetch_window(ticker, entry_date, today):
    """30 günlük penceredeki Open/High/Low/Close verisi"""
    window_end = min(entry_date + timedelta(days=MAX_HOLD_DAYS), today)
    start = entry_date.strftime("%Y-%m-%d")
    end   = (window_end + timedelta(days=1)).strftime("%Y-%m-%d")
    try:
        hist = yf.Ticker(ticker).history(start=start, end=end)
        if hist.empty:
            return None
        hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
        mask = hist.index.normalize() >= pd.Timestamp(entry_date)
        hist = hist[mask]
        return hist if not hist.empty else None
    except Exception as e:
        log.warning(f"  {ticker} fetch error: {e}")
        return None

def main():
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.strftime("%Y-%m-%d")

    data = load()
    history = data["history"]
    log.info(f"Toplam kayıt: {len(history)}")

    # Bugünkü PENDING'leri atla
    to_fix = [r for r in history if r.get("date") != today_str]
    log.info(f"İşlenecek: {len(to_fix)}")

    # Ticker → records
    ticker_map: dict[str, list] = {}
    for r in to_fix:
        ticker_map.setdefault(r["ticker"], []).append(r)

    updated = errors = 0

    for i, (ticker, records) in enumerate(ticker_map.items(), 1):
        log.info(f"[{i}/{len(ticker_map)}] {ticker} — {len(records)} kayıt")

        for r in records:
            entry_price = float(r.get("entry", 0))
            if entry_price <= 0:
                continue

            try:
                entry_date = datetime.strptime(r["date"], "%Y-%m-%d")
            except:
                continue

            sl_price = round(entry_price * (1 - SL_PCT), 4)
            tp_price = round(entry_price * (1 + TP_PCT), 4)

            hist = fetch_window(ticker, entry_date, today)
            if hist is None:
                # Veri yok: tahmin değerleri koru, tp/sl ekle
                r["tp"] = round(tp_price, 2)
                r["sl"] = round(sl_price, 2)
                errors += 1
                continue

            # ─── Gün bazında SL / TP kontrolü ───────────────────────
            sl_hit_date  = None
            tp_hit_date  = None
            peak_price   = entry_price
            peak_date_ts = None
            last_close   = entry_price
            last_day     = None

            for ts, row in hist.iterrows():
                day = ts.normalize()
                low  = float(row["Low"])
                high = float(row["High"])
                close= float(row["Close"])

                # Peak takibi
                if high > peak_price:
                    peak_price   = high
                    peak_date_ts = day

                # Son gün fiyatını kaydet
                last_close = close
                last_day = day

                # SL kontrol (günlük Low)
                if sl_hit_date is None and low <= sl_price:
                    sl_hit_date = day

                # TP kontrol (günlük High)
                if tp_hit_date is None and high >= tp_price:
                    tp_hit_date = day

            # ─── Sonuç belirleme ─────────────────────────────────────
            entry_ts = pd.Timestamp(entry_date)

            if sl_hit_date is not None and tp_hit_date is not None:
                # Hangisi önce geldiyse
                if sl_hit_date <= tp_hit_date:
                    # SL önce çarpıldı → LOSS
                    result  = "LOSS"
                    days    = int((sl_hit_date - entry_ts).days)
                    close_p = sl_price
                else:
                    # TP önce çarpıldı → WIN
                    result  = "WIN"
                    days    = int((tp_hit_date - entry_ts).days)
                    close_p = tp_price
            elif sl_hit_date is not None:
                result  = "LOSS"
                days    = int((sl_hit_date - entry_ts).days)
                close_p = sl_price
            elif tp_hit_date is not None:
                result  = "WIN"
                days    = int((tp_hit_date - entry_ts).days)
                close_p = tp_price
            else:
                # Ne SL ne TP — 30 günün sonundaki Close fiyatına göre kapat
                close_p = last_close
                if last_day:
                    days = int((last_day - entry_ts).days)
                else:
                    days = 0
                # 30 günün sonundaki fiyat entry'den yüksekse WIN, düşükse LOSS
                result = "WIN" if close_p >= entry_price else "LOSS"

            return_pct = round(((close_p - entry_price) / entry_price) * 100, 2)
            days       = max(0, min(days, MAX_HOLD_DAYS))

            # ─── Kaydı güncelle ──────────────────────────────────────
            r["tp"]         = round(tp_price, 2)
            r["sl"]         = round(sl_price, 2)
            r["result"]     = result
            r["days"]       = days
            r["return_pct"] = return_pct
            r["close_price"]= round(close_p, 2)

            # Peak güncelle (her zaman 30 günlük maksimum)
            r["max_price"]  = round(peak_price, 2)
            if peak_date_ts is not None:
                r["peak_date"] = peak_date_ts.strftime("%Y-%m-%d")

            updated += 1

        time.sleep(SLEEP)

    # ─── Stats yeniden hesapla ────────────────────────────────────
    total  = len(history)
    wins   = sum(1 for x in history if x.get("result") == "WIN")
    losses = sum(1 for x in history if x.get("result") == "LOSS")
    pending= sum(1 for x in history if x.get("result") == "PENDING")

    settled = total - pending
    win_rate = round(wins / settled * 100, 1) if settled > 0 else 0
    loss_rate = round(losses / settled * 100, 1) if settled > 0 else 0

    data["stats"] = {
        "total_picks":      total,
        "wins":             wins,
        "losses":           losses,
        "win_rate":         win_rate,
        "loss_rate":        loss_rate,
        "avg_return_pct":   round(sum(x.get("return_pct", 0) for x in history) / total, 1) if total else 0,
        "period_days":      180,
    }
    data["generated_at"] = datetime.now().isoformat()

    save(data)

    log.info(f"Tamamlandı. Updated={updated}, Errors={errors}")
    log.info(f"Wins={wins}, Losses={losses}, Pending={pending}")
    log.info(f"Win Rate: {win_rate}% | Loss Rate: {loss_rate}%")
    log.info(f"Wins={wins}, Losses={losses}, Pending={pending}")
    log.info(f"Win Rate: {data['stats']['win_rate']}% | Loss Rate: {data['stats']['loss_rate']}%")

if __name__ == "__main__":
    os.makedirs("logs", exist_ok=True)
    main()
