#!/usr/bin/env python3
"""
run_performance_hourly.py — BOGA AI Swing & Options Performance Hourly Tracker
Zamanlayıcı: Windows Task Scheduler ile 10:00-16:30 NY arası her saat (Pzt-Cuma)
Amacı: Hem swing hem de options P&L durumlarını güncelleyip GitHub'a pushlamak.
"""
import logging
import os
import subprocess
import time
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

# 2026-08-18 17:00'dan sonra .git/index.lock sikisip kalinca bu script (ve
# ayni sorunu yasayan run_swing_hourly.py) sessizce her saat basarisiz oldu —
# sadece log'a ERROR yaziyordu, kimseye bildirim gitmedi. GIT_LOCK_STALE_SEC'ten
# daha eski bir index.lock, normal bir commit/push suresinden cok daha uzun
# demektir; yani neredeyse kesin yarida kesilmis/çökmüs bir git surecinden
# kalma yetim kilittir ve güvenle silinip tek seferlik yeniden denenebilir.
GIT_LOCK_PATH = os.path.join(FINMA_DIR, ".git", "index.lock")
GIT_LOCK_STALE_SEC = 120


def _clear_stale_lock() -> bool:
    try:
        if os.path.exists(GIT_LOCK_PATH):
            age = time.time() - os.path.getmtime(GIT_LOCK_PATH)
            if age > GIT_LOCK_STALE_SEC:
                os.remove(GIT_LOCK_PATH)
                log.warning(f"Sikismis .git/index.lock temizlendi (yasi {age:.0f}s), yeniden deneniyor.")
                return True
    except Exception as e:
        log.warning(f"Kilit temizleme denemesi basarisiz: {e}")
    return False


def run_git(args):
    try:
        return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        if "index.lock" in (e.stderr or "") and _clear_stale_lock():
            return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
        raise

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

    # 2. Update Heatmap Prices (master.json + all_tickers_list.json)
    log.info("2. Heatmap fiyatlari guncelleniyor...")
    try:
        subprocess.run([VENV_PYTHON, "update_heatmap_prices.py"], cwd=FINMA_DIR, check=True)
        log.info("✅ Heatmap fiyatlari guncellendi.")
    except Exception as e:
        log.error(f"❌ Heatmap fiyat guncelleme hatasi: {e}")

    # 3. Update Options Performance
    log.info("3. Options P&L tracker calistiriliyor...")
    try:
        subprocess.run([VENV_PYTHON, "options_pnl_tracker.py"], cwd=FINMA_DIR, check=True)
        log.info("✅ Options P&L tracker tamamlandi.")
    except Exception as e:
        log.error(f"❌ Options P&L tracker hatasi: {e}")

    # 4. Git Push to GitHub
    log.info("4. Veriler GitHub'a yukleniyor...")
    try:
        # Stage the updated files
        run_git(["add", "frontend/public/swing_performance.json"])
        run_git(["add", "frontend/public/data/latest/all_tickers_list.json"])
        run_git(["add", "frontend/public/data/latest/master.json"])
        run_git(["add", "frontend/public/data/latest/options_outcomes.json"])
        
        # Git diff check before committing
        diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=FINMA_DIR)
        if diff_res.returncode == 1: # There are changes
            run_git(["commit", "-m", f"Data: Hourly Prices + Performance Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
            run_git(["push", "origin", "main"])
            log.info("Pushed to GitHub — Vercel deployment triggered.")
        else:
            log.info("No changes to commit.")
    except subprocess.CalledProcessError as e:
        log.error(f"Git error: stdout={e.stdout}, stderr={e.stderr}")
    except Exception as e:
        log.error(f"Git unexpected error: {e}")

    log.info("Hourly cycle complete.")

if __name__ == "__main__":
    main()
