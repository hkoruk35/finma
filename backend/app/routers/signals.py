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
from app.dependencies import require_admin, optional_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── In-memory pushed signal store (Railway'de kalıcı) ───
_pushed_signals: Optional[dict] = None
_swing113_latest: Optional[dict] = None
_swing113_file_mtime: float = 0.0  # file modification time when last loaded

# Backend path resolver
current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/app/routers
backend_dir = os.path.dirname(os.path.dirname(current_dir)) # .../backend

# Paths to bot output files
SIGNAL_PATHS = [
    os.path.join(backend_dir, "bots", "output", "swing112_latest.json"),
    os.path.join(backend_dir, "bots", "output", "bot_analysis_latest.json"),
]

SWING113_PATH = os.path.join(backend_dir, "bots", "output", "swing113_latest.json")
SWING113_ARCHIVE_DIR = os.path.join(backend_dir, "bots", "output", "swing113_archive")

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
            "news_bot": {"name": "Market News Bot", "scheduled": False, "next_run": None},
            "insider_bot": {"name": "Insider Data Bot", "scheduled": False, "next_run": None},
        }


@router.get("/bots/{bot_name}/logs")
async def get_bot_logs(bot_name: str, lines: int = Query(100, ge=10, le=1000)):
    """Botun canlı loglarını getir"""
    try:
        from app.services.bot_runner import get_logs
        from app.config import get_settings
        settings = get_settings()
        logs = get_logs(bot_name, settings.signals_output_dir, lines)
        return {"bot_name": bot_name, "logs": logs}
    except Exception as e:
        return {"bot_name": bot_name, "logs": f"Hata: {str(e)}", "error": True}


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
# ─── SWING113 OPPORTUNITIES ENDPOINTS ───

class Swing113OpportunityItem(BaseModel):
    rank: int
    ticker: str
    company_name: str = ""
    sector: str = "Unknown"
    price: float
    score: float
    entry_zone: str = ""
    stop_loss: float = 0.0
    target: float = 0.0
    potential_pct: float = 0.0
    reason: str = ""

class Swing113PushRequest(BaseModel):
    run_id: str
    run_at: str
    schedule_slot: str = ""  # "11:00", "13:05", "15:00"
    opportunities: List[Swing113OpportunityItem]


def load_swing113_latest() -> Optional[dict]:
    """Load latest swing113 run.
    File-first: dosya RAM cache'den yeniyse her zaman diskten okur.
    Bu sayede bot yeni sonucu yazdığında bir sonraki API çağrısı onu görür.
    Format normalize: run_timestamp → run_at (swing113.py uyumsuzluğu)
    """
    global _swing113_latest, _swing113_file_mtime
    abs_path = os.path.abspath(SWING113_PATH)

    file_mtime = 0.0
    if os.path.exists(abs_path):
        try:
            file_mtime = os.path.getmtime(abs_path)
        except Exception:
            pass

    # Dosya RAM cache'den yeniyse yükle
    if file_mtime > _swing113_file_mtime and file_mtime > 0:
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            # Format normalize: run_timestamp → run_at
            if "run_timestamp" in raw and "run_at" not in raw:
                raw["run_at"] = raw["run_timestamp"]
            _swing113_latest = raw
            _swing113_file_mtime = file_mtime
            logger.info(f"swing113 dosyadan yüklendi: {len(raw.get('opportunities', []))} fırsat")
        except Exception as e:
            logger.warning(f"swing113 dosya okuma hatası: {e}")

    return _swing113_latest


