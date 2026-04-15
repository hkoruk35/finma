import json
import os
import yfinance as yf
from datetime import datetime, timedelta
import asyncio
import aiohttp
from zoneinfo import ZoneInfo
import glob
import logging

# Yapilandirma
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
NY_TZ = ZoneInfo("America/New_York")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Logs dizini oluştur
os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(
            os.path.join(os.path.dirname(__file__), "logs", "site_health_checker.log"),
            encoding="utf-8"
        ),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger("site_health_checker")

# Dosya Yollari
FILES = {
    "Homepage (Master)": "frontend/public/master.json",
    "Swing Picks": "frontend/public/swing_all_picks.json",
    "Performance": "frontend/public/swing_performance.json",
    "Sectors": "frontend/public/sectors.json",
    "Sector Analysis": "transfer/latest/sector_analysis.json",
    "Ticker Analysis": "transfer/latest/ticker_analysis.json",
}

async def send_telegram(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                return await resp.json()
    except Exception as e:
        print(f"Telegram Hatasi: {e}")

def get_file_stats(path):
    """Dosya istatistiklerini al - doğru kayıt sayısını say"""
    full_path = os.path.join(BASE_DIR, path)
    if not os.path.exists(full_path):
        return "❌ Bulunamadı", 0

    mtime = os.path.getmtime(full_path)
    dt_mtime = datetime.fromtimestamp(mtime, tz=NY_TZ)
    age_hours = (datetime.now(NY_TZ) - dt_mtime).total_seconds() / 3600

    try:
        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            data = json.load(f)
            count = 0

            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                # Master.json
                if 'top_3_overall' in data:
                    count = len(data.get('top_3_overall', []))
                    count += len(data.get('sector_summary', {}))
                # Swing picks
                elif 'picks' in data:
                    count = len(data.get('picks', []))
                # Performance (history)
                elif 'history' in data:
                    count = len(data.get('history', []))
                # Sectors.json
                elif 'sectors' in data and 'date' in data:
                    count = len(data.get('sectors', {}))
                # Sector Analysis (transfer/latest)
                elif 'analysis_by_sector' in data:
                    count = data.get('total_tickers', 0)
                # Ticker Analysis (transfer/latest)
                elif 'analysis_by_ticker' in data:
                    count = data.get('total_tickers', 0)
                # All tickers list
                elif isinstance(data, list):
                    count = len(data)
                # Fallback: nested structure
                else:
                    for sector, subsectors in data.items():
                        if isinstance(subsectors, dict):
                            for subsector, tickers in subsectors.items():
                                if isinstance(tickers, list):
                                    count += len(tickers)

            # Yaş kontrolü
            if age_hours > 48:
                status = f"🔴 ESKİ ({age_hours:.1f}h)"
            elif age_hours > 24:
                status = f"🟠 TARİH ({age_hours:.1f}h)"
            else:
                status = f"✅ TAZE ({age_hours:.1f}h)"

            return f"{status} | {dt_mtime.strftime('%H:%M')} | {count} Kayıt", count
    except Exception as e:
        log.error(f"File stats error for {path}: {e}")
        return f"⚠️ Hata: {str(e)[:30]}", 0

def check_detail_pages():
    """Hisse detay sayfalarını kontrol et"""
    data_dir = os.path.join(BASE_DIR, "frontend/public/data/*.json")
    files = glob.glob(data_dir)
    if not files:
        return "❌ Analiz Dosyası Yok", 0

    # En son guncellenen 1 dosyaya bak
    latest_file = max(files, key=os.path.getmtime)
    mtime = os.path.getmtime(latest_file)
    dt_mtime = datetime.fromtimestamp(mtime, tz=NY_TZ)
    age_hours = (datetime.now(NY_TZ) - dt_mtime).total_seconds() / 3600

    status = "✅" if age_hours < 25 else "⚠️"
    return f"{status} {len(files)} Analiz (Son: {dt_mtime.strftime('%d %b %H:%M')})", len(files)

async def check_price_sync():
    """Swing picks fiyatlarını canlı fiyatlarla senkronize et"""
    try:
        path = os.path.join(BASE_DIR, FILES["Swing Picks"])
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if not data.get('picks'):
                return "⚠️ Picks Listesi Boş"

            # İlk 3 pick'i kontrol et
            synced = 0
            errors = 0

            for pick in data['picks'][:3]:
                try:
                    ticker = pick.get('ticker')
                    list_price = pick.get('current_price', 0)

                    live = yf.Ticker(ticker).history(period="1d")
                    if len(live) == 0:
                        errors += 1
                        continue

                    live_price = round(float(live['Close'].iloc[-1]), 2)
                    diff = abs(live_price - list_price)

                    if diff < 1.0:
                        synced += 1
                except:
                    errors += 1

            if errors > 0:
                return f"⚠️ Fiyat Kontrolü: {synced} Senkronize (⚠️ {errors} Hata)"
            return f"✅ Fiyat Senkronu: {synced}/3 Tamam"
    except Exception as e:
        log.error(f"Price sync error: {e}")
        return "❌ Fiyat Kontrolü Hatası"

def check_bot_logs():
    """Son 24 saatteki bot hatalarını kontrol et"""
    logs_dir = os.path.join(BASE_DIR, "logs")
    if not os.path.exists(logs_dir):
        return "⚠️ Log dizini yok", 0

    error_count = 0
    warning_count = 0
    recent_logs = []

    # Log dosyalarında sadece [ERROR] ve [WARNING] token'ları ara
    for log_file in glob.glob(os.path.join(logs_dir, "*.log")):
        try:
            mtime = os.path.getmtime(log_file)
            age_hours = (datetime.now() - datetime.fromtimestamp(mtime)).total_seconds() / 3600

            if age_hours < 24:
                recent_logs.append(os.path.basename(log_file))
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        # Sadece log format'ında olan gerçek ERROR/WARNING'leri say
                        if "[ERROR]" in line:
                            error_count += 1
                        elif "[WARNING]" in line:
                            warning_count += 1
        except:
            pass

    if error_count > 0:
        return f"❌ {error_count} Hata Bulundu", error_count
    elif warning_count > 0:
        return f"⚠️ {warning_count} Uyarı", warning_count
    else:
        return f"✅ 0 Hata ({len(recent_logs)} log)", 0

async def check_main_pages():
    """Ana sayfaların erişilebilirliğini kontrol et"""
    pages = {
        "Ana Sayfa": "https://bogastock.com/",
        "Swing Picks": "https://bogastock.com/swing-picks",
        "Swing Performance": "https://bogastock.com/swing-performance",
        "Sektör": "https://bogastock.com/sector/technology",
        "Hisse Detay": "https://bogastock.com/stock/AAPL",
    }

    working = 0
    failed_pages = []

    for name, url in pages.items():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10), ssl=False) as resp:
                    if 200 <= resp.status < 400:
                        working += 1
                    else:
                        failed_pages.append(f"{name} ({resp.status})")
        except Exception as e:
            failed_pages.append(f"{name} (error)")

    status = "✅" if working == len(pages) else "⚠️" if working >= len(pages) - 1 else "❌"
    result = f"{status} {working}/{len(pages)} Sayfa Aktif"

    if failed_pages:
        result += f" | Sorunlu: {', '.join(failed_pages[:2])}"

    return result

