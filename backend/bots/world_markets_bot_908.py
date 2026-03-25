"""
Bot 908 — World Markets Bot
40+ küresel borsa endeksi + emtia + forex verilerini yfinance ile çeker,
output/world_markets_908.json dosyasına yazar.

Schedule: Her 3 dakikada bir (bot_runner.py'den çağrılır)
Manuel çalıştırma: python world_markets_bot_908.py

Output JSON yapısı:
{
  "timestamp": "2026-03-25T14:30:00Z",
  "regions": [
    {
      "id": "abd",
      "label": "ABD",
      "icon": "🇺🇸",
      "indices": [
        {"symbol": "ES=F", "label": "S&P 500", "price": 5826.0, "chg_pct": +1.23, "status": "open"},
        ...
      ]
    },
    ...
  ],
  "commodities": [...],
  "forex": [...],
  "top_movers": {"gainers": [...], "losers": [...]}
}
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

import yfinance as yf

logger = logging.getLogger("bot_908_world")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [BOT_908] %(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "output", "world_markets_908.json")

# ═══════════════════════════════════════════════════════════════════════
# SEMBOL TANIMLARI
# ═══════════════════════════════════════════════════════════════════════

REGIONS = [
    {
        "id": "abd",
        "label": "ABD",
        "icon": "🇺🇸",
        "indices": [
            {"symbol": "ES=F",  "label": "S&P 500",     "full": "S&P 500 Futures"},
            {"symbol": "NQ=F",  "label": "Nasdaq-100",  "full": "Nasdaq 100 Futures"},
            {"symbol": "YM=F",  "label": "Dow Jones",   "full": "Dow Jones Futures"},
            {"symbol": "RTY=F", "label": "Russell 2000","full": "Russell 2000 Futures"},
            {"symbol": "^VIX",  "label": "VIX",         "full": "Volatilite Endeksi"},
        ],
    },
    {
        "id": "avrupa",
        "label": "Avrupa",
        "icon": "🇪🇺",
        "indices": [
            {"symbol": "^STOXX50E", "label": "Euro Stoxx 50", "full": "Euro Stoxx 50"},
            {"symbol": "^GDAXI",    "label": "DAX",           "full": "DAX 40 (Almanya)"},
            {"symbol": "^FTSE",     "label": "FTSE 100",      "full": "FTSE 100 (İngiltere)"},
            {"symbol": "^FCHI",     "label": "CAC 40",        "full": "CAC 40 (Fransa)"},
            {"symbol": "^IBEX",     "label": "IBEX 35",       "full": "IBEX 35 (İspanya)"},
            {"symbol": "FTSEMIB.MI","label": "FTSE MIB",      "full": "FTSE MIB (İtalya)"},
            {"symbol": "^AEX",      "label": "AEX",           "full": "AEX (Hollanda)"},
            {"symbol": "^SSMI",     "label": "SMI",           "full": "SMI (İsviçre)"},
        ],
    },
    {
        "id": "asya",
        "label": "Asya-Pasifik",
        "icon": "🌏",
        "indices": [
            {"symbol": "^N225",    "label": "Nikkei 225",  "full": "Nikkei 225 (Japonya)"},
            {"symbol": "^HSI",     "label": "Hang Seng",   "full": "Hang Seng (Hong Kong)"},
            {"symbol": "000001.SS","label": "Shanghai",    "full": "Shanghai Composite (Çin)"},
            {"symbol": "^KS11",    "label": "KOSPI",       "full": "KOSPI (Güney Kore)"},
            {"symbol": "^TWII",    "label": "TAIEX",       "full": "TAIEX (Tayvan)"},
            {"symbol": "^AXJO",    "label": "ASX 200",     "full": "ASX 200 (Avustralya)"},
            {"symbol": "^STI",     "label": "STI",         "full": "Straits Times (Singapur)"},
            {"symbol": "^BSESN",   "label": "Sensex",      "full": "BSE Sensex (Hindistan)"},
            {"symbol": "^NZ50",    "label": "NZX 50",      "full": "NZX 50 (Yeni Zelanda)"},
        ],
    },
    {
        "id": "gelismekte",
        "label": "Gelişmekte Olan",
        "icon": "🌍",
        "indices": [
            {"symbol": "^BVSP",  "label": "Bovespa",   "full": "Bovespa (Brezilya)"},
            {"symbol": "^MXX",   "label": "IPC",       "full": "IPC (Meksika)"},
            {"symbol": "^MERV",  "label": "Merval",    "full": "Merval (Arjantin)"},
            {"symbol": "^JKSE",  "label": "IDX",       "full": "Jakarta Composite (Endonezya)"},
            {"symbol": "^KLSE",  "label": "KLCI",      "full": "KLCI (Malezya)"},
            {"symbol": "^SET",   "label": "SET",       "full": "SET (Tayland)"},
            {"symbol": "^NSEI",  "label": "Nifty 50",  "full": "Nifty 50 (Hindistan)"},
            {"symbol": "^TA125.TA","label":"TA-125",   "full": "TA-125 (İsrail)"},
        ],
    },
    {
        "id": "orta_dogu_afrika",
        "label": "Orta Doğu / Afrika",
        "icon": "🌐",
        "indices": [
            {"symbol": "^TASI.SR", "label": "Tadawul",  "full": "Tadawul (Suudi Arabistan)"},
            {"symbol": "^DFMGI",   "label": "DFM",      "full": "Dubai Financial Market"},
            {"symbol": "^CASE",    "label": "EGX 30",   "full": "EGX 30 (Mısır)"},
            {"symbol": "^JN0U.JO", "label": "JSE",      "full": "JSE (Güney Afrika)"},
        ],
    },
]

COMMODITIES = [
    {"symbol": "GC=F",  "label": "Altın",      "unit": "USD/oz",  "icon": "🥇"},
    {"symbol": "SI=F",  "label": "Gümüş",      "unit": "USD/oz",  "icon": "⚪"},
    {"symbol": "CL=F",  "label": "WTI Ham Petrol", "unit": "USD/bl", "icon": "🛢️"},
    {"symbol": "BZ=F",  "label": "Brent Petrol",   "unit": "USD/bl", "icon": "🛢️"},
    {"symbol": "NG=F",  "label": "Doğal Gaz",  "unit": "USD/MMBtu","icon": "🔥"},
    {"symbol": "ZW=F",  "label": "Buğday",     "unit": "USc/bu",  "icon": "🌾"},
    {"symbol": "ZC=F",  "label": "Mısır",      "unit": "USc/bu",  "icon": "🌽"},
    {"symbol": "KC=F",  "label": "Kahve",      "unit": "USc/lb",  "icon": "☕"},
    {"symbol": "HG=F",  "label": "Bakır",      "unit": "USD/lb",  "icon": "🔶"},
    {"symbol": "PL=F",  "label": "Platin",     "unit": "USD/oz",  "icon": "⬜"},
]

FOREX = [
    {"symbol": "EURUSD=X", "label": "EUR/USD", "base": "EUR", "quote": "USD"},
    {"symbol": "USDJPY=X", "label": "USD/JPY", "base": "USD", "quote": "JPY"},
    {"symbol": "GBPUSD=X", "label": "GBP/USD", "base": "GBP", "quote": "USD"},
    {"symbol": "USDTRY=X", "label": "USD/TRY", "base": "USD", "quote": "TRY"},
    {"symbol": "USDCNH=X", "label": "USD/CNH", "base": "USD", "quote": "CNH"},
    {"symbol": "USDINR=X", "label": "USD/INR", "base": "USD", "quote": "INR"},
    {"symbol": "USDBRL=X", "label": "USD/BRL", "base": "USD", "quote": "BRL"},
    {"symbol": "AUDUSD=X", "label": "AUD/USD", "base": "AUD", "quote": "USD"},
    {"symbol": "USDKRW=X", "label": "USD/KRW", "base": "USD", "quote": "KRW"},
    {"symbol": "DX-Y.NYB", "label": "DXY",     "base": "USD", "quote": "INDEX"},
]

CRYPTO = [
    {"symbol": "BTC-USD",  "label": "Bitcoin",  "abbr": "BTC"},
    {"symbol": "ETH-USD",  "label": "Ethereum", "abbr": "ETH"},
    {"symbol": "BNB-USD",  "label": "BNB",      "abbr": "BNB"},
    {"symbol": "SOL-USD",  "label": "Solana",   "abbr": "SOL"},
    {"symbol": "XRP-USD",  "label": "XRP",      "abbr": "XRP"},
]


# ═══════════════════════════════════════════════════════════════════════
# VERİ ÇEKME YARDIMCILARI
# ═══════════════════════════════════════════════════════════════════════

def get_change_pct(fast_info, history=None) -> float:
    """regularMarketChangePercent yoksa fiyat farkından hesapla."""
    try:
        pct = float(fast_info.get("regularMarketChangePercent", 0) or 0)
        if pct != 0:
            return round(pct, 2)
    except Exception:
        pass

    # Yedek: önceki kapanıştan hesapla
    try:
        price = float(fast_info.get("lastPrice", 0) or fast_info.get("last_price", 0) or 0)
        prev  = float(fast_info.get("previousClose", 0) or fast_info.get("previous_close", 0) or 0)
        if price > 0 and prev > 0:
            return round((price - prev) / prev * 100, 2)
    except Exception:
        pass

    return 0.0


def fetch_batch(symbols: list[str]) -> dict[str, dict]:
    """Tek seferde birden fazla sembolü çek, {symbol: {price, chg_pct}} döndür."""
    result: dict[str, dict] = {}
    if not symbols:
        return result

    try:
        tickers_obj = yf.Tickers(" ".join(symbols))
        for sym in symbols:
            try:
                t = tickers_obj.tickers[sym]
                fi = t.fast_info

                price = 0.0
                try:
                    price = float(fi.get("lastPrice", 0) or fi.get("last_price", 0) or 0)
                except Exception:
                    pass

                if price <= 0:
                    hist = t.history(period="1d")
                    if not hist.empty:
                        price = float(hist["Close"].iloc[-1])

                chg_pct = get_change_pct(fi)

                if price > 0:
                    result[sym] = {"price": round(price, 4), "chg_pct": chg_pct}

            except Exception as e:
                logger.debug(f"  {sym} atlandı: {e}")

    except Exception as e:
        logger.error(f"Batch fetch hatası: {e}")

    return result


def fmt_price(p: float) -> str:
    if p >= 10000:
        return f"{p:,.0f}"
    elif p >= 100:
        return f"{p:,.2f}"
    elif p >= 1:
        return f"{p:.4f}"
    else:
        return f"{p:.6f}"


def chg_dir(chg: float) -> str:
    return "up" if chg >= 0 else "down"


# ═══════════════════════════════════════════════════════════════════════
# ANA FONKSİYON
# ═══════════════════════════════════════════════════════════════════════

def run():
    logger.info("Bot 908 — World Markets başlatıldı")
    t0 = time.time()

    # Tüm sembolleri topla
    all_symbols: list[str] = []
    for region in REGIONS:
        for idx in region["indices"]:
            all_symbols.append(idx["symbol"])
    for c in COMMODITIES:
        all_symbols.append(c["symbol"])
    for f in FOREX:
        all_symbols.append(f["symbol"])
    for cr in CRYPTO:
        all_symbols.append(cr["symbol"])

    logger.info(f"  Toplam {len(all_symbols)} sembol çekiliyor...")

    # Batch'e böl (yfinance 50'den fazlasında unstable olabilir)
    BATCH = 30
    data: dict[str, dict] = {}
    for i in range(0, len(all_symbols), BATCH):
        batch = all_symbols[i:i+BATCH]
        chunk = fetch_batch(batch)
        data.update(chunk)
        if i + BATCH < len(all_symbols):
            time.sleep(0.5)  # rate limit

    logger.info(f"  {len(data)}/{len(all_symbols)} sembol başarılı")

    # Çıktı yapısını oluştur
    out_regions = []
    for region in REGIONS:
        out_indices = []
        for idx in region["indices"]:
            d = data.get(idx["symbol"])
            if d:
                out_indices.append({
                    "symbol": idx["symbol"],
                    "label":  idx["label"],
                    "full":   idx["full"],
                    "price":  fmt_price(d["price"]),
                    "chg_pct": d["chg_pct"],
                    "dir":    chg_dir(d["chg_pct"]),
                })
            else:
                out_indices.append({
                    "symbol": idx["symbol"],
                    "label":  idx["label"],
                    "full":   idx["full"],
                    "price":  "—",
                    "chg_pct": 0.0,
                    "dir":    "up",
                })
        out_regions.append({
            "id":    region["id"],
            "label": region["label"],
            "icon":  region["icon"],
            "indices": out_indices,
        })

    # Emtia
    out_comm = []
    for c in COMMODITIES:
        d = data.get(c["symbol"])
        out_comm.append({
            "symbol": c["symbol"],
            "label":  c["label"],
            "unit":   c["unit"],
            "icon":   c["icon"],
            "price":  fmt_price(d["price"]) if d else "—",
            "chg_pct": d["chg_pct"] if d else 0.0,
            "dir":    chg_dir(d["chg_pct"]) if d else "up",
        })

    # Forex
    out_forex = []
    for f in FOREX:
        d = data.get(f["symbol"])
        out_forex.append({
            "symbol": f["symbol"],
            "label":  f["label"],
            "price":  fmt_price(d["price"]) if d else "—",
            "chg_pct": d["chg_pct"] if d else 0.0,
            "dir":    chg_dir(d["chg_pct"]) if d else "up",
        })

    # Kripto
    out_crypto = []
    for cr in CRYPTO:
        d = data.get(cr["symbol"])
        out_crypto.append({
            "symbol": cr["symbol"],
            "label":  cr["label"],
            "abbr":   cr["abbr"],
            "price":  fmt_price(d["price"]) if d else "—",
            "chg_pct": d["chg_pct"] if d else 0.0,
            "dir":    chg_dir(d["chg_pct"]) if d else "up",
        })

    # Top movers (endeksler)
    all_index_items = [
        {"label": idx["label"], "symbol": idx["symbol"],
         "chg_pct": data[idx["symbol"]]["chg_pct"]}
        for region in REGIONS for idx in region["indices"]
        if idx["symbol"] in data
    ]
    sorted_by_chg = sorted(all_index_items, key=lambda x: x["chg_pct"])
    top_losers  = sorted_by_chg[:5]
    top_gainers = list(reversed(sorted_by_chg[-5:]))

    output = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fetch_ms": int((time.time() - t0) * 1000),
        "total_ok": len(data),
        "total_symbols": len(all_symbols),
        "regions": out_regions,
        "commodities": out_comm,
        "forex": out_forex,
        "crypto": out_crypto,
        "top_movers": {
            "gainers": top_gainers,
            "losers":  top_losers,
        },
    }

    # Yaz
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    tmp = OUTPUT_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    os.replace(tmp, OUTPUT_FILE)

    elapsed = time.time() - t0
    logger.info(f"Bot 908 tamamlandı — {len(data)} sembol, {elapsed:.1f}s — {OUTPUT_FILE}")
    return output


if __name__ == "__main__":
    run()
