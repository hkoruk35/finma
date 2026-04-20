import json
import asyncio
import logging
import os
import aiohttp
import re
import sys
from datetime import datetime

# ================================================================
# ALPHA COMMANDER v5.5 - UNIFIED BATCH UPDATER (PATH FIX)
# ================================================================

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

BASE_DIR = r"C:\Users\afksm\finma"
GEMINI_API_KEY = ""
GEMINI_MODEL = "gemini-2.0-flash"

try:
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "GEMINI_API_KEY=" in line:
                    GEMINI_API_KEY = line.split("=")[1].strip()
    config_path = os.path.join(BASE_DIR, "config.py")
    if os.path.exists(config_path):
        import importlib.util
        spec = importlib.util.spec_from_file_location("config", config_path)
        cfg = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cfg)
        if not GEMINI_API_KEY:
            GEMINI_API_KEY = getattr(cfg, "GEMINI_API_KEY", "")
        GEMINI_MODEL = getattr(cfg, "GEMINI_MODEL", "gemini-2.0-flash")
except Exception: pass

if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY not found!")
    sys.exit(1)

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

async def generate_gemini_summary_unified(c: dict) -> dict:
    ticker = c.get("ticker", "UNKNOWN"); company = c.get("company", ticker)
    price = c.get("price", {}).get("current", 0.0)
    score = c.get("scores", {}).get("master_score", 0.0)
    tech = c.get("technical", {})
    zones = c.get("scores_detail", {})
    
    ohlc_str = "N/A"
    if "history" in c and len(c["history"]) > 0:
        ohlc_str = "\n".join([f"{h['Date']}: {h['Close']}" for h in c["history"][-10:]])
    
    prompt = f"""
Analyze {ticker} ({company}) for institutional swing traders.
BOGA AI Alpha Commander v5.5 protocol. 6 languages: EN, TR, ES, PT, FR, ID.

DATA: ${price:.2f}, Score {score}/100. RSI {tech.get('rsi_14')}, ADX {tech.get('adx')}.
Zones: Entry [{zones.get('entry_range_low')} - {zones.get('entry_range_high')}] -> Target {zones.get('target_price')}.

Sections:
1. Business Context
2. Performance
3. Technical Matrix (With OHLC Table + Verdict)
4. Risks
5. Execution Strategy

Return ONLY JSON:
{{
  "homepage": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "detail":   {{ "en": "Markdown...", "tr": "Markdown...", "es": "...", "pt": "...", "fr": "...", "id": "..." }}
}}
"""
    url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.45, "maxOutputTokens": 8192}}
    
    async with aiohttp.ClientSession() as session:
        for attempt in range(2):
            try:
                async with session.post(url, json=payload, timeout=60) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                        return safe_json_parse(raw_text)
                    elif resp.status == 429: await asyncio.sleep(20)
            except Exception: await asyncio.sleep(2)
    return None

async def main():
    target_tickers = [t.upper() for t in sys.argv[1:]]
    data_dir_root = os.path.join(BASE_DIR, "data")
    # Only directories starting with 202
    dates = sorted([d for d in os.listdir(data_dir_root) if os.path.isdir(os.path.join(data_dir_root, d)) and d.startswith("202")])
    if not dates: return
    
    stocks_dir = os.path.join(data_dir_root, dates[-1], "stocks")
    stock_files = [f"{t}.json" for t in target_tickers if os.path.exists(os.path.join(stocks_dir, f"{t}.json"))]
    if not stock_files and not target_tickers:
        stock_files = [f for f in os.listdir(stocks_dir) if f.endswith('.json') and f != "master.json"]

    logging.info(f"Processing {len(stock_files)} stocks...")

    for stock_file in stock_files:
        ticker = stock_file.replace('.json', '').upper()
        stock_path = os.path.join(stocks_dir, stock_file)
        try:
            with open(stock_path, "r", encoding="utf-8") as f: stock_data = json.load(f)
            logging.info(f"AI Request for {ticker}...")
            summary = await generate_gemini_summary_unified(stock_data)
            if summary:
                stock_data["ai_summary"] = summary
                with open(stock_path, "w", encoding="utf-8") as f: json.dump(stock_data, f, indent=2, ensure_ascii=False)
                logging.info(f"✓ {ticker} OK.")
                await asyncio.sleep(6) 
            else: logging.error(f"✗ {ticker} Failed.")
        except Exception as e: logging.error(f"✗ {ticker} Error: {e}")

if __name__ == "__main__":
    if os.name == 'nt': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
