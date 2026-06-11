"""
update_heatmap_prices.py
Saatlik heatmap fiyat güncelleyici.

- frontend/public/data/latest/all_tickers_list.json içindeki her hissenin
  price ve change_pct değerini yfinance ile günceller.
- frontend/public/data/latest/master.json içindeki market_indices'i günceller.
- Hızlı: sadece fiyat verisi çeker, AI analizi yapmaz.
"""

import json
import math
import os
import time
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

import yfinance as yf

sys.stdout.reconfigure(encoding="utf-8")

NY_TZ = ZoneInfo("America/New_York")
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "frontend", "public", "data", "latest")

ALL_TICKERS_FILE = os.path.join(DATA_DIR, "all_tickers_list.json")
MASTER_FILE      = os.path.join(DATA_DIR, "master.json")

LOG_DIR = os.path.join(ROOT, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(os.path.join(LOG_DIR, "heatmap_prices.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")

# Piyasa saatleri kontrolü (NYSE 09:30–16:00 NY)
def is_market_hours() -> bool:
    now = datetime.now(NY_TZ)
    if now.weekday() >= 5:   # hafta sonu
        return False
    h, m = now.hour, now.minute
    return (h > 9 or (h == 9 and m >= 30)) and h < 16

def safe_float(val, default=0.0) -> float:
    try:
        v = float(val)
        return default if (math.isnan(v) or math.isinf(v)) else v
    except Exception:
        return default

def fetch_prices(tickers: list[str]) -> dict[str, dict]:
    """Toplu yfinance indirme — {TICKER: {price, change_pct, volume}}"""
    if not tickers:
        return {}

    result = {}
    # Batch indir (500 sembol limiti, 2 günlük data yeterli)
    try:
        df = yf.download(
            tickers,
            period="2d",
            interval="1d",
            group_by="ticker",
            threads=True,
            progress=False,
            auto_adjust=True,
        )
    except Exception as e:
        log(f"WARN: Bulk download hatası: {e}")
        return {}

    for ticker in tickers:
        try:
            td = df[ticker] if len(tickers) > 1 else df
            if td is None or td.empty:
                continue
            td = td.dropna(subset=["Close"])
            if len(td) < 1:
                continue

            close_today = safe_float(td["Close"].iloc[-1])
            volume_today = safe_float(td["Volume"].iloc[-1]) if "Volume" in td.columns else 0.0

            if len(td) >= 2:
                close_prev = safe_float(td["Close"].iloc[-2])
                change_pct = ((close_today - close_prev) / close_prev * 100) if close_prev > 0 else 0.0
            else:
                change_pct = 0.0

            result[ticker.upper()] = {
                "price":      round(close_today, 4),
                "change_pct": round(change_pct, 2),
                "volume":     int(volume_today),
            }
        except Exception:
            continue

    return result

def update_all_tickers(prices: dict[str, dict]) -> int:
    if not os.path.exists(ALL_TICKERS_FILE):
        log("SKIP: all_tickers_list.json bulunamadı.")
        return 0

    with open(ALL_TICKERS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated = 0
    for stock in data.get("tickers", []):
        ticker = stock.get("ticker", "").upper()
        if ticker in prices:
            p = prices[ticker]
            stock["price"]      = p["price"]
            stock["change_pct"] = p["change_pct"]
            if p["volume"] > 0:
                stock["volume"] = p["volume"]
            updated += 1

    data["price_updated_at"] = datetime.now(NY_TZ).isoformat()

    with open(ALL_TICKERS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return updated

def update_master_indices(prices: dict[str, dict]):
    """market_indices'i SPY/QQQ/DIA/^VIX ile güncelle."""
    if not os.path.exists(MASTER_FILE):
        log("SKIP: master.json bulunamadı.")
        return

    with open(MASTER_FILE, "r", encoding="utf-8") as f:
        master = json.load(f)

    index_map = {
        "SPY":  "SP500",
        "QQQ":  "NASDAQ",
        "DIA":  "DOW",
        "^VIX": "VIX",
        "IWM":  "RUSSELL2000",
    }

    if "market_indices" not in master:
        master["market_indices"] = {}

    for etf, key in index_map.items():
        etf_upper = etf.upper()
        if etf_upper in prices:
            p = prices[etf_upper]
            master["market_indices"][key] = {
                "value":      p["price"],
                "change_pct": p["change_pct"],
            }

    master["price_updated_at"] = datetime.now(NY_TZ).isoformat()

    with open(MASTER_FILE, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)

def main():
    log("=== Heatmap Fiyat Güncellemesi Başlatıldı ===")

    if not is_market_hours():
        log("Piyasa kapalı veya hafta sonu — güncelleme atlandı.")
        return

    # Mevcut ticker listesini oku
    if not os.path.exists(ALL_TICKERS_FILE):
        log(f"HATA: {ALL_TICKERS_FILE} bulunamadı.")
        return

    with open(ALL_TICKERS_FILE, "r", encoding="utf-8") as f:
        tickers_data = json.load(f)

    stock_tickers = [
        s["ticker"].upper()
        for s in tickers_data.get("tickers", [])
        if s.get("ticker")
    ]

    # Endeks ETF'lerini de ekle
    index_etfs = ["SPY", "QQQ", "DIA", "^VIX", "IWM"]
    all_tickers = list(dict.fromkeys(stock_tickers + index_etfs))  # tekrar önle

    log(f"Toplam {len(all_tickers)} sembol indiriliyor...")

    prices = fetch_prices(all_tickers)
    log(f"{len(prices)} sembole ait fiyat alındı.")

    # all_tickers_list.json güncelle
    updated_count = update_all_tickers(prices)
    log(f"all_tickers_list.json: {updated_count} hisse güncellendi.")

    # master.json endeksleri güncelle
    update_master_indices(prices)
    log("master.json market_indices güncellendi.")

    log("=== Heatmap güncellemesi tamamlandı ===")

if __name__ == "__main__":
    main()
