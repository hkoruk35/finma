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
import re
import sys
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

VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")  # Windows
if not os.path.exists(VENV_PYTHON):
    _dotvenv = os.path.join(FINMA_DIR, ".venv", "bin", "python3")  # Linux/Ubuntu (guncel venv)
    _venv313 = os.path.join(FINMA_DIR, "venv313", "bin", "python")  # Linux eski venv (fallback)
    if os.path.exists(_dotvenv):
        VENV_PYTHON = _dotvenv
    elif os.path.exists(_venv313):
        VENV_PYTHON = _venv313
    else:
        VENV_PYTHON = sys.executable

def run_git(args):
    return subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, check=True)


def _git(args, env=None, check=True):
    r = subprocess.run(["git"] + args, cwd=FINMA_DIR, capture_output=True, text=True, encoding="utf-8",
                       env={**os.environ, **(env or {})})
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:2])} -> {r.returncode}: {(r.stderr or r.stdout).strip()[:300]}")
    return r.stdout.strip()


def publish_files(rel_paths, message):
    """Çalışma ağacındaki dosyaları origin/main üzerine tek commit olarak gönderir (yerel dal/indeks değişmez)."""
    import tempfile
    files = [p for p in rel_paths if os.path.isfile(os.path.join(FINMA_DIR, p))]
    if not files:
        log.info("ℹ️ Yayınlanacak dosya yok.")
        return
    _git(["fetch", "origin", "main"])
    base = _git(["rev-parse", "origin/main"])
    idx = os.path.join(tempfile.gettempdir(), f"boga_opt_index_{os.getpid()}")
    env = {"GIT_INDEX_FILE": idx}
    try:
        _git(["read-tree", base], env)
        for p in files:
            _git(["update-index", "--add", "--", p], env)
        tree = _git(["write-tree"], env)
        if tree == _git(["rev-parse", f"{base}^{{tree}}"]):
            log.info("ℹ️ Değişiklik yok — yayın atlandı.")
            return
        commit = _git(["commit-tree", tree, "-p", base, "-m", message])
        _git(["push", "origin", f"{commit}:refs/heads/main"])
        log.info(f"🚀 origin/main'e yayınlandı: {commit[:9]} ({len(files)} dosya)")
    finally:
        try: os.remove(idx)
        except OSError: pass


