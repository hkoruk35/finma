#!/usr/bin/env python3
"""
run_performance_hourly.py — BOGA AI Swing & Options Performance Hourly Tracker
Zamanlayıcı: Windows Task Scheduler ile 10:00-16:30 NY arası her saat (Pzt-Cuma)
Amacı: Hem swing hem de options P&L durumlarını güncelleyip GitHub'a pushlamak.
"""
import logging
import os
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo

NY_TZ = ZoneInfo("America/New_York")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(FINMA_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(LOG_DIR, "performance_hourly.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("performance_hourly")

VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

def run_git(args):
    return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)

def main():
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        log.info("🛌 Hafta sonu. İşlem yapılmadı.")
        return

    log.info("🌅 Performance Hourly Tracker Başlatıldı...")

    # 1. Update Swing Performance
    log.info("1. Swing performans güncelleniyor...")
    try:
        subprocess.run([VENV_PYTHON, "update_swing_performance.py"], cwd=FINMA_DIR, check=True)
        log.info("✅ Swing performans güncellendi.")
    except Exception as e:
        log.error(f"❌ Swing performans güncelleme hatası: {e}")

    # 2. Update Options Performance
    log.info("2. Options P&L tracker çalıştırılıyor...")
    try:
        subprocess.run([VENV_PYTHON, "options_pnl_tracker.py"], cwd=FINMA_DIR, check=True)
        log.info("✅ Options P&L tracker tamamlandı.")
    except Exception as e:
        log.error(f"❌ Options P&L tracker hatası: {e}")

    # 3. Git Push to GitHub
    log.info("3. Veriler GitHub'a yükleniyor...")
    try:
        # Stage the updated files
        run_git(["add", "frontend/public/swing_performance.json"])
        run_git(["add", "frontend/public/data/latest/options_outcomes.json"])
        
        # Git diff check before committing
        diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=FINMA_DIR)
        if diff_res.returncode == 1: # There are changes
            run_git(["commit", "-m", f"Data: Hourly Performance Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
            run_git(["push", "origin", "main"])
            log.info("🚀 Git Push ve Vercel Deployment başarılı.")
        else:
            log.info("ℹ️ Değişiklik yok, git push yapılmadı.")
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Git işlem hatası: stdout={e.stdout}, stderr={e.stderr}")
    except Exception as e:
        log.error(f"❌ Git Push beklenmedik hata: {e}")

    log.info("✅ Saatlik performans döngüsü tamamlandı.")

if __name__ == "__main__":
    main()
