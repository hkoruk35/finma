"""
Signals API Router — Supabase entegrasyonlu sinyal geçmişi
Endpoints: latest signals, history, candidates, featured (top 5), bot status
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
import os
from datetime import datetime
from app.database import SignalsDB
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

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
    """Load the latest signal report from bot output files"""
    for path in SIGNAL_PATHS + FALLBACK_PATHS:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                continue
    return None


# Mock signal data for development
MOCK_SIGNALS = {
    "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    "bot_name": "inday312",
    "market_regime": "Bull",
    "sector_leaders": ["Energy", "Utilities"],
    "vix_level": 24.74,
    "candidates": [
        {
            "ticker": "NVDA", "score": 8.4, "price": 912.45, "action": "BUY",
            "entry_zone": "895 - 910", "stop_loss": 865, "target": 980,
            "potential_pct": 7.41, "sector": "Technology",
            "trend_phase": "Expansion", "rvol": 1.85,
            "notes": ["AI çip talebi güçlü", "Kurumsal alım baskısı yüksek"],
        },
        {
            "ticker": "FANG", "score": 7.9, "price": 182.43, "action": "BUY",
            "entry_zone": "174 - 180", "stop_loss": 168.50, "target": 198,
            "potential_pct": 8.53, "sector": "Energy",
            "trend_phase": "Expansion", "rvol": 1.42,
            "notes": ["Enerji sektörü momentum güçlü", "Teknik kırılım beklentisi"],
        },
        {
            "ticker": "LMT", "score": 7.5, "price": 646.10, "action": "BUY",
            "entry_zone": "635 - 645", "stop_loss": 620, "target": 690,
            "potential_pct": 6.80, "sector": "Industrials",
            "trend_phase": "Expansion", "rvol": 1.15,
            "notes": ["Savunma harcamaları artışta", "Güçlü sipariş defteri"],
        },
        {
            "ticker": "EQNR", "score": 7.2, "price": 35.25, "action": "BUY",
            "entry_zone": "31 - 33", "stop_loss": 29.50, "target": 38.50,
            "potential_pct": 9.22, "sector": "Energy",
            "trend_phase": "Recovery", "rvol": 1.30,
            "notes": ["Düşük değerleme", "Yüksek temettü verimi"],
        },
        {
            "ticker": "DELL", "score": 7.0, "price": 151.70, "action": "BUY",
            "entry_zone": "140 - 148", "stop_loss": 132, "target": 175,
            "potential_pct": 15.36, "sector": "Technology",
            "trend_phase": "Expansion", "rvol": 1.55,
            "notes": ["AI sunucu satışları beklentileri aşıyor"],
        },
        {
            "ticker": "OKE", "score": 6.8, "price": 85.36, "action": "BUY",
            "entry_zone": "83.70 - 85.50", "stop_loss": 81, "target": 92,
            "potential_pct": 7.78, "sector": "Energy",
            "trend_phase": "Accumulation", "rvol": 1.10,
            "notes": ["Temettü oyunu", "Enerji toparlanması"],
        },
        {
            "ticker": "NTR", "score": 6.5, "price": 82.86, "action": "BUY",
            "entry_zone": "72.49 - 76", "stop_loss": 68, "target": 90,
            "potential_pct": 8.61, "sector": "Materials",
            "trend_phase": "Recovery", "rvol": 1.08,
            "notes": ["Tarım sektörü oyunu"],
        },
        {
            "ticker": "OUT", "score": 6.2, "price": 26.71, "action": "CLOSE",
            "entry_zone": "28.37 - 29.25", "stop_loss": 27.05, "target": 32.34,
            "potential_pct": 21.08, "sector": "Real Estate",
            "trend_phase": "Exhaustion", "rvol": 0.85,
            "notes": ["RS: Güçlü ayrışma"],
        },
        {
            "ticker": "GFS", "score": 5.8, "price": 41.88, "action": "BUY",
            "entry_zone": "46.37 - 48", "stop_loss": 43.20, "target": 52.50,
            "potential_pct": 25.38, "sector": "Technology",
            "trend_phase": "Accumulation", "rvol": 1.22,
            "notes": ["Kırılım adayı", "Yarı iletken talebi"],
        },
        {
            "ticker": "NOC", "score": 5.5, "price": 733.41, "action": "BUY",
            "entry_zone": "729 - 735", "stop_loss": 715, "target": 765,
            "potential_pct": 4.31, "sector": "Industrials",
            "trend_phase": "Expansion", "rvol": 1.05,
            "notes": ["Savunma rallisi"],
        },
        {
            "ticker": "CVX", "score": 5.2, "price": 158.40, "action": "BUY",
            "entry_zone": "155 - 158", "stop_loss": 150, "target": 170,
            "potential_pct": 7.32, "sector": "Energy",
            "trend_phase": "Accumulation", "rvol": 0.95,
            "notes": ["Petrol fiyatları destekli"],
        },
        {
            "ticker": "META", "score": 4.8, "price": 485.20, "action": "HOLD",
            "entry_zone": "470 - 480", "stop_loss": 455, "target": 520,
            "potential_pct": 7.17, "sector": "Communication Services",
            "trend_phase": "Distribution", "rvol": 1.35,
            "notes": ["AI yatırımları harcama baskısı"],
        },
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
