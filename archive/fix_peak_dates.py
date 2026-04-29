#!/usr/bin/env python3
"""
fix_peak_dates.py
─────────────────
Tüm swing_performance.json kayıtlarını düzelt:
  - Her pick için entry_date'den itibaren MAX 30 günlük pencerede
    gerçek peak (en yüksek High) fiyatını ve tarihini bul
  - days = entry_date → peak_date arasındaki gün sayısı (bekleme süresi)
  - peak_date alanını ekle
  - PENDING (0 günlük, bugünkü) kayıtlar: entry==today → atla
"""

import json
import os
import time
import logging
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/fix_peak_dates.log", encoding="utf-8"),
    ]
)
log = logging.getLogger("fix_peak_dates")

PERFORMANCE_FILE = "frontend/public/swing_performance.json"
MAX_HOLD_DAYS = 30
BATCH_SIZE = 15          # yfinance'a tek seferde kaç ticker
SLEEP_BETWEEN = 0.3      # saniye — rate limit

# ──────────────────────────────────────────────
def load_history():
    with open(PERFORMANCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_history(data):
    with open(PERFORMANCE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# ──────────────────────────────────────────────
def fetch_30d_high(ticker: str, entry_date: datetime, today: datetime) -> dict:
    """
    entry_date'den MAX 30 gün içindeki gerçek High peak'i bul.
    Returns: {peak_price, peak_date_str, days_to_peak}
    """
    window_end = min(entry_date + timedelta(days=MAX_HOLD_DAYS), today)

    # yfinance start/end: start dahil, end hariç
    start_str = entry_date.strftime("%Y-%m-%d")
    end_str   = (window_end + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        hist = yf.Ticker(ticker).history(start=start_str, end=end_str)
    except Exception as e:
        log.warning(f"  {ticker}: yfinance error — {e}")
        return {}

    if hist.empty:
        log.warning(f"  {ticker}: no data from {start_str} → {end_str}")
        return {}

    # Sadece entry_date'e eşit veya sonraki bar'lar
    hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
    mask = hist.index.normalize() >= pd.Timestamp(entry_date)
    hist = hist[mask]

    if hist.empty:
        return {}

    peak_idx   = hist["High"].idxmax()
    peak_price = float(hist["High"].max())
    peak_date  = peak_idx.normalize()
    days_to_peak = (peak_date - pd.Timestamp(entry_date)).days

    return {
        "peak_price":    round(peak_price, 4),
        "peak_date_str": peak_date.strftime("%Y-%m-%d"),
        "days_to_peak":  int(max(0, days_to_peak)),
    }

# ──────────────────────────────────────────────
def main():
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = today.strftime("%Y-%m-%d")

    data = load_history()
    history = data["history"]
    log.info(f"Toplam kayıt: {len(history)}")

    # ── Grubu belirle ─────────────────────────────────────────
    # Bugünkü PENDING'ler: days=0, peak henüz oluşmamış → atla
    to_fix = []
    skip_today = 0

    for r in history:
        entry_date_str = r.get("date", "")
        if entry_date_str == today_str:
            skip_today += 1
            continue          # bugün eklenenler için henüz veri yok
        to_fix.append(r)

    log.info(f"Düzeltilecek kayıt: {len(to_fix)} | Bugünkü atlanıyor: {skip_today}")

    # ── Ticker → kayıtlar sözlüğü ────────────────────────────
    ticker_map: dict[str, list] = {}
    for r in to_fix:
        t = r["ticker"]
        ticker_map.setdefault(t, []).append(r)

    unique_tickers = list(ticker_map.keys())
    log.info(f"Benzersiz ticker: {len(unique_tickers)}")

    # ── Tek tek işle (gruplama opsiyonu: aynı ticker birden fazla entry) ──
    updated = 0
    errors  = 0

    for i, ticker in enumerate(unique_tickers, 1):
        records = ticker_map[ticker]
        log.info(f"[{i}/{len(unique_tickers)}] {ticker} — {len(records)} kayıt")

        for r in records:
            entry_date_str = r["date"]
            try:
                entry_date  = datetime.strptime(entry_date_str, "%Y-%m-%d")
                entry_price = float(r.get("entry", 0))
            except Exception as e:
                log.error(f"  Parse hatası {ticker}/{entry_date_str}: {e}")
                errors += 1
                continue

            result = fetch_30d_high(ticker, entry_date, today)
            if not result:
                errors += 1
                continue

            peak_price    = result["peak_price"]
            peak_date_str = result["peak_date_str"]
            days_to_peak  = result["days_to_peak"]

            # Eğer entry fiyatı 0 ya da yok → girişi koru
            if entry_price <= 0:
                entry_price = peak_price  # fallback

            return_pct = round(((peak_price - entry_price) / entry_price) * 100, 2) if entry_price > 0 else 0.0

            r["max_price"]  = round(peak_price, 2)
            r["peak_date"]  = peak_date_str
            r["days"]       = days_to_peak      # bekleme süresi (entry→peak)
            r["return_pct"] = return_pct

            # result alanı: 30 günden fazla geçmiş mi?
            days_since_entry = (today - entry_date).days
            if days_since_entry <= MAX_HOLD_DAYS:
                r["result"] = "PENDING"
            else:
                r["result"] = "WIN" if return_pct > 0 else "FLAT"

            updated += 1

        time.sleep(SLEEP_BETWEEN)

    # ── İstatistikleri yeniden hesapla ───────────────────────
    total  = len(history)
    wins   = sum(1 for x in history if x.get("return_pct", 0) > 0)
    data["stats"] = {
        "total_picks":      total,
        "win_rate":         round(wins / total * 100, 1) if total else 0,
        "avg_return_pct":   round(sum(x.get("return_pct", 0) for x in history) / total, 1) if total else 0,
        "period_days":      180,
        "above_5pct_rate":  round(sum(1 for x in history if x.get("return_pct", 0) >= 5)  / total * 100, 1) if total else 0,
        "above_10pct_rate": round(sum(1 for x in history if x.get("return_pct", 0) >= 10) / total * 100, 1) if total else 0,
    }
    data["generated_at"] = datetime.now().isoformat()

    save_history(data)
    log.info(f"Tamamlandı. Güncellenen: {updated} | Hata: {errors}")

    # ── Özet rapor ───────────────────────────────────────────
    over30 = [r for r in history if r.get("days", 0) > 30]
    log.info(f"30 günden fazla days değeri kalan: {len(over30)}  (olmamalı)")

    avg_days_to_peak = sum(r.get("days", 0) for r in history if r.get("result") != "PENDING") / max(1, len([r for r in history if r.get("result") != "PENDING"]))
    log.info(f"Ortalama bekleme süresi (days to peak): {avg_days_to_peak:.1f} gün")

if __name__ == "__main__":
    os.makedirs("logs", exist_ok=True)
    main()
