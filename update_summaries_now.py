import json
import os
import asyncio
import aiohttp
import re
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

try:
    from config import GEMINI_API_KEY, GEMINI_MODEL
except:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    """
    BOGA AI tarafından desteklenen Gemini AI ile 6 dilde özet üretir.
    """
    if not GEMINI_API_KEY:
        return _fallback_summary(c)

    # ── Kimlik Verileri ──────────────────────────────────────────────────────
    ticker        = c.get("ticker", "")
    company       = c.get("company", ticker)
    sector        = c.get("sector", "Unknown")
    price         = c.get("current_price", 0.0)
    score_100     = c.get("boga_score_100", c.get("score", 0.0))
    entry_trigger = c.get("entry_trigger", "")
    trend_status  = c.get("trend_durumu_1d", "")
    
    if not trend_status and "trend_status" in c:
        trend_status = c["trend_status"].get("trend", "")

    # ── Teknik İndikatörler ──────────────────────────────────────────────────
    rsi       = c.get("rsi_14", c.get("rsi", 50.0))
    adx       = c.get("adx", 0.0)
    macd_hist = c.get("macd_hist", 0.0)
    mfi       = c.get("mfi", 50.0)
    ema20     = c.get("ema20", 0.0)
    ema50     = c.get("ema50", 0.0)
    ema200    = c.get("ema200", 0.0)

    # ── Bölgeler ─────────────────────────────────────────────────────────────
    if not zones and "boga_zones" in c:
        zones = {"buy_zone": c["buy_zone"], "sell_zone": c["profit_zone"], "stop_zone": c["stop_zone"], "rr_ratio": c["boga_zones"].get("risk_reward", 2.5)}
    
    rr        = zones.get("rr_ratio", 0.0)
    buy_low   = zones.get("buy_zone", {}).get("low", 0.0)
    buy_high  = zones.get("buy_zone", {}).get("high", 0.0)
    sell_high = zones.get("sell_zone", {}).get("high", 0.0)
    stop_high = zones.get("stop_zone", {}).get("high", 0.0)

    if not fin_health and "fundamentals" in c:
        fin_health = c["fundamentals"]

    # ── Temel Veriler ─────────────────────────────────────────────────────────
    gross_m = fin_health.get("gross_margin", fin_health.get("gross_margin_pct", 0))
    op_m    = fin_health.get("operating_margin", fin_health.get("operating_margin_pct", 0))
    net_m   = fin_health.get("net_margin", fin_health.get("net_margin_pct", 0))
    rev_g   = fin_health.get("revenue_growth", fin_health.get("revenue_growth_pct", 0))
    pe      = fin_health.get("pe_ratio", 0)
    pb      = fin_health.get("pb_ratio", 0)
    fcf_y   = fin_health.get("fcf_yield", fin_health.get("fcf_yield_pct", 0))
    mcap    = fin_health.get("market_cap_b", fin_health.get("market_cap_usd", 0) / 1e9 if fin_health.get("market_cap_usd") else 0)

    # ── Performans ────────────────────────────────────────────────────────────
    p1d = c.get("change_1d", 0.0)
    p1w = c.get("change_1w", 0.0)
    p1m = c.get("change_1m", 0.0)
    p1y = c.get("change_1y", 0.0)
    p5y = c.get("change_5y", 0.0)

    # ── EMA Konumu (insan diline çeviri) ──────────────────────────────────────
    def ema_status(price_val, ema_val, label):
        if price_val <= 0 or ema_val <= 0:
            return f"N/A ({label})"
        pct = ((price_val - ema_val) / ema_val) * 100
        direction = "above" if pct >= 0 else "below"
        return f"{abs(pct):.1f}% {direction} {label}"

    ema20_status  = ema_status(price, ema20,  "EMA20")
    ema50_status  = ema_status(price, ema50,  "EMA50")
    ema200_status = ema_status(price, ema200, "EMA200")

    # ── RSI Yorumu ────────────────────────────────────────────────────────────
    if rsi >= 70:
        rsi_comment = "overbought territory — caution on new entries"
    elif rsi >= 55:
        rsi_comment = "bullish momentum zone — trend intact"
    elif rsi >= 45:
        rsi_comment = "neutral — awaiting directional catalyst"
    elif rsi >= 30:
        rsi_comment = "oversold pressure — potential recovery watch"
    else:
        rsi_comment = "deep oversold — capitulation risk present"

    # ── ADX Yorumu ────────────────────────────────────────────────────────────
    if adx >= 40:
        adx_comment = "extremely strong trending market"
    elif adx >= 25:
        adx_comment = "confirmed trending environment"
    elif adx >= 15:
        adx_comment = "weak trend — range-bound conditions possible"
    else:
        adx_comment = "no clear trend — choppy price action"

    # ── MACD Yorumu ───────────────────────────────────────────────────────────
    if macd_hist > 0:
        macd_comment = f"positive histogram ({macd_hist:+.3f}) — bullish momentum expanding"
    else:
        macd_comment = f"negative histogram ({macd_hist:+.3f}) — bearish pressure building"

    # ── Değerleme Özeti ───────────────────────────────────────────────────────
    if pe > 0 and rev_g > 0:
        peg_approx = pe / rev_g
        if peg_approx < 1.0:
            val_comment = f"trading at a potential discount (PEG ~{peg_approx:.1f}x) — growth not fully priced"
        elif peg_approx < 2.0:
            val_comment = f"fairly valued relative to growth (PEG ~{peg_approx:.1f}x)"
        else:
            val_comment = f"elevated valuation (PEG ~{peg_approx:.1f}x) — growth must continue to justify"
    else:
        val_comment = "valuation data incomplete — fundamental caution warranted"

    # ── R/R Yorumu ────────────────────────────────────────────────────────────
    if rr >= 3.0:
        rr_comment = f"{rr:.1f}:1 — exceptional risk/reward setup"
    elif rr >= 2.0:
        rr_comment = f"{rr:.1f}:1 — attractive risk/reward for swing traders"
    elif rr >= 1.5:
        rr_comment = f"{rr:.1f}:1 — acceptable risk/reward with disciplined stop"
    else:
        rr_comment = f"{rr:.1f}:1 — marginal risk/reward — position sizing critical"

    language_configs = {
        "en": {
            "lang_name":    "English",
            "region_note":  "Use professional American/British financial English. Keep the tone confident and data-driven.",
            "homepage_len": "ONE powerful sentence (max 25 words) that highlights both the opportunity and the key risk.",
            "detail_len":   "5 to 7 sentences. Structure: (1) What the company does in plain English, (2) Why BOGA AI selected it, (3) Technical momentum reading, (4) Fundamental health snapshot, (5) The specific risk to watch, (6) Entry/target/stop in plain numbers.",
        },
        "tr": {
            "lang_name":    "Turkish",
            "region_note":  "Türkiye finans camiasının kullandığı profesyonel ama anlaşılır bir dil kullan. 'Pozisyon', 'breakout', 'momentum', 'stop' gibi sektör terimleri kabul edilebilir.",
            "homepage_len": "TEK güçlü cümle (maks. 30 kelime) — hem fırsatı hem temel riski vurgula.",
            "detail_len":   "5 ila 7 cümle. Yapı: (1) Şirket ne iş yapar — sade Türkçe, (2) BOGA AI neden seçti, (3) Teknik momentum okumas, (4) Temel sağlık özeti, (5) İzlenecek spesifik risk, (6) Giriş/hedef/stop rakamları.",
        },
        "es": {
            "lang_name":    "Spanish",
            "region_note":  "Usa español financiero latinoamericano (México, Argentina, Colombia) — profesional pero accesible para no expertos.",
            "homepage_len": "UNA frase poderosa (máx. 28 palabras) que destaque tanto la oportunidad como el riesgo clave.",
            "detail_len":   "5 a 7 oraciones. Estructura: (1) Qué hace la empresa en lenguaje simple, (2) Por qué BOGA AI la seleccionó, (3) Lectura del momentum técnico, (4) Resumen de salud fundamental, (5) El riesgo específico a vigilar, (6) Entrada/objetivo/stop en números claros.",
        },
        "pt": {
            "lang_name":    "Portuguese",
            "region_note":  "Use português financeiro brasileiro — profissional mas acessível para investidores iniciantes e intermediários.",
            "homepage_len": "UMA frase forte (máx. 28 palavras) que destaque a oportunidade e o risco principal.",
            "detail_len":   "5 a 7 frases. Estrutura: (1) O que a empresa faz em linguagem simples, (2) Por que BOGA AI a selecionou, (3) Leitura do momentum técnico, (4) Resumo da saúde fundamental, (5) O risco específico a monitorar, (6) Entrada/alvo/stop em números objetivos.",
        },
        "fr": {
            "lang_name":    "French",
            "region_note":  "Utilise le français financier professionnel (style Euronext/AMF) — rigoureux mais compréhensible pour un non-spécialiste.",
            "homepage_len": "UNE phrase percutante (max. 28 mots) qui souligne à la fois l'opportunité et le risque clé.",
            "detail_len":   "5 à 7 phrases. Structure : (1) Ce que fait l'entreprise en termes simples, (2) Pourquoi BOGA AI l'a sélectionnée, (3) Lecture du momentum technique, (4) Bilan de santé fondamental, (5) Le risque spécifique à surveiller, (6) Entrée/objectif/stop en chiffres précis.",
        },
        "id": {
            "lang_name":    "Indonesian",
            "region_note":  "Gunakan bahasa Indonesia keuangan profesional (IDX/OJK standard) — tegas namun mudah dipahami investor ritel.",
            "homepage_len": "SATU kalimat kuat (maks. 28 kata) yang menonjolkan peluang dan risiko utama.",
            "detail_len":   "5 hingga 7 kalimat. Struktur: (1) Apa yang dilakukan perusahaan dalam bahasa sederhana, (2) Mengapa BOGA AI memilihnya, (3) Pembacaan momentum teknikal, (4) Ringkasan kesehatan fundamental, (5) Risiko spesifik yang perlu dipantau, (6) Entry/target/stop dalam angka yang jelas.",
        },
    }

    prompt = f"""
You are BOGA AI — the engine behind the "Kartal Yuvası Alpha Commander v5.5" protocol.
Your mission: produce institutional-grade yet plain-language investment summaries for {ticker} ({company}), a {sector} company.

═══════════════════════════════════════════════════════
MARKET INTELLIGENCE BRIEFING — {ticker}
═══════════════════════════════════════════════════════

▌ SCORE & IDENTITY
  BOGA AI Score  : {score_100}/100
  Sector         : {sector}
  Market Cap     : ${mcap:.1f}B
  Current Price  : ${price:.2f}
  Entry Trigger  : {entry_trigger}
  Trend (Daily)  : {trend_status}

▌ TECHNICAL MATRIX (Kartal Gözü)
  RSI (14)       : {rsi:.1f} → {rsi_comment}
  ADX            : {adx:.1f} → {adx_comment}
  MACD           : {macd_comment}
  MFI            : {mfi:.1f} (Money Flow — {('accumulation signal' if mfi > 60 else 'distribution warning' if mfi < 40 else 'neutral flow')})
  EMA Ribbon     : Price is {ema20_status} | {ema50_status} | {ema200_status}

▌ PERFORMANCE CONTEXT
  1D / 1W / 1M   : {p1d:+.1f}% / {p1w:+.1f}% / {p1m:+.1f}%
  1Y / 5Y        : {p1y:+.1f}% / {p5y:+.1f}%

▌ FUNDAMENTAL HEALTH (Quant Metrics)
  Revenue Growth : {rev_g:.1f}%
  Gross Margin   : {gross_m:.1f}%
  Operating Margin: {op_m:.1f}%
  Net Margin     : {net_m:.1f}%
  P/E Ratio      : {pe:.1f}x
  P/B Ratio      : {pb:.1f}x
  FCF Yield      : {fcf_y:.1f}%
  Valuation      : {val_comment}

▌ TACTICAL ZONES (Operasyonel Plan)
  Buy Zone       : ${buy_low:.2f} – ${buy_high:.2f}
  Take Profit    : ${sell_high:.2f}
  Stop Loss      : ${stop_high:.2f} (pain threshold)
  Risk/Reward    : {rr_comment}

═══════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════

Generate summaries in ALL SIX languages below. For each language, follow the
specific regional finance dialect and length instructions precisely.

LANGUAGE INSTRUCTIONS:
{chr(10).join([f'  [{k.upper()}] {v["lang_name"]}: {v["region_note"]} | homepage → {v["homepage_len"]} | detail → {v["detail_len"]}' for k, v in language_configs.items()])}

CONTENT RULES (apply to ALL languages):
1. homepage_summary : Captures both the alpha opportunity AND the main risk in one breath.
   Never generic. Always name a specific catalyst or data point from above.
2. detail_summary   : Write like a calm, senior analyst briefing a smart but non-finance CEO.
   Use plain language. Explain what RSI, ADX, margin mean in human terms (no jargon dumps).
   Mention: company role in sector, why the score is high, one key risk, the entry/stop setup.
3. NEVER use these hollow phrases: "compelling opportunity", "promising outlook",
   "solid fundamentals", "strong momentum" without backing with a specific number.
4. Tone: Confident, measured, honest about risk — not a sales pitch.

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no preamble:
{{
  "homepage_summary": {{
    "en": "...",
    "tr": "...",
    "es": "...",
    "pt": "...",
    "fr": "...",
    "id": "..."
  }},
  "detail_summary": {{
    "en": "...",
    "tr": "...",
    "es": "...",
    "pt": "...",
    "fr": "...",
    "id": "..."
  }}
}}
"""

    try:
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.45,
                "maxOutputTokens": 3500,
                "topP": 0.92,
                "topK": 40,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT",        "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH",       "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ],
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=45) as resp:
                if resp.status != 200:
                    logging.error(f"Gemini API hatası ({ticker}): HTTP {resp.status}")
                    return _fallback_summary(c)
                data = await resp.json()

        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]

        raw_text = re.sub(r"```json\s*", "", raw_text)
        raw_text = re.sub(r"```\s*",     "", raw_text)
        raw_text = raw_text.strip()

        result = json.loads(raw_text)

        required_keys = {"en", "tr", "es", "pt", "fr", "id"}
        for field in ("homepage_summary", "detail_summary"):
            if field not in result:
                raise ValueError(f"Missing field in Gemini response: {field}")
            missing_langs = required_keys - set(result[field].keys())
            if missing_langs:
                logging.warning(f"⚠️ {ticker}: Gemini yanıtında eksik dil(ler): {missing_langs} — fallback ile tamamlanıyor")
                fb = _fallback_summary(c)
                for lang in missing_langs:
                    result[field][lang] = fb[field].get(lang, "")

        logging.info(f"✅ {ticker}: Gemini AI özeti başarıyla oluşturuldu")
        return result

    except Exception as e:
        logging.error(f"❌ {ticker} Gemini API hatası: {e}")
        return _fallback_summary(c)

