"""
Gemini AI Service - Ported from ai_ops.py + prompts.py
Comprehensive multilingual financial AI analysis with regional norms
V6+ Architecture: Language-aware prompts + REGION_NORMS injection
"""

import json
import re
import logging
from typing import Optional, Dict, Any, Literal
from app.config import get_settings

logger = logging.getLogger(__name__)

# ─── Region Norms: Language-specific financial culture & tone ───

Locale = Literal['tr', 'en', 'es', 'pt-BR', 'de', 'fr', 'id', 'ms']

REGION_NORMS: Dict[Locale, Dict[str, str]] = {
    'tr': {
        'tone': 'Kazanç odaklı, akademik rigor, Türk piyasası psikolojisi',
        'terminology': 'Hisse (stocks), Endüstri (industry), Temettü (dividend)',
        'number_format': '1.250,50 (AB-stili)',
        'currency_symbol': '₺',
        'financial_culture': 'Muhafazakar, uzun vadeli servet birikimi odaklı',
        'risk_appetite': 'Orta - dengeli analiz',
        'language': 'Türkçe',
    },
    'en': {
        'tone': 'Professional, analytical, global market standards',
        'terminology': 'Stock, Industry, Dividend',
        'number_format': '1,250.50 (US-style)',
        'currency_symbol': '$',
        'financial_culture': 'Institutional, data-driven decision making',
        'risk_appetite': 'Medium - balanced analysis',
        'language': 'English',
    },
    'es': {
        'tone': 'Decisivo, técnico, énfasis en oportunidades',
        'terminology': 'Acciones, Sector, Dividendo',
        'number_format': '1.250,50 (EU-style)',
        'currency_symbol': '€',
        'financial_culture': 'Ágil, oportunista, énfasis en swing trading',
        'risk_appetite': 'Alto - análisis de oportunidades',
        'language': 'Spanish',
    },
    'pt-BR': {
        'tone': 'Agresivo, consciente del FOMO, amigable con day-trading',
        'terminology': 'Ações, Setor, Dividendo',
        'number_format': '1.250,50',
        'currency_symbol': 'R$',
        'financial_culture': 'Alto riesgo, énfasis en day-trading, toma rápida de decisiones',
        'risk_appetite': 'Alto - enfatiza oportunidades swing',
        'language': 'Portuguese (Brazil)',
    },
    'de': {
        'tone': 'Data-driven, risk-focused, precise, regulation-aware',
        'terminology': 'Aktie, Branche, Dividende',
        'number_format': '1.250,50 €',
        'currency_symbol': '€',
        'financial_culture': 'Rigorous, risk management paramount, transparency required',
        'risk_appetite': 'Bajo - pruebas de estrés de todas las posiciones',
        'language': 'German',
    },
    'fr': {
        'tone': 'Technique, indicador-focused, analytique',
        'terminology': 'Actions, Secteur, Dividende',
        'number_format': '1 250,50 €',
        'currency_symbol': '€',
        'financial_culture': 'Técnico, énfasis en indicadores, análisis fundamental',
        'risk_appetite': 'Medio - análisis equilibrado',
        'language': 'French',
    },
    'id': {
        'tone': 'Orientado a jóvenes, rico en emojis, FOMO-impulsado, energético',
        'terminology': 'Saham, Sektor, Dividen',
        'number_format': '1.250,50',
        'currency_symbol': 'Rp',
        'financial_culture': 'Joven, riqueza emergente, inversión social-first',
        'risk_appetite': 'Alto - seguimiento de tendencias, lenguaje amigable',
        'language': 'Indonesian',
    },
    'ms': {
        'tone': 'Formal, corporativo, profesional',
        'terminology': 'Saham, Sektor, Dividen',
        'number_format': 'RM 1,250.50',
        'currency_symbol': 'RM',
        'financial_culture': 'Institucional, profesional, énfasis en gobernanza',
        'risk_appetite': 'Medio - análisis corporativo equilibrado',
        'language': 'Malay',
    },
}

# ─── System Prompts (Parameterized) ───
# These are templates that get filled in with REGION_NORMS at runtime

