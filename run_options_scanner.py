#!/usr/bin/env python3
"""
run_options_scanner.py — BOGA AI Option Scanner Otomasyonu
Zamanlayıcı: Windows Task Scheduler ile 11:00 & 15:30 NY (Pzt-Cuma)
Amacı: opsiyon241.py botunu çalıştırıp, json çıktılarını transfer klasörlerine kopyalamak ve GitHub'a pushlamak.
"""

import logging
import os
import subprocess
import shutil
import glob
from datetime import datetime
from zoneinfo import ZoneInfo

NY_TZ = ZoneInfo("America/New_York")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(FINMA_DIR, "logs")
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(LOG_DIR, "options_scanner.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("options_scanner")

VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")

def run_git(args):
    return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)

def main():
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        log.info("🛌 Hafta sonu. İşlem yapılmadı.")
        return

    log.info("🌅 BOGA AI Option Scanner (11:00 & 15:30 NY) Başlatıldı...")

    script_path = os.path.join(FINMA_DIR, "opsiyon241.py")
    cmd = [VENV_PYTHON, script_path, "--oneshot"]
    
    log.info(f"▶ Çalıştırılıyor: opsiyon241.py")
    try:
        subprocess.run(cmd, cwd=FINMA_DIR, capture_output=True, text=True, encoding="utf-8", check=True)
        log.info("✅ opsiyon241.py tamamlandı.")
    except subprocess.CalledProcessError as e:
        log.error(f"❌ opsiyon241.py hatası (Exit {e.returncode}):")
        if e.stdout: log.error(f"STDOUT: {e.stdout}")
        if e.stderr: log.error(f"STDERR: {e.stderr}")
        return
    except Exception as e:
        log.error(f"❌ Beklenmedik hata: {e}")
        return

    # Dosyaları kopyala
    data_dir = os.path.join(FINMA_DIR, "data")
    v241_files = glob.glob(os.path.join(data_dir, "v241_*.json"))
    
    if not v241_files:
        log.error("❌ opsiyon241.py çalıştı ancak yeni bir JSON dosyası bulunamadı.")
        return
        
    v241_files.sort()
    latest_file = v241_files[-1]
    log.info(f"📄 En son dosya bulundu: {os.path.basename(latest_file)}")

    # 1. Public Data Dir (Latest)
    public_latest_dir = os.path.join(FINMA_DIR, "frontend", "public", "data", "latest")
    os.makedirs(public_latest_dir, exist_ok=True)
    shutil.copy2(latest_file, os.path.join(public_latest_dir, "options_picks.json"))
    
    # 2. Public Data Dir (Archive Date)
    today_str = now_ny.strftime("%Y-%m-%d")
    public_archive_dir = os.path.join(FINMA_DIR, "frontend", "public", "data", today_str)
    os.makedirs(public_archive_dir, exist_ok=True)
    shutil.copy2(latest_file, os.path.join(public_archive_dir, "options_picks.json"))

    # 3. Transfer Latest Dir
    transfer_latest_dir = os.path.join(FINMA_DIR, "transfer", "latest")
    os.makedirs(transfer_latest_dir, exist_ok=True)
    shutil.copy2(latest_file, os.path.join(transfer_latest_dir, "options_picks.json"))
    
    # 4. Transfer Archive Dir
    transfer_archive_dir = os.path.join(FINMA_DIR, "transfer", today_str)
    os.makedirs(transfer_archive_dir, exist_ok=True)
    shutil.copy2(latest_file, os.path.join(transfer_archive_dir, "options_picks.json"))
    
    log.info("📁 Dosyalar transfer ve frontend klasörlerine başarıyla kopyalandı.")

    # Git Push
    log.info("📤 Veriler GitHub'a gönderiliyor...")
    try:
        run_git(["add", "."])
        run_git(["commit", "-m", f"Data: Options Scanner Auto Update {now_ny.strftime('%Y-%m-%d %H:%M')}"])
        run_git(["push", "origin", "main"])
        log.info("🚀 Git Push başarılı.")
    except subprocess.CalledProcessError as e:
        # Eğer değişiklik yoksa hata verebilir, yoksay.
        if "nothing to commit" in e.stdout or "nothing to commit" in e.stderr:
            log.info("ℹ️ Gönderilecek yeni değişiklik yok.")
        else:
            log.error(f"❌ Git Push hatası (Exit {e.returncode}):")
            if e.stdout: log.error(f"STDOUT: {e.stdout}")
            if e.stderr: log.error(f"STDERR: {e.stderr}")
    except Exception as e:
        log.error(f"❌ Git Push beklenmedik hata: {e}")

    log.info("✅ Otomatik tarama döngüsü tamamlandı.")

if __name__ == "__main__":
    main()
