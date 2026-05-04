import json
import os
import yfinance as yf
from datetime import datetime, timedelta
import asyncio
import aiohttp
from zoneinfo import ZoneInfo
import glob
import logging
import psutil
import shutil
import subprocess

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

# Script Ownership Map
SCRIPT_OWNERS = {
    "Swing Picks": "swing114_boga.py",
    "Options Picks": "opsiyon218v8.py",
    "Swing Performance": "update_swing_performance.py",
    "Options Performance": "options_pnl_tracker.py",
}

# Dosya Yollari
FILES = {
    "Swing Picks": "frontend/public/swing_all_picks.json",
    "Options Picks": "frontend/public/data/latest/options_picks.json",
    "Swing Performance": "frontend/public/swing_performance.json",
    "Options Performance": "frontend/public/data/latest/options_outcomes.json",
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
    filename = next((k for k, v in FILES.items() if v == path), "Bilinmeyen")
    owner_script = SCRIPT_OWNERS.get(filename, "Bilinmeyen")

    if not os.path.exists(full_path):
        return f"❌ Bulunamadı (Sorumlu: {owner_script})", 0

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
                # Master.json / all_tickers_list
                if 'top_3_overall' in data:
                    count = len(data.get('top_3_overall', []))
                elif 'picks' in data:
                    count = len(data.get('picks', []))
                elif 'history' in data:
                    count = len(data.get('history', []))
                elif 'sectors' in data:
                    count = len(data.get('sectors', {}))
                elif 'analysis_by_sector' in data:
                    count = data.get('total_tickers', 0)
                elif 'analysis_by_ticker' in data:
                    count = data.get('total_tickers', 0)
                else:
                    # Fallback for nested dicts
                    count = len(data)

            # Yaş kontrolü
            if age_hours > 48:
                status = f"🔴 KRİTİK ESKİ ({age_hours:.1f}h)"
            elif age_hours > 24:
                status = f"🟠 GÜNCEL DEĞİL ({age_hours:.1f}h)"
            else:
                status = f"✅ TAZE ({age_hours:.1f}h)"

            return f"{status} | {dt_mtime.strftime('%H:%M')} | {count} Kayıt | Sorumlu: {owner_script}", count
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
    """Son 24 saatteki bot hatalarını kontrol et ve detaylandır"""
    logs_dir = os.path.join(BASE_DIR, "logs")
    if not os.path.exists(logs_dir):
        return "⚠️ Log dizini yok", 0, []

    error_count = 0
    warning_count = 0
    recent_errors = []
    today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")

    for log_file in glob.glob(os.path.join(logs_dir, "*.log")):
        try:
            mtime = os.path.getmtime(log_file)
            age_hours = (datetime.now() - datetime.fromtimestamp(mtime)).total_seconds() / 3600

            if age_hours < 24:
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    file_lines = f.readlines()
                    for line in file_lines[-500:]: # Son 500 satıra bak
                        if today_str not in line: continue
                        
                        if "[ERROR]" in line:
                            error_count += 1
                            if len(recent_errors) < 5:
                                recent_errors.append(f"{os.path.basename(log_file)}: {line.strip()[:80]}...")
                        elif "[WARNING]" in line:
                            warning_count += 1
        except:
            pass

    if error_count > 0:
        return f"❌ {error_count} Hata Bulundu", error_count, recent_errors
    elif warning_count > 0:
        return f"⚠️ {warning_count} Uyarı", warning_count, []
    else:
        return "✅ 0 Hata", 0, []

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

# (Deleted obsolete consistency and member stats functions)

def check_system_resources():
    """Sistem kaynaklarını kontrol et"""
    cpu_usage = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = shutil.disk_usage("/")
    
    cpu_status = "✅" if cpu_usage < 80 else "⚠️" if cpu_usage < 90 else "❌"
    mem_status = "✅" if memory.percent < 85 else "⚠️" if memory.percent < 95 else "❌"
    disk_free_gb = disk.free / (1024**3)
    disk_status = "✅" if disk_free_gb > 10 else "⚠️" if disk_free_gb > 5 else "❌"
    
    return [
        f"• CPU: {cpu_status} %{cpu_usage}",
        f"• RAM: {mem_status} %{memory.percent}",
        f"• Disk Boş: {disk_status} {disk_free_gb:.1f} GB"
    ]

def check_bot_processes():
    """Kritik bot süreçlerini kontrol et"""
    critical_bots = ["opsiyon218v8.py", "inday313.py", "swing114_boga.py", "options_pnl_tracker.py"]
    running_bots = []
    
    # Get all python processes
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if cmdline and any("python" in arg.lower() for arg in cmdline):
                full_cmd = " ".join(cmdline)
                for bot in critical_bots:
                    if bot in full_cmd:
                        running_bots.append(bot)
        except:
            continue
            
    results = []
    for bot in critical_bots:
        status = "🟢 ÇALIŞIYOR" if bot in running_bots else "⚪ BEKLEMEDE"
        results.append(f"• {bot}: {status}")
    return results

async def main():
    import sys
    is_daily = "--daily" in sys.argv or datetime.now(NY_TZ).hour == 6
    
    now_ny = datetime.now(NY_TZ)
    title = "🔍 BOGA AI GÜNLÜK DETAYLI SİSTEM SAĞLIK RAPORU" if is_daily else "🔍 BOGA AI 2 SAATLİK SİSTEM SAĞLIK RAPORU"
    
    report = [
        f"<b>{title}</b>",
        f"📅 {now_ny.strftime('%Y-%m-%d %H:%M')} NY",
        f"{'=' * 50}",
    ]

    os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)

    # 0. SİSTEM KAYNAKLARI
    report.append("<b>💻 0. SİSTEM KAYNAKLARI:</b>")
    report.extend(check_system_resources())

    # 1. BOT SÜREÇLERİ
    report.append(f"\n<b>🤖 1. BOT DURUMU (ACTIVE):</b>")
    report.extend(check_bot_processes())

    # 2. TEMEL VERİ AKIŞI
    report.append("\n<b>📊 2. TEMEL VERİ AKIŞI:</b>")
    files_ok = True
    for name, path in FILES.items():
        status, count = get_file_stats(path)
        report.append(f"• {name}: {status}")
        if "❌" in status or "🔴" in status:
            files_ok = False
        if count > 0:
            report.append(f"  └─ {count} kayıt")

    # 2. BOT LOGLARI
    report.append(f"\n<b>🤖 2. BOT ÇALIŞMA DURUMU:</b>")
    log_status, error_count, error_snippets = check_bot_logs()
    report.append(f"• {log_status}")
    if error_count > 0:
        report.append(f"  └─ ⚠️ {error_count} hata/uyarı bulundu")
        if is_daily or error_count > 0:
            for snip in error_snippets:
                report.append(f"     ⚠️ {snip}")

    # 3. HİSSE DETAY SAYFALARI
    report.append(f"\n<b>📄 3. HİSSE DETAY SAYFALARI:</b>")
    detail_status, detail_count = check_detail_pages()
    report.append(f"• {detail_status}")

    # 4. FİYAT SİNCHRONİZASYONU
    report.append(f"\n<b>⚡ 4. CANLI FİYAT SİNCHRONİZASYONU:</b>")
    price_status = await check_price_sync()
    report.append(f"• {price_status}")

    # 5. ANA SAYFALAR ERİŞİM
    report.append(f"\n<b>🌐 5. SAYFA ERİŞİLEBİLİRLİĞİ:</b>")
    page_status = await check_main_pages()
    report.append(f"• {page_status}")

    # DURUM ÖZETİ
    report.append(f"\n{'=' * 50}")
    full_text = "\n".join(report)

    if "❌" in full_text or "🔴" in full_text:
        report.append("<b>🚨 SİSTEM DURUMU: KRİTİK HATA!</b>")
    elif "⚠️" in full_text:
        report.append("<b>⚠️ SİSTEM DURUMU: TAMİNKAR (İNCELEME GEREKLİ)</b>")
    else:
        report.append("<b>🌟 SİSTEM DURUMU: MÜKEMMEL!</b>")

    full_message = "\n".join(report)
    log.info(full_message)
    await send_telegram(full_message)

if __name__ == "__main__":
    asyncio.run(main())
