import json
import asyncio
import logging
import os
import aiohttp
import re
import sys
from datetime import datetime

# ================================================================
# ALPHA COMMANDER v5.5 - SWING PICKS MANIFEST REGENERATOR (V3)
# ================================================================

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

BASE_DIR = r"C:\Users\afksm\finma"
SWING_PICKS_PATH = os.path.join(BASE_DIR, "frontend", "public", "swing_picks.json")
GEMINI_API_KEY = "AIzaSyDBO4A7PxD0VAmRrB9C4IblFJXqqmF6svY"
GEMINI_MODEL = "gemini-2.0-flash"

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

async def generate_gemini_summary_unified(p: dict) -> dict:
    ticker = p.get("ticker", "UNKNOWN"); company = p.get("company", ticker)
    price = p.get("current_price", 0.0)
    score = p.get("score", 0.0)
    
    trend = p.get("trend_status", {})
    rsi = trend.get("rsi_14", p.get("rsi", "N/A"))
    adx = trend.get("adx", trend.get("adx_1h", p.get("adx", "N/A")))
    
    zones = p.get("boga_zones", {})
    buy_range_low = zones.get("buying_zone", {}).get("low", p.get("buy_zone",{}).get("low", "N/A"))
    buy_range_high = zones.get("buying_zone", {}).get("high", p.get("buy_zone",{}).get("high", "N/A"))
    
    sell_range_low = zones.get("sell_zone", {}).get("low", p.get("profit_zone",{}).get("low", "N/A"))
    sell_range_high = zones.get("sell_zone", {}).get("high", p.get("profit_zone",{}).get("high", "N/A"))
    
    prompt = f"""
Analyze {ticker} ({company}) for institutional swing traders.
BOGA AI Alpha Commander v5.5 protocol. 6 languages: EN, TR, ES, PT, FR, ID.

DATA: ${price:.2f}, Score {score}/100. RSI {rsi}, ADX {adx}.
Tactical: Buy [{buy_range_low} - {buy_range_high}] -> Target [{sell_range_low} - {sell_range_high}]

Sections:
1. Business Context
2. Performance Matrix
3. Technical Matrix (With OHLC Table + Verdict)
4. Risk Mitigation & Fundamental Brief
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
    if not os.path.exists(SWING_PICKS_PATH):
        logging.error(f"Manifest not found")
        return

    with open(SWING_PICKS_PATH, "r", encoding="utf-8") as f: manifest = json.load(f)

    picks = manifest.get("picks", [])
    logging.info(f"Processing {len(picks)} picks...")

    for pick in picks:
        ticker = pick.get("ticker", "UNKNOWN").upper()
        logging.info(f"Regenerating AI for {ticker}...")
        
        summary = await generate_gemini_summary_unified(pick)
        if summary:
            # Match AnalysisTabs.tsx expectation
            pick["ai_summary"] = {
                "homepage_summary": summary.get("homepage", {}),
                "detail_summary": summary.get("detail", {})
            }
            logging.info(f"✓ {ticker} Updated.")
            await asyncio.sleep(8) # Safety delay
        else:
            logging.error(f"✗ {ticker} Failed.")

    # Save to public folder
    with open(SWING_PICKS_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    # Sync to latest data folder
    data_dir_root = os.path.join(BASE_DIR, "data")
    dates = sorted([d for d in os.listdir(data_dir_root) if os.path.isdir(os.path.join(data_dir_root, d)) and d.startswith("202")])
    if dates:
        date_folder = dates[-1]
        today_swing_path = os.path.join(data_dir_root, date_folder, "swing_picks.json")
        with open(today_swing_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        
        # Individual stock JSONs
        stocks_dir = os.path.join(data_dir_root, date_folder, "stocks")
        if os.path.exists(stocks_dir):
            for pick in picks:
                t = pick["ticker"].upper()
                s_path = os.path.join(stocks_dir, f"{t}.json")
                
                stock_data = {}
                if os.path.exists(s_path):
                    with open(s_path, "r", encoding="utf-8") as f: stock_data = json.load(f)
                
                stock_data.update({
                    "ticker": t, "company": pick["company"], "sector": pick["sector"],
                    "scores": stock_data.get("scores", {"master_score": pick["score"]}),
                    "ai_summary": pick["ai_summary"],
                    "price": stock_data.get("price", {"current": pick["current_price"]}),
                    "scores_detail": {
                        "entry_range_low": pick["buy_zone"]["low"],
                        "entry_range_high": pick["buy_zone"]["high"],
                        "target_range_low": pick["profit_zone"]["low"],
                        "target_range_high": pick["profit_zone"]["high"],
                        "stop_range_low": pick["stop_zone"]["low"],
                        "stop_range_high": pick["stop_zone"]["high"],
                        "risk_reward_ratio": pick.get("boga_zones", {}).get("risk_reward", 2.5)
                    }
                })
                with open(s_path, "w", encoding="utf-8") as f:
                    json.dump(stock_data, f, indent=2, ensure_ascii=False)

    logging.info("Deep Audit Complete.")

if __name__ == "__main__":
    if os.name == 'nt': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
