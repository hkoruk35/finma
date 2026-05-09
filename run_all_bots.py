#!/usr/bin/env python3
"""
run_all_bots.py — BOGA AI Tam Otomasyon
Manual çalıştırma: python run_all_bots.py
Zamanlayıcı: Windows Task Scheduler ile 09:00 NY (Pzt-Cuma)

Sıra:
1. opsiyon218v8.py --oneshot (11:00 NY bekler)
2. swing115_boga.py --oneshot (18:00 NY bekler)
3. inday313.py --force (10:00-16:00 arası çalışır)
4. options_pnl_tracker.py
5. site_health_checker.py
6. Git Push & Deploy
"""

import asyncio
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
            os.path.join(os.path.dirname(__file__), "logs", "run_all_bots.log"),
            encoding="utf-8"
        ),
    ]
)
log = logging.getLogger("run_all_bots")

FINMA_DIR = os.path.dirname(os.path.abspath(__file__))

# Python executable in the venv
VENV_PYTHON = os.path.join(FINMA_DIR, "venv313", "Scripts", "python.exe")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable


def run_bot_subprocess(script_name: str, extra_args: list = None) -> bool:
    """Run a bot script as a subprocess and return success status."""
    script_path = os.path.join(FINMA_DIR, script_name)
    cmd = [VENV_PYTHON, script_path] + (extra_args or [])
    log.info(f"▶ Çalıştırılıyor: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            cwd=FINMA_DIR,
            timeout=7200,   # 2 saat max
            capture_output=False,
        )
        if result.returncode == 0:
            log.info(f"✅ {script_name} başarıyla tamamlandı.")
            return True
        else:
            log.error(f"❌ {script_name} hata kodu {result.returncode} ile çıktı.")
            return False
    except subprocess.TimeoutExpired:
        log.error(f"⏱️ {script_name} zaman aşımına uğradı (2 saat).")
        return False
    except Exception as e:
        log.error(f"❌ {script_name} çalıştırma hatası: {e}")
        return False