def _fallback_summary(c: dict) -> dict:
    ticker  = c.get("ticker", "")
    company = c.get("company", ticker)
    sector  = c.get("sector", "Unknown")
    score   = c.get("boga_score_100", c.get("score", 0.0))
    trend   = c.get("trend_durumu_1d", "Bullish")
    rsi     = c.get("rsi_14", c.get("rsi", 50.0))
    adx     = c.get("adx", 0.0)
    macd_h  = c.get("macd_hist", 0.0)
    price   = c.get("current_price", 0.0)

    perf    = c.get("performance", {})
    p1y     = perf.get("1y", c.get("change_1y", 0.0))
    p1m     = perf.get("1m", c.get("change_1m", 0.0))

    fin = c.get("fin_health", c.get("fundamentals", {}))
    rev_g   = fin.get("revenue_growth", fin.get("revenue_growth_pct", 0.0))
    net_m   = fin.get("net_margin", fin.get("net_margin_pct", 0.0))
    pe      = fin.get("pe_ratio", 0.0)

    zones    = c.get("zones", c.get("boga_zones", {}))
    if "buy_zone" not in zones and "buying_zone" in zones:
        zones["buy_zone"] = zones["buying_zone"]
        
    buy_low  = c.get("buy_zone", {}).get("low", price * 0.97)
    buy_high = c.get("buy_zone", {}).get("high", price * 0.99)
    sell_h   = c.get("profit_zone", {}).get("high", price * 1.08)
    stop_h   = c.get("stop_zone", {}).get("high", price * 0.94)
    rr       = zones.get("rr_ratio", zones.get("risk_reward", 2.0))

    if rsi >= 70:
        rsi_ctx_en = f"RSI at {rsi:.0f} — the stock is in overbought territory, so a brief pullback before the next leg up is possible"
        rsi_ctx_tr = f"RSI {rsi:.0f} aşırı alım bölgesinde — kısa vadeli bir geri çekilme sonrası yükseliş sürebilir"
        rsi_ctx_es = f"RSI en {rsi:.0f} — sobrecomprado, posible corrección breve antes de continuar al alza"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — sobrecomprado, possível recuo breve antes de continuar em alta"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — suracheté, une correction courte est possible avant la prochaine hausse"
        rsi_ctx_id = f"RSI di {rsi:.0f} — jenuh beli, koreksi singkat mungkin terjadi sebelum melanjutkan naik"
    elif rsi >= 55:
        rsi_ctx_en = f"RSI at {rsi:.0f} — momentum is building in the healthy bullish zone without being overextended"
        rsi_ctx_tr = f"RSI {rsi:.0f} sağlıklı yükseliş bölgesinde — momentum aşırıya kaçmadan güçleniyor"
        rsi_ctx_es = f"RSI en {rsi:.0f} — impulso saludable, sin sobreextensión"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — momentum saudável, sem sobreextensão"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — momentum haussier sain, sans surextension"
        rsi_ctx_id = f"RSI di {rsi:.0f} — momentum bullish sehat, tidak berlebihan"
    else:
        rsi_ctx_en = f"RSI at {rsi:.0f} — still neutral; a catalyst is needed to confirm the breakout"
        rsi_ctx_tr = f"RSI {rsi:.0f} nötr bölgede — kırılımı teyitlemek için katalizör bekleniyor"
        rsi_ctx_es = f"RSI en {rsi:.0f} — neutral, se necesita catalizador para confirmar la ruptura"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — neutro, precisa de catalisador para confirmar o rompimento"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — neutre, un catalyseur est nécessaire pour confirmer la cassure"
        rsi_ctx_id = f"RSI di {rsi:.0f} — netral, butuh katalis untuk konfirmasi breakout"

    if adx >= 25:
        adx_ctx_en = f"with ADX at {adx:.0f} confirming a genuine trend"
        adx_ctx_tr = f"ADX {adx:.0f} gerçek bir trendin varlığını doğruluyor"
        adx_ctx_es = f"con ADX en {adx:.0f} confirmando una tendencia real"
        adx_ctx_pt = f"com ADX em {adx:.0f} confirmando uma tendência real"
        adx_ctx_fr = f"avec un ADX à {adx:.0f} confirmant une vraie tendance"
        adx_ctx_id = f"dengan ADX {adx:.0f} mengkonfirmasi tren nyata"
    else:
        adx_ctx_en = f"though ADX at {adx:.0f} suggests the trend is still maturing"
        adx_ctx_tr = f"ancak ADX {adx:.0f} trendin henüz olgunlaşma aşamasında olduğuna işaret ediyor"
        adx_ctx_es = f"aunque el ADX en {adx:.0f} indica que la tendencia aún madura"
        adx_ctx_pt = f"embora ADX em {adx:.0f} indique que a tendência ainda está se formando"
        adx_ctx_fr = f"bien que l'ADX à {adx:.0f} suggère que la tendance est encore en formation"
        adx_ctx_id = f"meskipun ADX {adx:.0f} menunjukkan tren masih dalam pematangan"

    macd_dir_en = "positive MACD histogram" if macd_h > 0 else "MACD histogram turning negative"
    macd_dir_tr = "pozitif MACD histogramı" if macd_h > 0 else "negatife dönen MACD histogramı"
    macd_dir_es = "histograma MACD positivo" if macd_h > 0 else "histograma MACD girando negativo"
    macd_dir_pt = "histograma MACD positivo" if macd_h > 0 else "histograma MACD virando negativo"
    macd_dir_fr = "histogramme MACD positif" if macd_h > 0 else "histogramme MACD virant négatif"
    macd_dir_id = "histogram MACD positif" if macd_h > 0 else "histogram MACD berbalik negatif"

    if pe > 40:
        pe_ctx_en = f"At P/E {pe:.0f}x, the valuation is high — which means the market expects strong growth; any earnings miss could trigger a sharp correction"
        pe_ctx_tr = f"F/K {pe:.0f}x değerleme yüksek — piyasa güçlü büyüme bekliyor; kazanç hayal kırıklığı sert düzeltmeyi tetikleyebilir"
        pe_ctx_es = f"Con P/E {pe:.0f}x, la valoración es elevada — el mercado exige crecimiento sostenido; una decepción en ganancias podría generar corrección"
        pe_ctx_pt = f"Com P/L {pe:.0f}x, a avaliação é alta — o mercado exige crescimento forte; uma decepção nos lucros pode gerar correção"
        pe_ctx_fr = f"Avec un P/E à {pe:.0f}x, la valorisation est élevée — le marché exige une forte croissance; une déception sur les bénéfices pourrait provoquer une correction"
        pe_ctx_id = f"Dengan P/E {pe:.0f}x, valuasi tinggi — pasar mengharapkan pertumbuhan kuat; kekecewaan laba dapat memicu koreksi tajam"
    elif pe > 0:
        pe_ctx_en = f"P/E at {pe:.0f}x is reasonable for the sector, leaving room for re-rating if earnings accelerate"
        pe_ctx_tr = f"F/K {pe:.0f}x sektör için makul — kazançlar hızlanırsa yeniden değerleme potansiyeli var"
        pe_ctx_es = f"P/E de {pe:.0f}x es razonable para el sector, con margen de revalorización si los beneficios aceleran"
        pe_ctx_pt = f"P/L de {pe:.0f}x é razoável para o setor, com espaço para reavaliação se os lucros acelerarem"
        pe_ctx_fr = f"Le P/E à {pe:.0f}x est raisonnable pour le secteur, avec une marge de revalorisation si les bénéfices s'accélèrent"
        pe_ctx_id = f"P/E {pe:.0f}x wajar untuk sektor ini, dengan ruang rerating jika laba meningkat"
    else:
        pe_ctx_en = "Valuation data is limited — weight technical signals more heavily for this setup"
        pe_ctx_tr = "Değerleme verisi sınırlı — bu kurulumda teknik sinyallere daha fazla ağırlık ver"
        pe_ctx_es = "Datos de valoración limitados — priorizar señales técnicas para este setup"
        pe_ctx_pt = "Dados de avaliação limitados — priorizar sinais técnicos neste setup"
        pe_ctx_fr = "Données de valorisation limitées — privilégier les signaux techniques pour ce setup"
        pe_ctx_id = "Data valuasi terbatas — lebih utamakan sinyal teknikal untuk setup ini"

    summaries = {"en": (), "tr": (), "es": (), "pt": (), "fr": (), "id": ()}

    summaries["en"] = (
        f"BOGA AI assigns {ticker} a score of {score:.0f}/100 in a {trend} trend — "
        f"entry zone ${buy_low:.2f}–${buy_high:.2f} targets ${sell_h:.2f} with a {rr:.1f}:1 risk/reward.",
        f"{company} operates in the {sector} sector, and BOGA AI's algorithm flagged it "
        f"with a {score:.0f}/100 score after detecting institutional accumulation signals aligned "
        f"with a {trend} daily trend. "
        f"On the technical side, {rsi_ctx_en}, {adx_ctx_en}, "
        f"and the {macd_dir_en} reinforces the directional bias. "
        f"Fundamentally, the company is growing revenue at {rev_g:.1f}% with a net margin of {net_m:.1f}%, "
        f"which means it keeps ${net_m:.1f} of profit for every $100 in sales. "
        f"{pe_ctx_en}. "
        f"The tactical setup: buy between ${buy_low:.2f} and ${buy_high:.2f}, "
        f"target ${sell_h:.2f}, and place a hard stop at ${stop_h:.2f} — "
        f"a {rr:.1f}:1 reward-to-risk ratio that makes this a disciplined swing trade candidate."
    )

    summaries["tr"] = (
        f"BOGA AI, {ticker} hissesine {trend} trend içinde {score:.0f}/100 skor verdi — "
        f"${buy_low:.2f}–${buy_high:.2f} giriş bölgesi, ${sell_h:.2f} hedef, {rr:.1f}:1 risk/ödül oranı.",
        f"{company}, {sector} sektöründe faaliyet gösteriyor ve BOGA AI algoritması, "
        f"kurumsal birikim sinyalleri ile {trend} günlük trendi tespit ederek hisseye {score:.0f}/100 skor atadı. "
        f"Teknik tarafta {rsi_ctx_tr}, {adx_ctx_tr} ve {macd_dir_tr} yönsel eğilimi destekliyor. "
        f"Temel açıdan bakıldığında şirket gelirlerini %{rev_g:.1f} büyütürken "
        f"net kar marjı %{net_m:.1f} — yani her 100 dolarlık satıştan {net_m:.1f} dolar kar elde ediyor. "
        f"{pe_ctx_tr}. "
        f"Operasyonel plan: ${buy_low:.2f}–${buy_high:.2f} aralığından giriş, "
        f"${sell_h:.2f} kâr hedefi, ${stop_h:.2f} kesin stop — "
        f"{rr:.1f}:1 risk/ödül oranıyla disiplinli bir swing trade fırsatı."
    )

    summaries["es"] = (
        f"BOGA AI otorga a {ticker} una puntuación de {score:.0f}/100 en tendencia {trend} — "
        f"zona de entrada ${buy_low:.2f}–${buy_high:.2f}, objetivo ${sell_h:.2f}, relación riesgo/beneficio {rr:.1f}:1.",
        f"{company} opera en el sector {sector}, y el algoritmo BOGA AI le asignó {score:.0f}/100 "
        f"al detectar señales de acumulación institucional alineadas con una tendencia {trend} diaria. "
        f"Técnicamente, {rsi_ctx_es}, {adx_ctx_es}, "
        f"y el {macd_dir_es} refuerza el sesgo direccional. "
        f"En lo fundamental, la empresa crece sus ingresos al {rev_g:.1f}% con un margen neto del {net_m:.1f}% — "
        f"es decir, retiene ${net_m:.1f} de ganancia por cada $100 en ventas. "
        f"{pe_ctx_es}. "
        f"El plan táctico: comprar entre ${buy_low:.2f} y ${buy_high:.2f}, "
        f"objetivo ${sell_h:.2f}, stop definitivo en ${stop_h:.2f} — "
        f"una relación recompensa/riesgo de {rr:.1f}:1 que lo convierte en candidato ideal para swing trade."
    )

    summaries["pt"] = (
        f"BOGA AI atribui ao {ticker} uma pontuação de {score:.0f}/100 em tendência {trend} — "
        f"zona de entrada ${buy_low:.2f}–${buy_high:.2f}, alvo ${sell_h:.2f}, relação risco/retorno {rr:.1f}:1.",
        f"{company} atua no setor de {sector}, e o algoritmo BOGA AI atribuiu {score:.0f}/100 "
        f"ao detectar sinais de acumulação institucional alinhados com uma tendência {trend} diária. "
        f"No âmbito técnico, {rsi_ctx_pt}, {adx_ctx_pt}, "
        f"e o {macd_dir_pt} reforça o viés direcional. "
        f"Nos fundamentos, a empresa cresce receita a {rev_g:.1f}% com margem líquida de {net_m:.1f}% — "
        f"ou seja, retém ${net_m:.1f} de lucro para cada $100 em vendas. "
        f"{pe_ctx_pt}. "
        f"O plano tático: comprar entre ${buy_low:.2f} e ${buy_high:.2f}, "
        f"alvo ${sell_h:.2f}, stop definitivo em ${stop_h:.2f} — "
        f"uma relação retorno/risco de {rr:.1f}:1 que o torna candidato ideal para swing trade."
    )

    summaries["fr"] = (
        f"BOGA AI attribue à {ticker} un score de {score:.0f}/100 en tendance {trend} — "
        f"zone d'entrée ${buy_low:.2f}–${buy_high:.2f}, objectif ${sell_h:.2f}, ratio risque/rendement {rr:.1f}:1.",
        f"{company} opère dans le secteur {sector}, et l'algorithme BOGA AI lui a attribué {score:.0f}/100 "
        f"après avoir détecté des signaux d'accumulation institutionnelle alignés sur une tendance {trend} journalière. "
        f"Techniquement, {rsi_ctx_fr}, {adx_ctx_fr}, "
        f"et le {macd_dir_fr} renforce le biais directionnel. "
        f"Sur le plan fondamental, l'entreprise affiche une croissance des revenus de {rev_g:.1f}% "
        f"avec une marge nette de {net_m:.1f}% — soit ${net_m:.1f} de bénéfice pour chaque $100 de ventes. "
        f"{pe_ctx_fr}. "
        f"Le plan tactique : achat entre ${buy_low:.2f} et ${buy_high:.2f}, "
        f"objectif ${sell_h:.2f}, stop définitif à ${stop_h:.2f} — "
        f"un ratio rendement/risque de {rr:.1f}:1 qui en fait un candidat idéal pour le swing trade."
    )

    summaries["id"] = (
        f"BOGA AI memberi {ticker} skor {score:.0f}/100 dalam tren {trend} — "
        f"zona beli ${buy_low:.2f}–${buy_high:.2f}, target ${sell_h:.2f}, rasio risiko/imbalan {rr:.1f}:1.",
        f"{company} beroperasi di sektor {sector}, dan algoritma BOGA AI menetapkan skor {score:.0f}/100 "
        f"setelah mendeteksi sinyal akumulasi institusional yang selaras dengan tren {trend} harian. "
        f"Secara teknikal, {rsi_ctx_id}, {adx_ctx_id}, "
        f"dan {macd_dir_id} memperkuat bias arah pergerakan. "
        f"Secara fundamental, perusahaan tumbuh pendapatannya {rev_g:.1f}% dengan margin bersih {net_m:.1f}% — "
        f"artinya setiap $100 penjualan menghasilkan ${net_m:.1f} keuntungan bersih. "
        f"{pe_ctx_id}. "
        f"Rencana taktis: beli di antara ${buy_low:.2f} dan ${buy_high:.2f}, "
        f"target ${sell_h:.2f}, stop ketat di ${stop_h:.2f} — "
        f"rasio imbalan/risiko {rr:.1f}:1 menjadikannya kandidat swing trade yang terukur."
    )

    return {
        "homepage_summary": {k: v[0] for k, v in summaries.items()},
        "detail_summary":   {k: v[1] for k, v in summaries.items()},
    }


