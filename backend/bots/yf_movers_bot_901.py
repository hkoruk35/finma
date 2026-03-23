"""
Bot 901 — Market Movers Bot (Yahoo Finance)
Yükselenler/Düşenler/Hacim verilerini Yahoo Finance'den çeker, cache'e yazar.
Schedule: Her 5 dakikada bir
"""
import json
import logging
import os
from datetime import datetime, timezone

import yfinance as yf
import pandas as pd

logger = logging.getLogger("bot_901_movers")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT_901] %(levelname)s: %(message)s")

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "output", "movers_901.json")

# S&P 500 / Russell 1000 universe'inden örnekleme — gerçek gainer/loser/volume tespiti için
SCAN_UNIVERSE = [
    "AAPL","MSFT","NVDA","GOOGL","META","AMZN","TSLA","BRK-B","JPM","V",
    "UNH","XOM","LLY","JNJ","MA","PG","HD","MRK","AVGO","CVX",
    "PEP","KO","ABBV","COST","WMT","BAC","CRM","ORCL","ACN","MCD",
    "NFLX","ADBE","AMD","INTC","QCOM","TXN","CSCO","IBM","HON","GE",
    "CAT","BA","RTX","LMT","NOC","GS","MS","WFC","C","USB",
    "PYPL","SQ","SHOP","UBER","LYFT","SNAP","TWTR","PINS","RBLX","U",
    "PLTR","SOFI","RIVN","LCID","NIO","XPEV","LI","DKNG","PENN","MGM",
    "AMC","GME","BB","NOK","SNDL","CLOV","WISH","SPCE","RIDE","WKHS",
    "SPY","QQQ","IWM","DIA","GLD","SLV","USO","UNG","ARKK","ARKG",
    "XLK","XLF","XLV","XLY","XLP","XLI","XLE","XLB","XLC","XLRE","XLU",
    "ENPH","SEDG","FSLR","PLUG","BE","CHPT","BLNK","EVGO","WKHS","HYLN",
    "ZM","DOCU","OKTA","CRWD","PANW","FTNT","S","NET","DDOG","SNOW",
    "COIN","MARA","RIOT","HUT","BTBT","CIFR","CLSK","MSTR","SQ","PYPL",
    "WBA","CVS","RAD","HUM","CI","MCK","ABC","CAH","HSIC","OMI",
]


def get_movers():
    gainers = []
    losers = []
    volume_leaders = []

    try:
        # yfinance batch download
        tickers = yf.Tickers(" ".join(SCAN_UNIVERSE[:80]))  # First 80 for speed
        rows = []

        for sym in SCAN_UNIVERSE[:80]:
            try:
                t = tickers.tickers.get(sym)
                if not t:
                    continue
                fast = t.fast_info
                price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
                prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
                vol = float(fast.get("last_volume", 0) or fast.get("lastVolume", 0) or 0)

                if price <= 0 or prev <= 0:
                    continue

                change_pct = ((price - prev) / prev) * 100
                info = {}
                try:
                    info = t.info or {}
                except:
                    pass

                rows.append({
                    "symbol": sym,
                    "name": info.get("longName", info.get("shortName", sym)),
                    "sector": info.get("sector", ""),
                    "price": round(price, 2),
                    "change_pct": round(change_pct, 2),
                    "volume": int(vol),
                    "market_cap": info.get("marketCap", 0),
                })
            except Exception as e:
                continue

        # Sort
        sorted_by_change = sorted(rows, key=lambda x: x["change_pct"], reverse=True)
        gainers = sorted_by_change[:17]
        losers = sorted_by_change[-17:][::-1]
        volume_leaders = sorted(rows, key=lambda x: x["volume"], reverse=True)[:16]

    except Exception as e:
        logger.error(f"Movers fetch error: {e}")

    return gainers, losers, volume_leaders


def run():
    logger.info("Bot 901 — Market Movers Bot starting...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    gainers, losers, volume = get_movers()

    output = {
        "gainers": gainers,
        "losers": losers,
        "volume": volume,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    logger.info(f"Bot 901 — Saved {len(gainers)} gainers, {len(losers)} losers, {len(volume)} volume leaders")


if __name__ == "__main__":
    run()
