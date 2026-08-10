#!/usr/bin/env python3
"""
run_terminal_pulse.py — BOGA AI Terminal Pulse (Hourly Market Data)
Zamanlayıcı: Windows Task Scheduler ile Saatlik (09:00 - 17:00 NY, Pzt-Cuma)
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
            os.path.join(os.path.dirname(__file__), "logs", "terminal_pulse.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("terminal_pulse")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

# Bot commit'leri SADECE veri dosyalarini icermeli.
#
# Onceden `git add .` kullaniliyordu; bu, calisma agacindaki yarim kalmis
# KAYNAK KODU da "Data: Terminal Pulse HH:00" basligiyla commit'leyip main'e
# push ediyordu. Iki kez yasandi: 2026-07-28 (search feature'i) ve 2026-08-10
# (Supabase kesinti duzeltmeleri, commit 9ebce091). Bkz. tasks/active/012.
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

def main():
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        return # Hafta sonu sessizce kapat

    # Sadece borsa saatlerinde çalış (09:00 - 17:00)
    if now_ny.hour < 9 or now_ny.hour > 17:
        return

    log.info(f"💓 Terminal Pulse Başlatıldı ({now_ny.hour}:00 NY)...")

    # 1. Inday Scanner (Market/Sector info)
    # --force flag forces it to run once and exit
    script_path = os.path.join(FINMA_DIR, "inday313.py")
    try:
        subprocess.run([VENV_PYTHON, script_path, "--force"], cwd=FINMA_DIR, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        log.error(f"❌ Inday Scanner hatası: {e.stderr}")

    # 2. Refresh Terminal Master Data (JSON merging)
    refresh_path = os.path.join(FINMA_DIR, "scratch", "refresh_terminal_data.py")
    if os.path.exists(refresh_path):
        try:
            subprocess.run([VENV_PYTHON, refresh_path], cwd=FINMA_DIR, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            log.error(f"❌ Refresh Terminal Data hatası: {e.stderr}")

    # 3. Git Push (Silent update)
    try:
        def run_git(args):
            return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)
        
        run_git(["add", "-A", "--"] + DATA_ONLY_PATHSPEC)
        run_git(["commit", "-m", f"Data: Terminal Pulse {now_ny.strftime('%H:00')}"])
        run_git(["push", "origin", "main"])
    except subprocess.CalledProcessError as e:
        log.warning(f"⚠️ Terminal Pulse Git Push hatası (Exit {e.returncode}): {e.stderr}")
    except Exception as e:
        log.warning(f"⚠️ Terminal Pulse Git Push beklenmedik hata: {e}")

    log.info("✅ Pulse tamamlandı.")

if __name__ == "__main__":
    main()
