"""
finma514_ai_worker.py — Gemini AI Batch Worker
────────────────────────────────────────────────
54 hisse için legal-safe AI metin üretimi (Gemini 2.0 Flash).
Çıktı: 7 alan (market_context, interest_zone_text, scenario_bull,
        scenario_bear, scenario_neutral, risk_reference, strategy_note)

Akış:
  1. Redis'te insight:{ticker}:tr:{date} varsa → cache hit, atla
  2. Yoksa Gemini'ye batch prompt gönder
  3. Sonucu Redis'e yaz (TTL 24h) + Supabase ai_insights tablosuna upsert

Çağrı: await generate_ai_insights(all_54, market_date)
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Desteklenen diller ──────────────────────────────────────────────
SUPPORTED_LANGS = ["tr", "en", "es", "pt", "ar", "id", "ja"]

# ─── Legal-safe sistem prompt (değiştirilemez çekirdek) ─────────────
_SYSTEM_PROMPT = """Sen FinMA AI Analytics asistanısın. Finansal piyasa analizi yapıyorsun.

ZORUNLU KURALLAR:
1. Hiçbir zaman kesin alım/satım tavsiyesi verme.
2. Yasaklı ifadeler kullanma: "al", "sat", "kesinlikle", "guaranteed", "buy", "sell", "enter now", "strong buy".
3. Her cümle olasılık dili içermeli: "olası", "mümkün", "izlenebilir", "bazı yatırımcılar tercih edebilir", "senaryo", "may", "could", "possible".
4. Türkçe yanıt ver.
5. JSON formatında yanıt ver — başka açıklama ekleme.
"""

_USER_TEMPLATE = """Aşağıdaki hisse için 7 alanlı analiz üret. SADECE JSON döndür.

Hisse: {ticker} — {company_name}
Sektör: {sector}
Fiyat: ${price}
Günlük değişim: %{change_1d}
RSI: {rsi}
ADX: {adx}
RVOL: {rvol}
EMA20/50: {ema20}/{ema50}
İlgi Bölgesi: {interest_zone}
Stop Referansı: ${stop_loss}
Hedef 1: ${target_1} | Hedef 2: ${target_2}
Skor: {score}/100 ({tier})
Piyasa Rejimi: {regime}

JSON şablonu (bu alanları doldur):
{{
  "market_context": "...",
  "interest_zone_text": "...",
  "scenario_bull": "...",
  "scenario_bear": "...",
  "scenario_neutral": "...",
  "risk_reference": "...",
  "strategy_note": "..."
}}"""

# ─── Yasaklı kelime temizleyici ──────────────────────────────────────
_FORBIDDEN = re.compile(
    r"\b(buy|sell|strong buy|enter now|guaranteed|exact target|"
    r"kesinlikle al|satin al|kesin kar|emir ver|al şimdi|hemen gir|"
    r"\bal\b|\bsat\b)\b",
    re.IGNORECASE,
)

def _guard(text: str) -> str:
    return _FORBIDDEN.sub("[—]", text)


# ─── Gemini çağrısı ─────────────────────────────────────────────────

async def _call_gemini_once(prompt: str, api_key: str) -> Optional[dict]:
    """Tek hisse için Gemini çağrısı — JSON dict döner."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=_SYSTEM_PROMPT,
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        raw = response.text.strip()

        # Markdown kod bloğunu temizle
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)

        # 7 alan doğrulama + guard
        required = [
            "market_context", "interest_zone_text", "scenario_bull",
            "scenario_bear", "scenario_neutral", "risk_reference", "strategy_note",
        ]
        for field in required:
            if field not in data:
                data[field] = ""
            else:
                data[field] = _guard(str(data[field]))

        data["_generated_by"] = "gemini-2.0-flash"
        data["_legal_safe"]   = True
        return data

    except Exception as e:
        logger.warning(f"Gemini çağrı hatası: {e}")
        return None


# ─── Redis & Supabase yardımcıları ──────────────────────────────────

def _get_redis():
    try:
        import redis as redis_lib
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(url, decode_responses=True, socket_timeout=3)
        r.ping()
        return r
    except Exception:
        return None


def _get_supabase():
    try:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_KEY", "")
        if not url or not key:
            return None
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


