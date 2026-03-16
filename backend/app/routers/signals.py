"""
Signals API Router — Supabase entegrasyonlu sinyal geçmişi
Endpoints: latest signals, history, candidates, featured (top 5), bot status, push
"""

from fastapi import APIRouter, HTTPException, Query, Header
from typing import List, Optional
from pydantic import BaseModel
import json
import os
from datetime import datetime
from app.database import SignalsDB
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── In-memory pushed signal store (Railway'de kalıcı) ───
_pushed_signals: Optional[dict] = None

# Paths to bot output files
SIGNAL_PATHS = [
    os.path.join("bots", "output", "bot_analysis_latest.json"),
    os.path.join("bots", "output", "inday312_latest.json"),
]

# Fallback paths to original FinMA system
FALLBACK_PATHS = [
    os.path.abspath(os.path.join(
        "..", ".gemini", "antigravity", "scratch", "financial_tracker",
        "watchlists", "bot_analysis_latest.json"
    )),
]


def load_latest_signals() -> Optional[dict]:
    """Load: 1) pushed via API  2) local file  3) None"""
    global _pushed_signals
    if _pushed_signals:
        return _pushed_signals
    for path in SIGNAL_PATHS + FALLBACK_PATHS:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                continue
    return None


# ─── Push Request Schema ───
class CandidatePush(BaseModel):
    ticker: str
    score: float
    price: float
    entry: float          # Giriş fiyatı
    stop_loss: float
    tp1: float            # Target 1
    tp2: float            # Target 2
    action: str = "BUY"
    sector: str = "Unknown"
    notes: Optional[List[str]] = None


class SignalsPushRequest(BaseModel):
    bot_name: str = "swing112"
    market_regime: str = "Bull"
    vix_level: float = 20.0
    sector_leaders: Optional[List[str]] = None
    candidates: List[CandidatePush]


# Mock signal data — Swing112 bot formatı (bot push etmediğinde fallback)
MOCK_SIGNALS = {
    "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    "bot_name": "swing112",
    "market_regime": "Bull",
    "sector_leaders": ["Energy", "Materials"],
    "vix_level": 20.5,
    "candidates": [
        {"ticker": "CGON", "score": 35.1, "price": 64.82, "action": "BUY", "entry_zone": "64.82 - 67.41", "stop_loss": 58.41, "target": 71.30, "tp1": 67.41, "tp2": 71.30, "potential_pct": 10.00, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 35.1"]},
        {"ticker": "LXU",  "score": 33.5, "price": 14.75, "action": "BUY", "entry_zone": "14.75 - 15.34", "stop_loss": 13.02, "target": 16.23, "tp1": 15.34, "tp2": 16.23, "potential_pct": 10.03, "sector": "Materials", "trend_phase": "Expansion", "notes": ["Swing112 skor: 33.5"]},
        {"ticker": "ADEA", "score": 32.5, "price": 23.10, "action": "BUY", "entry_zone": "23.10 - 24.02", "stop_loss": 21.07, "target": 25.41, "tp1": 24.02, "tp2": 25.41, "potential_pct": 9.96, "sector": "Technology", "trend_phase": "Expansion", "notes": ["Swing112 skor: 32.5"]},
        {"ticker": "PBR",  "score": 30.4, "price": 18.57, "action": "BUY", "entry_zone": "18.57 - 19.14", "stop_loss": 17.43, "target": 19.99, "tp1": 19.14, "tp2": 19.99, "potential_pct": 7.65, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 30.4"]},
        {"ticker": "STGW", "score": 30.0, "price": 5.95,  "action": "BUY", "entry_zone": "5.95 - 6.19",  "stop_loss": 5.17,  "target": 6.55,  "tp1": 6.19,  "tp2": 6.55,  "potential_pct": 10.08, "sector": "Technology", "trend_phase": "Expansion", "notes": ["Swing112 skor: 30.0"]},
        {"ticker": "BP",   "score": 29.6, "price": 42.67, "action": "BUY", "entry_zone": "42.67 - 43.65", "stop_loss": 40.70, "target": 45.13, "tp1": 43.65, "tp2": 45.13, "potential_pct": 5.76, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 29.6"]},
        {"ticker": "DNTH", "score": 29.3, "price": 78.89, "action": "BUY", "entry_zone": "78.89 - 82.04", "stop_loss": 68.49, "target": 86.77, "tp1": 82.04, "tp2": 86.77, "potential_pct": 9.99, "sector": "Healthcare", "trend_phase": "Expansion", "notes": ["Swing112 skor: 29.3"]},
        {"ticker": "UNFI", "score": 27.8, "price": 41.69, "action": "BUY", "entry_zone": "41.69 - 43.36", "stop_loss": 37.98, "target": 45.86, "tp1": 43.36, "tp2": 45.86, "potential_pct": 10.00, "sector": "Consumer", "trend_phase": "Expansion", "notes": ["Swing112 skor: 27.8"]},
        {"ticker": "OXY",  "score": 27.4, "price": 57.33, "action": "BUY", "entry_zone": "57.33 - 59.26", "stop_loss": 53.48, "target": 62.15, "tp1": 59.26, "tp2": 62.15, "potential_pct": 8.41, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 27.4"]},
        {"ticker": "EGY",  "score": 27.3, "price": 5.49,  "action": "BUY", "entry_zone": "5.49 - 5.70",  "stop_loss": 4.91,  "target": 6.03,  "tp1": 5.70,  "tp2": 6.03,  "potential_pct": 9.84, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 27.3"]},
        {"ticker": "ERIC", "score": 27.2, "price": 11.89, "action": "BUY", "entry_zone": "11.89 - 12.20", "stop_loss": 11.26, "target": 12.67, "tp1": 12.20, "tp2": 12.67, "potential_pct": 6.56, "sector": "Communication", "trend_phase": "Expansion", "notes": ["Swing112 skor: 27.2"]},
        {"ticker": "CAPR", "score": 26.9, "price": 30.65, "action": "BUY", "entry_zone": "30.65 - 31.88", "stop_loss": 26.15, "target": 33.72, "tp1": 31.88, "tp2": 33.72, "potential_pct": 10.02, "sector": "Healthcare", "trend_phase": "Expansion", "notes": ["Swing112 skor: 26.9"]},
        {"ticker": "UTHR", "score": 26.8, "price": 533.37,"action": "BUY", "entry_zone": "533.37 - 551.08","stop_loss": 497.95,"target": 577.64,"tp1": 551.08,"tp2": 577.64,"potential_pct": 8.30, "sector": "Healthcare", "trend_phase": "Expansion", "notes": ["Swing112 skor: 26.8"]},
        {"ticker": "NOK",  "score": 26.5, "price": 8.64,  "action": "BUY", "entry_zone": "8.64 - 8.98",  "stop_loss": 7.95,  "target": 9.49,  "tp1": 8.98,  "tp2": 9.49,  "potential_pct": 9.84, "sector": "Communication", "trend_phase": "Expansion", "notes": ["Swing112 skor: 26.5"]},
        {"ticker": "DAR",  "score": 26.0, "price": 54.57, "action": "BUY", "entry_zone": "54.57 - 56.36", "stop_loss": 50.99, "target": 59.05, "tp1": 56.36, "tp2": 59.05, "potential_pct": 8.21, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 26.0"]},
        {"ticker": "NSSC", "score": 25.6, "price": 42.99, "action": "BUY", "entry_zone": "42.99 - 44.61", "stop_loss": 39.76, "target": 47.03, "tp1": 44.61, "tp2": 47.03, "potential_pct": 9.40, "sector": "Industrials", "trend_phase": "Expansion", "notes": ["Swing112 skor: 25.6"]},
        {"ticker": "RLAY", "score": 25.0, "price": 10.30, "action": "BUY", "entry_zone": "10.30 - 10.71", "stop_loss": 8.80,  "target": 11.32, "tp1": 10.71, "tp2": 11.32, "potential_pct": 9.90, "sector": "Healthcare", "trend_phase": "Expansion", "notes": ["Swing112 skor: 25.0"]},
        {"ticker": "APEI", "score": 24.7, "price": 54.12, "action": "BUY", "entry_zone": "54.12 - 55.32", "stop_loss": 48.55, "target": 57.13, "tp1": 55.32, "tp2": 57.13, "potential_pct": 5.56, "sector": "Consumer", "trend_phase": "Expansion", "notes": ["Swing112 skor: 24.7 [E]"]},
        {"ticker": "PSX",  "score": 24.5, "price": 173.67,"action": "BUY", "entry_zone": "173.67 - 178.93","stop_loss": 163.14,"target": 186.83,"tp1": 178.93,"tp2": 186.83,"potential_pct": 7.58, "sector": "Energy", "trend_phase": "Expansion", "notes": ["Swing112 skor: 24.5"]},
        {"ticker": "TALK", "score": 23.7, "price": 5.14,  "action": "BUY", "entry_zone": "5.14 - 5.35",  "stop_loss": 4.73,  "target": 5.66,  "tp1": 5.35,  "tp2": 5.66,  "potential_pct": 10.12, "sector": "Technology", "trend_phase": "Expansion", "notes": ["Swing112 skor: 23.7"]},
    ],
}


@router.get("/latest")
async def get_latest_signals():
    """En son bot sinyal raporunu getir"""
    data = load_latest_signals()
    if data:
        # Supabase'e kaydet (arka planda)
        try:
            SignalsDB.save_report(data)
        except Exception as e:
            logger.warning(f"Sinyal kayıt hatası: {e}")
    return data or MOCK_SIGNALS


@router.get("/featured")
async def get_featured(limit: int = Query(5, ge=1, le=10)):
    """Öne çıkan en iyi skor hisseler (Öne Çıkanlar sayfası)"""
    data = load_latest_signals() or MOCK_SIGNALS
    candidates = data.get("candidates", [])
    sorted_candidates = sorted(candidates, key=lambda c: c.get("score", 0), reverse=True)
    return {
        "timestamp": data.get("timestamp"),
        "market_regime": data.get("market_regime"),
        "vix_level": data.get("vix_level"),
        "featured": sorted_candidates[:limit],
    }


@router.get("/history")
async def get_signal_history(
    limit: int = Query(10, ge=1, le=100),
    ticker: Optional[str] = None,
):
    """Sinyal geçmişini getir (Supabase'den)"""
    # Supabase'den geçmiş sinyalleri getir
    history = SignalsDB.get_history(limit=limit, ticker=ticker)

    if history:
        return {"signals": history, "total": len(history)}

    # Fallback: dosyadan son raporu döndür
    data = load_latest_signals() or MOCK_SIGNALS
    return {"signals": [data], "total": 1}


@router.get("/candidates")
async def get_candidates(
    sector: Optional[str] = None,
    action: Optional[str] = None,
    min_score: Optional[float] = None,
    sort_by: str = Query("score", description="Sıralama: score, potential_pct, price"),
    limit: int = Query(20, ge=1, le=50),
):
    """Filtrelenmiş sinyal adaylarını getir"""
    data = load_latest_signals() or MOCK_SIGNALS
    candidates = data.get("candidates", [])

    if sector:
        candidates = [c for c in candidates if c.get("sector", "").lower() == sector.lower()]
    if action:
        candidates = [c for c in candidates if c.get("action", "").upper() == action.upper()]
    if min_score is not None:
        candidates = [c for c in candidates if c.get("score", 0) >= min_score]

    if sort_by in ("score", "potential_pct", "price"):
        candidates = sorted(candidates, key=lambda c: c.get(sort_by, 0), reverse=True)

    return {
        "candidates": candidates[:limit],
        "total": len(candidates),
        "market_regime": data.get("market_regime"),
        "vix_level": data.get("vix_level"),
    }


@router.get("/bot-status")
async def get_bot_status():
    """Bot çalışma durumlarını getir"""
    try:
        from app.services.bot_runner import get_bot_status as _get_status
        return _get_status()
    except Exception:
        return {
            "swing112": {"name": "Swing Trade Scanner", "scheduled": False, "next_run": None},
            "agresif411": {"name": "Agresif Scanner", "scheduled": False, "next_run": None},
            "inday312": {"name": "Intraday Scanner", "scheduled": False, "next_run": None},
            "opsiyon217": {"name": "Opsiyon Scanner", "scheduled": False, "next_run": None},
        }


@router.post("/push")
async def push_signals(
    payload: SignalsPushRequest,
    x_api_key: Optional[str] = Header(None),
):
    """
    Bot sonuçlarını API'ye push et.
    Header: X-Api-Key: <BOT_API_KEY env var>
    """
    global _pushed_signals

    # API Key doğrulama
    settings = get_settings()
    expected_key = getattr(settings, "bot_api_key", None) or os.environ.get("BOT_API_KEY", "finma-bot-2026")
    if x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Geçersiz API anahtarı")

    # Kandidatları standart formata dönüştür
    candidates = []
    for c in payload.candidates:
        # TP1 ve TP2'yi kullanarak entry_zone hesapla
        candidates.append({
            "ticker": c.ticker.upper(),
            "score": round(c.score, 1),
            "price": c.price,
            "action": c.action.upper(),
            "entry_zone": f"{c.entry:.2f} - {c.tp1:.2f}",
            "stop_loss": c.stop_loss,
            "target": c.tp2,   # Ana hedef = TP2
            "tp1": c.tp1,
            "tp2": c.tp2,
            "potential_pct": round(((c.tp2 - c.entry) / c.entry) * 100, 2) if c.entry > 0 else 0,
            "sector": c.sector,
            "trend_phase": "Expansion",
            "notes": c.notes or [f"Swing112 skor: {c.score}"],
        })

    # Skora göre sırala, ilk 20'yi al
    candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)[:20]

    _pushed_signals = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "bot_name": payload.bot_name,
        "market_regime": payload.market_regime,
        "vix_level": payload.vix_level,
        "sector_leaders": payload.sector_leaders or [],
        "candidates": candidates,
    }

    # Supabase'e kaydet
    try:
        SignalsDB.save_report(_pushed_signals)
    except Exception as e:
        logger.warning(f"Sinyal kayıt hatası: {e}")

    logger.info(f"✅ {len(candidates)} sinyal push edildi — bot: {payload.bot_name}")
    return {"status": "ok", "count": len(candidates), "timestamp": _pushed_signals["timestamp"]}
