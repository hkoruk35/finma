import os
import json
import asyncio
import aiohttp
import sys
import logging
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDBO4A7PxD0VAmRrB9C4IblFJXqqmF6svY")
GEMINI_MODEL = "gemini-2.0-flash" 
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{{GEMINI_MODEL}}:generateContent"

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

async def test_sqm_analysis():
    ticker = "SQM"
    company = "Sociedad Química y Minera de Chile S.A."
    sector = "Materials"
    price = 84.43
    score = 51.42
    trend = "Uptrend"
    rsi = 60.8
    adx = 15.7
    macd = 0.396
    mcap = 24.1
    buy = "$76.12 - $84.85"
    target = "$100.56"
    stop = "$76.87"
    rr = "1.5:1"
    
    ohlc_str = """
         Open   High    Low  Close   Volume
Date                                     
2026-04-01  75.00  77.50  74.80  76.90  1200000
2026-04-02  76.90  78.20  76.10  77.50  1100000
2026-04-03  77.50  79.80  77.00  79.20  1350000
2026-04-06  79.20  80.50  78.80  79.90  1050000
2026-04-07  79.90  82.40  79.50  81.80  1400000
2026-04-08  81.80  83.50  81.20  82.17  1250000
2026-04-09  82.17  84.20  81.80  82.77  1180000
2026-04-10  82.77  86.00  82.87  84.43   691775
    """.strip()

    prompt = f"""
You are a top-tier Wall Street Equity Research Analyst. 
Your mission: execute the "Kartal Yuvası Alpha Commander v5.5" protocol for {ticker} ({company}).

RAW MARKET DATA:
- Price: ${price:.2f}
- Sector {sector} | MCap ${mcap:.1f}B
- BOGA AI Score: {score}/100
- Technical Matrix: Trend {trend}, RSI {rsi:.1f}, ADX {adx:.1f}, MACD {macd:.3f}
- Tactical Zones: Buy [{buy}], Target {target}, Stop {stop}, R/R {rr}

REAL HISTORICAL PRICES (Last 10 Days):
{ohlc_str}

YOUR TASK:
Generate a high-authority swing trade analysis (1-4 week horizon).
Language: Turkish.
### 1. Şirket ve Sektör Özeti
### 2. Güncel Fiyat ve Performans
### 3. Teknik Analiz (INCLUDE A MARKDOWN TABLE of the 10-day OHLC data + Verdict: Strong Buy/Buy/Neutral/Sell)
### 4. Temel ve Riskler
### 5. Swing Trade Stratejisi

OUTPUT FORMAT: Return ONLY valid JSON.
{{
  "homepage": "ONE powerful sentence summing up the alpha opportunity.",
  "detail": "Full Markdown analysis in Turkish."
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_API_URL.split('/')[-1].split(':')[0] if '{' in GEMINI_API_URL else GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    # Let me simplify the URL building
    full_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.45, "maxOutputTokens": 3000}
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(full_url, json=payload, timeout=60) as resp:
            data = await resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = safe_json_parse(raw_text)
            if parsed:
                with open("sqm_result.json", "w", encoding="utf-8") as f:
                    json.dump(parsed, f, ensure_ascii=False, indent=2)
                print("SUCCESS: sqm_result.json created.")

if __name__ == "__main__":
    asyncio.run(test_sqm_analysis())