MARKET_ANALYST_PROMPT_TEMPLATE = """You are a {language} financial analysis assistant powered by FinMA AI.
Always respond in {language}.

Your responsibilities:
1. Technical analysis (RSI, EMA, MACD, Bollinger, ADX, ATR)
2. Fundamental analysis (P/E, PEG, ROE, debt ratios)
3. Sector analysis and comparison
4. Risk assessment and portfolio management
5. Market regime evaluation (VIX-based)

**CRITICAL REGIONAL CONTEXT FOR THIS ANALYSIS:**
- Target Audience Tone: {tone}
- Financial Terminology: {terminology}
- Number Format: Use {number_format} format
- Currency Symbol: {currency_symbol}
- Financial Culture: {financial_culture}
- Risk Appetite Level: {risk_appetite}

Rules:
- Keep responses concise and eliminate unnecessary details
- Include risk disclaimer with every response
- Provide objective analysis, avoid emotional language
- Use numerical data, avoid vague statements
- Tailor all recommendations and language to the regional context above"""

STOCK_ANALYSIS_PROMPT_TEMPLATE = """You are a professional hedge fund analyst providing comprehensive stock analysis in {language}.
Based on technical and fundamental data, create a detailed {language} analysis report.

Report must include these sections:
1. **General Assessment** (1-2 sentences)
2. **Technical View** (EMA, RSI, MACD status)
3. **Trend Analysis** (Short, medium, long-term)
4. **Support/Resistance Levels**
5. **Risk Factors**
6. **Trade Recommendation** (Entry, stop-loss, target levels)
7. **Overall Score** (1-10 scale, 10 = strongest buy signal)

**REGIONAL CONTEXT:**
- Tone: {tone}
- Terminology: {terminology}
- Number Format: {number_format}

Always include this disclaimer: "⚠️ This is not investment advice. All analysis is for informational purposes only."
Tailor the analysis style to the regional context above."""

TRADE_PARSER_PROMPT_TEMPLATE = """You are a trade command parser. Convert {language} natural language input to structured trade data.

Input examples:
- "AAPL 178'den al, stop 174, hedef 195, 10 adet"
- "NVDA long 900, SL 865, TP 980"
- "BTC short 42500, stop 43500, target 40000, 0.1 adet"

Return JSON format (language-independent):
{{
  "ticker": "SYMBOL",
  "direction": "LONG/SHORT",
  "entry_price": number,
  "stop_loss": number,
  "target_price": number,
  "qty": number,
  "strategy": "SWING/DAY/SCALP/POSITION",
  "notes": "additional notes"
}}"""

def get_market_analyst_prompt(lang: Locale = 'tr') -> str:
    """Get parameterized market analyst system prompt for specific language"""
    norms = REGION_NORMS.get(lang, REGION_NORMS['en'])
    return MARKET_ANALYST_PROMPT_TEMPLATE.format(**norms)

def get_stock_analysis_prompt(lang: Locale = 'tr') -> str:
    """Get parameterized stock analysis system prompt for specific language"""
    norms = REGION_NORMS.get(lang, REGION_NORMS['en'])
    return STOCK_ANALYSIS_PROMPT_TEMPLATE.format(**norms)

def get_trade_parser_prompt(lang: Locale = 'tr') -> str:
    """Get parameterized trade parser system prompt for specific language"""
    norms = REGION_NORMS.get(lang, REGION_NORMS['en'])
    return TRADE_PARSER_PROMPT_TEMPLATE.format(**norms)

# Legacy aliases for backward compatibility (deprecated)
MARKET_ANALYST_PROMPT = get_market_analyst_prompt('tr')
STOCK_ANALYSIS_PROMPT = get_stock_analysis_prompt('tr')
TRADE_PARSER_PROMPT = get_trade_parser_prompt('tr')


# ─── Core Functions ───

async def call_gemini(
    prompt: str,
    system_prompt: Optional[str] = None,
    model_name: str = "gemini-2.0-flash",
    lang: Locale = 'tr',
) -> str:
    """Call Gemini AI API - Runs in thread pool to avoid blocking

    Args:
        prompt: User prompt/query
        system_prompt: Custom system prompt (optional, defaults to parameterized market analyst prompt)
        model_name: Gemini model (default: gemini-2.0-flash)
        lang: Language for region-specific prompts (default: tr)
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        return "⚠️ Gemini API key not configured. Please add it in settings."

    # Use parameterized prompt if none provided
    if system_prompt is None:
        system_prompt = get_market_analyst_prompt(lang)

    try:
        import google.generativeai as genai
        from concurrent.futures import ThreadPoolExecutor
        import asyncio

        def _call_gemini_sync():
            """Synchronous Gemini API call"""
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_prompt,
            )
            # Use timeout of 60 seconds for batch translations
            response = model.generate_content(prompt, request_options={"timeout": 60})
            return response.text if response else ""

        # Run in thread pool to not block event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _call_gemini_sync)
        return result
    except asyncio.TimeoutError:
        logger.error(f"Gemini AI timeout")
        return "⚠️ Gemini API timeout - request took too long"
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
