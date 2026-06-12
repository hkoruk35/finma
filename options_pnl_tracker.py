"""
🐂 BOGA AI v242 — Options P&L Tracker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
v242 scan çıktısı (v242_YYYYMMDD_HHMM.json) dosyalarını
okur, her pick için pozisyon oluşturur ve güncel opsiyon
fiyatlarıyla unrealized/realized P&L hesaplar.

v242 kontrat yapısı:
  pick["opt"]["best"]  →  tek kontrat objesi (mid, strike, expiration, ...)
  pick["trend"]        →  trend motoru çıktısı (rs_60, ret_5d, hh_structure, ...)
  pick["vol"]          →  hacim motoru çıktısı (rvol, today_rvol, ...)
  pick["bs"]           →  breakout/squeeze motoru (setup_type, bs_label, ...)
  pick["mom"]          →  momentum motoru (rsi_1d, rsi_1h_val, ...)
  pick["opt"]          →  opsiyon motoru (iv_rank, atm_iv, flow_label, ...)

Çıktı: transfer/latest/options_outcomes.json
       data/{date}/options_outcomes.json (snapshot)

Çalıştırma:
  python options_pnl_tracker.py

Otomatik tetikleme:
  opsiyon242.py her scan sonrası bu scripti çağırır.
"""

import os
import glob
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

NY_TZ         = ZoneInfo("America/New_York")
HERE          = os.path.dirname(os.path.abspath(__file__))
DATA_DIR      = os.path.join(HERE, "data")
LATEST_DIR    = os.path.join(HERE, "transfer", "latest")
OUTCOMES_FILE = os.path.join(LATEST_DIR, "options_outcomes.json")

# v242 piyasa rejimi — tracker aynı process'ten çağrıldığında dolu olur,
# standalone çalışmada fallback olarak boş dict kullanılır.
try:
    from opsiyon242 import MARKET_REGIME  # type: ignore
except ImportError:
    MARKET_REGIME: Dict = {}


# ─── Helper ──────────────────────────────────────────────────────────────────

def _sanitize(raw: str) -> str:
    import re
    raw = re.sub(r':\s*NaN',       ': null', raw)
    raw = re.sub(r':\s*Infinity',  ': null', raw)
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

