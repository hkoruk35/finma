import time
import subprocess
import logging
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)

NY_TZ = ZoneInfo("America/New_York")

def run_performance_update():
    """Saatlik performance güncellemesi"""
    logging.info("🚀 Saatlik performance güncellemesi başlatılıyor...")
    try:
        result = subprocess.run([sys.executable, "update_swing_performance.py"], capture_output=True, text=True)
        if result.returncode == 0:
            logging.info("✅ Performance güncellemesi başarıyla tamamlandı.")
            logging.info(result.stdout)
        else:
            logging.error(f"❌ Performance güncellemesi başarısız: {result.returncode}")
            logging.error(result.stderr)
    except Exception as e:
        logging.error(f"❌ Performance güncellemesi hatası: {e}")

def run_health_monitor():
    """2 saatlik sistem sağlığı kontorü"""
    logging.info("🔍 2 SAATLİK SİSTEM SAĞLIK KONTORÜ BAŞLATILDI")
    try:
        result = subprocess.run([sys.executable, "site_health_checker.py"], capture_output=True, text=True)
        if result.returncode == 0:
            logging.info("✅ Sistem sağlığı kontrolü tamamlandı.")
            if result.stdout:
                logging.info(result.stdout[:500])  # İlk 500 char'ı logla
        else:
            logging.error(f"❌ Sistem sağlığı kontrolü başarısız: {result.returncode}")
            logging.error(result.stderr[:500])
    except Exception as e:
        logging.error(f"❌ Sistem sağlığı kontrolü hatası: {e}")

def get_next_2h_interval():
    """Sonraki 2 saatlik aralığı hesapla"""
    now = datetime.now(NY_TZ)
    current_hour = now.hour

    # 2 saatlik aralıklar: 0:00, 2:00, 4:00, 6:00, ...
    next_hour = ((current_hour // 2) + 1) * 2
    if next_hour >= 24:
        next_hour = 0

    return next_hour

def main():
    logging.info("=" * 60)
    logging.info("🤖 BOGA AI 2 SAATLİK KONTROL BOTu BAŞLATILDI")
    logging.info("=" * 60)

    counter = 0
    while True:
        now = datetime.now(NY_TZ)
        counter += 1

        # Her 2 saatte bir sistem kontorü çalıştır
        if counter % 2 == 0:
            logging.info(f"\n[{counter}] ▶ 2 SAATLİK SISTEM SAĞLIK KONTORÜ (Her 2 saat)")
            run_health_monitor()
        else:
            # Diğer saatlerde performance güncellemesi
            logging.info(f"\n[{counter}] ▶ SAATLIK PERFORMANCE GÜNCELLEMESI (Her saat)")
            run_performance_update()

        # Sonraki çalışmaya kadar bekle (1 saat)
        logging.info(f"😴 Sonraki kontrol: {(datetime.now(NY_TZ) + timedelta(hours=1)).strftime('%H:%M')} (1 saat sonra)")
        time.sleep(3600)

if __name__ == "__main__":
    from datetime import timedelta
    main()
