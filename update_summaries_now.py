import json
import asyncio
import logging
import os
import aiohttp
import re
import yfinance as yf
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

try:
    from config import GEMINI_API_KEY, GEMINI_MODEL
except:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    """
    BOGA AI 'Decision Support Briefing' Synthesis Engine.
    Institutional-grade multilingual analysis.
    """
    ticker = c.get("ticker", "UNKNOWN")
    company = c.get("company", ticker)
    sector = c.get("sector", "Market")
    price = c.get("price", 0.0)
    score_100 = c.get("composite_score_100", c.get("score", 0.0))
    trend_status = "BULLISH" if score_100 >= 70 else "NEUTRAL" if score_100 >= 50 else "CAUTION"
    entry_trigger = c.get("setup_type", "Momentum Breakout")

    # Technical Indicators
    tech = c.get("technical", {})
    rsi = tech.get("rsi_14", 50.0)
    adx = tech.get("adx", 20.0)
    macd_hist = tech.get("macd_histogram", 0.0)
    mfi = tech.get("mfi", 50.0)
    ema20 = tech.get("ema_20", 0.0)
    ema50 = tech.get("ema_50", 0.0)
    ema200 = tech.get("ema_200", 0.0)

    # Trading Zones
    rr = zones.get("rr_ratio", 0.0)
    buy_low = zones.get("buy_zone", {}).get("low", 0.0)
    buy_high = zones.get("buy_zone", {}).get("high", 0.0)
    sell_high = zones.get("sell_zone", {}).get("high", 0.0)
    stop_high = zones.get("stop_zone", {}).get("high", 0.0)

    if not fin_health and "fundamentals" in c:
        fin_health = c["fundamentals"]

    # ── DATA REPAIR ──
    if fin_health.get("gross_margin", 0) == 0 and fin_health.get("revenue_growth", 0) == 0:
        try:
            logging.info(f"🔍 {ticker} fundamentals repair...")
            stock = yf.Ticker(ticker)
            inf = stock.info
            fin_health.update({
                "gross_margin": (inf.get("grossMargins", 0) or 0) * 100,
                "operating_margin": (inf.get("operatingMargins", 0) or 0) * 100,
                "net_margin": (inf.get("profitMargins", 0) or 0) * 100,
                "revenue_growth": (inf.get("revenueGrowth", 0) or 0) * 100,
                "pe_ratio": inf.get("trailingPE", 0) or 0,
                "pb_ratio": inf.get("priceToBook", 0) or 0,
                "fcf_yield": (inf.get("freeCashflow", 0) / (inf.get("marketCap", 1) or 1) * 100),
                "market_cap_usd": inf.get("marketCap", 0)
            })
            c["market_cap_usd"] = inf.get("marketCap", 0)
        except Exception as e:
            logging.warning(f"⚠️ {ticker} repair failed: {e}")

    # Variables for prompt
    mcap_b = c.get("market_cap_usd", 0) / 1e9 if c.get("market_cap_usd") else 0
    rev_g = fin_health.get("revenue_growth", 0)
    gross_m = fin_health.get("gross_margin", 0)
    op_m = fin_health.get("operating_margin", 0)
    net_m = fin_health.get("net_margin", 0)
    pe = fin_health.get("pe_ratio", 0)
    pb = fin_health.get("pb_ratio", 0)
    fcf_y = fin_health.get("fcf_yield", 0)

    # Valuation context
    if pe > 0 and rev_g > 0:
        peg = pe / rev_g
        if peg < 1.0: val_comment = f"Undervalued (PEG: {peg:.1f}x)"
        elif peg < 2.0: val_comment = f"Fair Value (PEG: {peg:.1f}x)"
        else: val_comment = f"Premium (PEG: {peg:.1f}x)"
    elif pe > 0:
        val_comment = f"Market Standard (P/E: {pe:.1f}x)"
    else:
        val_comment = "Valuation Data Incomplete"

    def ema_status_str(price_val, ema_val, label):
        if price_val <= 0 or ema_val <= 0: return f"N/A ({label})"
        pct = ((price_val - ema_val) / ema_val) * 100
        return f"{abs(pct):.1f}% {'above' if pct >= 0 else 'below'} {label}"

    ema20_s = ema_status_str(price, ema20, "EMA20")
    ema50_s = ema_status_str(price, ema50, "EMA50")
    ema200_s = ema_status_str(price, ema200, "EMA200")

    rsi_c = "overbought - caution" if rsi >= 70 else "strong bullish" if rsi >= 55 else "neutral"
    adx_c = "strong trend" if adx >= 25 else "choppy range"
    macd_c = f"bullish ({macd_hist:+.2f})" if macd_hist > 0 else f"bearish ({macd_hist:+.2f})"
    rr_c = f"{rr:.1f}:1 - Excellent" if rr >= 2.5 else f"{rr:.1f}:1 - Good"

    language_configs = {
        "en": {
            "lang_name": "English",
            "region_note": "Institutional financial English. NO generic intros. Direct to thesis.",
            "homepage_len": "ONE sharp decisive sentence.",
            "detail_len": "6 sentences covering: (1) Tactical thesis, (2) Price action/EMA, (3) Growth/Margins, (4) Specific risk, (5) Volatility, (6) Price targets."
        },
        "tr": {
            "lang_name": "Turkish",
            "region_note": "Kurumsal finans dili. 'X bir şirkettir' yasak. Doğrudan taktiksel özet.",
            "homepage_len": "TEK ve vurucu cümle.",
            "detail_len": "6 cümle: (1) Taktiksel tez, (2) Fiyat hareketi/EMA, (3) Büyüme/Marjlar, (4) Kritik risk uyarısı, (5) Oynaklık yorumu, (6) Hedef fiyatlar."
        },
        "es": { "lang_name": "Spanish", "region_note": "Financial Spanish. No generic intro.", "homepage_len": "UNA oración decisiva.", "detail_len": "6 oraciones: Tesis, Técnica, Márgenes, Riesgo, Volumen, Precios." },
        "pt": { "lang_name": "Portuguese", "region_note": "Financial Portuguese. Direct thesis.", "homepage_len": "UMA frase forte.", "detail_len": "6 frases: Tese, Técnica, Saúde, Risco, Dinâmica, Preços." },
        "fr": { "lang_name": "French", "region_note": "Financial French. No fluff.", "homepage_len": "UNE phrase percutante.", "detail_len": "6 phrases: Thèse, Technique, Solidité, Risque, Volume, Prix." },
        "id": { "lang_name": "Indonesian", "region_note": "Financial Indonesian. Direct thesis.", "homepage_len": "SATU kalimat tegas.", "detail_len": "6 kalimat: Tesis, Teknikal, Margin, Risiko, Volume, Target." }
    }

    prompt = f"""
You are BOGA AI — the elite intelligence core of the "Kartal Yuvası Alpha Commander v5.5" protocol.
Your mission: produce institutional-grade investment briefings for {ticker}.

▌ ANALYSIS CONTEXT
  • Master Score: {score_100}/100
  • Market Cap: ${mcap_b:.1f}B | Price: ${price:.2f}
  • Sector: {sector} | Trend: {trend_status}
  
▌ QUANT MATRIX
  • RSI: {rsi:.1f} ({rsi_c})
  • ADX: {adx:.1f} ({adx_c})
  • MACD: {macd_c}
  • EMA Ribbon: {ema20_s} | {ema50_s} | {ema200_s}

▌ FUNDAMENTAL DISCIPLINE
  • Growth: {rev_g:.1f}% | Margins (G/O/N): {gross_m:.1f}% / {op_m:.1f}% / {net_m:.1f}%
  • Valuation: {val_comment} | FCF Yield: {fcf_y:.1f}%

▌ EXECUTION ZONES
  • Buy: ${buy_low:.2f}–${buy_high:.2f} | Target: ${sell_high:.2f} | Stop: ${stop_high:.2f}

Your task is to synthesize this into a "Decision Support Briefing" in ALL SIX languages below.
RULES:
1. NO generic introductions. Jump straight into the core investment thesis.
2. Link numbers to risks. Be surgical and authoritative.
3. Every detail summary MUST be 6 dense sentences following the structure provided.

LANGUAGES:
{chr(10).join([f'  [{k.upper()}] {v["lang_name"]}: {v["region_note"]} ({v["detail_len"]})' for k, v in language_configs.items()])}

OUTPUT FORMAT: Return ONLY valid JSON:
{{
  "homepage_summary": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "detail_summary":   {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }}
}}
"""
    try:
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4, "maxOutputTokens": 3000}}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=30) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    json_match = re.search(r'\{.*\}', text, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group())
        return _fallback_summary(c)
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        return _fallback_summary(c)

