import json
import os
import yfinance as yf
from datetime import datetime
import asyncio
import aiohttp
from zoneinfo import ZoneInfo
import glob

# Yapilandirma
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
NY_TZ = ZoneInfo("America/New_York")

# Dosya Yollari
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FILES = {
    "Homepage (Master)": "frontend/public/master.json",
    "Swing Picks": "frontend/public/swing_all_picks.json",
    "Performance": "frontend/public/swing_performance.json",
    "Sectors": "frontend/public/sectors.json"
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
    full_path = os.path.join(BASE_DIR, path)
    if not os.path.exists(full_path):
        return "❌ Bulunamadı", 0
    
    mtime = os.path.getmtime(full_path)
    dt_mtime = datetime.fromtimestamp(mtime, tz=NY_TZ)
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list): count = len(data)
            elif isinstance(data, dict): count = len(data.get('picks', data.get('performance_log', data.get('stocks', []))))
            else: count = 0
            return f"✅ {dt_mtime.strftime('%H:%M')} | {count} Kayıt", count
    except:
        return "⚠️ Hatalı Format", 0

def check_detail_pages():
    data_dir = os.path.join(BASE_DIR, "frontend/public/data/*.json")
    files = glob.glob(data_dir)
    if not files:
        return "❌ Analiz Dosyası Yok"
    
    # En son guncellenen 1 dosyaya bak
    latest_file = max(files, key=os.path.getmtime)
    mtime = os.path.getmtime(latest_file)
    dt_mtime = datetime.fromtimestamp(mtime, tz=NY_TZ)
    return f"✅ {len(files)} Analiz Hazır (Son: {dt_mtime.strftime('%d %b %H:%M')})"

async def check_price_sync():
    try:
        path = os.path.join(BASE_DIR, FILES["Swing Picks"])
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if not data.get('picks'): return "⚠️ Liste Boş"
            first_pick = data['picks'][0]
            ticker = first_pick['ticker']
            list_price = first_pick['current_price']
            
            live = yf.Ticker(ticker).history(period="1d")
            live_price = round(float(live['Close'].iloc[-1]), 2)
            diff = abs(live_price - list_price)
            if diff < 0.25:
                return f"✅ Fiyat Senkronu: Tamam ({ticker})"
            else:
                return f"⚠️ Fiyat Farkı: ${diff:.2f} ({ticker})"
    except:
        return "❌ Fiyat Kontrolü Hatası"

async def main():
    now_ny = datetime.now(NY_TZ)
    report = [
        f"<b>🔍 BOGA AI SİSTEM DERİNLİKLİ SAĞLIK RAPORU</b>",
        f"📅 {now_ny.strftime('%Y-%m-%d %H:%M')} NY",
        f"────────────────",
    ]
    
    # 1. Ana Dosyalar
    report.append("<b>📊 TEMEL VERİ AKIŞI:</b>")
    for name, path in FILES.items():
        status, _ = get_file_stats(path)
        report.append(f"• {name}: {status}")
    
    # 2. Detay Sayfalari
    report.append(f"\n<b>📄 HİSSE DETAY SAYFALARI:</b>")
    report.append(f"• {check_detail_pages()}")

    # 3. Sektor Isı Haritası Kontrolü
    report.append(f"\n<b>🌡️ SEKTÖR ISI HARİTASI:</b>")
    _, sector_count = get_file_stats(FILES["Sectors"])
    if sector_count > 5:
        report.append(f"• ✅ Isı Haritası Aktif ({sector_count} Sektör)")
    else:
        report.append(f"• ⚠️ Isı Haritası Verisi Eksik")

    # 4. Fiyat Senkronu
    report.append(f"\n<b>⚡ CANLI VERİ SENKRONİZASYONU:</b>")
    report.append(f"• {await check_price_sync()}")
    
    report.append(f"────────────────")
    
    # Durum Ozeti
    if "❌" in "".join(report):
        report.append("🚨 <b>SİSTEM DURUMU:</b> KRİTİK HATA!")
    elif "⚠️" in "".join(report):
        report.append("⚠️ <b>SİSTEM DURUMU:</b> İNCELEME GEREKİR")
    else:
        report.append("🌟 <b>SİSTEM DURUMU:</b> MÜKEMMEL")

    full_message = "\n".join(report)
    await send_telegram(full_message)

if __name__ == "__main__":
    asyncio.run(main())
