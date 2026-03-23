"""
Flow Bot — Akıllı Para Akışı Botu
Her 4 saatte bir çalışır ve şunları toplar:
1. Sektör ETF akışı (inflow/outflow)
2. Yüksek hacimli yükselenler / düşenler (RVOL bazlı)
3. Insider işlemleri (yfinance, 40 büyük hisse)
4. Kurumsal hareket sinyalleri (RVOL > 2.0 olan hisseler)

Çıktı: bots/output/flow_cache.json
"""

import sys
import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("flow_bot")

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    logger.error("yfinance/pandas eksik — pip install yfinance pandas")
    sys.exit(1)

# ─── Sabitler ─────────────────────────────────────────────────────────────────

SECTOR_ETFS = {
    "XLK": "Teknoloji",
    "XLF": "Finans",
    "XLV": "Sağlık",
    "XLY": "Tüketici İhtiyari",
    "XLP": "Temel Tüketim",
    "XLI": "Sanayi",
    "XLC": "İletişim",
    "XLE": "Enerji",
    "XLU": "Kamu Hizmetleri",
    "XLRE": "Gayrimenkul",
    "XLB": "Hammadde",
}

# Insider takibi için büyük cap hisseler
INSIDER_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "AVGO",
    "JPM", "BAC", "GS", "MS", "WFC", "BLK",
    "UNH", "LLY", "JNJ", "ABBV", "MRK",
    "XOM", "CVX", "COP", "SLB",
    "HD", "WMT", "COST", "MCD",
    "CAT", "GE", "UNP", "LMT",
    "NFLX", "DIS", "T", "VZ",
    "AMD", "INTC", "QCOM",
    "NEE", "PLD", "AMT",
]

# RVOL izleme evrenesi (hacim anormalliği tespiti)
RVOL_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "GOOGL", "AMD",
    "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BBAI", "SOUN", "SMCI",
    "JPM", "BAC", "GS", "XOM", "CVX", "UNH", "LLY", "ABBV",
    "SPY", "QQQ", "IWM", "GLD", "SLV", "USO",
]

# ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

def safe_float(val, default=0.0) -> float:
    try:
        v = float(val)
        return v if v == v else default  # NaN check
    except (TypeError, ValueError):
        return default


def get_sector_flow() -> List[Dict[str, Any]]:
    """Her ETF için günlük değişim + hacim oranını hesapla."""
    results = []
    for etf, name in SECTOR_ETFS.items():
        try:
            t = yf.Ticker(etf)
            hist = t.history(period="5d", auto_adjust=True)
            if hist is None or len(hist) < 2:
                continue
            close_today = safe_float(hist["Close"].iloc[-1])
            close_prev  = safe_float(hist["Close"].iloc[-2])
            change_pct  = ((close_today - close_prev) / close_prev * 100) if close_prev else 0

            # Hacim oranı: bugün / 5g ortalama
            vol_today = safe_float(hist["Volume"].iloc[-1])
            vol_avg   = safe_float(hist["Volume"].mean())
            vol_ratio = round(vol_today / vol_avg, 2) if vol_avg > 0 else 1.0

            flow = "inflow" if change_pct > 0.3 else ("outflow" if change_pct < -0.3 else "neutral")

            results.append({
                "etf": etf,
                "sector": name,
                "change_pct": round(change_pct, 2),
                "price": round(close_today, 2),
                "volume_ratio": vol_ratio,
                "flow": flow,
            })
        except Exception as e:
            logger.warning(f"Sektör {etf} hatası: {e}")

    results.sort(key=lambda x: x["change_pct"], reverse=True)
    logger.info(f"✅ Sektör akışı: {len(results)} ETF")
    return results


