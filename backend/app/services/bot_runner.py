"""Bot Runner Service - Schedules and executes signal bots via APScheduler"""

import os
import sys
import json
import subprocess
import logging
import threading
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

# ─── Redis log helpers ────────────────────────────────────────────────────────
_REDIS_LOG_TTL = 60 * 60 * 24 * 3   # 3 gün

def _get_redis():
    """Basit Redis bağlantısı; başarısız olursa None."""
    try:
        import redis as _redis_lib
        url = os.getenv("REDIS_URL", "")
        if not url:
            rest_url   = os.getenv("UPSTASH_REDIS_REST_URL", "")
            rest_token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
            if rest_url and rest_token:
                host = rest_url.replace("https://", "").replace("http://", "").rstrip("/")
                url  = f"rediss://default:{rest_token}@{host}:6379"
        if not url:
            return None
        r = _redis_lib.from_url(url, decode_responses=True, socket_timeout=3)
        r.ping()
        return r
    except Exception:
        return None

def _redis_log_key(bot_name: str) -> str:
    return f"bot:log:{bot_name}"

def _redis_append_log(bot_name: str, line: str):
    """Redis listesine log satırı ekler; hata sessizce yutulur."""
    try:
        rc = _get_redis()
        if rc:
            key = _redis_log_key(bot_name)
            rc.rpush(key, line)
            rc.expire(key, _REDIS_LOG_TTL)
    except Exception:
        pass

def _redis_reset_log(bot_name: str):
    """Yeni çalışmadan önce eski Redis logunu temizler."""
    try:
        rc = _get_redis()
        if rc:
            rc.delete(_redis_log_key(bot_name))
    except Exception:
        pass

def _redis_get_log(bot_name: str) -> Optional[str]:
    """Redis'teki log satırlarını birleştirir; yoksa None."""
    try:
        rc = _get_redis()
        if rc:
            lines = rc.lrange(_redis_log_key(bot_name), 0, -1)
            if lines:
                return "\n".join(
                    ln.decode("utf-8") if isinstance(ln, bytes) else ln
                    for ln in lines
                )
    except Exception:
        pass
    return None

# Bot configurations
BOT_CONFIGS = {
    "swing113_11": {
        "script": "swing113.py",
        "schedule": {"hour": "11", "minute": "0"},
        "description": "ATMACA Fırsatlar Tarayıcı - NY 11:00",
    },
    "swing113_13": {
        "script": "swing113.py",
        "schedule": {"hour": "13", "minute": "5"},
        "description": "ATMACA Fırsatlar Tarayıcı - NY 13:05",
    },
    "swing113_15": {
        "script": "swing113.py",
        "schedule": {"hour": "15", "minute": "0"},
        "description": "ATMACA Fırsatlar Tarayıcı - NY 15:00",
    },
    "news_bot": {
        "script": "news_bot.py",
        "schedule": {"minute": "0"},
        "description": "Market News & Sentiment Bot",
    },
    "insider_bot": {
        "script": "insider_bot.py",
        "schedule": {"hour": "2", "minute": "0"},
        "description": "Daily Insider Activity Scanner",
    },
    "intelligence_bot": {
        "script": "intelligence_bot.py",
        "schedule": {"hour": "3", "minute": "0"},
        "description": "Market Intelligence Report Builder",
    },
    # ─── Yeni Botlar (901/902/904/907) ───
    "market_indices_904": {
        "script": "market_indices_bot_904.py",
        "schedule": {"minute": "*/1"},
        "description": "Bot 904 — Market Indices (SPX/DJI/NDX...) Her 1 Dakika",
    },
    "yf_movers_901": {
        "script": "yf_movers_bot_901.py",
        "schedule": {"minute": "*/5"},
        "description": "Bot 901 — Yahoo Finance Movers Her 5 Dakika",
    },
    "yf_movers_901_9am": {
        "script": "yf_movers_bot_901.py",
        "schedule": {"day_of_week": "mon-fri", "hour": "9", "minute": "0", "timezone": "America/New_York"},
        "description": "Bot 901 — Google Finance Daily Snapshot NY 09:00 (Hafta içi)",
    },
    "yf_history_902": {
        "script": "yf_history_bot_902.py",
        "schedule": {"minute": "*/15"},
        "description": "Bot 902 — Yahoo Finance Historical Data Her 15 Dakika",
    },
    "detail_scanner_907": {
        "script": "detail_scanner_bot_907.py",
        "schedule": {"minute": "*/15"},
        "description": "Bot 907 — 60 Hisse Detay Tarama Her 15 Dakika",
    },
    "flow_bot": {
        "script": "flow_bot.py",
        "schedule": {"hour": "*/4", "minute": "5"},
        "description": "Flow Bot — Sektör Akışı, Insider, RVOL Her 4 Saat",
    },
    # ─── FinMA 514 (NY 06:30 + 12:00, hafta içi, DST-safe) ───────
    "finma514_0630": {
        "script":      "finma514.py",
        "schedule":    {"day_of_week": "mon-fri", "hour": "6", "minute": "30",
                        "timezone": "America/New_York"},
        "description": "FinMA514 — 8000+ tarama sabah NY 06:30",
    },
    "finma514_1200": {
        "script":      "finma514.py",
        "schedule":    {"day_of_week": "mon-fri", "hour": "12", "minute": "0",
                        "timezone": "America/New_York"},
        "description": "FinMA514 — 8000+ tarama öğle NY 12:00",
    },
    "tracking_5min": {
        "script":      "finma514_tracking.py",
        "schedule":    {"day_of_week": "mon-fri", "minute": "*/5",
                        "timezone": "America/New_York"},
        "description": "Smart Tracking — 5dk state machine",
    },
}