def _build_position(scan_date: str, pick: dict, contract: dict) -> Optional[dict]:
    """
    v242 pick + opt["best"] kontratından pozisyon objesi oluştur.

    v242 veri yapısı:
      pick["ticker"], pick["current_price"], pick["score"], pick["sector_etf"]
      pick["opt"]["best"]  →  kontrat (mid, strike, expiration, dte, delta,
                               tp_price, sl_price, time_stop_days, gt_ratio, iv_rank)
      pick["trend"]        →  rs_60, ret_5d, weekly_ok, hh_structure, atr_pct
      pick["bs"]           →  setup_type, bs_label, at_new_high, nr7, bb_pct
      pick["vol"]          →  rvol, today_rvol
      pick["mom"]          →  rsi_1d, rsi_1h_val
      pick["opt"]          →  iv_rank, atm_iv, flow_label, put_call_ratio
      pick["hv20"]         →  gerçekleşen volatilite (%)
    """
    if not contract:
        return None
    strike     = contract.get("strike")
    expiration = contract.get("expiration")
    # v242: "mid" | eski format fallback: "premium"
    premium    = contract.get("mid") or contract.get("premium")
    if not all([strike, expiration, premium]):
        return None

    # Yardımcı sub-dict'ler
    trend = pick.get("trend") or {}
    bs    = pick.get("bs")    or {}
    vol   = pick.get("vol")   or {}
    mom   = pick.get("mom")   or {}
    opt   = pick.get("opt")   or {}

    setup_type = bs.get("setup_type", "")
    atm_iv     = opt.get("atm_iv", 0)
    hv20       = pick.get("hv20", 0)

    # IV/HV karşılaştırma etiketi
    iv_vs_hv_label = None
    if atm_iv and hv20:
        ratio = (atm_iv / hv20) if hv20 > 0 else 1.0
        iv_vs_hv_label = ("IV < HV — ucuz"     if ratio < 0.9
                    else  "IV ~ HV — dengeli"   if ratio < 1.2
                    else  "IV > HV — pahalı")

    # RS vs SPY etiketi (60 günlük rölatif güç)
    rs_60 = trend.get("rs_60", 0)
    rs_vs_spy_label = (f"RS+{rs_60:.1f}pp lider" if rs_60 >= 5
                 else  f"RS{rs_60:+.1f}pp nötr"  if rs_60 >= 0
                 else  f"RS{rs_60:.1f}pp zayıf")

    # Piyasa rejimi (global veya fallback)
    regime = MARKET_REGIME.get("regime", "")

    # Expected move tahmini: underlying × IV% × sqrt(DTE/365)
    dte    = contract.get("dte") or 21
    cp_val = pick.get("current_price") or 0
    expected_move = None
    if atm_iv and cp_val:
        expected_move = round(cp_val * (atm_iv / 100) * ((dte / 365) ** 0.5), 2)

    # Unique ID: ticker-scanDate-strike-expiry-v242
    pos_id = f"{pick['ticker']}-{scan_date}-{int(strike)}C-{expiration}-v242"

    return {
        "id":               pos_id,
        "scan_date":        scan_date,
        "ticker":           pick["ticker"],
        "strategy":         "v242_call",
        # --- Giriş bilgileri ---
        "entry_mode":       setup_type,           # eski entry_mode karşılığı
        "entry_mode_label": bs.get("bs_label", ""),
        "regime":           regime,
        "score":            pick.get("score", 0),
        "sector_etf":       pick.get("sector_etf", ""),
        "underlying_entry": cp_val,
        "strike":           strike,
        "expiration":       expiration,
        "dte_at_entry":     dte,
        "entry_premium":    premium,
        "tp_target":        contract.get("tp_price"),
        "sl_target":        contract.get("sl_price"),
        "time_stop_days":   contract.get("time_stop_days"),
        "iv_rank_at_entry": opt.get("iv_rank"),
        "delta_at_entry":   contract.get("delta"),
        "expected_move":    expected_move,
        # --- Tracker tarafından güncellenen alanlar ---
        "status":           "open",   # open / tp_hit / sl_hit / time_stop / expired / manual
        "exit_premium":     None,
        "exit_date":        None,
        "exit_reason":      None,
        "pnl_pct":          None,
        "current_premium":  None,
        "unrealized_pnl_pct": None,
        "days_held":        None,
        "peak_premium":     None,
        "trough_premium":   None,
        "underlying_current": None,
        # --- Performans sayfası etiketleri ---
        "iv_vs_hv_label":   iv_vs_hv_label,
        "rs_vs_spy_label":  rs_vs_spy_label,
        "upside_label":     bs.get("bs_label"),
        "higher_highs":     trend.get("hh_structure"),
        "volume_spike":     (vol.get("today_rvol", 1.0) or 1.0) >= 2.0,
        # --- v242 ek analiz alanları ---
        "setup_type":       setup_type,
        "weekly_ok":        trend.get("weekly_ok"),
        "rs_60":            rs_60,
        "ret_5d":           trend.get("ret_5d"),
        "rsi_1d":           mom.get("rsi_1d"),
        "rsi_1h":           mom.get("rsi_1h"),
        "rvol":             vol.get("rvol"),
        "today_rvol":       vol.get("today_rvol"),
        "gt_ratio":         contract.get("gt_ratio"),
        "atr_pct":          trend.get("atr_pct", 2.0),
        "hv20":             hv20,
        "atm_iv":           atm_iv,
        "flow_label":       opt.get("flow_label"),
        "put_call_ratio":   opt.get("put_call_ratio"),
    }


