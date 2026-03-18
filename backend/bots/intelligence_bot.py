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
  "sector_leaders": "Teknoloji, Finans",
  "money_flow": "Net Giriş" | "Net Çıkış" | "Stabil",
  "money_flow_details": [
    {"label": "SPY net akış", "value": "+$2.1B", "color": "text-finma-green"},
    {"label": "QQQ net akış", "value": "-$450M", "color": "text-finma-red"},
    {"label": "DXY (Dolar)", "value": "104.2", "color": "text-finma-cyan"}
  ],
  "daily_summary": [
    "Piyasalar güçlü açıldı, Teknoloji sektörü liderlik ediyor.",
    "Altın güvenli liman talebiyle yükselişte."
  ],
  "economic_calendar": [
    {"time": "14:30", "event": "ABD İşsizlik Başvuruları", "hot": true},
    {"time": "16:00", "event": "FED Başkanı Konuşması", "hot": true}
  ],
  "ai_analysis": [
    "Genel yön pozitif, ancak VIX 20 üzerinde dikkat gerektiriyor.",
    "Kurumsal para girişi NVDA ve MSFT'de yoğunlaşıyor."
  ],
  "technical_levels": [
    ["S&P 500 Destek", "5,720 / 5,680", "text-finma-green"],
    ["S&P 500 Direnç", "5,880 / 5,920", "text-finma-red"],
    ["Bitcoin Destek/Direnç", "$62.5K / $68K", "text-finma-cyan"]
  ]
}

- Tüm metinler Türkçe olmalı.
- Sayısal veriler gerçekçi ve verilen verilere dayalı olmalı.
- Teknik seviyeleri güncel S&P 500 ve Bitcoin fiyatına göre mantıklı aralıklarda belirle.
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

        # 3. Push to API
        api_url = f"{settings.backend_url}/api/signals/intelligence/push"
        
        push_data = {
            "payload": payload,
            "api_key": settings.bot_api_key
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(api_url, json=push_data)
            if resp.status_code == 200:
                logger.info("✅ Market Intelligence başarıyla güncellendi")
            else:
                logger.error(f"❌ API push hatası ({resp.status_code}): {resp.text}")
                
    except Exception as e:
        logger.error(f"❌ Kritik hata: {e}")

if __name__ == "__main__":
    asyncio.run(run_intelligence_update())
