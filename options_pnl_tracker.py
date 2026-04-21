"""
🐂 BOGA AI — Options P&L Tracker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tüm geçmiş options_picks.json dosyalarını okur,
her pick için pozisyon oluşturur ve güncel opsiyon
fiyatlarıyla unrealized/realized P&L hesaplar.

Çıktı: transfer/latest/options_outcomes.json
       data/{date}/options_outcomes.json (snapshot)

Çalıştırma:
  python options_pnl_tracker.py

Otomatik tetikleme:
  opsiyon218v7.py her scan sonrası bu scripti çağırır.
"""

import os
import json
import asyncio
import logging
import time
from datetime import datetime, date, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional
import yfinance as yf
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(levelname)s — %(message)s")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

NY_TZ   = ZoneInfo("America/New_York")
HERE    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
LATEST_DIR = os.path.join(HERE, "transfer", "latest")
OUTCOMES_FILE = os.path.join(LATEST_DIR, "options_outcomes.json")


# ─── Helper ──────────────────────────────────────────────────────────────────

def _sanitize(raw: str) -> str:
    import re
    raw = re.sub(r':\s*NaN', ': null', raw)
    raw = re.sub(r':\s*Infinity', ': null', raw)
    raw = re.sub(r':\s*-Infinity', ': null', raw)
    return raw