def collect_positions(existing: Dict[str, dict]) -> Dict[str, dict]:
    """
    v242 scan dosyalarını oku, yeni pozisyonlar ekle.

    v242 dosya adı formatı: data/v242_YYYYMMDD_HHMM.json
    Her dosya picks listesi içerir; her pick'in opt["best"] alanı kontrat.
    """
    positions = dict(existing)
    added = 0

    scan_files = []

    # v242 formatı: data/v242_*.json
    if os.path.isdir(DATA_DIR):
        for p in sorted(glob.glob(os.path.join(DATA_DIR, "v242_*.json"))):
            scan_files.append(p)

    # Geçmiş format uyumu: data/YYYY-MM-DD/options_picks.json (varsa)
    if os.path.isdir(DATA_DIR):
        for d in sorted(os.listdir(DATA_DIR)):
            if len(d) == 10 and d[:4].isdigit():
                legacy = os.path.join(DATA_DIR, d, "options_picks.json")
                if os.path.isfile(legacy):
                    scan_files.append(legacy)

    # Latest klasöründe güncel dosya varsa (eski format)
    latest_p = os.path.join(LATEST_DIR, "options_picks.json")
    if os.path.isfile(latest_p):
        scan_files.append(latest_p)

    for path in scan_files:
        data = load_json(path)
        if not data:
            continue

        scan_date = data.get("date", date.today().isoformat())
        picks     = data.get("picks", [])

        for pick in picks:
            # ── v242 formatı: pick["opt"]["best"] ──
            opt_block = pick.get("opt") or {}
            contract  = opt_block.get("best")

            # ── Geçmiş format fallback: pick["institutional"] / pick["asymmetric"] ──
            if not contract:
                for strat in ("institutional", "asymmetric"):
                    legacy_c = pick.get(strat) or (pick.get("options") or {}).get(strat)
                    if legacy_c:
                        contract = legacy_c
                        break

            if not contract:
                continue

            pos = _build_position(scan_date, pick, contract)
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
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps:
            return None
        target = date.fromisoformat(expiration)
        exps_d = []
        for e in exps:
            try: exps_d.append(date.fromisoformat(e))
            except: pass
        if not exps_d:
            return None
        closest = min(exps_d, key=lambda x: abs((x - target).days))
        if abs((closest - target).days) > 14:
            return None   # expired olabilir
        closest_str = closest.isoformat()

        chain = await asyncio.to_thread(lambda: stock.option_chain(closest_str))
        calls = chain.calls
        if calls is None or calls.empty:
            return None

        calls["strike"]    = pd.to_numeric(calls["strike"],    errors="coerce")
        calls["bid"]       = pd.to_numeric(calls.get("bid", 0),       errors="coerce").fillna(0)
        calls["ask"]       = pd.to_numeric(calls.get("ask", 0),       errors="coerce").fillna(0)
        calls["lastPrice"] = pd.to_numeric(calls.get("lastPrice", 0), errors="coerce").fillna(0)

        calls["dist"] = abs(calls["strike"] - strike)
        row  = calls.nsmallest(1, "dist").iloc[0]
        if row["dist"] > 2.5:
            return None   # strike çok uzak

        bid, ask, last = float(row["bid"]), float(row["ask"]), float(row["lastPrice"])
        if ask > 0 and bid > 0:
            return round((bid + ask) / 2, 4)
        elif ask > 0:
            return round(ask * 0.95, 4)
        elif last > 0:
            return round(last, 4)   # piyasa kapalı fallback
        return None
    except Exception as e:
        logging.debug(f"fetch_option {ticker} {expiration} {strike}: {e}")
        return None


# ─── Status Logic ─────────────────────────────────────────────────────────────

def _days_held(scan_date: str) -> int:
    try:
        return (date.today() - date.fromisoformat(scan_date)).days
    except:
        return 0

def _is_expired(expiration: str) -> bool:
    try:
        return date.fromisoformat(expiration) < date.today()
    except:
        return False

