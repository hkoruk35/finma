#!/usr/bin/env python3
"""
run_morning_cycle.py — BOGA AI Sabah Döngüsü (DayTrade Focus)
Zamanlayıcı: Windows Task Scheduler ile 09:15 NY (Pzt-Cuma)
"""

import logging
import os
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

NY_TZ = ZoneInfo("America/New_York")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "logs", "morning_cycle.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("morning_cycle")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

def run_bot(script_name: str, args: list = None):
    script_path = os.path.join(FINMA_DIR, script_name)
    cmd = [VENV_PYTHON, script_path] + (args or [])
    log.info(f"▶ Başlatılıyor: {script_name}")
    try:
        result = subprocess.run(cmd, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
        log.info(f"✅ {script_name} tamamlandı.")
        return True
    except subprocess.CalledProcessError as e:
        log.error(f"❌ {script_name} hatası (Exit {e.returncode}):")
        if e.stdout: log.error(f"STDOUT: {e.stdout}")
        if e.stderr: log.error(f"STDERR: {e.stderr}")
        return False
    except Exception as e:
        log.error(f"❌ {script_name} beklenmedik hata: {e}")
        return False

def main():
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        log.info("🛌 Hafta sonu. İşlem yapılmadı.")
        return

    log.info("🌅 BOGA AI Sabah Döngüsü Başlatıldı...")

    # 1. DayTrade Scan
    run_bot("daytrade_atmaca_v2.py", ["--oneshot"])

    # 2. DayTrade Performance Update
    run_bot("update_daytrade_performance.py")

    # 3. DayTrade Options Scan (30-45-60 DTE)
    run_bot("fetch_daytrade_options.py")

    # 4. Git Push
    log.info("📤 Veriler GitHub'a gönderiliyor...")
    try:
        def run_git(args):
            return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)

        run_git(["add", "."])
        run_git(["commit", "-m", f"Data: Morning Cycle Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
        run_git(["push", "origin", "main"])
        log.info("🚀 Git Push başarılı.")
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Git Push hatası (Exit {e.returncode}):")
        if e.stdout: log.error(f"STDOUT: {e.stdout}")
        if e.stderr: log.error(f"STDERR: {e.stderr}")
    except Exception as e:
        log.error(f"❌ Git Push beklenmedik hata: {e}")

    log.info("✅ Sabah döngüsü tamamlandı.")

if __name__ == "__main__":
    main()
