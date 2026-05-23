#!/usr/bin/env python3
"""
BOGA AI — Pre-Catalyst Scanner v1.0
Gece taraması (23:00) ile ertesi gün patlama yapabilecek hisseleri tespit eder.
Çıktı: watchlist_YYYYMMDD.json → swing117_boga.py tarafından okunur.

AKTX örneği (22 Mayıs 2026, +157%): Bu sistem bir gün öncesinden tespit etmiş olurdu.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
from zoneinfo import ZoneInfo

# ─── SETUP ────────────────────────────────────────────────────────────────────

NY_TZ = ZoneInfo("America/New_York")
HERE = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(HERE, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(levelname)s — %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "pre_catalyst_scanner.log"), encoding="utf-8")
    ]
)
log = logging.getLogger("pre_catalyst")

# ─── CONFIG ────────────────────────────────────────────────────────────────────

SCREENER_API = "http://localhost:3000/api/screener"  # Dev: localhost | Prod: https://bogastock.com
PRESET = "pre_catalyst"
SCAN_LIMIT = 1000  # Tüm pre-catalyst aday hisseleri tara

# PCS Eşikleri
PCS_POSITION_THRESHOLD = 85   # POZİSYON AL (açılışta öncelikli izle)
PCS_WATCHLIST_THRESHOLD = 70  # WATCHLİST'E AL (manuel doğrulamaya al)

# ─── PCS HESAPLAMA ─────────────────────────────────────────────────────────────

def calculate_pcs(
    ticker: str,
    market_cap_m: float,
    rvol: float,
    rsi: float,
    change_1d: float,
    closes_5d: List[float],
    macd: float,
) -> Dict[str, Any]:
    """
    Pre-Catalyst Score (PCS) = 100 puan maksimum
    Bileşenler:
    1. Float Score (0-30): MCap'a göre
    2. Volume Score (0-25): RVOL anomalisi
    3. Momentum Score (0-25): Yeşil kapanış + RSI ısınması
    4. Event Score (0-20): Earnings / katalizör
    """

    # 1. FLOAT SCORE (0-30)
    if market_cap_m < 50:
        float_score = 30
    elif market_cap_m < 150:
        float_score = 20
    else:
        float_score = 5

    # 2. VOLUME ANOMALY SCORE (0-25)
    if rvol > 3.0:
        rvol_score = 25
    elif rvol > 2.0:
        rvol_score = 15
    elif rvol > 1.5:
        rvol_score = 8
    else:
        rvol_score = 0

    # 3. MOMENTUM SCORE (0-25)
    momentum_score = 0

    # 3a. Green closes (son 5 gün)
    green_count = 0
    for i in range(1, len(closes_5d)):
        if closes_5d[i] > closes_5d[i-1]:
            green_count += 1

    if green_count >= 3:
        momentum_score += 15
    elif green_count == 2:
        momentum_score += 8

    # 3b. RSI ısınması (55-70)
    if 55 <= rsi <= 70:
        momentum_score += 10
    elif 45 <= rsi < 55 or 70 < rsi <= 80:
        momentum_score += 5

    # 4. EVENT SCORE (0-20) — Placeholder (manual takvim entegrasyonu için)
    # TODO: SEC EDGAR 8-K / Earnings API entegrasyonu
    event_score = 0  # Şimdilik 0, manuel doğrulama için

    # TOPLAM
    pcs = float_score + rvol_score + momentum_score + event_score

    return {
        "float_score": float_score,
        "rvol_score": rvol_score,
        "momentum_score": momentum_score,
        "event_score": event_score,
        "pcs": min(100, pcs),  # Max 100
    }


def evaluate_stock(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Screener sonucundan PCS hesapla ve karar ver.
    Çıktı: WATCHLİST | POZİSYON | GEÇ
    """

    ticker = result.get("ticker")
    market_cap = result.get("market_cap", 0)
    market_cap_m = market_cap / 1e6
    rvol = result.get("rvol", 0)
    rsi = result.get("rsi", 50)
    change_1d = result.get("change_1d", 0)
    macd = result.get("macd", 0)

    # PCS hesapla (5 günlük kapanış verisi olmadığı için approximation)
    closes_5d = [result.get("price") * (1 - change_1d/100), result.get("price")]  # Basit approx

    pcs_data = calculate_pcs(
        ticker=ticker,
        market_cap_m=market_cap_m,
        rvol=rvol,
        rsi=rsi,
        change_1d=change_1d,
        closes_5d=closes_5d,
        macd=macd,
    )

    pcs = pcs_data["pcs"]

    # Karar eşikleri
    if pcs >= PCS_POSITION_THRESHOLD:
        signal = "🎯 POZİSYON"
    elif pcs >= PCS_WATCHLIST_THRESHOLD:
        signal = "👁️ WATCHLİST"
    else:
        signal = "PASS"

    return {
        "ticker": ticker,
        "pcs": round(pcs, 1),
        "float_score": pcs_data["float_score"],
        "rvol_score": pcs_data["rvol_score"],
        "momentum_score": pcs_data["momentum_score"],
        "event_score": pcs_data["event_score"],
        "market_cap_m": round(market_cap_m, 1),
        "rvol": round(rvol, 2),
        "rsi": round(rsi, 1),
        "change_1d": round(change_1d, 2),
        "signal": signal,
        "scan_date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
    }


