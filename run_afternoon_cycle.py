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

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(LOG_DIR, "afternoon_cycle.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("afternoon_cycle")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

DEFAULT_TIMEOUT_SEC = 10 * 60   # 10 dakika

# NOT: swing117_boga.py artik burada degil — ayri, saatlik calisan
# run_swing_hourly.py + BOGA_AI_Swing_Hourly Task Scheduler gorevi
# tarafindan yonetiliyor (09:00-17:00 NY, her saat basi). Bu dongu
# ayrica calistirirsa ayni candidate_pool.json'a ayni anda iki surec
# yazardi — mukerrer tetiklemeyi onlemek icin buradan kaldirildi.


def run_bot(script_name: str, args: list = None, timeout: int = DEFAULT_TIMEOUT_SEC) -> bool:
    script_path = os.path.join(FINMA_DIR, script_name)
    if not os.path.exists(script_path):
        log.error(f"❌ Script bulunamadı: {script_name}")
        return False

    cmd = [VENV_PYTHON, script_path] + (args or [])
    log.info(f"▶ Başlatılıyor: {script_name} (timeout={timeout//60}dk)")

    try:
        result = subprocess.run(
            cmd, cwd=FINMA_DIR,
            capture_output=True, text=True, check=True,
            timeout=timeout
        )
        log.info(f"✅ {script_name} tamamlandı.")
        return True
    except subprocess.TimeoutExpired:
        log.error(f"⏱️ {script_name} {timeout//60} dakika içinde bitmedi — zorla sonlandırıldı.")
        return False
    except subprocess.CalledProcessError as e:
        log.error(f"❌ {script_name} hatası (Exit {e.returncode}):")
        if e.stdout: log.error(f"STDOUT: {e.stdout[-2000:]}")
        if e.stderr: log.error(f"STDERR: {e.stderr[-2000:]}")
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

    # NOT: swing117_boga.py artık burada çalışmıyor — BOGA_AI_Swing_Hourly
    # görevi (run_swing_hourly.py) 09:00-17:00 NY arası her saat başı ayrıca
    # tetikliyor. swing_performance.json güncellemesi öncesinde dosyanın
    # public/ altında bulunması yeterli; ilk kurulumda eksikse kopyala.
    import shutil
    public_latest = os.path.join(FINMA_DIR, "frontend", "public", "data", "latest")
    public_root = os.path.join(FINMA_DIR, "frontend", "public")

    perf_src = os.path.join(public_latest, "swing_performance.json")
    perf_dst = os.path.join(public_root, "swing_performance.json")
    if os.path.exists(perf_src) and not os.path.exists(perf_dst):
        try:
            shutil.copy2(perf_src, perf_dst)
            log.info("📋 Copied swing_performance.json to public/ (initial setup)")
        except Exception as e:
            log.warning(f"⚠️ Could not copy swing_performance.json: {e}")

    # 1. Swing Performance Update
    run_bot("update_swing_performance.py")

    # 2. Swing Performance Fix (Clean duplicates)
    run_bot("fix_swing_performance.py")

    # 3. Live Options Update for Swing
    run_bot("fetch_live_options.py")

    # 4. Options P&L Tracker
    run_bot("options_pnl_tracker.py")

    # 5. Health Check
    run_bot("site_health_checker.py")

    # 6. Git Push — Swing ve Options verilerini açıkça ekle ve push et
    log.info("📤 Veriler GitHub'a gönderiliyor...")
    try:
        def run_git(args):
            result = subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
            if result.stdout:
                log.debug(f"  Git: {result.stdout.strip()}")
            return result

        # Swing ve Options dosyalarını açıkça stage et
        swing_files = [
            "frontend/public/swing_picks.json",
            "frontend/public/swing_all_picks.json",
            "frontend/public/swing_table.json",
            "frontend/public/swing_performance.json",
            "frontend/public/data/candidate_pool.json",
            "frontend/public/data/watchlist_picks.json",
            "frontend/public/data/latest/",
            "frontend/public/data/swing2026/",
            "data/",
            "transfer/"
        ]

        for f in swing_files:
            try:
                run_git(["add", f])
            except Exception:
                pass

        # Status kontrol
        status = subprocess.run(["git", "status", "--porcelain"], cwd=FINMA_DIR,
                               capture_output=True, text=True).stdout
        if status.strip():
            log.info(f"  📝 Commit edilecek değişiklikler: {len(status.splitlines())} dosya")
            run_git(["commit", "-m", f"Data: Afternoon Cycle Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
            run_git(["push", "origin", "main"])
            log.info("🚀 Git Push başarılı.")
        else:
            log.info("ℹ️ Commit edilecek değişiklik yok.")

    except subprocess.CalledProcessError as e:
        log.error(f"❌ Git Push hatası (Exit {e.returncode}): {e.stderr}")
    except Exception as e:
        log.error(f"❌ Git Push beklenmedik hata: {e}")

    log.info("✅ Öğleden sonra döngüsü tamamlandı.")


if __name__ == "__main__":
    main()