def get_movers_with_volume() -> Dict[str, List]:
    """Yükselenler, düşenler ve yüksek hacimli hisseler."""
    tickers_str = " ".join(RVOL_UNIVERSE)
    gainers, losers, high_vol = [], [], []

    try:
        data = yf.download(
            tickers_str,
            period="2d",
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        if data.empty:
            raise ValueError("download boş döndü")

        close = data["Close"]
        volume = data["Volume"]

        for ticker in RVOL_UNIVERSE:
            try:
                if ticker not in close.columns:
                    continue
                prices = close[ticker].dropna()
                vols   = volume[ticker].dropna()
                if len(prices) < 2:
                    continue
                p_now  = safe_float(prices.iloc[-1])
                p_prev = safe_float(prices.iloc[-2])
                if p_now <= 0 or p_prev <= 0:
                    continue
                chg = (p_now - p_prev) / p_prev * 100

                v_now = safe_float(vols.iloc[-1])
                v_avg = safe_float(vols.mean())
                rvol  = round(v_now / v_avg, 2) if v_avg > 0 else 1.0

                entry = {
                    "ticker": ticker,
                    "price": round(p_now, 2),
                    "change_pct": round(chg, 2),
                    "volume": int(v_now),
                    "rvol": rvol,
                }
                if chg >= 1.0:
                    gainers.append(entry)
                if chg <= -1.0:
                    losers.append(entry)
                if rvol >= 1.8:
                    high_vol.append(entry)
            except Exception:
                pass

    except Exception as e:
        logger.warning(f"Batch download hatası, fallback: {e}")
        # Fallback: bireysel çek
        for ticker in RVOL_UNIVERSE[:15]:
            try:
                t = yf.Ticker(ticker)
                fi = t.fast_info
                p  = safe_float(getattr(fi, "last_price", 0))
                pc = safe_float(getattr(fi, "previous_close", p) or p)
                chg = ((p - pc) / pc * 100) if pc else 0
                if abs(chg) > 0.5:
                    entry = {"ticker": ticker, "price": round(p, 2), "change_pct": round(chg, 2), "volume": 0, "rvol": 1.0}
                    if chg > 0: gainers.append(entry)
                    else: losers.append(entry)
            except Exception:
                pass

    gainers.sort(key=lambda x: x["change_pct"], reverse=True)
    losers.sort(key=lambda x: x["change_pct"])
    high_vol.sort(key=lambda x: x["rvol"], reverse=True)

    logger.info(f"✅ Movers: {len(gainers)} gainer, {len(losers)} loser, {len(high_vol)} yüksek hacim")
    return {"gainers": gainers[:12], "losers": losers[:12], "high_volume": high_vol[:10]}


def get_insider_trades() -> List[Dict[str, Any]]:
    """Gelişmiş InsiderDB üzerinden güncel insider işlemlerini al"""
    try:
        from app.database import InsiderDB
        db_trades = InsiderDB.get_latest(limit=40)
        
        # Eğer veritabanı boşsa (veya bellek silinmişse), anlık olarak SEC crawler'ı tetikle
        if not db_trades:
            logger.info("InsiderDB boş, anlık SEC taraması başlatılıyor...")
            from app.services.market_data import update_market_insiders
            update_market_insiders()
            db_trades = InsiderDB.get_latest(limit=40)
        
        flow_trades = []
        for doc in db_trades:
            txn = str(doc.get("transaction", ""))
            is_buy = "Alış" in txn or "Buy" in txn or "Purchase" in txn
            
            flow_trades.append({
                "ticker": doc.get("symbol", ""),
                "insider_name": doc.get("owner", ""),
                "title": doc.get("relationship", ""),
                "transaction_type": txn,
                "is_buy": is_buy,
                "shares": doc.get("shares", 0),
                "value": doc.get("value", 0),
                "price": doc.get("cost", 0),
                "date": doc.get("date", ""),
            })
            
        logger.info(f"✅ Insider: {len(flow_trades)} işlem db'den çekildi")
        return flow_trades
    except Exception as e:
        logger.error(f"Insider error in flow bot: {e}")
        return []


def get_unusual_volume_signals(high_volume: List[Dict]) -> List[Dict]:
    """RVOL > 2.0 olan hisseleri 'kurumsal sinyal' olarak işaretle."""
    signals = []
    for item in high_volume:
        if item.get("rvol", 1) >= 2.0:
            chg = item.get("change_pct", 0)
            signals.append({
                "ticker": item["ticker"],
                "price": item["price"],
                "change_pct": chg,
                "rvol": item["rvol"],
                "volume": item["volume"],
                "signal": "📈 Güçlü Alım" if chg > 0 else "📉 Yoğun Satış",
                "signal_type": "buy" if chg > 0 else "sell",
            })
    return signals


# ─── Ana Çalıştırma ───────────────────────────────────────────────────────────

def run():
    logger.info("🔄 Flow Bot başladı...")
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    now_utc = datetime.now(timezone.utc)
    updated_at = now_utc.strftime("%Y-%m-%d %H:%M UTC")

    # 1. Sektör akışı
    sector_flow = get_sector_flow()

    # 2. Hisse hareketleri
    movers = get_movers_with_volume()

    # 3. Insider işlemleri
    insiders = get_insider_trades()

    # 4. Kurumsal sinyal (RVOL > 2.0)
    signals = get_unusual_volume_signals(movers.get("high_volume", []))

    payload = {
        "updated_at": updated_at,
        "updated_ts": now_utc.timestamp(),
        "sector_flow": sector_flow,
        "gainers": movers["gainers"],
        "losers": movers["losers"],
        "high_volume": movers["high_volume"],
        "unusual_signals": signals,
        "insiders": insiders,
        "summary": {
            "inflow_sectors": len([s for s in sector_flow if s["flow"] == "inflow"]),
            "outflow_sectors": len([s for s in sector_flow if s["flow"] == "outflow"]),
            "insider_buys": len([i for i in insiders if i.get("is_buy")]),
            "insider_sells": len([i for i in insiders if not i.get("is_buy")]),
            "unusual_signals": len(signals),
        }
    }

    out_path = os.path.join(output_dir, "flow_cache.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    logger.info(f"✅ Flow cache kaydedildi: {out_path}")
    logger.info(f"   Sektörler: {len(sector_flow)}, Gainers: {len(movers['gainers'])}, "
                f"Insider: {len(insiders)}, Sinyal: {len(signals)}")
    return payload


if __name__ == "__main__":
    run()
