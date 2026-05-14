#!/usr/bin/env python3
"""
run_afternoon_cycle.py — BOGA AI Öğleden Sonra Döngüsü (Swing Focus)
Zamanlayıcı: Windows Task Scheduler ile 13:00 NY (Pzt-Cuma)
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
            os.path.join(os.path.dirname(__file__), "logs", "afternoon_cycle.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("afternoon_cycle")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

def run_bot(script_name: str, args: list = None):
    script_path = os.path.join(FINMA_DIR, script_name)
    if not os.path.exists(script_path):
        log.error(f"❌ Script bulunamadı: {script_name}")
        return False
        
    cmd = [VENV_PYTHON, script_path] + (args or [])
    log.info(f"▶ Başlatılıyor: {script_name}")
    try:
        # Capture output to log it if it fails
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

    log.info("🌇 BOGA AI Öğleden Sonra Döngüsü Başlatıldı...")

    # 1. Swing Scanner (v116) - 13:00 NY'da çalışır
    run_bot("swing116_boga.py", ["--oneshot"])

    # 2. Swing Performance Update
    run_bot("update_swing_performance.py")

    # 3. Swing Performance Fix (Clean duplicates)
    run_bot("fix_swing_performance.py")

    # 4. Live Options Update for Swing
    run_bot("fetch_live_options.py")

    # 5. Options P&L Tracker
    run_bot("options_pnl_tracker.py")

    # 6. Health Check
    run_bot("site_health_checker.py")

    # 7. Git Push
    log.info("📤 Veriler GitHub'a gönderiliyor...")
    try:
        def run_git(args):
            res = subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
            return res

        run_git(["add", "."])
        run_git(["commit", "-m", f"Data: Afternoon Cycle Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
        run_git(["push", "origin", "main"])
        log.info("🚀 Git Push başarılı.")
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Git Push hatası (Exit {e.returncode}):")
        if e.stdout: log.error(f"STDOUT: {e.stdout}")
        if e.stderr: log.error(f"STDERR: {e.stderr}")
    except Exception as e:
        log.error(f"❌ Git Push beklenmedik hata: {e}")

    log.info("✅ Öğleden sonra döngüsü tamamlandı.")

if __name__ == "__main__":
    main()
