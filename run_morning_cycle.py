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

# Bot commit'leri SADECE veri dosyalarini icermeli.
#
# Onceden `git add .` kullaniliyordu; bu, calisma agacindaki yarim kalmis
# KAYNAK KODU da "Data: Morning Cycle Update ..." basligiyla commit'leyip
# main'e push ediyordu (2026-07-28, commit 0463b36f — bkz. tasks/active/012).
#
# Allowlist degil denylist: yeni bir VERI klasoru eklendiginde sessizce
# commit'lenmemesi, yeni bir KOD klasoru eklendiginde yanlislikla
# commit'lenmesinden daha buyuk bir risk — veri akisini kirmamak oncelikli
# (bkz. AGENTS.md "Hard Constraints").
#
# NOT: `scratch/` bilerek listeye alinmadi. .gitignore'da oldugu icin
# pathspec'te acikca adlandirilmasi `git add`'i exit 1 yapiyor ve bot
# check=True kullandigindan veri commit'i hic olusmuyor.
DATA_ONLY_PATHSPEC = [
    ".",
    ":(exclude,glob)frontend/app/**",
    ":(exclude,glob)frontend/components/**",
    ":(exclude,glob)frontend/lib/**",
    ":(exclude,glob)frontend/hooks/**",
    ":(exclude,glob)frontend/scripts/**",
    ":(exclude,glob)frontend/supabase/**",
    ":(exclude,glob)frontend/*.ts",
    ":(exclude,glob)frontend/*.tsx",
    ":(exclude,glob)frontend/*.js",
    ":(exclude,glob)frontend/*.mjs",
    ":(exclude,glob)frontend/*.json",
    ":(exclude,glob)supabase/**",
    ":(exclude,glob)docs/**",
    ":(exclude,glob)tasks/**",
    ":(exclude,glob).github/**",
    ":(exclude,glob)archive/**",
    ":(exclude,glob)*.py",
    ":(exclude,glob)*.md",
    ":(exclude,glob)*.bat",
    ":(exclude,glob)*.ps1",
    ":(exclude,glob)*.ts",
    ":(exclude,glob)*.js",
]

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

        run_git(["add", "-A", "--"] + DATA_ONLY_PATHSPEC)
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