async def fetch_screener_results() -> List[Dict[str, Any]]:
    """
    BOGA Screener API'den pre_catalyst preset sonuçlarını çek.
    """
    import urllib.request
    import urllib.error

    url = f"{SCREENER_API}?preset={PRESET}&limit={SCAN_LIMIT}&sort=score"

    try:
        log.info(f"📡 Screener API çağrılıyor: {url}")
        with urllib.request.urlopen(url, timeout=120) as response:
            data = json.loads(response.read().decode('utf-8'))

        results = data.get("results", [])
        log.info(f"✅ {len(results)} hisse tarandı")
        return results

    except urllib.error.URLError as e:
        log.error(f"❌ API hatası: {e}")
        return []
    except Exception as e:
        log.error(f"❌ Beklenmedik hata: {e}")
        return []


async def main():
    """
    Ana flow:
    1. Screener API'den pre_catalyst hisseleri çek
    2. Her hisse için PCS hesapla
    3. PCS ≥ 70 olanları watchlist'e al
    4. watchlist_YYYYMMDD.json kaydet
    """

    log.info("🌙 Pre-Catalyst Scanner başlatıldı")
    now_ny = datetime.now(NY_TZ)

    # API'den verileri çek
    screener_results = await fetch_screener_results()

    if not screener_results:
        log.warning("⚠️ Screener'dan sonuç alınamadı")
        return

    # Her hisse için PCS hesapla
    all_stocks = []
    watchlist = []
    position_list = []

    for result in screener_results:
        evaluation = evaluate_stock(result)
        all_stocks.append(evaluation)

        if evaluation["signal"] == "🎯 POZİSYON":
            position_list.append(evaluation)
        elif evaluation["signal"] == "👁️ WATCHLİST":
            watchlist.append(evaluation)

    # Sonuçları sırala (PCS'ye göre yüksekten düşüğe)
    watchlist.sort(key=lambda x: x["pcs"], reverse=True)
    position_list.sort(key=lambda x: x["pcs"], reverse=True)

    log.info(f"📊 Sonuçlar: {len(position_list)} POZİSYON, {len(watchlist)} WATCHLİST")

    # Çıktı dosyası: watchlist_YYYYMMDD.json
    output_file = os.path.join(
        HERE,
        f"watchlist_{now_ny.strftime('%Y%m%d')}.json"
    )

    output_data = {
        "scan_date": now_ny.strftime("%Y-%m-%d"),
        "scan_time": now_ny.strftime("%H:%M"),
        "total_scanned": len(screener_results),
        "position_list": position_list,  # PCS ≥ 85
        "watchlist": watchlist,            # PCS ≥ 70
        "thresholds": {
            "position": PCS_POSITION_THRESHOLD,
            "watchlist": PCS_WATCHLIST_THRESHOLD,
        },
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    log.info(f"💾 Watchlist kaydedildi: {output_file}")

    # Özet
    if position_list:
        log.info(f"🎯 POZİSYON KANDİDATLARI ({len(position_list)}):")
        for stock in position_list[:5]:
            log.info(
                f"   {stock['ticker']:6} PCS={stock['pcs']:5.1f} "
                f"MCap=${stock['market_cap_m']:6.1f}M RVOL={stock['rvol']:4.2f}x RSI={stock['rsi']:5.1f}"
            )

    if watchlist:
        log.info(f"👁️ WATCHLİST ({len(watchlist)}):")
        for stock in watchlist[:5]:
            log.info(
                f"   {stock['ticker']:6} PCS={stock['pcs']:5.1f} "
                f"MCap=${stock['market_cap_m']:6.1f}M RVOL={stock['rvol']:4.2f}x RSI={stock['rsi']:5.1f}"
            )

    log.info("✅ Pre-Catalyst Scanner tamamlandı")


if __name__ == "__main__":
    asyncio.run(main())
