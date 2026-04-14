import json
import asyncio
import logging
import os
import aiohttp
import re
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

try:
    from config import GEMINI_API_KEY, GEMINI_MODEL
except:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

if not GEMINI_API_KEY:
    logging.warning("⚠️  GEMINI_API_KEY not found. Set environment variable or add to config.py")

GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
logging.info(f"Using Gemini Model: {GEMINI_MODEL}")

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    """
    Enhanced BOGA AI Engine: Generates multi-tab specific analysis.
    """
    ticker = c.get("ticker", "UNKNOWN")
    company = c.get("company", ticker)
    sector = c.get("sector", "Market")
    price = c.get("price", 0.0)
    score_100 = c.get("composite_score_100", c.get("score", 0.0))
    
    # Technical Data
    tech = c.get("technical", {})
    rsi = tech.get("rsi_14", 50.0)
    adx = tech.get("adx", 20.0)
    macd_hist = tech.get("macd_histogram", 0.0)
    
    # Fundamentals
    if not fin_health and "fundamentals" in c: fin_health = c["fundamentals"]
    rev_g = fin_health.get("revenue_growth", 0)
    gross_m = fin_health.get("gross_margin", 0)
    pe = fin_health.get("pe_ratio", 0)

    prompt = f"""
You are BOGA AI. Analyze {ticker} ({company}).
Data: Score {score_100}/100, Price ${price}, RSI {rsi}, ADX {adx}, MACD {macd_hist}, Revenue Growth {rev_g}%, Gross Margin {gross_m}%, P/E {pe}.

TASKS:
1. Homepage Summary: 1 sharp sentence for the main dashboard.
2. Detail Report: 6 sentences deep briefing. Link numbers to risks. No generic intros.
3. Technical Insight: 2 sentences explaining the RSI/ADX/MACD setup.
4. Fundamental Insight: 2 sentences explaining the Margin/Growth health.

LANGUAGES: Provide ALL tasks in 6 languages: EN, TR, ES, PT, FR, ID.

OUTPUT FORMAT (STRICT JSON):
{{
  "homepage": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "detail":   {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "tech_ins": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "quant_ins":{{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }}
}}
"""
    try:
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4000}}
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=40) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    text = result['candidates'][0]['content']['parts'][0]['text']
                    json_match = re.search(r'\{.*\}', text, re.DOTALL)
                    if json_match: return json.loads(json_match.group())
        return _fallback(c)
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        return _fallback(c)

def _fallback(c: dict) -> dict:
    t = c.get("ticker", "")
    return {
        "homepage": {"en": f"Analysis for {t}.", "tr": f"{t} için analiz."},
        "detail": {"en": "Synchronizing data...", "tr": "Veriler senkronize ediliyor..."},
        "tech_ins": {"en": "Technical signals active.", "tr": "Teknik sinyaller aktif."},
        "quant_ins": {"en": "Fundamentals monitored.", "tr": "Temel veriler izleniyor."}
    }

async def main():
    # Detect the latest data directory
    data_base = "data"
    if not os.path.exists(data_base):
        logging.error(f"Data directory {data_base} not found")
        return

    # Find latest date folder
    dates = sorted([d for d in os.listdir(data_base) if os.path.isdir(os.path.join(data_base, d))])
    if not dates:
        logging.error("No dated folders found in data/")
        return

    latest_date = dates[-1]
    data_dir = os.path.join(data_base, latest_date)
    stocks_dir = os.path.join(data_dir, "stocks")

    if not os.path.exists(stocks_dir):
        logging.error(f"Stocks directory {stocks_dir} not found")
        return

    logging.info(f"Using data from {data_dir}")

    # Process all stock files
    stock_files = [f for f in os.listdir(stocks_dir) if f.endswith('.json') and f != "master.json"]

    for stock_file in stock_files:
        ticker = stock_file.replace('.json', '').upper()
        stock_path = os.path.join(stocks_dir, stock_file)

        try:
            logging.info(f"Analyzing {ticker}...")
            with open(stock_path, "r", encoding="utf-8") as f:
                stock_data = json.load(f)

            # Generate AI summary
            summary = await generate_gemini_summary(
                stock_data,
                stock_data.get("fundamental", {}),
                stock_data.get("signals", {})
            )
            stock_data["ai_summary"] = summary

            # Save updated data
            with open(stock_path, "w", encoding="utf-8") as f:
                json.dump(stock_data, f, indent=2, ensure_ascii=False)

            logging.info(f"✓ {ticker} AI summary updated")
        except Exception as e:
            logging.error(f"✗ {ticker} failed: {e}")

    logging.info("Deep AI upgrade complete.")

if __name__ == "__main__":
    if os.name == 'nt': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