def check_chart_data_consistency():
    """Grafik ve hisse analiz verilerinin tutarlılığını kontrol et"""
    issues = []

    try:
        # Master ve Sector Analysis'i karşılaştır
        master_path = os.path.join(BASE_DIR, FILES["Homepage (Master)"])
        sector_path = os.path.join(BASE_DIR, FILES["Sector Analysis"])

        if os.path.exists(master_path) and os.path.exists(sector_path):
            with open(master_path, 'r', encoding='utf-8') as f:
                master = json.load(f)
            with open(sector_path, 'r', encoding='utf-8') as f:
                sectors = json.load(f)

            # Eğer hisse sayıları çok farklıysa uyar
            master_stocks = len(master.get('stocks', {}))
            sector_stocks = sum(
                len(tickers) if isinstance(tickers, list) else 0
                for subsectors in sectors.values()
                if isinstance(subsectors, dict)
                for tickers in subsectors.values()
            )

            if abs(master_stocks - sector_stocks) > 50:
                issues.append(f"Hisse sayısı uyumsuz: Master={master_stocks}, Sectors={sector_stocks}")
    except Exception as e:
        issues.append(f"Kontrol hatası: {str(e)[:40]}")

    return f"{'✅' if not issues else '⚠️'} Veri Tutarlılığı", issues

