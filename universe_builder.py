#!/usr/bin/env python3
"""
universe_builder.py — BOGA AI Daily Universe Builder v2.1
SEC → yfinance → TOP 1000 → daily_universe.json

Düzeltilen bug: 'W' in t filtresi WMT, WFC, CRWD, UBER gibi
legit hisseleri de filtreliyordu. Artık sadece suffix kontrol edilir.
"""
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import requests
import yfinance as yf

FINMA_DIR   = os.path.dirname(os.path.abspath(__file__))
OUT_FILE    = os.path.join(FINMA_DIR, "frontend", "public", "data", "daily_universe.json")
LOG_DIR     = os.path.join(FINMA_DIR, "logs")

os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "universe_builder.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("universe_builder")

TOP_N        = 1000
ESSENTIAL    = ["SPY", "QQQ", "IWM", "VXX"]
CHUNK_SIZE   = 200
WORKERS      = 8
MIN_PRICE    = 1.0
MIN_DOL_VOL  = 1_000_000   # $1M günlük dolar hacmi

# --------------------------------------------------------------------------- #
# Ticker temizleme
# --------------------------------------------------------------------------- #

def is_valid_ticker(t: str) -> bool:
    """
    SPAC warrantlarını (AAACW), unit'leri (AAACU), when-issued (+/=)
    filtrele — ama WMT, CRWD, UBER gibi hisselere dokunma.
    Kural: son karakter W veya U ise VE uzunluk >= 5 → warrant/unit → filtrele.
    """
    if not t or len(t) > 6:
        return False
    if any(c in t for c in ("+", "=")):
        return False
    # Sadece 5+ karakter suffix W/U → SPAC türevi
    if len(t) >= 5 and t[-1] in ("W", "U"):
        return False
    return True


def fetch_sec_tickers() -> list[str]:
    log.info("SEC.gov'dan tüm ABD hisseleri çekiliyor...")
    headers = {"User-Agent": "BogaScreener/2.1 (admin@bogastock.com)"}
    r = requests.get(
        "https://www.sec.gov/files/company_tickers.json",
        headers=headers, timeout=30,
    )
    data = r.json()

    raw = []
    for v in data.values():
        t = v["ticker"].upper().strip()
        t = t.replace(".", "-")   # BRK.B → BRK-B  (Yahoo Finance formatı)
        raw.append(t)

    tickers = [t for t in set(raw) if is_valid_ticker(t)]
    log.info(f"SEC'ten temizlenmiş ticker sayısı: {len(tickers)}")
    return tickers


# --------------------------------------------------------------------------- #
# yfinance batch indirme
# --------------------------------------------------------------------------- #

def process_chunk(chunk: list[str]) -> list[dict]:
    """Chunk için yfinance indir, fiyat/hacim kriterini uygula."""
    valid = []
    try:
        df = yf.download(
            chunk, period="20d", group_by="ticker",
            threads=True, progress=False,
        )
        if df.empty:
            return valid

        if len(chunk) == 1:
            t = chunk[0]
            try:
                closes = df["Close"].dropna()
                vols   = df["Volume"].dropna()
                if closes.empty:
                    return valid
                price   = float(closes.iloc[-1])
                avg_vol = float(vols.mean())
                dol_vol = price * avg_vol
                if price > MIN_PRICE and dol_vol > MIN_DOL_VOL:
                    valid.append({"ticker": t, "dol_vol": dol_vol})
            except Exception:
                pass
            return valid

        # Çoklu ticker — MultiIndex DataFrame
        level0 = df.columns.get_level_values(0).unique().tolist()
        for t in chunk:
            try:
                if t not in level0:
                    continue
                tdf = df[t]
                closes = tdf["Close"].dropna()
                vols   = tdf["Volume"].dropna()
                if closes.empty or len(closes) < 5:
                    continue
                price   = float(closes.iloc[-1])
                avg_vol = float(vols.mean())
                dol_vol = price * avg_vol
                if price > MIN_PRICE and dol_vol > MIN_DOL_VOL:
                    valid.append({"ticker": t, "dol_vol": dol_vol})
            except Exception:
                pass
    except Exception as e:
        log.warning(f"Chunk hatası ({chunk[0] if chunk else '?'}...): {e}")
    return valid


# --------------------------------------------------------------------------- #
# Ana build fonksiyonu
# --------------------------------------------------------------------------- #

def build_universe() -> int:
    log.info("=" * 60)
    log.info(f"Universe Build Başladı — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    log.info("=" * 60)

    # 1. SEC ticker listesi
    sec_tickers = fetch_sec_tickers()

    # 2. config.py'daki curated listeyi her zaman dahil et
    curated: set[str] = set()
    try:
        sys.path.insert(0, FINMA_DIR)
        from config import FIXED_100_TICKERS  # noqa
        curated = set(FIXED_100_TICKERS)
        log.info(f"config.py'dan {len(curated)} curated ticker yüklendi.")
    except Exception as e:
        log.warning(f"config.py yüklenemedi: {e}")

    all_candidates = list(set(sec_tickers) | curated | set(ESSENTIAL))
    log.info(f"Toplam aday: {len(all_candidates)}")

    # 3. Chunk'lara böl, paralel indir
    chunks = [all_candidates[i:i + CHUNK_SIZE] for i in range(0, len(all_candidates), CHUNK_SIZE)]
    log.info(f"{len(chunks)} chunk × {CHUNK_SIZE} ticker, {WORKERS} worker...")

    all_valid: list[dict] = []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(process_chunk, c): i for i, c in enumerate(chunks)}
        done = 0
        for fut in as_completed(futures):
            all_valid.extend(fut.result())
            done += 1
            if done % 5 == 0 or done == len(chunks):
                log.info(f"  {done}/{len(chunks)} chunk, {len(all_valid)} geçerli")

    log.info(f"Likidite eşiğini geçen ticker: {len(all_valid)}")

    # 4. Dolar hacmine göre sırala → TOP N
    all_valid.sort(key=lambda x: x["dol_vol"], reverse=True)
    top = [x["ticker"] for x in all_valid[:TOP_N]]

    # 5. Curated + essential her zaman dahil (TOP_N dışına düşse de)
    for t in list(curated) + ESSENTIAL:
        if t not in top:
            top.append(t)

    log.info(f"Final universe: {len(top)} ticker")

    # 6. Kaydet
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(
            {"timestamp": datetime.now().isoformat(), "count": len(top), "tickers": top},
            f,
        )

    log.info(f"Kaydedildi → {OUT_FILE}")
    log.info("=" * 60)
    return len(top)


if __name__ == "__main__":
    count = build_universe()
    log.info(f"✅ Tamamlandı. {count} ticker universe hazır.")
