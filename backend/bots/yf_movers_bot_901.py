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
        # 1. Toplu veri indir (1h periyot için 2 gün yeterli)
        # Scan universe'den ilk 80'i alıyoruz
        symbols = SCAN_UNIVERSE[:80]
        
        # Hourly data for 1h change calculation
        logger.info(f"Downloading 1h history for {len(symbols)} tickers...")
        h_data = yf.download(symbols, period="2d", interval="1h", group_by='ticker', threads=False, progress=False)
        
        # Daily data for 1w and 1m change calculation
        logger.info(f"Downloading 1mo history for {len(symbols)} tickers...")
        d_data = yf.download(symbols, period="1mo", interval="1d", group_by='ticker', threads=False, progress=False)
        
        # Info and Fast Info for other metrics

        tickers_obj = yf.Tickers(" ".join(symbols))
        
        rows = []
        for sym in symbols:
            try:
                t = tickers_obj.tickers.get(sym)
                if not t: continue
                
                # 1 saatlik değişim hesapla
                df_h = h_data[sym] if sym in h_data.columns.levels[0] else None
                change_1h = 0.0
                if df_h is not None and not df_h.empty:
                    closes_h = df_h['Close'].dropna()
                    if len(closes_h) >= 2:
                        current_h = float(closes_h.iloc[-1])
                        prev_h = float(closes_h.iloc[-2])
                        if prev_h > 0:
                            change_1h = ((current_h - prev_h) / prev_h) * 100

                # 1 haftalık ve 1 aylık değişim hesapla
                df_d = d_data[sym] if sym in d_data.columns.levels[0] else None
                change_1w = 0.0
                change_1m = 0.0
                if df_d is not None and not df_d.empty:
                    closes_d = df_d['Close'].dropna()
                    if len(closes_d) >= 2:
                        current_d = float(closes_d.iloc[-1])
                        
                        # 1 week (~5 trading days)
                        if len(closes_d) >= 6:
                            prev_1w = float(closes_d.iloc[-6])
                        else:
                            prev_1w = float(closes_d.iloc[0])
                        if prev_1w > 0:
                            change_1w = ((current_d - prev_1w) / prev_1w) * 100
                            
                        # 1 month (~20-22 trading days) fallback to oldest available in 1mo
                        prev_1m = float(closes_d.iloc[0])
                        if prev_1m > 0:
                            change_1m = ((current_d - prev_1m) / prev_1m) * 100

                fast = t.fast_info
                price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
                prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
                vol = float(fast.get("last_volume", 0) or fast.get("lastVolume", 0) or 0)

                if price <= 0 or prev <= 0:
                    continue

                change_24h = ((price - prev) / prev) * 100
                
                # Info'dan isim ve sektör (cache dostu)
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
                    "change_pct": round(change_24h, 2), # 24h change (daily)
                    "change_1h": round(change_1h, 2),   # 1h change
                    "change_1w": round(change_1w, 2),   # 1w change
                    "change_1m": round(change_1m, 2),   # 1m change
                    "volume": int(vol),
                    "market_cap": info.get("marketCap", 0),
                })
            except Exception:
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
