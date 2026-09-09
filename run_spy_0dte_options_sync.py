#!/usr/bin/env python3
"""
run_spy_0dte_options_sync.py — SPY 0DTE Options Sync zamanlayıcı sarmalayıcısı.
Zamanlayıcı: Windows Task Scheduler, BOGA_AI_SPY_0DTE_Options
             (09:45 NY, ardından saat başı 15:45 NY'ye kadar, Pzt-Cuma).

NEDEN AYRI BİR ZAMANLAMA (run_options_scanner.py / BOGA_AI_Options_Scanner
İÇİNDEN DEĞİL): O görev günde yalnızca 2 kez (11:00 & 15:30 NY) çalışıyor —
0DTE Greeks'in gün içinde hızla değişen doğası için çok seyrek. SPY 0DTE
senkronu kendi bağımsız, daha sık zamanlamasına taşındı (bkz.
tasks/active/013, Faz 2).

spy_0dte_options_sync.py hiçbir yerel dosya yazmaz / git commit'i
tetiklemez (yalnızca Supabase shared_store'a REST ile yazar) — bu
sarmalayıcı SADECE loglama ve çalıştırma için var, diğer run_*.py'lerdeki
git-push/dosya kopyalama mantığına ihtiyaç YOK.
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
        logging.FileHandler(os.path.join(LOG_DIR, "spy_0dte_options_sync.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("spy_0dte_options_sync")

VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")


def main() -> None:
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        log.info("Hafta sonu. İşlem yapılmadı.")
        return

    log.info("▶ Çalıştırılıyor: spy_0dte_options_sync.py")
    result = subprocess.run(
        [VENV_PYTHON, os.path.join(FINMA_DIR, "spy_0dte_options_sync.py")],
        cwd=FINMA_DIR, capture_output=True, text=True, encoding="utf-8",
    )
    if result.stdout:
        log.info(result.stdout.strip())
    if result.returncode == 0:
        log.info("✅ Tamamlandı.")
    else:
        log.warning(f"⚠️ Exit code: {result.returncode} — {result.stderr.strip()[-500:]}")


if __name__ == "__main__":
    main()