def _update_status(pos: dict, current_premium: Optional[float]) -> dict:
    """Güncel fiyata göre status ve P&L hesapla."""
    if pos["status"] != "open":
        return pos   # kapalı pozisyona dokunma

    entry   = pos["entry_premium"]
    tp      = pos["tp_target"]
    sl      = pos["sl_target"]
    ts_days = pos["time_stop_days"]
    held    = _days_held(pos["scan_date"])
    pos["days_held"] = held

    # Expired
    if _is_expired(pos.get("expiration", "")):
        cur = current_premium or 0.0
        pos["current_premium"] = cur
        pos["pnl_pct"]   = round((cur - entry) / entry * 100, 1) if (entry and cur > 0.05) else -100.0
        pos["status"]    = "expired"
        pos["exit_premium"] = cur
        pos["exit_date"] = pos.get("expiration")
        pos["exit_reason"] = "Expiry — " + ("worthless" if (cur or 0) < 0.05 else f"${cur:.2f}")
        return pos

    # Time stop — v242: time_stop_days = round(dte * 0.40)
    if ts_days and held >= ts_days:
        cur = current_premium
        pnl = round((cur - entry) / entry * 100, 1) if (cur and entry) else None
        pos.update({
            "status": "time_stop", "current_premium": cur,
            "exit_premium": cur, "exit_date": date.today().isoformat(),
            "exit_reason": f"Time Stop ({held}g ≥ {ts_days}g)",
            "pnl_pct": pnl, "unrealized_pnl_pct": None,
        })
        return pos

    if current_premium is None:
        pos["unrealized_pnl_pct"] = None
        return pos

    pos["current_premium"] = current_premium

    # Peak / trough tracking
    pos["peak_premium"]   = max(pos.get("peak_premium")   or 0,            current_premium)
    pos["trough_premium"] = min(pos.get("trough_premium") or float('inf'), current_premium)
    if pos["trough_premium"] == float('inf'):
        pos["trough_premium"] = current_premium

    if entry:
        pos["unrealized_pnl_pct"] = round((current_premium - entry) / entry * 100, 1)

    # TP hit (v242 TP = mid * 1.50)
    if tp and current_premium >= tp:
        pos.update({
            "status": "tp_hit", "exit_premium": current_premium,
            "exit_date": date.today().isoformat(),
            "exit_reason": f"TP Hit (${current_premium:.2f} ≥ ${tp:.2f})",
            "pnl_pct": round((current_premium - entry) / entry * 100, 1) if entry else None,
        })
        return pos

    # SL hit (v242 SL = mid * 0.65)
    if sl and current_premium <= sl:
        pos.update({
            "status": "sl_hit", "exit_premium": current_premium,
            "exit_date": date.today().isoformat(),
            "exit_reason": f"SL Hit (${current_premium:.2f} ≤ ${sl:.2f})",
            "pnl_pct": round((current_premium - entry) / entry * 100, 1) if entry else None,
        })
        return pos

    return pos


# ─── Main Tracker ─────────────────────────────────────────────────────────────

SEM = asyncio.Semaphore(6)

async def update_position(pos: dict) -> dict:
    if pos.get("status") != "open":
        return pos
    async with SEM:
        cur = await fetch_current_option_price(
            pos["ticker"], pos.get("expiration", ""), pos.get("strike", 0)
        )
        await asyncio.sleep(0.2)
    return _update_status(pos, cur)