def load_json(path: str) -> Optional[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.loads(_sanitize(f.read()))
    except Exception as e:
        logging.debug(f"load_json {path}: {e}")
        return None

def save_json(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


# ─── Position Builder ─────────────────────────────────────────────────────────

def _build_position(scan_date: str, pick: dict, strategy: str, contract: dict) -> Optional[dict]:
    """Tek bir contract (institutional/asymmetric) için pozisyon objesi oluştur."""
    if not contract:
        return None
    strike     = contract.get("strike")
    expiration = contract.get("expiration")
    premium    = contract.get("premium")
    if not all([strike, expiration, premium]):
        return None

    # Unique ID: ticker-scanDate-strike-expiry-strategy
    pos_id = f"{pick['ticker']}-{scan_date}-{int(strike)}C-{expiration}-{strategy[:4]}"

    return {
        "id":                   pos_id,
        "scan_date":            scan_date,
        "ticker":               pick["ticker"],
        "strategy":             strategy,           # "institutional" | "asymmetric"
        "entry_mode":           pick.get("entry_mode", ""),
        "entry_mode_label":     pick.get("entry_mode_label", ""),
        "regime":               pick.get("regime", ""),
        "score":                pick.get("score", 0),
        "underlying_entry":     pick.get("current_price"),
        "strike":               strike,
        "expiration":           expiration,
        "dte_at_entry":         contract.get("dte"),
        "entry_premium":        premium,
        "tp_target":            contract.get("tp_price"),
        "sl_target":            contract.get("sl_price"),
        "time_stop_days":       contract.get("time_stop_days"),
        "iv_rank_at_entry":     pick.get("iv_rank"),
        "delta_at_entry":       contract.get("delta"),
        "expected_move":        pick.get("expected_move"),
        # Updated fields (filled by tracker)
        "status":               "open",      # open / tp_hit / sl_hit / time_stop / expired / manual
        "exit_premium":         None,
        "exit_date":            None,
        "exit_reason":          None,
        "pnl_pct":              None,
        "current_premium":      None,
        "unrealized_pnl_pct":   None,
        "days_held":            None,
        "peak_premium":         None,
        "trough_premium":       None,
        "underlying_current":   None,
    }


def collect_positions(existing: Dict[str, dict]) -> Dict[str, dict]:
    """Tüm tarihli klasörlerden options_picks.json oku, yeni pozisyonlar ekle."""
    positions = dict(existing)
    added = 0

    # Geçmiş tarihler
    scan_dirs = []
    if os.path.isdir(DATA_DIR):
        for d in sorted(os.listdir(DATA_DIR)):
            if len(d) == 10 and d[:4].isdigit():
                p = os.path.join(DATA_DIR, d, "options_picks.json")
                if os.path.isfile(p):
                    scan_dirs.append((d, p))

    # Latest (bugün, henüz arşivde olmayabilir)
    latest_p = os.path.join(LATEST_DIR, "options_picks.json")
    if os.path.isfile(latest_p):
        scan_dirs.append(("latest", latest_p))

    for scan_label, path in scan_dirs:
        data = load_json(path)
        if not data:
            continue
        scan_date = data.get("date", scan_label)
        for pick in data.get("picks", []):
            for strat in ("institutional", "asymmetric"):
                contract = pick.get(strat)
                if not contract:
                    continue
                pos = _build_position(scan_date, pick, strat, contract)
                if not pos:
                    continue
                pid = pos["id"]
                if pid not in positions:
                    positions[pid] = pos
                    added += 1

    logging.info(f"✅ {added} yeni pozisyon eklendi, toplam: {len(positions)}")
    return positions


# ─── Price Fetcher ────────────────────────────────────────────────────────────

async def fetch_current_option_price(
    ticker: str, expiration: str, strike: float
) -> Optional[float]:
    """yfinance ile güncel opsiyon mid-price al."""
    try:
        stock = yf.Ticker(ticker)
        # Expirations
        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps:
            return None
        # En yakın uygun expiry'yi bul
        target = date.fromisoformat(expiration)
        exps_d = []
        for e in exps:
            try:
                exps_d.append(date.fromisoformat(e))
            except:
                pass
        if not exps_d:
            return None
        closest = min(exps_d, key=lambda x: abs((x - target).days))
        if abs((closest - target).days) > 14:
            return None  # 14 günden uzak → uygun kontrat yok (expired olabilir)
        closest_str = closest.isoformat()

        chain = await asyncio.to_thread(lambda: stock.option_chain(closest_str))
        calls = chain.calls
        if calls is None or calls.empty:
            return None

        calls["strike"] = pd.to_numeric(calls["strike"], errors="coerce")
        calls["bid"]    = pd.to_numeric(calls.get("bid", 0), errors="coerce").fillna(0)
        calls["ask"]    = pd.to_numeric(calls.get("ask", 0), errors="coerce").fillna(0)

        # En yakın strike
        calls["dist"] = abs(calls["strike"] - strike)
        row = calls.nsmallest(1, "dist").iloc[0]
        if row["dist"] > 2.5:
            return None  # Strike çok uzak
        bid, ask = float(row["bid"]), float(row["ask"])
        if ask <= 0:
            return None
        return round((bid + ask) / 2, 4) if bid > 0 else round(ask * 0.9, 4)
    except Exception as e:
        logging.debug(f"fetch_option {ticker} {expiration} {strike}: {e}")
        return None


# ─── Status Logic ─────────────────────────────────────────────────────────────

def _days_held(scan_date: str) -> int:
    try:
        d = date.fromisoformat(scan_date)
        return (date.today() - d).days
    except:
        return 0

def _is_expired(expiration: str) -> bool:
    try:
        return date.fromisoformat(expiration) < date.today()
    except:
        return False

def _update_status(pos: dict, current_premium: Optional[float]) -> dict:
    """Güncel fiyata göre status ve P&L hesapla."""
    if pos["status"] not in ("open",):
        return pos  # closed pozisyonlara dokunma

    entry   = pos["entry_premium"]
    tp      = pos["tp_target"]
    sl      = pos["sl_target"]
    ts_days = pos["time_stop_days"]
    held    = _days_held(pos["scan_date"])

    pos["days_held"] = held

    # Expired kontrolü
    if _is_expired(pos.get("expiration", "")):
        cur = current_premium or 0.0
        pos["current_premium"] = cur
        if cur > 0.05 and entry:
            pos["pnl_pct"] = round((cur - entry) / entry * 100, 1)
        else:
            pos["pnl_pct"] = -100.0
        pos["status"]       = "expired"
        pos["exit_premium"] = cur
        pos["exit_date"]    = pos.get("expiration")
        pos["exit_reason"]  = "Expiry — " + ("worthless" if (cur or 0) < 0.05 else f"${cur:.2f}")
        return pos

    # Time stop
    if ts_days and held >= ts_days:
        cur = current_premium
        if cur and entry:
            pnl = round((cur - entry) / entry * 100, 1)
        else:
            pnl = None
        pos["status"]              = "time_stop"
        pos["current_premium"]     = cur
        pos["exit_premium"]        = cur
        pos["exit_date"]           = date.today().isoformat()
        pos["exit_reason"]         = f"Time Stop ({held}d ≥ {ts_days}d)"
        pos["pnl_pct"]             = pnl
        pos["unrealized_pnl_pct"]  = None
        return pos

    if current_premium is None:
        pos["unrealized_pnl_pct"] = None
        return pos

    pos["current_premium"] = current_premium

    # Peak / trough tracking
    prev_peak = pos.get("peak_premium") or 0
    prev_trough = pos.get("trough_premium") or float('inf')
    pos["peak_premium"]   = max(prev_peak, current_premium)
    pos["trough_premium"] = min(prev_trough, current_premium) if prev_trough < float('inf') else current_premium

    # Unrealized P&L
    if entry:
        pos["unrealized_pnl_pct"] = round((current_premium - entry) / entry * 100, 1)

    # TP hit
    if tp and current_premium >= tp:
        pos["status"]      = "tp_hit"
        pos["exit_premium"] = current_premium
        pos["exit_date"]   = date.today().isoformat()
        pos["exit_reason"] = f"TP Hit (${current_premium:.2f} ≥ ${tp:.2f})"
        pos["pnl_pct"]     = round((current_premium - entry) / entry * 100, 1) if entry else None
        return pos

    # SL hit
    if sl and current_premium <= sl:
        pos["status"]      = "sl_hit"
        pos["exit_premium"] = current_premium
        pos["exit_date"]   = date.today().isoformat()
        pos["exit_reason"] = f"SL Hit (${current_premium:.2f} ≤ ${sl:.2f})"
        pos["pnl_pct"]     = round((current_premium - entry) / entry * 100, 1) if entry else None
        return pos

    return pos


# ─── Main Tracker ─────────────────────────────────────────────────────────────

SEM = asyncio.Semaphore(6)

async def update_position(pos: dict) -> dict:
    if pos.get("status") != "open":
        return pos
    async with SEM:
        ticker  = pos["ticker"]
        expiry  = pos.get("expiration", "")
        strike  = pos.get("strike", 0)
        cur     = await fetch_current_option_price(ticker, expiry, strike)
        await asyncio.sleep(0.2)
    return _update_status(pos, cur)

def _compute_summary(positions: List[dict]) -> dict:
    closed = [p for p in positions if p["status"] != "open"]
    open_  = [p for p in positions if p["status"] == "open"]

    pnl_vals = [p["pnl_pct"] for p in closed if p.get("pnl_pct") is not None]
    unrealized = [p.get("unrealized_pnl_pct") for p in open_ if p.get("unrealized_pnl_pct") is not None]

    tp_list = [p for p in closed if p["status"] == "tp_hit"]
    sl_list = [p for p in closed if p["status"] == "sl_hit"]
    ts_list = [p for p in closed if p["status"] == "time_stop"]
    ex_list = [p for p in closed if p["status"] == "expired"]

    winners = [v for v in pnl_vals if v > 0]
    losers  = [v for v in pnl_vals if v <= 0]

    by_mode: Dict[str, dict] = {}
    for p in closed:
        m = p.get("entry_mode", "UNKNOWN")
        if m not in by_mode:
            by_mode[m] = {"total": 0, "wins": 0, "pnl_sum": 0}
        by_mode[m]["total"] += 1
        pnl = p.get("pnl_pct")
        if pnl is not None:
            by_mode[m]["pnl_sum"] += pnl
            if pnl > 0:
                by_mode[m]["wins"] += 1
    mode_stats = {
        m: {
            "total": v["total"],
            "wins":  v["wins"],
            "win_rate": round(v["wins"] / v["total"] * 100, 1) if v["total"] else None,
            "avg_pnl":  round(v["pnl_sum"] / v["total"], 1) if v["total"] else None,
        }
        for m, v in by_mode.items()
    }

    return {
        "total":           len(positions),
        "open":            len(open_),
        "closed":          len(closed),
        "tp_hit":          len(tp_list),
        "sl_hit":          len(sl_list),
        "time_stop":       len(ts_list),
        "expired":         len(ex_list),
        "win_rate":        round(len(tp_list) / len(closed) * 100, 1) if closed else None,
        "avg_pnl_pct":     round(sum(pnl_vals) / len(pnl_vals), 1) if pnl_vals else None,
        "avg_winner_pct":  round(sum(winners) / len(winners), 1) if winners else None,
        "avg_loser_pct":   round(sum(losers) / len(losers), 1) if losers else None,
        "best_trade_pct":  round(max(pnl_vals), 1) if pnl_vals else None,
        "worst_trade_pct": round(min(pnl_vals), 1) if pnl_vals else None,
        "avg_unrealized_pnl": round(sum(unrealized) / len(unrealized), 1) if unrealized else None,
        "by_mode":         mode_stats,
        "expectancy":      round((len(tp_list) / len(closed)) * (sum(winners) / len(winners) if winners else 0) +
                                 (len(losers) / len(closed)) * (sum(losers) / len(losers) if losers else 0), 1)
                           if closed else None,
    }

async def run_tracker():
    start = time.time()
    logging.info("🐂 BOGA AI Options P&L Tracker başlatıldı")

    # Mevcut outcomes yükle (daha önce kaydedilmiş pozisyonlar)
    existing_outcomes = load_json(OUTCOMES_FILE) or {}
    existing_positions: Dict[str, dict] = {
        p["id"]: p for p in existing_outcomes.get("positions", [])
    }

    # Yeni scan'lerden pozisyon ekle
    all_positions = collect_positions(existing_positions)

    # Sadece açık pozisyonları güncelle
    open_positions  = [p for p in all_positions.values() if p["status"] == "open"]
    closed_positions = [p for p in all_positions.values() if p["status"] != "open"]

    logging.info(f"📊 {len(open_positions)} açık, {len(closed_positions)} kapalı pozisyon")

    # Paralel price update
    if open_positions:
        updated = await asyncio.gather(*[update_position(p) for p in open_positions])
        for p in updated:
            all_positions[p["id"]] = p

    positions_list = sorted(all_positions.values(), key=lambda x: x["scan_date"], reverse=True)
    summary = _compute_summary(positions_list)

    outcomes = {
        "updated_at":   datetime.now(NY_TZ).isoformat(),
        "tracker_version": "1.0",
        "summary":      summary,
        "positions":    positions_list,
    }

    # Latest'e kaydet
    save_json(OUTCOMES_FILE, outcomes)
    logging.info(f"✅ options_outcomes.json güncellendi ({len(positions_list)} pozisyon)")

    # Bugünün data klasörüne de kaydet
    today_str = date.today().isoformat()
    today_path = os.path.join(DATA_DIR, today_str, "options_outcomes.json")
    save_json(today_path, outcomes)

    duration = time.time() - start
    logging.info(f"⏱ Tracker tamamlandı: {duration:.1f}s")
    logging.info(
        f"📈 Win rate: {summary.get('win_rate')}% | "
        f"Avg P&L: {summary.get('avg_pnl_pct')}% | "
        f"Open: {summary.get('open')} | Closed: {summary.get('closed')}"
    )
    return outcomes


if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_tracker())
