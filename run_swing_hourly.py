#!/usr/bin/env python3
"""
run_swing_hourly.py — BOGA AI Swing V117 Saatlik Tarama
Zamanlayici: Windows Task Scheduler ile saatlik (09:00-17:00 NY, Pzt-Cuma)

swing117_boga.py'yi --oneshot modunda calistirir. Mod (FULL_SCAN / ENTRY_CHECK)
script'in kendi icinde NY saatine gore otomatik secilir (09/14/17 -> FULL_SCAN,
diger saatler -> ENTRY_CHECK). Bu wrapper havuz (candidate_pool.json) ekleme/
cikarma mantigina DOKUNMAZ — sadece tetikleme + git commit/push + Telegram
kisa bilgilendirmesini yonetir.
"""

import json
import logging
import os
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

NY_TZ = ZoneInfo("America/New_York")
FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

LOG_DIR = os.path.join(FINMA_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, "swing_hourly.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("swing_hourly")

SWING_LOG_PATH = os.path.join(LOG_DIR, "swing117_last_run.log")
SWING_TIMEOUT_SEC = 45 * 60

# swing117_boga.py ile ayni sabitler (sadece log/telegram metni icin — mod
# secimi zaten script'in kendi icinde yapiliyor, burada tekrarlanmiyor)
FULL_SCAN_HOURS_NY = {9, 14, 17}
ACTIVE_SCAN_HOURS_NY = set(range(9, 18))

# swing117_boga.py ile ayni Telegram kanali (v117.v2'den beri kullanilan sabitler)
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"

CANDIDATE_POOL_FILE = os.path.join(FINMA_DIR, "frontend", "public", "data", "candidate_pool.json")
SWING_ALL_PICKS_FILE = os.path.join(FINMA_DIR, "frontend", "public", "swing_all_picks.json")

GIT_PATHS = [
    "frontend/public/swing_picks.json",
    "frontend/public/swing_all_picks.json",
    "frontend/public/swing_table.json",
    "frontend/public/watchlist_picks.json",
    "frontend/public/data/candidate_pool.json",
    "frontend/public/data/swing2026/",
]


def send_telegram(message: str):
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage",
            json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            log.warning(f"Telegram error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log.warning(f"Telegram gonderilemedi: {e}")


def run_git(args):
    return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True)


def pool_counts():
    try:
        with open(CANDIDATE_POOL_FILE, "r", encoding="utf-8") as f:
            pool = json.load(f)
        return len(pool.get("swing_candidates", [])), len(pool.get("watchlist_candidates", []))
    except Exception:
        return None, None


def main():
    now_ny = datetime.now(NY_TZ)

    if now_ny.weekday() >= 5:
        log.info("Hafta sonu. Islem yapilmadi.")
        return

    if now_ny.hour not in ACTIVE_SCAN_HOURS_NY:
        log.info(f"Saat {now_ny.hour}:00 NY aktif tarama saatleri disinda (09-17). Atlandi.")
        return

    mode = "FULL_SCAN" if now_ny.hour in FULL_SCAN_HOURS_NY else "ENTRY_CHECK"
    log.info(f"Swing117 saatlik tarama basliyor - NY {now_ny.strftime('%H:%M')} (mode={mode})")

    script_path = os.path.join(FINMA_DIR, "swing117_boga.py")
    cmd = [VENV_PYTHON, script_path, "--oneshot"]

    try:
        with open(SWING_LOG_PATH, "w", encoding="utf-8") as out_file:
            result = subprocess.run(
                cmd, cwd=FINMA_DIR,
                stdout=out_file, stderr=subprocess.STDOUT,
                timeout=SWING_TIMEOUT_SEC,
            )
        returncode = result.returncode
    except subprocess.TimeoutExpired:
        log.error(f"swing117_boga.py {SWING_TIMEOUT_SEC // 60} dakika icinde bitmedi - sonlandirildi.")
        send_telegram(
            f"\U0001f6a8 <b>Swing117 zaman asimi</b> - {now_ny.strftime('%H:%M')} NY ({mode})\n"
            f"45 dakikada bitmedi, sonlandirildi. Detay: logs/swing117_last_run.log"
        )
        return
    except Exception as e:
        log.error(f"swing117_boga.py beklenmedik hata: {e}")
        send_telegram(f"\U0001f6a8 <b>Swing117 baslatilamadi</b> - {now_ny.strftime('%H:%M')} NY: {e}")
        return

    swing_ok = os.path.exists(SWING_ALL_PICKS_FILE) and os.path.exists(CANDIDATE_POOL_FILE)

    if returncode != 0 and not swing_ok:
        log.error(f"swing117_boga.py hata kodu {returncode}, cikti dosyalari da yok. Detay: {SWING_LOG_PATH}")
        send_telegram(
            f"\U0001f6a8 <b>Swing117 hata verdi</b> - {now_ny.strftime('%H:%M')} NY ({mode})\n"
            f"Exit code {returncode}. Detay: logs/swing117_last_run.log"
        )
        return

    if returncode != 0:
        log.warning(f"swing117_boga.py exit code {returncode} ama cikti dosyalari mevcut, devam ediliyor.")
    else:
        log.info("swing117_boga.py tamamlandi.")

    # Git pull --rebase: diger saatlik botlarla (terminal pulse, performance) push
    # cakismasini onlemek icin
    run_git(["pull", "--rebase", "origin", "main"])

    for path in GIT_PATHS:
        run_git(["add", path])

    status = run_git(["status", "--porcelain"]).stdout
    if status.strip():
        commit_msg = f"Data: Swing Hourly Scan {now_ny.strftime('%Y-%m-%d %H:%M')} ({mode})"
        commit = run_git(["commit", "-m", commit_msg])
        if commit.returncode == 0:
            push = run_git(["push", "origin", "main"])
            if push.returncode == 0:
                log.info("Git push basarili.")
            else:
                log.error(f"Git push hatasi: {push.stderr}")
        else:
            log.warning(f"Git commit yapilamadi: {commit.stderr}")
    else:
        log.info("Commit edilecek degisiklik yok.")

    n_swing, n_watch = pool_counts()
    counts_txt = f"{n_swing} swing / {n_watch} watchlist" if n_swing is not None else "havuz okunamadi"
    send_telegram(
        f"✅ <b>Swing117 Kontrol</b> - {now_ny.strftime('%H:%M')} NY ({mode})\n"
        f"Calisti, sorun yok. Takipte: {counts_txt}"
    )

    log.info("Saatlik swing kontrolu tamamlandi.")


if __name__ == "__main__":
    main()