@router.post("/swing113/push")
async def push_swing113(
    payload: Swing113PushRequest,
    x_api_key: Optional[str] = Header(None),
):
    """swing113 botu fırsatları API'ye gönderir"""
    global _swing113_latest
    settings = get_settings()
    expected_key = getattr(settings, "bot_api_key", None) or os.environ.get("BOT_API_KEY", "finma-bot-2026")
    if x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Geçersiz API anahtarı")

    data = {
        "run_id": payload.run_id,
        "run_at": payload.run_at,
        "schedule_slot": payload.schedule_slot,
        "opportunities": [o.dict() for o in payload.opportunities],
    }
    _swing113_latest = data

    # Write to file + update mtime tracker
    try:
        import time as _time
        abs_p = os.path.abspath(SWING113_PATH)
        os.makedirs(os.path.dirname(abs_p), exist_ok=True)
        with open(abs_p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        global _swing113_file_mtime
        _swing113_file_mtime = _time.time()
    except Exception as e:
        logger.warning(f"swing113 dosya yazma hatası: {e}")

    logger.info(f"✅ swing113 push: {len(payload.opportunities)} fırsat — slot: {payload.schedule_slot}")
    return {"status": "ok", "count": len(payload.opportunities), "run_id": payload.run_id}


@router.get("/opportunities")
async def get_opportunities(
    user: Optional[dict] = Depends(optional_user),
    x_user_tier: Optional[str] = Header(None),
):
    """
    swing113 son fırsatları getir.
    Free: sadece rank-1. Pro/Admin: tümü.
    """
    data = load_swing113_latest()
    if not data:
        return {"opportunities": [], "run_at": None, "run_id": None, "total": 0}

    opportunities = data.get("opportunities", [])
    
    # Determine tier: Header -> JWT -> Fallback
    tier = x_user_tier
    if not tier and user:
        tier = user.get("role")
    
    if not tier:
        tier = "free"

    # Free tier: only rank 1
    if tier == "free":
        opportunities = [o for o in opportunities if o.get("rank") == 1]

    return {
        "opportunities": opportunities,
        "run_at": data.get("run_at"),
        "run_id": data.get("run_id"),
        "schedule_slot": data.get("schedule_slot"),
        "total": len(data.get("opportunities", [])),
        "visible": len(opportunities),
    }


@router.get("/opportunities/history")
async def get_opportunities_history(
    limit: int = Query(10, ge=1, le=30),
    admin: dict = Depends(require_admin),
):
    """Son N swing113 çalıştırma geçmişini getir (Admin)"""
    archive_dir = os.path.abspath(SWING113_ARCHIVE_DIR)
    if not os.path.exists(archive_dir):
        return {"runs": [], "total": 0}

    files = sorted(
        [f for f in os.listdir(archive_dir) if f.endswith(".json")],
        reverse=True
    )[:limit]

    runs = []
    for fname in files:
        try:
            with open(os.path.join(archive_dir, fname), "r", encoding="utf-8") as f:
                run = json.load(f)
                runs.append({
                    "run_id": run.get("run_id"),
                    "run_at": run.get("run_at"),
                    "schedule_slot": run.get("schedule_slot"),
                    "count": len(run.get("opportunities", [])),
                })
        except Exception:
            continue

    return {"runs": runs, "total": len(runs)}


@router.get("/history-last3")
async def get_last3_opportunities():
    """
    Son 3 swing113 taramasının birleştirilmiş listesi (max 30 hisse).
    Aynı ticker birden fazla taramada geçiyorsa, en son taraması tutulur.
    Dashboard'daki 'Günün Fırsatları' sekmesi bu endpoint'i kullanır.
    """
    archive_dir = os.path.abspath(SWING113_ARCHIVE_DIR)

    all_opportunities: dict = {}  # ticker → opportunity (sonuncusu kazanır)

    # Önce archive dosyalarından son 3 taramayı al
    if os.path.exists(archive_dir):
        files = sorted(
            [f for f in os.listdir(archive_dir) if f.endswith(".json")],
            reverse=True,
        )[:3]
        for fname in files:
            try:
                with open(os.path.join(archive_dir, fname), "r", encoding="utf-8") as f:
                    run = json.load(f)
                run_at = run.get("run_at", "")
                for opp in run.get("opportunities", []):
                    ticker = opp.get("ticker", "")
                    if ticker:
                        opp["run_at"] = run_at
                        all_opportunities[ticker] = opp
            except Exception:
                continue

    # Archive boşsa veya az ise, mevcut swing113_latest'i de ekle
    latest = _swing113_latest or {}
    if not latest and os.path.exists(SWING113_PATH):
        try:
            with open(SWING113_PATH, "r", encoding="utf-8") as f:
                latest = json.load(f)
        except Exception:
            pass

    run_at_latest = latest.get("run_timestamp", "")
    for opp in latest.get("opportunities", []):
        ticker = opp.get("ticker", "")
        if ticker and ticker not in all_opportunities:
            opp["run_at"] = run_at_latest
            all_opportunities[ticker] = opp

    merged = list(all_opportunities.values())[:30]

    return {
        "opportunities": merged,
        "total": len(merged),
        "source": "last3_scans",
    }


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
