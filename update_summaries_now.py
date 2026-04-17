import json
import asyncio
import logging
import os
import aiohttp
import re
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

GEMINI_API_KEY = ""
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

try:
    # Try importing directly from config.py values
    import importlib.util
    spec = importlib.util.spec_from_file_location("config", os.path.join(os.path.dirname(__file__), "config.py"))
    cfg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cfg)
    GEMINI_API_KEY = getattr(cfg, "GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = getattr(cfg, "GEMINI_MODEL", GEMINI_MODEL) or GEMINI_MODEL
except Exception as e:
    logging.warning(f"Could not load config.py: {e}")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY not found — set it in config.py or as env var")
else:
    logging.info(f"Gemini API key loaded (model: {GEMINI_MODEL})")

GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

def safe_json_parse(text: str):
    if not text: return None
    try:
        clean_text = re.sub(r"```json\s*", "", text); clean_text = re.sub(r"```\s*", "", clean_text).strip()
        return json.loads(clean_text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                jp = match.group(); jp = re.sub(r",\s*\}", "}", jp); jp = re.sub(r",\s*\]", "]", jp)
                return json.loads(jp)
            except Exception: pass
    return None

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    ticker = c.get("ticker", "UNKNOWN"); company = c.get("company", ticker)
    price = c.get("price", c.get("current_price", 0.0))
    score = c.get("composite_score_100", c.get("score", 0.0))
    tech = c.get("technical", c.get("meta", {}).get("1d", {}))
    
    # OHLC
    df_1d = c.get("df_1d")
    ohlc_str = "N/A"
    if df_1d is not None and len(df_1d) >= 10:
        ohlc_str = df_1d.tail(10)[['Open', 'High', 'Low', 'Close', 'Volume']].to_string()

    lang_configs = {"en": "English", "tr": "Turkish", "es": "Spanish", "pt": "Portuguese", "fr": "French", "id": "Indonesian"}
    
    async def fetch_lang(l, desc):
        prompt = f"""
You are a senior Wall Street Analyst. Analyze {ticker} ({company}).
Score: {score}/100, Price: ${price}. RSI: {tech.get('RSI', 'N/A')}, ADX: {tech.get('ADX', 'N/A')}.
Tactical: {zones.get('buy_zone', 'N/A')} -> Target {zones.get('sell_zone', 'N/A')}.

HISTORICAL OHLC (Last 10 Days):
{ohlc_str}

TASK: 5 Sections (Summary, Performance, Technical with Table, Fundamental/Risks, Strategy) for {desc} audience.
Return JSON: {{"homepage": "1 sentence", "detail": "Full Markdown"}}
"""
        for attempt in range(2):
            try:
                url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
                payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2500}}
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload, timeout=45) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            parsed = safe_json_parse(data["candidates"][0]["content"]["parts"][0]["text"])
                            if parsed: return l, parsed
            except Exception: pass
        return l, None

    tasks = [fetch_lang(l, d) for l, d in lang_configs.items()]
    results = await asyncio.gather(*tasks)
    
    out = {"homepage": {}, "detail": {}}
    for l, data in results:
        if data:
            out["homepage"][l] = data["homepage"]; out["detail"][l] = data["detail"]
    return out

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
