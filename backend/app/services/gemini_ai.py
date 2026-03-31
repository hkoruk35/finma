"""
Gemini AI Service - Ported from ai_ops.py + prompts.py
Comprehensive Turkish financial AI analysis
"""

import json
import re
import logging
from typing import Optional, Dict, Any
from app.config import get_settings

logger = logging.getLogger(__name__)

# ─── System Prompts (Turkish) ───

MARKET_ANALYST_PROMPT = """Sen FinMA profesyonel finansal analiz asistanısın. Gemini AI ile güçlendirilmiş.
Her zaman Türkçe yanıt ver.

Görevlerin:
1. Teknik analiz (RSI, EMA, MACD, Bollinger, ADX, ATR)
2. Temel analiz (F/K, PEG, ROE, borç oranları)
3. Sektör analizi ve karşılaştırma
4. Risk değerlendirmesi ve portföy yönetimi
5. Piyasa rejimi değerlendirmesi (VIX bazlı)

Kurallar:
- Kısa ve öz cevaplar ver, gereksiz detaylardan kaçın
- Her yanıtta risk uyarısı ekle
- Objektif analiz yap, duygusal ifadelerden kaçın
- Sayısal veriler kullan, belirsiz ifadelerden kaçın
- Bull → Boğa, Bear → Ayı, Buy → Al, Sell → Sat, Hold → Tut terminolojisi kullan"""

STOCK_ANALYSIS_PROMPT = """Sen profesyonel bir hedge fund analisti gibi hisse senedi analizi yapıyorsun.
Verilen teknik ve temel verilere dayanarak kapsamlı bir Türkçe analiz raporu oluştur.

Rapor şu bölümleri içermeli:
1. **Genel Değerlendirme** (1-2 cümle)
2. **Teknik Görünüm** (EMA, RSI, MACD durumu)
3. **Trend Analizi** (Kısa, orta, uzun vade)
4. **Destek/Direnç Seviyeleri**
5. **Risk Faktörleri**
6. **İşlem Önerisi** (Giriş, stop-loss, hedef seviyeleri)
7. **Genel Skor** (1-10 arası, 10 = en güçlü al sinyali)

Her zaman şu uyarıyı ekle: "⚠️ Bu bir yatırım tavsiyesi değildir. Tüm analizler bilgilendirme amaçlıdır."
"""

TRADE_PARSER_PROMPT = """Sen bir trade komut çözümleyicisisin. Türkçe veya İngilizce doğal dil girdisini
yapılandırılmış trade verisine dönüştür.

Giriş örnekleri:
- "AAPL 178'den al, stop 174, hedef 195, 10 adet"
- "NVDA long 900, SL 865, TP 980"
- "BTC short 42500, stop 43500, target 40000, 0.1 adet"

JSON formatında yanıt ver:
{
  "ticker": "SEMBOL",
  "direction": "LONG/SHORT",
  "entry_price": sayı,
  "stop_loss": sayı,
  "target_price": sayı,
  "qty": sayı,
  "strategy": "SWING/DAY/SCALP/POSITION",
  "notes": "ek notlar"
}"""

RISK_AUDITOR_PROMPT = """Sen bir hedge fund baş risk yöneticisisin (CRO).
Verilen açık pozisyonları analiz et ve risk değerlendirmesi yap.

Analiz adımları:
1. Her pozisyon için Gerçekleşmemiş R hesapla: R = (Mevcut Fiyat - Giriş) / (Giriş - Stop Loss)
2. R > 1.0 ise: Stop-loss'u maliyet fiyatına çek (risk-free)
3. R > 2.0 ise: %30-50 kâr al veya trailing stop uygula
4. Teknik kontrol: Trend, RSI ayrışma, yaklaşan kazanç riski

Türkçe yanıt ver. Tablo formatında özet sun."""


# ─── Core Functions ───

async def call_gemini(
    prompt: str,
    system_prompt: str = MARKET_ANALYST_PROMPT,
    model_name: str = "gemini-2.0-flash",
) -> str:
    """Call Gemini AI API - Runs in thread pool to avoid blocking event loop"""
    settings = get_settings()
    if not settings.gemini_api_key:
        return "⚠️ Gemini API anahtarı yapılandırılmamış. Ayarlar bölümünden ekleyin."

    try:
        import google.generativeai as genai
        import asyncio
        from concurrent.futures import TimeoutError as FuturesTimeoutError

        def _call_gemini_sync():
            """Synchronous Gemini API call"""
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt,
            )
            response = model.generate_content(prompt, request_options={"timeout": 60})
            return response.text if response else ""

        # Run in thread pool to not block event loop
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, _call_gemini_sync),
            timeout=70  # 70 second timeout (includes Gemini's 60 second timeout)
        )
        return result
    except asyncio.TimeoutError:
        logger.error(f"Gemini API timeout - request exceeded 70 seconds")
        return "⚠️ Gemini API timeout - çeviri işlemi çok uzun sürdü"
    except Exception as e:
        logger.error(f"Gemini AI hatası: {e}")
        return f"AI yanıt hatası: {str(e)}"


