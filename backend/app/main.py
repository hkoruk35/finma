"""
FinMA API - Profesyonel Finans Terminali Backend
FastAPI + yfinance + Gemini AI + APScheduler + Telegram
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, market, signals, portfolio, ai, telegram, invite
from app.ws.price_feed import websocket_endpoint

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    settings = get_settings()
    logger.info(f"🚀 {settings.app_name} v4.0 starting...")
    logger.info(f"📡 Frontend URL: {settings.frontend_url}")
    logger.info(f"🤖 Gemini API: {'✅ Configured' if settings.gemini_api_key else '❌ Not set'}")
    logger.info(f"📱 Telegram: {'✅ Configured' if settings.telegram_bot_token else '❌ Not set'}")

    # Supabase bağlantı kontrolü
    from app.database import is_db_available
    if is_db_available():
        logger.info("🗄️  Supabase: ✅ Connected — PostgreSQL aktif")
    elif settings.supabase_url and settings.supabase_key:
        logger.warning("🗄️  Supabase: ⚠️ Credentials set but connection failed — using in-memory fallback")
    else:
        logger.info("🗄️  Supabase: ℹ️ Not configured — using in-memory storage (add SUPABASE_URL & SUPABASE_KEY to .env)")

    # Start stock cache worker — her 5dk popüler 30 hisseyi hesapla → Supabase cache'e yaz
    try:
        from app.services.stock_cache import start_cache_worker
        start_cache_worker(interval_minutes=5)
    except Exception as e:
        logger.warning(f"Cache worker başlatılamadı: {e}")

    # Create bot output directory
    os.makedirs(settings.signals_output_dir, exist_ok=True)

    # Start bot scheduler if bots directory exists
    bots_dir = os.path.abspath(settings.bots_dir)
    if os.path.exists(bots_dir):
        try:
            from app.services.bot_runner import start_scheduler
            start_scheduler(bots_dir, settings.signals_output_dir)
            logger.info("📊 Bot scheduler başlatıldı")
        except Exception as e:
            logger.warning(f"Bot scheduler başlatılamadı: {e}")
    else:
        logger.info(f"ℹ️  Bots dizini bulunamadı: {bots_dir} — scheduler atlanıyor")
    
    # Ensure admin user exists
    try:
        from app.routers.auth import ensure_admin_user
        ensure_admin_user()
    except Exception as e:
        logger.warning(f"Admin kontrolü hatası: {e}")

    yield

    # Shutdown
    try:
        from app.services.bot_runner import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    logger.info("👋 FinMA API shutting down...")


app = FastAPI(
    title="FinMA API",
    description="Profesyonel Finans Terminali Backend API — Bloomberg tarzı analiz platformu",
    version="4.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers ───
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(market.router, prefix="/api/market", tags=["Market Data"])
app.include_router(signals.router, prefix="/api/signals", tags=["Signals & Bots"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["Telegram"])
app.include_router(invite.router, prefix="/api/invite", tags=["Invite"])


# ─── Root Endpoints ───

@app.get("/")
async def root():
    return {
        "name": "FinMA API",
        "version": "4.0.0",
        "status": "operational",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/auth",
            "market": "/api/market",
            "signals": "/api/signals",
            "portfolio": "/api/portfolio",
            "ai": "/api/ai",
            "telegram": "/api/telegram",
            "websocket": "/ws/prices",
        },
    }


@app.get("/health")
async def health():
    settings = get_settings()
    from app.database import is_db_available
    return {
        "status": "healthy",
        "services": {
            "gemini": bool(settings.gemini_api_key),
            "telegram": bool(settings.telegram_bot_token),
            "supabase": is_db_available(),
        },
        "database": "supabase" if is_db_available() else "in-memory",
    }


# ─── WebSocket ───

@app.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    await websocket_endpoint(websocket)