def main():
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        log.info("🛌 Hafta sonu. İşlem yapılmadı.")
        return

    log.info("🌅 BOGA AI Option Scanner (11:00 & 15:30 NY) Başlatıldı...")

    script_path = os.path.join(FINMA_DIR, "opsiyon242.py")
    cmd = [VENV_PYTHON, script_path, "--oneshot"]
    
    log.info(f"▶ Çalıştırılıyor: opsiyon242.py")
    try:
        result = subprocess.run(cmd, cwd=FINMA_DIR, capture_output=True, text=True, encoding="utf-8",
                                env={**os.environ, "BOGA_NO_GIT": "1", "PYTHONIOENCODING": "utf-8"})
        if result.returncode == 0:
            log.info("✅ opsiyon242.py tamamlandı.")
        else:
            # Exit code != 0 olsa bile, eğer JSON dosyası oluşturulduysa devam et (print error vs)
            log.warning(f"⚠️ opsiyon242.py exit code: {result.returncode} (devam ediliyor...)")
            if result.stderr:
                log.debug(f"STDERR: {result.stderr[-500:]}")
    except Exception as e:
        log.error(f"❌ Beklenmedik hata: {e}")
        return

    # Run P&L tracker to calculate P&Ls and update options_outcomes.json
    log.info("▶ Çalıştırılıyor: options_pnl_tracker.py")
    try:
        subprocess.run([VENV_PYTHON, "options_pnl_tracker.py"], cwd=FINMA_DIR, check=True)
        log.info("✅ options_pnl_tracker.py tamamlandı.")
    except Exception as e:
        log.error(f"❌ options_pnl_tracker.py hatası: {e}")

    # NOT: SPY 0DTE Greeks senkronizasyonu (spy_0dte_options_sync.py) artık
    # BURADAN çağrılmıyor -- kendi bağımsız zamanlamasına (09:45 NY + saat
    # başı, BOGA_AI_SPY_0DTE_Options) taşındı, çünkü bu görevin 11:00/15:30
    # NY döngüsü 0DTE için çok seyrek. Bkz. run_spy_0dte_options_sync.py ve
    # scratch/setup_boga_tasks.ps1 (tasks/active/013, Faz 2).

    # Dosyaları kopyala
    data_dir = os.path.join(FINMA_DIR, "data")
    # opsiyon242.py'nin çıktı dosya adındaki sürüm öneki zamanla değişiyor
    # (v241 -> v242 -> v243). Burada yalnızca v241_/v242_ aranıyordu; scanner
    # 2026-06-08'de v243_'e geçince glob hiçbir yeni dosyayı görmedi ve her
    # çalışmada bulabildiği en son dosyayı — 2026-06-05 tarihli
    # v242_20260605_1100.json — "bugünün seçimleri" olarak kopyalamaya devam
    # etti. Site iki aydan uzun süre 5 Haziran opsiyon seçimlerini güncelmiş
    # gibi gösterdi; her saatlik çalışma da bunu tekrar commit'ledi
    # (2026-08-10'da tespit edildi).
    #
    # Artık sürüm önekinden bağımsız olarak bütün v2*_ dosyaları taranıyor ve
    # seçim, dosya adındaki YYYYMMDD_HHMM damgasına göre yapılıyor — böylece
    # bir sonraki sürüm yükseltmesi bunu sessizce tekrar kıramaz.
    def _stamp(path: str) -> str:
        m = re.search(r"_(\d{8}_\d{4})\.json$", os.path.basename(path))
        return m.group(1) if m else ""

    all_files = sorted(
        (f for f in glob.glob(os.path.join(data_dir, "v2*_*.json")) if _stamp(f)),
        key=_stamp,
    )

    if not all_files:
        log.error("❌ opsiyon242.py çalıştı ancak yeni bir JSON dosyası bulunamadı.")
        return

    latest_file = all_files[-1]

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

    # 5. Copy to PUBLIC ROOT — Frontend loads from here!
    public_root = os.path.join(FINMA_DIR, "frontend", "public")
    os.makedirs(public_root, exist_ok=True)
    shutil.copy2(latest_file, os.path.join(public_root, "options_picks.json"))

    log.info("📁 Dosyalar transfer, frontend/data ve public/ klasörlerine başarıyla kopyalandı.")

    # P&L sonuçları (tracker transfer/latest'e yazar) -> frontend'in okuduğu public/data/latest
    _out = os.path.join(FINMA_DIR, "transfer", "latest", "options_outcomes.json")
    if os.path.isfile(_out):
        shutil.copy2(_out, os.path.join(public_latest_dir, "options_outcomes.json"))

    # 6. Yayınlama — origin/main'e PLUMBING ile (yerel main'e commit YOK).
    # Neden: yerel main yüzlerce commit geride/ileride; `git push` her çalışmada "fetch first" ile reddediliyordu
    # (2026-10-14'ten beri site bayat kaldı). Burada origin/main'in ağacına yalnız opsiyon dosyaları eklenir.
    # Yalnız frontend/public/data/** yazılır: deploy-frontend.yml bunu build tetiklemeden hariç tutar (OOM riski yok).
    log.info("📤 Veriler origin/main'e yayınlanıyor...")
    try:
        publish_files([
            "frontend/public/data/latest/options_picks.json",
            f"frontend/public/data/{today_str}/options_picks.json",
            "frontend/public/data/latest/options_outcomes.json",
        ], f"Data: Options Scanner Auto Update {now_ny.strftime('%Y-%m-%d %H:%M')}")
    except Exception as e:
        log.error(f"❌ Yayınlama hatası: {e}")

    log.info("✅ Otomatik tarama döngüsü tamamlandı.")

if __name__ == "__main__":
    main()