def main():
    now_ny = datetime.now(NY_TZ)
    log.info("=" * 60)
    log.info(f"🚀 BOGA AI Tam Otomasyon Başlatıldı — {now_ny.strftime('%Y-%m-%d %H:%M %Z')}")
    log.info("=" * 60)

    os.makedirs(os.path.join(FINMA_DIR, "logs"), exist_ok=True)

    # ── ADIM 1: DayTrade Master (v1.0) ──
    log.info("ADIM 1: daytrade_atmaca_v1.py çalıştırılıyor...")
    dt_ok = run_bot_subprocess("daytrade_atmaca_v1.py")
    if dt_ok:
        log.info("DayTrade sonuçları ara yükleme yapılıyor (Git Push)...")
        subprocess.run(["git", "add", "frontend/public/daytrade_picks.json", "frontend/public/daytrade_all_picks.json"], cwd=FINMA_DIR)
        subprocess.run(["git", "commit", "-m", f"Data: DayTrade Update {now_ny.strftime('%Y-%m-%d %H:%M')}"], cwd=FINMA_DIR)
        subprocess.run(["git", "push", "origin", "main"], cwd=FINMA_DIR)

    # ── ADIM 2: Swing Scanner (v115) ──
    log.info("ADIM 2: swing115_boga.py --oneshot (13:00 NY Bekleme Modu)...")
    run_bot_subprocess("swing115_boga.py", ["--oneshot"])

    # ── ADIM 3: daily_comprehensive_analysis.py (Sektör/Altsektör Analiz) - DISABLED BY USER REQUEST ──
    # log.info("ADIM 3: daily_comprehensive_analysis.py çalıştırılıyor...")
    # step3_ok = run_bot_subprocess("daily_comprehensive_analysis.py")
    # if not step3_ok:
    #     log.warning("⚠️ daily_comprehensive_analysis.py başarısız. Devam ediliyor...")

    # ── ADIM 4: Veri Tazeleme & Sektör/Zone Düzeltme - DISABLED BY USER REQUEST ──
    # log.info("ADIM 4: refresh_swing_data.py (Sektör ve Zone Düzeltme) çalıştırılıyor...")
    # run_bot_subprocess("refresh_swing_data.py")

    # ── ADIM 5: swing_performance (Geçmiş Performans) güncelle ──
    log.info("ADIM 5: update_swing_performance.py güncelleniyor...")
    run_bot_subprocess("update_swing_performance.py")

    # ── ADIM 5.5: inday313 tek seferlik tarama (Saatlik Bot) ──
    log.info("ADIM 5.5: inday313.py --force (Kurumsal Swing Analizi)...")
    run_bot_subprocess("inday313.py", ["--force"])

    # ── ADIM 5.7: swing_performance tekrarlarını temizle (5 günlük kural enforslama) ──
    # NOT: update_swing_performance sonrası çalışır, yeni eklenen tekrarları temizlemek için
    log.info("ADIM 5.7: fix_swing_performance.py (Tekrarlı hisseler temizleniyor)...")
    run_bot_subprocess("fix_swing_performance.py")

    # ── ADIM 5.8: fetch_live_options.py (Swing listesi için canlı opsiyon fiyatlarını çek) ──
    log.info("ADIM 5.8: fetch_live_options.py (Canlı Opsiyon Fiyatları)...")
    run_bot_subprocess("fetch_live_options.py")

    # ── ADIM 6: Multilingual AI Summaries (Kritik: Tüm diller için rapor üret) - DISABLED BY USER REQUEST ──
    # log.info("ADIM 6: update_summaries_now.py (Multilingual Reports) çalıştırılıyor...")
    # run_bot_subprocess("update_summaries_now.py")

    # ── ADIM 7: Options P&L Tracker ──
    log.info("ADIM 7: options_pnl_tracker.py (P&L Güncelle) çalıştırılıyor...")
    run_bot_subprocess("options_pnl_tracker.py")

    # ── ADIM 8: Site Health Checker (Sistem Raporu) ──
    log.info("ADIM 8: site_health_checker.py (Sağlık Raporu) çalıştırılıyor...")
    run_bot_subprocess("site_health_checker.py")

    # ── ADIM 8.5: SYSTEMATIC DATA SYNC (Kritik: transfer/latest -> frontend) ──
    log.info("ADIM 8.5: Transfer klasörü frontend'e senkronize ediliyor...")
    try:
        import shutil
        transfer_src = os.path.join(FINMA_DIR, "transfer", "latest")
        frontend_dst = os.path.join(FINMA_DIR, "frontend", "public", "data", "latest")
        if os.path.exists(transfer_src):
            os.makedirs(frontend_dst, exist_ok=True)
            for item in os.listdir(transfer_src):
                s = os.path.join(transfer_src, item)
                d = os.path.join(frontend_dst, item)
                if os.path.isdir(s):
                    if os.path.exists(d): shutil.rmtree(d)
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
            log.info("✅ Senkronizasyon başarılı.")
    except Exception as e:
        log.error(f"❌ Senkronizasyon hatası: {e}")

    # ── ADIM 9: SYSTEMATIC PRICE SYNC (Kritik: Tüm fiyatları eşitle) - DISABLED BY USER REQUEST ──
    # log.info("ADIM 9: update_all_prices.py (Fiyat Senkronizasyonu) çalıştırılıyor...")
    # run_bot_subprocess("update_all_prices.py")

    log.info("=" * 60)
    log.info("ADIM 10: Veriler GitHub'a yükleniyor (Git Push)...")
    try:
        subprocess.run(["git", "add", "."], cwd=FINMA_DIR, check=True)
        # Using a reliable date tag
        commit_msg = f"Data: Daily Master Update {now_ny.strftime('%Y-%m-%d %H:%M')}"
        # We don't check=True on commit because it fails if there are no changes
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=FINMA_DIR)
        subprocess.run(["git", "push", "origin", "main"], cwd=FINMA_DIR, check=True)
        log.info("✅ Tüm veriler GitHub'a iletildi (Vercel deploy tetiklendi).")
    except Exception as e:
        log.error(f"❌ Git Push sırasında hata oluştu: {e}")

    log.info("=" * 60)
    log.info("✅ Tüm botlar tamamlandı.")
    log.info("=" * 60)

if __name__ == "__main__":
    main()