def _fallback_summary(c: dict) -> dict:
    t = c.get("ticker", "")
    p = c.get("price", 0.0)
    return {
        "homepage_summary": {"en": f"Tactical setup for {t} at ${p}.", "tr": f"{t} için ${p} seviyesinde taktiksel kurulum."},
        "detail_summary": {"en": "Analysis is being processed by BOGA AI. Check back shortly.", "tr": "Analiz BOGA AI tarafından işleniyor. Lütfen kısa süre sonra tekrar kontrol edin."}
    }

async def main():
    picks_path = "frontend/public/swing_picks.json"
    if not os.path.exists(picks_path): return
    with open(picks_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logging.info(f"Updating AI summaries for {len(data['picks'])} candidates...")
    for p in data['picks']:
        ticker = p['ticker']
        summary = await generate_gemini_summary(p, p.get("fundamentals", {}), p.get("zones", {}))
        p["ai_summary"] = summary
        
        detail_path = f"frontend/public/data/{ticker}.json"
        if os.path.exists(detail_path):
            try:
                with open(detail_path, "r", encoding="utf-8") as df:
                    ddata = json.load(df)
                    ddata["ai_summary"] = summary
                with open(detail_path, "w", encoding="utf-8") as df:
                    json.dump(ddata, df, indent=2, ensure_ascii=False)
            except: pass
        logging.info(f"✅ {ticker} updated.")

    with open(picks_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Also update swing_all_picks.json
    all_picks_path = "frontend/public/swing_all_picks.json"
    if os.path.exists(all_picks_path):
        with open(all_picks_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
