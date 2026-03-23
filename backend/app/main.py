"""
FinMA API - Profesyonel Finans Terminali Backend
FastAPI + yfinance + Gemini AI + APScheduler + Telegram
"""

import logging
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import auth, market, signals, portfolio, ai, telegram, invite
from app.routers import notifications, watchlist, screener, events, chart
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
    logger.info(f"🚀 {settings.app_name} v5.0 starting...")
    
    # Start SSE Runner (Redis -> SSE Bridge)
    from app.services.sse_runner import sse_runner
    asyncio.create_task(sse_runner.start())
    logger.info("📡 SSE Multi-Stream Runner started")
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

    # Sectors cache warm-up — startup'ta hemen hesapla, dosyaya yaz
    # Böylece ilk kullanıcı beklemiyor (market/maps anında açılır)
    def _warmup_sectors():
        import time
        time.sleep(3)  # Diğer servisler başlasın
        try:
            from app.services.market_data import get_sector_performance
            from app.routers.market import _save_sectors_file
            for period in ("1d", "1mo"):
                data = get_sector_performance(period)
                if data:
                    _save_sectors_file(period, data)
                    logger.info(f"✅ Sectors warm-up tamamlandı: {period} ({len(data)} ETF)")
        except Exception as e:
            logger.warning(f"Sectors warm-up hatası: {e}")

    import threading
    threading.Thread(target=_warmup_sectors, daemon=True, name="sectors_warmup").start()
    logger.info("🔥 Sectors warm-up başlatıldı (arka plan)")

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
    version="5.0.0",
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
        "https://finmasmart.com",
        "https://www.finmasmart.com",
    ],
    allow_origin_regex=r"https://.*\.(vercel\.app|finmasmart\.com)",
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
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["Smart Watchlist"])
app.include_router(screener.router, prefix="/api/screener", tags=["Screener"])
app.include_router(events.router, prefix="/api/events", tags=["Real-time Events"])
app.include_router(chart.router, tags=["Charts"])


# ─── Root Endpoints ───

@app.get("/")
async def root():
    return {
        "name": "FinMA API",
        "version": "5.0.0",
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
    import datetime

    # Son sinyal tarihini oku
    last_signal_date = None
    try:
        from app.routers.signals import _pushed_signals
        ts = (_pushed_signals or {}).get("timestamp")
        if ts:
            last_signal_date = ts[:16]  # "YYYY-MM-DD HH:MM"
    except Exception:
        pass

    return {
        "status": "ok",
        "version": "v4.0",
        "services": {
            "gemini": bool(settings.gemini_api_key),
            "telegram": bool(settings.telegram_bot_token),
            "supabase": is_db_available(),
        },
        "database": "connected" if is_db_available() else "supabase",
        "last_signal_date": last_signal_date or "Henüz sinyal yok",
    }


# ─── WebSocket ───

@app.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    await websocket_endpoint(websocket)