def _compute_summary(positions: List[dict]) -> dict:
    closed = [p for p in positions if p["status"] != "open"]
    open_  = [p for p in positions if p["status"] == "open"]

    pnl_vals   = [p["pnl_pct"]             for p in closed if p.get("pnl_pct")             is not None]
    unrealized = [p["unrealized_pnl_pct"]  for p in open_  if p.get("unrealized_pnl_pct")  is not None]

    tp_list = [p for p in closed if p["status"] == "tp_hit"]
    sl_list = [p for p in closed if p["status"] == "sl_hit"]
    ts_list = [p for p in closed if p["status"] == "time_stop"]
    ex_list = [p for p in closed if p["status"] == "expired"]

    winners = [v for v in pnl_vals if v > 0]
    losers  = [v for v in pnl_vals if v <= 0]

    # Setup tipine göre breakdown (v242: setup_type alanı)
    by_setup: Dict[str, dict] = {}
    for p in closed:
        st = p.get("setup_type") or p.get("entry_mode") or "UNKNOWN"
        if st not in by_setup:
            by_setup[st] = {"total": 0, "wins": 0, "pnl_sum": 0.0}
        by_setup[st]["total"] += 1
        pnl = p.get("pnl_pct")
        if pnl is not None:
            by_setup[st]["pnl_sum"] += pnl
            if pnl > 0: by_setup[st]["wins"] += 1

    setup_stats = {
        st: {
            "total":    v["total"],
            "wins":     v["wins"],
            "win_rate": round(v["wins"] / v["total"] * 100, 1) if v["total"] else None,
            "avg_pnl":  round(v["pnl_sum"] / v["total"], 1)    if v["total"] else None,
        }
        for st, v in by_setup.items()
    }

    return {
        "total":            len(positions),
        "open":             len(open_),
        "closed":           len(closed),
        "tp_hit":           len(tp_list),
        "sl_hit":           len(sl_list),
        "time_stop":        len(ts_list),
        "expired":          len(ex_list),
        "win_rate":         round(len(tp_list) / len(closed) * 100, 1) if closed else None,
        "avg_pnl_pct":      round(sum(pnl_vals) / len(pnl_vals), 1)   if pnl_vals   else None,
        "avg_winner_pct":   round(sum(winners)  / len(winners),  1)   if winners    else None,
        "avg_loser_pct":    round(sum(losers)   / len(losers),   1)   if losers     else None,
        "best_trade_pct":   round(max(pnl_vals), 1)                   if pnl_vals   else None,
        "worst_trade_pct":  round(min(pnl_vals), 1)                   if pnl_vals   else None,
        "avg_unrealized_pnl": round(sum(unrealized) / len(unrealized), 1) if unrealized else None,
        "by_setup":         setup_stats,    # v242: by_mode → by_setup
        "expectancy": round(
            (len(tp_list) / len(closed)) * (sum(winners) / len(winners) if winners else 0) +
            (len(losers)  / len(closed)) * (sum(losers)  / len(losers)  if losers  else 0), 1
        ) if closed else None,
    }


async def run_tracker():
    start = time.time()
    logging.info("🐂 BOGA AI v242 Options P&L Tracker başlatıldı")

    # Mevcut outcomes yükle
    existing_outcomes  = load_json(OUTCOMES_FILE) or {}
    existing_positions = {p["id"]: p for p in existing_outcomes.get("positions", [])}

    # Yeni scan dosyalarından pozisyon ekle
    all_positions = collect_positions(existing_positions)

    open_positions   = [p for p in all_positions.values() if p["status"] == "open"]
    closed_positions = [p for p in all_positions.values() if p["status"] != "open"]
    logging.info(f"📊 {len(open_positions)} açık, {len(closed_positions)} kapalı pozisyon")

    # Paralel price update
    if open_positions:
        updated = await asyncio.gather(*[update_position(p) for p in open_positions])
        for p in updated:
            all_positions[p["id"]] = p

    positions_list = sorted(all_positions.values(), key=lambda x: x["scan_date"], reverse=True)
    summary        = _compute_summary(positions_list)

    outcomes = {
        "updated_at":      datetime.now(NY_TZ).isoformat(),
        "tracker_version": "2.0-v242",
        "summary":         summary,
        "positions":       positions_list,
    }

    # Latest'e kaydet
    save_json(OUTCOMES_FILE, outcomes)
    logging.info(f"✅ options_outcomes.json güncellendi ({len(positions_list)} pozisyon)")

    # Bugünün data klasörüne snapshot
    today_str  = date.today().isoformat()
    today_path = os.path.join(DATA_DIR, today_str, "options_outcomes.json")
    save_json(today_path, outcomes)

    # Frontend public/data senkronizasyonu
    import shutil
    frontend_public = os.path.join(HERE, "frontend", "public")
    frontend_dir = os.path.join(frontend_public, "data")
    if os.path.exists(frontend_dir):
        # Root public/options_outcomes.json
        shutil.copy2(OUTCOMES_FILE, os.path.join(frontend_public, "options_outcomes.json"))
        # data/latest/
        f_latest = os.path.join(frontend_dir, "latest")
        os.makedirs(f_latest, exist_ok=True)
        shutil.copy2(OUTCOMES_FILE, os.path.join(f_latest, "options_outcomes.json"))
        # data/<date>/
        f_date = os.path.join(frontend_dir, today_str)
        os.makedirs(f_date, exist_ok=True)
        shutil.copy2(today_path, os.path.join(f_date, "options_outcomes.json"))
        logging.info("✅ Frontend outcomes senkronizasyonu başarılı.")

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