def check_member_stats():
    """Üye istatistiklerini kontrol et"""
    # Not: Üye verisi veritabanında veya ayrı API endpoint'de
    # Master.json'da şu anda üye verisi bulunmuyor

    return "⚠️ API entegrasyonu bekleniyor (DB sorgusu gerekli)"

async def main():
    now_ny = datetime.now(NY_TZ)
    report = [
        f"<b>🔍 BOGA AI 2 SAATLİK SİSTEM SAĞLIK RAPORU</b>",
        f"📅 {now_ny.strftime('%Y-%m-%d %H:%M')} NY",
        f"{'=' * 50}",
    ]

    os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

    # 1. TEMEL VERİ AKIŞI
    report.append("<b>📊 1. TEMEL VERİ AKIŞI:</b>")
    files_ok = True
    for name, path in FILES.items():
        status, count = get_file_stats(path)
        report.append(f"• {name}: {status}")
        if "❌" in status:
            files_ok = False
        if count > 0:
            report.append(f"  └─ {count} kayıt")

    # 2. BOT LOGLARI
    report.append(f"\n<b>🤖 2. BOT ÇALIŞMA DURUMU:</b>")
    log_status, error_count = check_bot_logs()
    report.append(f"• {log_status}")
    if error_count > 0:
        report.append(f"  └─ ⚠️ {error_count} hata/uyarı bulundu")

    # 3. HİSSE DETAY SAYFALARI
    report.append(f"\n<b>📄 3. HİSSE DETAY SAYFALARI:</b>")
    detail_status, detail_count = check_detail_pages()
    report.append(f"• {detail_status}")

    # 4. SEKTÖR ANALİZİ
    report.append(f"\n<b>📈 4. SEKTÖR ANALİZİ:</b>")
    sector_status, sector_count = get_file_stats(FILES["Sectors"])
    report.append(f"• {sector_status}")
    if sector_count > 5:
        report.append(f"  └─ ✅ {sector_count} sektör hazır")
    else:
        report.append(f"  └─ ⚠️ {sector_count} sektör (eksik olabilir)")

    # 5. VERİ TUTARLILUĞU
    report.append(f"\n<b>🔗 5. VERİ TUTARLILUĞU & GRAFİK DOĞRULMASI:</b>")
    consistency_status, consistency_issues = check_chart_data_consistency()
    report.append(f"• {consistency_status}")
    for issue in consistency_issues[:2]:
        report.append(f"  └─ {issue}")

    # 6. FİYAT SİNCHRONİZASYONU
    report.append(f"\n<b>⚡ 6. CANLI FİYAT SİNCHRONİZASYONU:</b>")
    price_status = await check_price_sync()
    report.append(f"• {price_status}")

    # 7. ANA SAYFALAR ERİŞİM
    report.append(f"\n<b>🌐 7. SAYFA ERİŞİLEBİLİRLİĞİ:</b>")
    page_status = await check_main_pages()
    report.append(f"• {page_status}")

    # 8. ÜYE İSTATİSTİKLERİ
    report.append(f"\n<b>👥 8. ÜYE İSTATİSTİKLERİ:</b>")
    member_status = check_member_stats()
    report.append(f"• {member_status}")

    # DURUM ÖZETİ
    report.append(f"\n{'=' * 50}")
    full_text = "\n".join(report)

    if "❌" in full_text:
        report.append("<b>🚨 SİSTEM DURUMU: KRİTİK HATA!</b>")
    elif "⚠️" in full_text:
        report.append("<b>⚠️ SİSTEM DURUMU: TAMİNKAR (İNCELEME GEREKLİ)</b>")
    else:
        report.append("<b>🌟 SİSTEM DURUMU: MÜKEMMEL!</b>")

    full_message = "\n".join(report)

    # Logla ve Telegram'a gönder
    log.info(full_message)
    await send_telegram(full_message)

if __name__ == "__main__":
    asyncio.run(main())
