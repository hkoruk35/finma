"""
Signals API Router — Supabase entegrasyonlu sinyal geçmişi
Endpoints: latest signals, history, candidates, featured (top 5), bot status, push
"""

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from typing import List, Optional
from pydantic import BaseModel
import json
import os
from datetime import datetime
from app.database import SignalsDB, IntelligenceDB
from app.config import get_settings
from app.dependencies import require_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── In-memory pushed signal store (Railway'de kalıcı) ───
_pushed_signals: Optional[dict] = None

# Paths to bot output files
SIGNAL_PATHS = [
    os.path.join("bots", "output", "swing112_latest.json"),
    os.path.join("bots", "output", "bot_analysis_latest.json"),
]

# Fallback paths to original FinMA system
FALLBACK_PATHS = [
    os.path.abspath(os.path.join(
        "..", ".gemini", "antigravity", "scratch", "financial_tracker",
        "watchlists", "bot_analysis_latest.json"
    )),
]


def load_latest_signals() -> Optional[dict]:
    """
    Load sinyaller (öncelik sırası):
      1) RAM'deki push verisi (hızlı, sunucu açıkken)
      2) Yerel dosya (bot aynı makinedeyse)
      3) Supabase'deki son rapor (kalıcı — Railway restart sonrası bile çalışır)
      4) None → MOCK_SIGNALS fallback
    """
    global _pushed_signals
    # 1. RAM
    if _pushed_signals:
        return _pushed_signals
    # 2. Yerel dosya
    for path in SIGNAL_PATHS + FALLBACK_PATHS:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                continue
    # 3. Supabase (kalıcı)
    try:
        db_report = SignalsDB.get_latest_report()
        if db_report and db_report.get("candidates"):
            logger.info(f"Supabase'den {len(db_report['candidates'])} sinyal yüklendi")
            _pushed_signals = db_report  # RAM'e de kaydet (sonraki istekler hızlı)
            return db_report
    except Exception as e:
        logger.warning(f"Supabase okuma hatası: {e}")
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
        {"ticker": "NVDA", "score": 38.5, "price": 125.40, "action": "BUY", "entry_zone": "125.40 - 130.00", "stop_loss": 115.00, "target": 145.00, "tp1": 135.00, "tp2": 145.00, "potential_pct": 15.6, "sector": "Technology", "trend_phase": "Expansion", "notes": ["AI dominance continues"]},
        {"ticker": "AAPL", "score": 34.2, "price": 225.10, "action": "BUY", "entry_zone": "225.10 - 230.00", "stop_loss": 210.00, "target": 250.00, "tp1": 240.00, "tp2": 250.00, "potential_pct": 11.1, "sector": "Technology", "trend_phase": "Expansion", "notes": ["Strong iPhone demand"]},
        {"ticker": "MSFT", "score": 33.8, "price": 440.50, "action": "BUY", "entry_zone": "440.50 - 450.00", "stop_loss": 415.00, "target": 485.00, "tp1": 465.00, "tp2": 485.00, "potential_pct": 10.1, "sector": "Technology", "trend_phase": "Expansion", "notes": ["Cloud growth accelerating"]},
        {"ticker": "AMZN", "score": 32.1, "price": 185.30, "action": "BUY", "entry_zone": "185.30 - 190.00", "stop_loss": 170.00, "target": 210.00, "tp1": 200.00, "tp2": 210.00, "potential_pct": 13.3, "sector": "Consumer", "trend_phase": "Expansion", "notes": ["E-commerce margins improving"]},
        {"ticker": "GOOGL", "score": 31.5, "price": 175.20, "action": "BUY", "entry_zone": "175.20 - 180.00", "stop_loss": 160.00, "target": 200.00, "tp1": 190.00, "tp2": 200.00, "potential_pct": 14.2, "sector": "Technology", "trend_phase": "Expansion", "notes": ["AI integration in search"]},
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
            "news_bot": {"name": "Market News Bot", "scheduled": False, "next_run": None},
            "insider_bot": {"name": "Insider Data Bot", "scheduled": False, "next_run": None},
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
# ─── MARKET INTELLIGENCE ENDPOINTS ───

class IntelligencePush(BaseModel):
    payload: dict
    api_key: str

@router.get("/intelligence")
async def get_market_intelligence():
    """En son yayınlanan zeka raporunu getir"""
    report = IntelligenceDB.get_latest()
    if not report:
        raise HTTPException(status_code=404, detail="No intelligence report found")
    return report

@router.post("/intelligence/push")
async def push_market_intelligence(data: IntelligencePush, x_api_key: Optional[str] = Header(None)):
    """Bot tarafından yeni zeka raporu gönderimi"""
    settings = get_settings()
    # Header veya body'den API key kontrolü
    provided_key = x_api_key or data.api_key
    if provided_key != settings.bot_api_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    
    success = IntelligenceDB.save_report(data.payload)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save report")
    
    return {"status": "success", "message": "Market Intelligence updated"}
@router.post("/bots/{bot_name}/run")
async def run_bot_manually(bot_name: str, admin: dict = Depends(require_admin)):
    """Botu manuel olarak hemen çalıştır (Admin sadece)"""
    from app.services.bot_runner import trigger_bot_manually
    success = trigger_bot_manually(bot_name)
    if not success:
        raise HTTPException(status_code=400, detail=f"Bot tetiklenemedi: {bot_name}")
    return {"status": "ok", "message": f"{bot_name} başlatıldı"}


@router.post("/bots/{bot_name}/toggle")
async def toggle_bot_schedule(bot_name: str, active: bool, admin: dict = Depends(require_admin)):
    """Botun zamanlanmış çalışmasını durdur veya başlat (Admin sadece)"""
    from app.services.bot_runner import toggle_bot_schedule as _toggle
    success = _toggle(bot_name, active)
    if not success:
        raise HTTPException(status_code=400, detail=f"Bot durumu değiştirilemedi: {bot_name}")
    return {"status": "ok", "active": active}
