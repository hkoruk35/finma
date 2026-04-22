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

def generate_v55_report_local(c: dict) -> dict:
    """Institutional Fallback - Kartal Yuvası Alpha Commander v5.5 Protocol"""
    t = c.get("ticker", "UNKNOWN"); comp = c.get("company", t)
    s = c.get("scores", {}).get("master_score", 0.0); pr = c.get("price", {}).get("current", 0.0)
    tech = c.get("technical", {})
    zd = c.get("scores_detail", {})
    sect = c.get("sector", "Market")

    langs = {
        "en": {
            "t": "Institutional Analysis", "b": "Business Context", "p": "Performance", "tm": "Technical Matrix", "r": "Risks", "e": "Execution",
            "desc": f"{comp} operates in the {sect} sector. BOGA AI detect institutional interest near ${pr:.2f}.",
            "v": "Verdict", "cur": "Current", "sup": "Support", "str": "Strength",
            "r_body": f"Volatility and sector rotation are key risks. Support near ${zd.get('stop_range_high', 0):.2f}.",
            "entry": "Entry Zone", "target": "Target Price", "stop": "Stop Loss"
        },
        "tr": {
            "t": "Kurumsal Analiz", "b": "İş Bağlamı", "p": "Performans", "tm": "Teknik Matris", "r": "Riskler", "e": "Uygulama",
            "desc": f"{comp}, {sect} sektöründe faaliyet göstermektedir. BOGA AI, ${pr:.2f} seviyelerinde kurumsal ilgi tespit etti.",
            "v": "Karar", "cur": "Güncel", "sup": "Destek", "str": "Güç",
            "r_body": f"Volatilite ve sektör rotasyonu temel risklerdir. Destek seviyesi ${zd.get('stop_range_high', 0):.2f} civarındadır.",
            "entry": "Giriş Bölgesi", "target": "Hedef Fiyat", "stop": "Zarar Kes"
        },
        "es": {
            "t": "Análisis Institucional", "b": "Contexto", "p": "Desempeño", "tm": "Matriz Técnica", "r": "Riesgos", "e": "Ejecución",
            "desc": f"{comp} opera en el sector {sect}. BOGA AI detecta interés institucional cerca de ${pr:.2f}.",
            "v": "Veredicto", "cur": "Actual", "sup": "Soporte", "str": "Fuerza",
            "r_body": f"La volatilidad y la rotación sectorial son riesgos clave. Soporte cerca de ${zd.get('stop_range_high', 0):.2f}.",
            "entry": "Zona de Entrada", "target": "Precio Objetivo", "stop": "Stop Loss"
        },
        "pt": {
            "t": "Análise Institucional", "b": "Contexto", "p": "Desempenho", "tm": "Matriz Técnica", "r": "Riscos", "e": "Execução",
            "desc": f"{comp} opera no setor {sect}. BOGA AI detecta interesse institucional perto de ${pr:.2f}.",
            "v": "Veredito", "cur": "Atual", "sup": "Suporte", "str": "Força",
            "r_body": f"A volatilidade e a rotação setorial são riscos principais. Suporte próximo de ${zd.get('stop_range_high', 0):.2f}.",
            "entry": "Zona de Entrada", "target": "Preço Alvo", "stop": "Stop Loss"
        },
        "fr": {
            "t": "Analyse Institutionnelle", "b": "Contexte Business", "p": "Performance", "tm": "Matrice Technique", "r": "Risques", "e": "Exécution",
            "desc": f"{comp} opère dans le secteur {sect}. BOGA AI détecte un intérêt institutionnel proche de ${pr:.2f}.",
            "v": "Verdict", "cur": "Actuel", "sup": "Support", "str": "Force",
            "r_body": f"La volatilité et la rotation sectorielle sont des risques clés. Support proche de ${zd.get('stop_range_high', 0):.2f}.",
            "entry": "Zone d'Entrée", "target": "Prix Cible", "stop": "Stop Loss"
        },
        "id": {
            "t": "Analisis Institusional", "b": "Konteks Bisnis", "p": "Performa", "tm": "Matriks Teknikal", "r": "Risiko", "e": "Eksekusi",
            "desc": f"{comp} beroperasi di sektor {sect}. BOGA AI mendeteksi minat institusional di dekat ${pr:.2f}.",
            "v": "Keputusan", "cur": "Saat Ini", "sup": "Dukungan", "str": "Kekuatan",
            "r_body": f"Volatilitas dan rotasi sektor adalah risiko utama. Dukungan di dekat ${zd.get('stop_range_high', 0):.2f}.",
            "entry": "Zona Masuk", "target": "Target Harga", "stop": "Stop Loss"
        }
    }

    home = {}; detail = {}
    for l, val in langs.items():
        home[l] = f"BOGA AI assigns {t} a score of {s:.1f}/100. Trend: {tech.get('trend', 'Neutral')}. RSI: {tech.get('rsi_14', 50)}."
        detail[l] = f"""## {val['t']}: {t} ({comp})

### 1. {val['b']}
{val['desc']}

### 2. {val['p']}
* **Master Score:** {s:.1f}/100
* **Market Regime:** {c.get('scores', {}).get('signal_type', 'Neutral')}
* **RSI:** {tech.get('rsi_14')}

### 3. {val['tm']}
| Metric | Value | {val['v']} |
|---|---|---|
| Price | ${pr:.2f} | {val['cur']} |
| EMA20 | ${tech.get('ema_20')} | {val['sup']} |
| ADX | {tech.get('adx')} | {val['str']} |

### 4. {val['r']}
{val['r_body']}

### 5. {val['e']}
* **{val['entry']}:** ${zd.get('entry_range_low', 0):.2f} - ${zd.get('entry_range_high', 0):.2f}
* **{val['target']}:** ${zd.get('target_price', 0):.2f}
* **{val['stop']}:** ${zd.get('stop_loss', 0):.2f}
"""
    return {"homepage_summary": home, "detail_summary": detail}

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
  "homepage_summary": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "detail_summary":   {{ "en": "Markdown...", "tr": "Markdown...", "es": "...", "pt": "...", "fr": "...", "id": "..." }}
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
                        result = safe_json_parse(raw_text)
                        if result: return result
                    elif resp.status == 429: 
                        logging.warning("Gemini Rate Limit (429). Waiting...")
                        await asyncio.sleep(20)
                    else:
                        err_text = await resp.text()
                        logging.error(f"Gemini API Error {resp.status}: {err_text}")
            except Exception as e: 
                logging.error(f"Request Exception: {e}")
                await asyncio.sleep(2)
    return generate_v55_report_local(c)

async def main():
    target_tickers = [t.upper() for t in sys.argv[1:]]
    data_dir_root = os.path.join(BASE_DIR, "data")
    
    # Priority: 1. latest 2. newest 202* folder
    latest_dir = os.path.join(data_dir_root, "latest")
    if os.path.exists(latest_dir):
        stocks_dir = os.path.join(latest_dir, "stocks")
    else:
        dates = sorted([d for d in os.listdir(data_dir_root) if d.startswith("202") and os.path.isdir(os.path.join(data_dir_root, d))])
        if not dates:
            logging.error("No data folders found!")
            return
        stocks_dir = os.path.join(data_dir_root, dates[-1], "stocks")
    
    logging.info(f"Targeting: {stocks_dir}")

    if target_tickers:
        stock_files = []
        for t in target_tickers:
            fname = f"{t}.json"
            if os.path.exists(os.path.join(stocks_dir, fname)):
                stock_files.append(fname)
            else:
                logging.warning(f"Ticker file not found: {fname}")
    else:
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
                pass
            else: logging.error(f"✗ {ticker} Failed.")
        except Exception as e: logging.error(f"✗ {ticker} Error: {e}")

if __name__ == "__main__":
    if os.name == 'nt': asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
