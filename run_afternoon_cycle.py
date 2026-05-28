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

# Swing117 için ayrı log dosyası — stdout/stderr buraya yazılır
SWING_LOG_PATH = os.path.join(LOG_DIR, "swing117_last_run.log")

# Geç başlatma eşiği: Bu saatten sonra swing117 zaten anlamsız (piyasa kapanıyor)
SWING_CUTOFF_HOUR = 15
SWING_CUTOFF_MINUTE = 30

# Maksimum bekleme süreleri
SWING_TIMEOUT_SEC   = 45 * 60   # 45 dakika
DEFAULT_TIMEOUT_SEC = 10 * 60   # 10 dakika


def run_bot(script_name: str, args: list = None, timeout: int = DEFAULT_TIMEOUT_SEC) -> bool:
    script_path = os.path.join(FINMA_DIR, script_name)
    if not os.path.exists(script_path):
        log.error(f"❌ Script bulunamadı: {script_name}")
        return False

    cmd = [VENV_PYTHON, script_path] + (args or [])
    log.info(f"▶ Başlatılıyor: {script_name} (timeout={timeout//60}dk)")

    # stdout/stderr'i ayrı log dosyasına yönlendir (swing117 için); diğerleri capture
    if "swing117" in script_name:
        out_file = open(SWING_LOG_PATH, "w", encoding="utf-8")
        try:
            result = subprocess.run(
                cmd, cwd=FINMA_DIR,
                stdout=out_file, stderr=subprocess.STDOUT,
                timeout=timeout
            )
            out_file.close()
            if result.returncode == 0:
                log.info(f"✅ {script_name} tamamlandı.")
                return True
            else:
                log.error(f"❌ {script_name} hata kodu {result.returncode}. Detay: {SWING_LOG_PATH}")
                return False
        except subprocess.TimeoutExpired:
            out_file.close()
            log.error(f"⏱️ {script_name} {timeout//60} dakika içinde bitmedi — zorla sonlandırıldı. Detay: {SWING_LOG_PATH}")
            return False
        except Exception as e:
            out_file.close()
            log.error(f"❌ {script_name} beklenmedik hata: {e}")
            return False
    else:
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

    # Geç başlatma kontrolü: 15:30 NY'dan sonra swing taraması anlamsız
    cutoff = now_ny.replace(hour=SWING_CUTOFF_HOUR, minute=SWING_CUTOFF_MINUTE, second=0, microsecond=0)
    if now_ny >= cutoff:
        log.warning(
            f"⚠️ Saat {now_ny.strftime('%H:%M')} NY — piyasa kapanışına yakın. "
            f"swing117_boga.py ATLANADI (eşik: {SWING_CUTOFF_HOUR}:{SWING_CUTOFF_MINUTE:02d})."
        )
    else:
        # 1. Swing Scanner (v117) — --now: 13:00 bekleme yapmadan hemen çalış
        run_bot("swing117_boga.py", ["--oneshot", "--now"], timeout=SWING_TIMEOUT_SEC)

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

    # 7. Git Push — Swing ve Options verilerini açıkça ekle ve push et
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
