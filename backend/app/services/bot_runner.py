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
        "schedule": {"hour": "9,12,15", "minute": "30"},
        "description": "Swing Trade Scanner - 3 kez/gün",
    },
    "agresif411": {
        "script": "agresif411.py",
        "schedule": {"hour": "10,14", "minute": "0"},
        "description": "Agresif Scanner - 2 kez/gün",
    },
    "inday312": {
        "script": "inday312.py",
        "schedule": {"hour": "9-16", "minute": "*/30"},
        "description": "Intraday Scanner - Her 30dk",
    },
    "opsiyon217": {
        "script": "opsiyon217.py",
        "schedule": {"hour": "10,13", "minute": "0"},
        "description": "Opsiyon Scanner - 2 kez/gün",
    },
    "insider_bot": {
        "script": "insider_bot.py",
        "schedule": {"hour": "10", "minute": "0"},
        "description": "Daily Insider Trading Scanner - 1 kez/gün",
    },
}

scheduler: Optional[AsyncIOScheduler] = None


def run_bot(bot_name: str, bots_dir: str, output_dir: str):
    """Execute a bot script and save its output"""
    config = BOT_CONFIGS.get(bot_name)
    if not config:
        logger.error(f"Bot bulunamadı: {bot_name}")
        return

    script_path = os.path.join(bots_dir, config["script"])
    if not os.path.exists(script_path):
        logger.warning(f"Bot script yok: {script_path}")
        return

    try:
        logger.info(f"Bot çalıştırılıyor: {bot_name}")
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes max
            cwd=bots_dir,
        )

        if result.returncode == 0:
            logger.info(f"Bot tamamlandı: {bot_name}")
            # Check for output JSON
            output_file = os.path.join(output_dir, f"{bot_name}_latest.json")
            if os.path.exists(output_file):
                logger.info(f"Çıktı dosyası: {output_file}")

            # Swing112 bittikten sonra FinMA sitesini güncelle
            if bot_name == "swing112":
                try:
                    push_script = os.path.join(bots_dir, "push_to_finma.py")
                    if os.path.exists(push_script):
                        push_result = subprocess.run(
                            ["python", push_script],
                            capture_output=True, text=True,
                            timeout=120, cwd=bots_dir,
                        )
                        if push_result.returncode == 0:
                            logger.info("FinMA push başarılı — site güncelleniyor")
                        else:
                            logger.warning(f"FinMA push hatası: {push_result.stderr[:300]}")
                except Exception as push_err:
                    logger.warning(f"FinMA push çalıştırılamadı: {push_err}")
        else:
            logger.error(f"Bot hatası {bot_name}: {result.stderr[:500]}")

    except subprocess.TimeoutExpired:
        logger.error(f"Bot zaman aşımı: {bot_name}")
    except Exception as e:
        logger.error(f"Bot çalıştırma hatası {bot_name}: {e}")


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
            
            # YENİ: insider_bot için başlangıçta hemen 1 kez çalıştır (User isteği)
            if bot_name == "insider_bot":
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


def get_bot_status():
    """Get status of all bots"""
    status = {}
    for bot_name, config in BOT_CONFIGS.items():
        job = scheduler.get_job(bot_name) if scheduler else None
        status[bot_name] = {
            "name": config["description"],
            "script": config["script"],
            "scheduled": job is not None,
            "next_run": str(job.next_run_time) if job else None,
        }
    return status
