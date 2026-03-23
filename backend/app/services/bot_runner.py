"""Bot Runner Service - Schedules and executes signal bots via APScheduler"""

import os
import json
import subprocess
import logging
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

# Bot configurations
BOT_CONFIGS = {
    "swing112": {
        "script": "swing112.py",
        "schedule": {"hour": "13", "minute": "0"},
        "description": "ATMACA Master Swing Scanner - Günlük 13:00 NY",
    },
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
}

active_processes = {}

def run_bot(bot_name: str, bots_dir: str, output_dir: str):
    """Execute a bot script in background and redirect output to a log file"""
    global active_processes
    config = BOT_CONFIGS.get(bot_name)
    if not config:
        logger.error(f"Bot bulunamadı: {bot_name}")
        return

    script_path = os.path.join(bots_dir, config["script"])
    if not os.path.exists(script_path):
        logger.warning(f"Bot script yok: {script_path}")
        return

    os.makedirs(output_dir, exist_ok=True)
    log_file_path = os.path.join(output_dir, f"{bot_name}.log")

    try:
        # Check if already running
        if bot_name in active_processes:
            proc = active_processes[bot_name]
            if proc.poll() is None:
                logger.info(f"Bot zaten çalışıyor: {bot_name} (PID: {proc.pid})")
                return
            else:
                del active_processes[bot_name]

        logger.info(f"Bot başlatılıyor: {bot_name} -> {log_file_path}")
        
        # Open log file with header
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"\n\n--- [ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ] STARTING BOT: {bot_name} ---\n")
            f.flush()

        log_file = open(log_file_path, "a", encoding="utf-8")
        
        process = subprocess.Popen(
            ["python", config["script"], "--one-shot"], # Using script name since cwd=bots_dir
            stdout=log_file,
            stderr=subprocess.STDOUT,
            cwd=bots_dir,
            text=True,
            bufsize=1 # Line buffered
        )

        active_processes[bot_name] = process
        logger.info(f"Bot PID {process.pid} ile arka planda başlatıldı: {bot_name}")

    except Exception as e:
        logger.error(f"Bot çalıştırma hatası {bot_name}: {e}")


def get_logs(bot_name: str, output_dir: str, lines: int = 100):
    """Read last N lines from bot log file"""
    log_file_path = os.path.join(output_dir, f"{bot_name}.log")
    if not os.path.exists(log_file_path):
        return f"Log dosyası henüz oluşmadı: {log_file_path}"
    
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            content = f.readlines()
            return "".join(content[-lines:])
    except Exception as e:
        return f"Log okuma hatası: {e}"


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
            if bot_name in ["insider_bot", "news_bot", "market_indices_904", "yf_movers_901", "detail_scanner_907"]:
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
    """Run a bot immediately once"""
    global scheduler
    if not scheduler:
        return False
    
    config = BOT_CONFIGS.get(bot_name)
    if not config:
        return False

    # Add a one-time job that runs NOW
    scheduler.add_job(
        run_bot,
        "date",
        run_date=datetime.now(),
        args=[bot_name, "bots", "bots/output"],
        name=f"Manual Run: {bot_name}"
    )
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
                scheduler.add_job(
                    run_bot,
                    "cron",
                    args=[bot_name, "bots", "bots/output"],
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