active_processes = {}

def run_bot(bot_name: str, bots_dir: str, output_dir: str):
    """Execute a bot script in background and redirect output to log file + Redis."""
    global active_processes
    config = BOT_CONFIGS.get(bot_name)
    if not config:
        logger.error(f"Bot bulunamadı: {bot_name}")
        return

    script_path = os.path.join(bots_dir, config["script"])
    if not os.path.exists(script_path):
        msg = f"❌ Bot script bulunamadı: {script_path}"
        logger.warning(msg)
        _redis_reset_log(bot_name)
        _redis_append_log(bot_name, msg)
        return

    os.makedirs(output_dir, exist_ok=True)
    log_file_path = os.path.join(output_dir, f"{bot_name}.log")

    # Zaten çalışıyor mu?
    if bot_name in active_processes:
        proc = active_processes[bot_name]
        if proc.poll() is None:
            logger.info(f"Bot zaten çalışıyor: {bot_name} (PID: {proc.pid})")
            return
        else:
            del active_processes[bot_name]

    # Redis log temizle + header yaz
    _redis_reset_log(bot_name)
    header = (
        f"--- [ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ] STARTING: {bot_name} ---\n"
        f"Script : {script_path}\n"
        f"Python : {sys.executable}"
    )
    _redis_append_log(bot_name, header)

    # Dosyaya header
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"\n\n{header}\n")
    except Exception:
        pass

    backend_dir = os.path.dirname(os.path.abspath(bots_dir))
    env = os.environ.copy()
    env["PYTHONPATH"] = backend_dir + os.pathsep + env.get("PYTHONPATH", "")

    try:
        process = subprocess.Popen(
            [sys.executable, script_path, "--one-shot"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=backend_dir,
            env=env,
            text=True,
            bufsize=1,
        )
        active_processes[bot_name] = process
        logger.info(f"Bot PID {process.pid} ile başlatıldı: {bot_name}")

        # Satır satır oku → hem dosyaya hem Redis'e yaz
        def _stream():
            try:
                log_file = open(log_file_path, "a", encoding="utf-8")
                for line in process.stdout:
                    line = line.rstrip("\n")
                    log_file.write(line + "\n")
                    log_file.flush()
                    _redis_append_log(bot_name, line)
                log_file.close()
            except Exception as ex:
                _redis_append_log(bot_name, f"[stream error] {ex}")

            code = process.wait()
            result_line = (
                f"\n✅ Tamamlandı (exit 0) — {datetime.now().strftime('%H:%M:%S')}"
                if code == 0
                else f"\n❌ Hata (exit {code}) — {datetime.now().strftime('%H:%M:%S')}"
            )
            _redis_append_log(bot_name, result_line)
            logger.info(f"Bot bitti: {bot_name} exit={code}")

        threading.Thread(target=_stream, daemon=True, name=f"stream_{bot_name}").start()

    except Exception as e:
        err = f"❌ Başlatma hatası: {e}"
        logger.error(f"Bot çalıştırma hatası {bot_name}: {e}")
        _redis_append_log(bot_name, err)


def get_logs(bot_name: str, output_dir: str, lines: int = 200):
    """
    Bot loglarını döner. Önce Redis (kalıcı), yoksa dosya, o da yoksa açıklayıcı mesaj.
    """
    # ── 1. Redis (Railway restart'ta da kalır) ─────────────────────
    redis_log = _redis_get_log(bot_name)
    if redis_log:
        all_lines = redis_log.splitlines()
        return "\n".join(all_lines[-lines:])

    # ── 2. Dosya (aynı container içinde) ───────────────────────────
    log_file_path = os.path.join(output_dir, f"{bot_name}.log")
    if os.path.exists(log_file_path):
        try:
            with open(log_file_path, "r", encoding="utf-8") as f:
                content = f.readlines()
            return "".join(content[-lines:])
        except Exception as e:
            return f"Log okuma hatası: {e}"

    return (
        f"Henüz log yok ({bot_name}).\n"
        "Botu 'Çalıştır' butonu ile tetikleyin — log burada görünecek."
    )


def start_scheduler(bots_dir: str = "bots", output_dir: str = "bots/output"):
    """Start the APScheduler with bot jobs"""
    global scheduler

    os.makedirs(output_dir, exist_ok=True)

    scheduler = AsyncIOScheduler()

    for bot_name, config in BOT_CONFIGS.items():
        script_path = os.path.join(bots_dir, config["script"])
        if os.path.exists(script_path):
            # Normal cron schedule
            scheduler.add_job(
                run_bot,
                "cron",
                args=[bot_name, bots_dir, output_dir],
                id=bot_name,
                name=config["description"],
                **config["schedule"],
                misfire_grace_time=60,
            )
            
            # Başlangıçta hemen 1 kez çalıştırılacak botlar
            if bot_name in ["insider_bot", "news_bot", "market_indices_904", "yf_movers_901", "detail_scanner_907", "flow_bot"]:
                scheduler.add_job(
                    run_bot,
                    "date",
                    run_date=datetime.now(),
                    args=[bot_name, bots_dir, output_dir],
                    id=f"{bot_name}_initial",
                    name=f"{config['description']} (Initial Run)"
                )
            
            logger.info(f"Bot zamanlandı: {bot_name} - {config['description']}")

    scheduler.start()
    logger.info("Bot scheduler başlatıldı")


def stop_scheduler():
    """Stop the scheduler"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Bot scheduler durduruldu")


scheduler: Optional[AsyncIOScheduler] = None

def get_bot_status():
    """Get status of all bots"""
    global active_processes
    status = {}
    for bot_name, config in BOT_CONFIGS.items():
        job = scheduler.get_job(bot_name) if scheduler else None
        
        # Check if running
        is_running = False
        if bot_name in active_processes:
            if active_processes[bot_name].poll() is None:
                is_running = True
            else:
                del active_processes[bot_name]

        status[bot_name] = {
            "name": config["description"],
            "script": config["script"],
            "scheduled": job is not None,
            "next_run": str(job.next_run_time) if job else None,
            "is_running": is_running
        }
    return status


def trigger_bot_manually(bot_name: str):
    """Run a bot immediately in a background thread (scheduler-independent)"""
    import threading
    import os
    from app.config import get_settings
    
    config = BOT_CONFIGS.get(bot_name)
    if not config:
        logger.warning(f"trigger_bot_manually: bot bulunamadı: {bot_name}")
        return False

    settings = get_settings()
    
    # Her ortamda backend kök dizinini garantile
    current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/app/services
    backend_dir = os.path.dirname(os.path.dirname(current_dir)) # .../backend
    
    bots_dir = os.path.join(backend_dir, settings.bots_dir)
    output_dir = os.path.join(backend_dir, settings.signals_output_dir)

    def _run():
        run_bot(bot_name, bots_dir, output_dir)

    t = threading.Thread(target=_run, daemon=True, name=f"manual_{bot_name}")
    t.start()
    logger.info(f"Bot manuel başlatıldı (thread): {bot_name}")
    return True


def toggle_bot_schedule(bot_name: str, active: bool):
    """Enable or disable a bot in the scheduler"""
    global scheduler
    if not scheduler:
        return False

    job = scheduler.get_job(bot_name)
    if active:
        if not job:
            # Re-add job (CRON)
            config = BOT_CONFIGS.get(bot_name)
            if config:
                import os
                from app.config import get_settings
                settings = get_settings()
                
                # Her ortamda backend kök dizinini garantile
                current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/app/services
                backend_dir = os.path.dirname(os.path.dirname(current_dir)) # .../backend
                
                b_dir = os.path.join(backend_dir, settings.bots_dir)
                o_dir = os.path.join(backend_dir, settings.signals_output_dir)
                
                scheduler.add_job(
                    run_bot,
                    "cron",
                    args=[bot_name, b_dir, o_dir],
                    id=bot_name,
                    name=config["description"],
                    **config["schedule"],
                    misfire_grace_time=60,
                )
                return True
        else:
            job.resume()
            return True
    else:
        if job:
            job.pause()
            return True
    return False