def _redis_insight_key(ticker: str, lang: str, date: str) -> str:
    return f"insight:{ticker}:{lang}:{date}"


# ─── Ana batch worker ────────────────────────────────────────────────

async def generate_ai_insights(
    all_54: list,
    market_date: str,
    run_timestamp: str,
    regime: str = "UNKNOWN",
    semaphore_size: int = 5,
) -> dict:
    """
    54 hisse için Gemini AI metin üretir.

    Döner:
        { ticker: { ...7_fields, _generated_by, _legal_safe }, ... }
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY eksik — AI üretimi atlandı")
        return {}

    rc = _get_redis()
    sb = _get_supabase()
    sem = asyncio.Semaphore(semaphore_size)
    results: dict = {}
    new_insights: list = []    # Supabase'e yazılacaklar

    async def process_one(stock: dict):
        ticker = stock.get("ticker", "")
        if not ticker:
            return

        # ── Cache hit kontrolü ──────────────────────────────────────
        if rc:
            cached = rc.get(_redis_insight_key(ticker, "tr", market_date))
            if cached:
                try:
                    results[ticker] = json.loads(cached)
                    return
                except Exception:
                    pass

        # ── Gemini çağrısı ──────────────────────────────────────────
        async with sem:
            await asyncio.sleep(0.3)   # rate limit koruması
            prompt = _USER_TEMPLATE.format(
                ticker       = ticker,
                company_name = stock.get("company_name", ticker),
                sector       = stock.get("sector", "Unknown"),
                price        = stock.get("price", 0),
                change_1d    = stock.get("change_1d", 0),
                rsi          = stock.get("rsi", 50),
                adx          = stock.get("adx", 0),
                rvol         = stock.get("rvol", 1),
                ema20        = stock.get("ema20", 0),
                ema50        = stock.get("ema50", 0),
                interest_zone = stock.get("interest_zone", ""),
                stop_loss    = stock.get("stop_loss", 0),
                target_1     = stock.get("target_1", 0),
                target_2     = stock.get("target_2", 0),
                score        = stock.get("score", 0),
                tier         = stock.get("tier", "WATCH"),
                regime       = regime,
            )
            ai = await _call_gemini_once(prompt, api_key)

        if not ai:
            return

        results[ticker] = ai

        # ── Redis'e yaz (24h TTL) ───────────────────────────────────
        if rc:
            try:
                rc.setex(
                    _redis_insight_key(ticker, "tr", market_date),
                    86_400,
                    json.dumps(ai, ensure_ascii=False),
                )
            except Exception as e:
                logger.debug(f"Redis insight yazma hatası ({ticker}): {e}")

        # ── Supabase satırı hazırla ─────────────────────────────────
        new_insights.append({
            "ticker":             ticker,
            "market_date":        market_date,
            "run_timestamp":      run_timestamp,
            "lang":               "tr",
            "market_context":     ai.get("market_context", ""),
            "interest_zone_text": ai.get("interest_zone_text", ""),
            "scenario_bull":      ai.get("scenario_bull", ""),
            "scenario_bear":      ai.get("scenario_bear", ""),
            "scenario_neutral":   ai.get("scenario_neutral", ""),
            "risk_reference":     ai.get("risk_reference", ""),
            "strategy_note":      ai.get("strategy_note", ""),
            "generated_by":       "gemini-2.0-flash",
        })

    # ── Tüm hisseler paralel ────────────────────────────────────────
    tasks = [process_one(s) for s in all_54]
    await asyncio.gather(*tasks)

    # ── Supabase toplu upsert ───────────────────────────────────────
    if sb and new_insights:
        try:
            sb.table("ai_insights").upsert(
                new_insights,
                on_conflict="run_timestamp,ticker,lang",
            ).execute()
            logger.info(
                f"AI Worker: {len(new_insights)} Gemini insight "
                f"Supabase'e yazıldı [{market_date}]"
            )
        except Exception as e:
            logger.error(f"Supabase ai_insights upsert hatası: {e}")

    logger.info(
        f"AI Worker tamamlandı: {len(results)}/{len(all_54)} hisse "
        f"({len(new_insights)} yeni, {len(all_54)-len(new_insights)} cache hit)"
    )
    return results
