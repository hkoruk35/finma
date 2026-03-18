import sys
import os
import asyncio
import json
import logging
import httpx
from datetime import datetime

# Add parent directory to sys.path to import app services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.market_data import (
    get_market_regime, 
    get_sector_performance, 
    get_batch_quotes,
    get_ticker_news
)
from app.services.gemini_ai import call_gemini
from app.config import get_settings
from app.database import IntelligenceDB

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("IntelligenceBot")

INTELLIGENCE_SYSTEM_PROMPT = """Sen FinMA Baş Stratejistisin. 
Görevin, verilen piyasa verilerini analiz edip profesyonel bir "Piyasa İstihbaratı" raporu oluşturmaktır.
Yanıtın SADECE ve SADECE aşağıdaki JSON formatında olmalıdır. Hiçbir açıklama veya markdown ekleme.

{
  "regime": "Bull" | "Bear" | "Cautious",
  "regime_tr": "🐂 Boğa" | "🐻 Ayı" | "⚠️ Temkinli",
  "vix": 18.2,
  "spy_price": 5840.2,
  "spy_ema20": 5790.5,
  "sector_rotation": "Defansif Döngü" | "Büyüme Odaklı" | "Nötr",
  "sector_leaders": "Hammadde, Enerji",
  "money_flow": "Net Giriş" | "Net Çıkış" | "Stabil",
  "money_flow_details": [
    {"label": "SPY net akış", "value": "+$2.1B", "color": "text-finma-green"},
    {"label": "QQQ net akış", "value": "-$450M", "color": "text-finma-red"},
    {"label": "GLD (Altın) akışı", "value": "+$120M", "color": "text-finma-green"},
    {"label": "DXY (Dolar)", "value": "104.2", "color": "text-finma-cyan"},
    {"label": "10Y Tahvil", "value": "4.25%", "color": "text-finma-yellow"}
  ],
  "daily_summary": [
    "Madde 1...", "Madde 2...", "Madde 3...", "Madde 4...", "Madde 5...",
    "Madde 6...", "Madde 7...", "Madde 8...", "Madde 9...", "Madde 10..."
  ],
  "economic_calendar": [
    {"time": "14:30", "event": "ABD İşsizlik Başvuruları", "hot": true},
    {"time": "16:00", "event": "FED Başkanı Konuşması", "hot": true},
    {"time": "18:00", "event": "Ham Petrol Stokları", "hot": false},
    {"time": "Yarın", "event": "Tüketici Güven Endeksi", "hot": false},
    {"time": "Yarın", "event": "Üretim PMI", "hot": false},
    {"time": "Çarş.", "event": "FOMC Toplantı Tutanakları", "hot": true},
    {"time": "Perş.", "event": "GYSİH Verisi", "hot": true},
    {"time": "Cuma", "event": "Tarım Dışı İstihdam", "hot": true},
    {"time": "Pazartesi", "event": "Konut Satışları", "hot": false},
    {"time": "Salı", "event": "Bütçe Dengesi", "hot": false}
  ],
  "ai_analysis": [
    "Analiz satırı 1...", "Analiz satırı 2...", "Analiz satırı 3...", "Analiz satırı 4...", 
    "Analiz satırı 5...", "Analiz satırı 6...", "Analiz satırı 7..."
  ],
  "technical_levels": [
    ["S&P 500 Destek", "5,720 / 5,680", "text-finma-green"],
    ["S&P 500 Direnç", "5,880 / 5,920", "text-finma-red"],
    ["Nasdaq Destek", "19,800 / 19,500", "text-finma-green"],
    ["Nasdaq Direnç", "20,500 / 20,900", "text-finma-red"],
    ["Bitcoin Destek", "$62.5K / $58K", "text-finma-green"],
    ["Bitcoin Direnç", "$68K / $72K", "text-finma-red"],
    ["Altın Destek", "$2,650 / $2,620", "text-finma-green"],
    ["Altın Direnç", "$2,750 / $2,800", "text-finma-red"],
    ["Brent Petrol", "$72 / $78", "text-finma-yellow"],
    ["Gümüş Seviye", "$30.5 / $34.0", "text-finma-cyan"]
  ]
}

KURALLAR:
1. TÜM metinler (sektör isimleri dahil) kesinlikle TÜRKÇE olmalıdır.
2. daily_summary tam olarak 10 madde içermelidir.
3. ai_analysis en az 6-7 satır derinlemesine analiz içermelidir.
4. economic_calendar tam olarak 10 madde içermelidir (gerçek takvime ve bugünkü verilere dayalı).
5. technical_levels tam olarak 10 madde içermelidir.
6. money_flow_details en az 5 madde içermelidir.
7. Sayısal veriler güncel ve gerçekçi olmalıdır.
"""

async def run_intelligence_update():
    logger.info("🚀 Market Intelligence güncellemesi başlatılıyor...")
    settings = get_settings()
    
    try:
        # 1. Veri Toplama
        regime_data = get_market_regime()
        sector_data = get_sector_performance("1d")
        
        # Ek göstergeler
        extra_quotes = get_batch_quotes(["^TNX", "GC=F", "CL=F", "BTC-USD", "DX-Y.NYB"])
        
        # Haberler (Sadece SPY için genel makro haberleri gibi düşünelim)
        news = get_ticker_news("^GSPC", count=5)
        news_titles = [n['title'] for n in news] if news else []
        
        # 2. Gemini Analizi
        prompt = f"""
        Aşağıdaki verileri kullanarak piyasa raporunu hazırla:
        
        PİYASA REJİMİ: {json.dumps(regime_data)}
        SEKTÖR PERFORMANSI: {json.dumps(sector_data[:8])}
        MAKRO GÖSTERGELER: {json.dumps(extra_quotes)}
        SON HABERLER: {json.dumps(news_titles)}
        
        Lütfen tüm alanları doldur ve geçerli bir JSON döndür.
        """
        
        ai_response = await call_gemini(prompt, system_prompt=INTELLIGENCE_SYSTEM_PROMPT, model_name="gemini-2.0-flash")
        
        # JSON temizleme (Markdown bloklarını kaldır)
        json_str = ai_response.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]
        if json_str.endswith("```"):
            json_str = json_str[:-3]
        json_str = json_str.strip()
        
        try:
            payload = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"❌ Gemini geçersiz JSON döndürdü: {e}")
            logger.error(f"Ham yanıt: {ai_response}")
            return

        # 3. Push to API or Save to DB directly as fallback
        try:
            api_url = f"{settings.backend_url}/api/signals/intelligence/push"
            push_data = {
                "payload": payload,
                "api_key": settings.bot_api_key
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(api_url, json=push_data, timeout=30.0)
                if resp.status_code == 200:
                    logger.info("✅ Market Intelligence API push başarılı")
                    return
                else:
                    logger.warning(f"⚠️ API push hatası ({resp.status_code}): {resp.text}. DB'ye direkt yazılıyor...")
        except Exception as e:
            logger.warning(f"⚠️ API bağlantı hatası ({e}), DB'ye direkt yazılıyor...")

        # Fallback: Direct DB Save
        success = IntelligenceDB.save_report(payload)
        if success:
            logger.info("✅ Market Intelligence direkt DB'ye kaydedildi")
        else:
            logger.error("❌ Market Intelligence güncellemesi tamamen başarısız")

    except Exception as e:
        logger.error(f"❌ Intelligence bot kritik hata: {e}")

if __name__ == "__main__":
    asyncio.run(run_intelligence_update())
