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
import re
import json
import asyncio
import logging
import time
import math
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


# ─── Giriş kuralı (2026-11-19, kullanıcı kararı) ──────────────────────────────
# Öneri tarama fiyatından değil, hisse aynı seansta VWAP'a geri döndüğünde (5dk kapanış) pozisyona dönüşür.
# CALL: kapanış <= VWAP · PUT: kapanış >= VWAP. Pencere: tarama anı -> 15:30 NY (15:30 sonrası taramada ertesi seans).
# Dönmezse "no_entry" (işlem yok, istatistiğe girmez). Giriş primi = tarama kotasyonundan çıkarılan IV ile
# dokunma anındaki hisse fiyatından Black-Scholes (entry_source="model_vwap_touch").
# Geriye dönük (25 hisse, 51 gün) + opsiyon242 kovalama filtresi: ort. +%0,8 -> +%5,3, maxDD -30,1k$ -> -9,2k$.
ENTRY_RULE   = "vwap_touch"
ENTRY_CUTOFF = (15, 30)
RISK_FREE    = 0.05


def _ncdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _bs(S: float, K: float, T: float, sigma: float, side: str) -> float:
    T = max(T, 1e-6); sigma = max(sigma, 1e-4)
    d1 = (math.log(S / K) + (RISK_FREE + sigma * sigma / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    call = S * _ncdf(d1) - K * math.exp(-RISK_FREE * T) * _ncdf(d2)
    return call if side == "CALL" else call - S + K * math.exp(-RISK_FREE * T)


def _implied_vol(price: float, S: float, K: float, T: float, side: str) -> float:
    lo, hi = 0.01, 5.0
    for _ in range(100):
        m = (lo + hi) / 2
        if _bs(S, K, T, m, side) > price: hi = m
        else: lo = m
    return (lo + hi) / 2


def _years_to(exp_iso: str, ts: datetime) -> float:
    exp_dt = datetime.fromisoformat(str(exp_iso)[:10] + "T16:00:00").replace(tzinfo=NY_TZ)
    return max((exp_dt - ts).total_seconds() / (365 * 86400), 1e-6)


async def _fetch_5m(ticker: str) -> Optional[pd.DataFrame]:
    try:
        df = await asyncio.to_thread(lambda: yf.download(ticker, period="5d", interval="5m", auto_adjust=False,
                                                         progress=False, prepost=False, multi_level_index=False))
        if df is None or df.empty:
            return None
        df.index = pd.to_datetime(df.index).tz_convert(NY_TZ)
        c = df["Close"].astype(float).values.copy()
        for i in range(1, len(c) - 1):   # Yahoo bozuk print: iki komşudan da >%1,5 sapan tek bar
            if abs(c[i] / c[i - 1] - 1) > 0.015 and abs(c[i] / c[i + 1] - 1) > 0.015:
                c[i] = (c[i - 1] + c[i + 1]) / 2
        df["C"] = c
        vol = df["Volume"].astype(float)
        df["V"] = vol.where(vol > 0, 1.0)
        df["d"] = df.index.date
        df["vwap"] = (df["C"] * df["V"]).groupby(df["d"]).cumsum() / df["V"].groupby(df["d"]).cumsum()
        return df
    except Exception as e:
        logging.debug(f"_fetch_5m {ticker}: {e}")
        return None


async def resolve_pending(pos: dict) -> dict:
    """Bekleyen öneri: VWAP'a dönüş olduysa pozisyonu aç, pencere geçtiyse no_entry."""
    if pos.get("status") != "pending":
        return pos
    try:
        scan_ts = datetime.fromisoformat(str(pos["scan_time"])).astimezone(NY_TZ)
    except Exception:
        pos["status"] = "open"; pos["entry_rule"] = "scan"
        return pos
    now = datetime.now(NY_TZ)
    if (now - scan_ts).days > 5:
        pos.update({"status": "no_entry", "exit_reason": "Giriş yok — VWAP dönüşü verisi bulunamadı"})
        return pos
    async with SEM:
        df = await _fetch_5m(pos["ticker"])
        await asyncio.sleep(0.2)
    if df is None:
        return pos
    side = pos.get("side", "CALL")
    sgn = 1.0 if side == "CALL" else -1.0
    cut_h, cut_m = ENTRY_CUTOFF
    # Pencere: tarama 15:30'dan önceyse taramanın seansı, değilse taramadan sonraki ilk seans
    in_day = (scan_ts.hour, scan_ts.minute) < (cut_h, cut_m)
    session_dates = sorted({d for d in df["d"] if d >= scan_ts.date()})
    if in_day:
        target = scan_ts.date() if scan_ts.date() in session_dates else None
        if target is None and now.date() > scan_ts.date():
            target = next((d for d in session_dates if d > scan_ts.date()), None)
    else:
        target = next((d for d in session_dates if d > scan_ts.date()), None)
    if target is None:
        return pos   # seans verisi henüz yok → beklemeye devam
    win_end = datetime(target.year, target.month, target.day, cut_h, cut_m, tzinfo=NY_TZ)
    win = df[df["d"] == target]
    close_ts = win.index + pd.Timedelta(minutes=5)   # bar etiketi açılış zamanı
    mask = close_ts <= win_end
    if target == scan_ts.date():
        mask &= close_ts > scan_ts
    win = win[mask]
    hit = win[sgn * (win["C"] - win["vwap"]) <= 0]
    if len(hit):
        ts = (hit.index[0] + pd.Timedelta(minutes=5)).to_pydatetime()
        S_t = float(hit["C"].iloc[0])
        S0, K, mid = float(pos["underlying_entry"]), float(pos["strike"]), float(pos["scan_premium"])
        sigma = _implied_vol(mid, S0, K, _years_to(pos["expiration"], scan_ts), side)
        entry = round(_bs(S_t, K, _years_to(pos["expiration"], ts), sigma, side), 2)
        pos.update({
            "status": "open", "entry_premium": entry, "entry_time": ts.isoformat(),
            "entry_date": ts.date().isoformat(), "entry_underlying": round(S_t, 2),
            "entry_source": "model_vwap_touch",
            "tp_target": round(entry * 1.50, 2), "sl_target": round(entry * 0.65, 2),
        })
        logging.info(f"🎯 {pos['ticker']} {side}: VWAP dönüşü {ts.strftime('%m-%d %H:%M')} @ {S_t:.2f} → giriş ${entry}")
        return pos
    if now >= win_end:
        pos.update({"status": "no_entry", "exit_date": target.isoformat(),
                    "exit_reason": f"Giriş yok — {target.isoformat()} seansında VWAP'a dönmedi"})
    return pos


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

def _build_position(scan_date: str, pick: dict, contract: dict, scan_ts: Optional[str] = None) -> Optional[dict]:
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
    side   = (contract.get("side") or pick.get("side") or "CALL").upper()
    pos_id = f"{pick['ticker']}-{scan_date}-{int(strike)}{'P' if side == 'PUT' else 'C'}-{expiration}-v242"

    return {
        "id":               pos_id,
        "scan_date":        scan_date,
        "ticker":           pick["ticker"],
        "strategy":         "v242_put" if side == "PUT" else "v242_call",
        "side":             side,
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
        "status":           "pending" if (ENTRY_RULE == "vwap_touch" and scan_ts) else "open",
                                      # pending / no_entry / open / tp_hit / sl_hit / time_stop / expired / manual
        "entry_rule":       ENTRY_RULE if scan_ts else "scan",
        "scan_time":        scan_ts,
        "scan_premium":     premium,
        "entry_time":       None,
        "entry_date":       None,
        "entry_underlying": None,
        "entry_source":     None,
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
    new_cutoff = (date.today() - timedelta(days=3)).isoformat()
    seen_day = {(p.get("ticker"), p.get("scan_date")) for p in positions.values()}

    scan_files = []

    # data/v2NN_YYYYMMDD_HHMM.json — SÜRÜM ÖNEKİNDEN BAĞIMSIZ (2026-11-12 düzeltme: yalnız v242_ aranıyordu; tarayıcı v243_
    # yazdığı için 14 Ekim'den sonraki hiçbir tarama pozisyona dönüşmüyor, saatlik çalışma açık pozisyonları 0'a düşürüyordu)
    if os.path.isdir(DATA_DIR):
        for p in sorted(glob.glob(os.path.join(DATA_DIR, "v2*_*.json"))):
            if re.search(r"_(\d{8}_\d{4})\.json$", os.path.basename(p)):
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

    # Depoyla eşitlenen yayın dosyaları: başka makinede (Windows/sunucu) yapılan taramalar da pozisyona dönüşsün
    pub = os.path.join(HERE, "frontend", "public", "data")
    if os.path.isdir(pub):
        cutoff = (date.today() - timedelta(days=60)).isoformat()
        for d in sorted(os.listdir(pub)):
            if len(d) == 10 and d[:4].isdigit() and d >= cutoff:
                f = os.path.join(pub, d, "options_picks.json")
                if os.path.isfile(f):
                    scan_files.append(f)
        f = os.path.join(pub, "latest", "options_picks.json")
        if os.path.isfile(f):
            scan_files.append(f)

    for path in scan_files:
        data = load_json(path)
        if not isinstance(data, dict) or not data:
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

            pos = _build_position(scan_date, pick, contract, data.get("generated_at"))
            if not pos:
                continue

            pid = pos["id"]
            if pid in positions:
                continue
            # Geç eklenen eski taramalar bugünkü primle değerlendirilip yanlış sonuç üretir → yalnız son 3 günün taramaları yeni pozisyon olur
            if scan_date < new_cutoff:
                continue
            # Gün içi tekrar taramalar aynı hisse için farklı strike'larla çoğalmasın: hisse+gün başına ilk öneri
            day_key = (pos["ticker"], scan_date)
            if day_key in seen_day:
                continue
            seen_day.add(day_key)
            positions[pid] = pos
            added += 1

    logging.info(f"✅ {added} yeni pozisyon eklendi, toplam: {len(positions)}")
    return positions


# ─── Price Fetcher ────────────────────────────────────────────────────────────

async def fetch_current_option_price(
    ticker: str, expiration: str, strike: float, side: str = "CALL"
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
        calls = chain.puts if str(side).upper() == "PUT" else chain.calls
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
    held    = _days_held(pos.get("entry_date") or pos["scan_date"])
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
    if ts_days and held >= ts_days and current_premium is not None:
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
        return pos   # fiyat çekilemedi (Yahoo kısıtı vb.) → önceki güncel/unrealized değerleri koru

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
            pos["ticker"], pos.get("expiration", ""), pos.get("strike", 0), pos.get("side", "CALL")
        )
        await asyncio.sleep(0.2)
    return _update_status(pos, cur)


def _compute_summary(positions: List[dict]) -> dict:
    closed = [p for p in positions if p["status"] not in ("open", "pending", "no_entry")]
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
        "pending":          sum(1 for p in positions if p["status"] == "pending"),
        "no_entry":         sum(1 for p in positions if p["status"] == "no_entry"),
        # Kazanma oranı = P&L > 0 olan kapanışlar (eskiden TP oranıydı; o artık tp_rate)
        "win_rate":         round(len(winners) / len(pnl_vals) * 100, 1) if pnl_vals else None,
        "tp_rate":          round(len(tp_list) / len(closed) * 100, 1) if closed else None,
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
    # Depodaki yayınlanmış sonuçlarla birleştir (başka makinenin açtığı/kapattığı pozisyonlar kaybolmasın).
    # Aynı pozisyon iki kaynakta varsa kapanmış olan (ya da daha çok gün izlenmiş olan) kazanır.
    published = load_json(os.path.join(HERE, "frontend", "public", "data", "latest", "options_outcomes.json")) or {}
    for p in published.get("positions", []):
        cur = existing_positions.get(p.get("id"))
        if cur is None:
            existing_positions[p["id"]] = p
        elif cur.get("status") == "pending" and p.get("status") != "pending":
            existing_positions[p["id"]] = p
        elif cur.get("status") == "open" and (p.get("status") not in ("open", "pending") or (p.get("days_held") or 0) > (cur.get("days_held") or 0)):
            existing_positions[p["id"]] = p

    # Yeni scan dosyalarından pozisyon ekle
    all_positions = collect_positions(existing_positions)

    pending = [p for p in all_positions.values() if p["status"] == "pending"]
    if pending:
        for p in await asyncio.gather(*[resolve_pending(p) for p in pending]):
            all_positions[p["id"]] = p
        logging.info(f"⏳ {len(pending)} bekleyen öneri: "
                     f"{sum(1 for p in pending if p['status'] == 'open')} giriş, "
                     f"{sum(1 for p in pending if p['status'] == 'no_entry')} giriş yok")

    open_positions   = [p for p in all_positions.values() if p["status"] == "open"]
    closed_positions = [p for p in all_positions.values() if p["status"] not in ("open", "pending", "no_entry")]
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
