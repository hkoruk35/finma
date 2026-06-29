#!/usr/bin/env python3
"""
run_midnight_update.py — BOGA AI Gece Yarısı Evren Güncellemesi
Zamanlayıcı: Windows Task Scheduler ile her gece 00:00 (7/24)

Adımlar:
1. universe_builder.py → daily_universe.json yenile
2. Git commit + push → Vercel otomatik deploy
"""
import logging
import os
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

NY_TZ = ZoneInfo("America/New_York")

FINMA_DIR   = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

os.makedirs(os.path.join(FINMA_DIR, "logs"), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(FINMA_DIR, "logs", "midnight_update.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("midnight_update")


def run_script(name: str, args: list = None, timeout: int = 1800) -> bool:
    path = os.path.join(FINMA_DIR, name)
    cmd  = [VENV_PYTHON, path] + (args or [])
    log.info(f"▶ {name} başlatılıyor...")
    try:
        result = subprocess.run(
            cmd, cwd=FINMA_DIR,
            capture_output=True, text=True,
            timeout=timeout,
        )
        for line in (result.stdout or "").splitlines():
            log.info(f"  {line}")
        if result.returncode == 0:
            log.info(f"✅ {name} tamamlandı.")
            return True
        log.error(f"❌ {name} hata (exit {result.returncode})")
        for line in (result.stderr or "")[:800].splitlines():
            log.error(f"  {line}")
        return False
    except subprocess.TimeoutExpired:
        log.error(f"⏱️  {name} zaman aşımı ({timeout // 60} dakika).")
        return False
    except Exception as e:
        log.error(f"❌ {name} başlatılamadı: {e}")
        return False


def git_push(message: str) -> bool:
    def git(*args):
        r = subprocess.run(
            ["git"] + list(args),
            cwd=FINMA_DIR, capture_output=True, text=True,
        )
        return r.returncode == 0, r.stdout, r.stderr

    git("add", "frontend/public/data/daily_universe.json")

    ok, out, err = git("commit", "-m", message)
    if not ok:
        combined = out + err
        if "nothing to commit" in combined:
            log.info("Değişiklik yok, commit atlandı.")
            return True
        log.error(f"git commit hatası: {err.strip()}")
        return False

    ok, _, err = git("push", "origin", "main")
    if ok:
        log.info("🚀 Git push başarılı — Vercel deploy tetiklendi.")
        return True
    log.error(f"git push hatası: {err.strip()}")
    return False


def main():
    now_ny  = datetime.now(NY_TZ)
    now_loc = datetime.now()

    log.info("=" * 60)
    log.info(f"🌙 Gece Yarısı Güncelleme — {now_loc.strftime('%Y-%m-%d %H:%M')} (yerel) / {now_ny.strftime('%H:%M %Z')}")
    log.info("=" * 60)

    # 1. Universe Build (~15-25 dakika)
    ok = run_script("universe_builder.py", timeout=2400)
    if not ok:
        log.error("Universe build başarısız oldu. Git push atlandı.")
        return

    # 1b. Top100 'fixed' liste — /tracker'daki yeni hisseleri hacme göre top90'a senkronize et
    run_script("update_top100_fixed.py", timeout=900)

    # 2. Git commit + push
    date_str = now_ny.strftime("%Y-%m-%d")
    git_push(f"Data: Universe Update {date_str} [bot]")

    log.info("=" * 60)
    log.info(f"✅ Gece yarısı güncellemesi tamamlandı — {datetime.now().strftime('%H:%M:%S')}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