async def analyze_stock(ticker: str, tech_data: Dict[str, Any], info: Dict[str, Any]) -> str:
    """Comprehensive stock analysis using Gemini"""
    prompt = f"""
{ticker} hissesi için kapsamlı analiz yap.

TEKNIK VERİLER:
- Fiyat: ${tech_data.get('price', 0):.2f}
- Trend: {tech_data.get('trend', 'Bilinmiyor')}
- RSI(14): {tech_data.get('indicators', {}).get('rsi', 'N/A')}
- EMA20: {tech_data.get('indicators', {}).get('ema20', 'N/A')}
- EMA50: {tech_data.get('indicators', {}).get('ema50', 'N/A')}
- EMA200: {tech_data.get('indicators', {}).get('ema200', 'N/A')}
- MACD: {tech_data.get('indicators', {}).get('macd', 'N/A')}
- ADX: {tech_data.get('indicators', {}).get('adx', 'N/A')}
- ATR: {tech_data.get('indicators', {}).get('atr', 'N/A')}
- RVOL: {tech_data.get('indicators', {}).get('rvol', 'N/A')}
- CMF: {tech_data.get('indicators', {}).get('cmf', 'N/A')}
- Bollinger %B: {tech_data.get('indicators', {}).get('bollinger_pctb', 'N/A')}
- Destek: {tech_data.get('levels', {}).get('support', 'N/A')}
- Direnç: {tech_data.get('levels', {}).get('resistance', 'N/A')}

TEMEL VERİLER:
- Şirket: {info.get('name', ticker)}
- Sektör: {info.get('sector', 'N/A')}
- Piyasa Değeri: {info.get('market_cap', 'N/A')}
- F/K: {info.get('pe_ratio', 'N/A')}
- İleri F/K: {info.get('forward_pe', 'N/A')}
- PEG: {info.get('peg_ratio', 'N/A')}
- ROE: {info.get('roe', 'N/A')}
- Temettü Verimi: {info.get('dividend_yield', 'N/A')}
- Borç/Özsermaye: {info.get('debt_to_equity', 'N/A')}
- Beta: {info.get('beta', 'N/A')}
- Analist Hedef: {info.get('target_mean', 'N/A')}
- Analist Sayısı: {info.get('analyst_count', 'N/A')}
- Kurumsal Sahiplik: {info.get('institutional_pct', 'N/A')}
"""
    return await call_gemini(prompt, STOCK_ANALYSIS_PROMPT)


async def analyze_market_summary(regime_data: Dict, sector_data: list) -> str:
    """Generate daily market summary"""
    sectors_text = "\n".join(
        f"- {s['sector_tr']}: {s['change_pct']:+.2f}%" for s in sector_data[:5]
    ) if sector_data else "Veri yok"

    prompt = f"""Bugünkü piyasa durumunu özetle:

PİYASA REJİMİ: {regime_data.get('regime_tr', 'Bilinmiyor')}
VIX: {regime_data.get('vix', 'N/A')}
S&P 500: {regime_data.get('spy_price', 'N/A')}

SEKTÖR LİDERLERİ:
{sectors_text}

Kısa ve öz bir günlük piyasa özeti oluştur (5-8 madde).
"""
    return await call_gemini(prompt)


async def parse_trade_command(text: str) -> Optional[Dict]:
    """Parse natural language trade command to structured JSON"""
    response = await call_gemini(text, TRADE_PARSER_PROMPT)
    try:
        # Extract JSON from response (handle markdown formatting)
        json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(response)
    except (json.JSONDecodeError, AttributeError):
        logger.warning(f"Trade komutu parse edilemedi: {response[:200]}")
        return None


async def audit_positions(positions: list) -> str:
    """Audit open positions for risk management"""
    pos_text = "\n".join(
        f"- {p.get('ticker')}: Yön={p.get('direction')}, Giriş=${p.get('entry_price')}, "
        f"Mevcut=${p.get('current_price')}, Stop=${p.get('stop_loss')}, "
        f"Hedef=${p.get('target_price')}, Adet={p.get('qty')}"
        for p in positions
    )

    prompt = f"""Aşağıdaki açık pozisyonları denetle:

{pos_text}

Her pozisyon için:
1. R değerini hesapla
2. Risk durumunu değerlendir
3. Aksiyon öner (Tut / Kâr Al / Stop Güncelle / Kapat)
"""
    return await call_gemini(prompt, RISK_AUDITOR_PROMPT)


async def summarize_news_turkish(title: str, description: str = "") -> str:
    """Haber başlığını Türkçe 1 cümleyle özetle (Gemini Flash)"""
    settings = get_settings()
    if not settings.gemini_api_key:
        return ""
    text = f"{title}. {description}".strip(". ")
    prompt = f"""Aşağıdaki İngilizce finans haberini tek cümlelik, akıcı Türkçe bir özet olarak çevir.
Sadece Türkçe özeti yaz, başka açıklama ekleme.

Haber: {text[:400]}"""
    try:
        result = await call_gemini(prompt, "Sen finans haberi çevirmenisin.", "gemini-2.0-flash")
        return result.strip()[:300] if result and not result.startswith("⚠️") else ""
    except Exception:
        return ""


async def summarize_news_batch(items: list) -> list:
    """Birden fazla haberi toplu olarak Türkçe özetle. items: [{title, description, ...}]"""
    import asyncio
    async def do_one(item: dict) -> dict:
        if item.get("lang") == "tr":
            return item  # Zaten Türkçe, skip
        summary = await summarize_news_turkish(item.get("title", ""), item.get("description", ""))
        if summary:
            # Doğrudan title alanını ez, böylece UI tam Türkçe görür
            item = {**item, "title": summary, "lang": "tr"}
        return item

    tasks = [do_one(item) for item in items]
    return list(await asyncio.gather(*tasks))