async def main():
    all_picks_path = 'frontend/public/swing_all_picks.json'
    top_picks_path = 'frontend/public/swing_picks.json'

    if not os.path.exists(all_picks_path):
        logging.error("Source list not found!")
        return

    with open(all_picks_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        picks = data.get('picks', [])

    if not picks:
        return

    logging.info(f"Updating AI summaries for {len(picks)} candidates...")

    for p in picks:
        summary = await generate_gemini_summary(p, p.get("fundamentals", {}), None)
        p["ai_summary"] = summary
        p["reasoning"] = summary["homepage_summary"].get("en", "")
        p["detail_reasoning"] = summary["detail_summary"].get("en", "")
        
        # update the detail file in frontend/public/data/{ticker}.json
        detail_path = f"frontend/public/data/{p['ticker']}.json"
        if os.path.exists(detail_path):
            try:
                with open(detail_path, "r", encoding="utf-8") as df:
                    ddata = json.load(df)
                    ddata["ai_summary"] = summary
                    if "ai_reasoning" in ddata:
                        ddata["ai_reasoning"] = summary["detail_summary"].get("en", "")
                with open(detail_path, "w", encoding="utf-8") as df:
                    json.dump(ddata, df, indent=2, ensure_ascii=False)
            except Exception as e:
                pass


    with open(all_picks_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    top_20_data = data.copy()
    top_20_data['picks'] = data['picks'][:20]
    with open(top_picks_path, 'w', encoding='utf-8') as f:
        json.dump(top_20_data, f, indent=2, ensure_ascii=False)

    logging.info("Gemini AI summaries updated successfully for all candidates.")

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
