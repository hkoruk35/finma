"""
finma514_translation.py — DeepL 7 Dil Çeviri Pipeline
───────────────────────────────────────────────────────
Türkçe AI metnini 6 hedef dile çevirir ve Redis + Supabase'e yazar.

Desteklenen diller:
  tr (kaynak) | en | es | pt | ar | id | ja

Akış:
  1. Türkçe AI metni al (generate_ai_insights çıktısı)
  2. DeepL API ile 6 dile paralel çevir
  3. Redis: insight:{ticker}:{lang}:{date} → TTL 24h
  4. Supabase: ai_insights tablosu (her dil için bir satır)

DeepL API key yoksa sadece Türkçe çalışır, hata vermez.
"""

import asyncio
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# DeepL dil kodları → Supabase lang kodu
_LANG_MAP = {
    "en": "EN-US",
    "es": "ES",
    "pt": "PT-BR",
    "ar": "AR",
    "id": "ID",
    "ja": "JA",
}

# Çevrilecek 7 metin alanı
_TEXT_FIELDS = [
    "market_context",
    "interest_zone_text",
    "scenario_bull",
    "scenario_bear",
    "scenario_neutral",
    "risk_reference",
    "strategy_note",
]


# ─── DeepL çevirici ─────────────────────────────────────────────────

async def _translate_text(text: str, target_lang: str, api_key: str) -> str:
    """Tek metin parçasını DeepL ile çevirir."""
    if not text or not text.strip():
        return text
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api-free.deepl.com/v2/translate",
                data={
                    "auth_key": api_key,
                    "text":     text,
                    "target_lang": target_lang,
                    "source_lang": "TR",
                    "tag_handling": "xml",
                },
            )
            resp.raise_for_status()
            return resp.json()["translations"][0]["text"]
    except Exception as e:
        logger.debug(f"DeepL çeviri hatası ({target_lang}): {e}")
        return text   # Hata durumunda orijinal metni döndür


async def _translate_insight(
    insight: dict, lang_code: str, deepl_lang: str, api_key: str
) -> dict:
    """Bir hisse AI metninin tüm 7 alanını çevirir."""
    translated = {}
    tasks = {
        field: _translate_text(insight.get(field, ""), deepl_lang, api_key)
        for field in _TEXT_FIELDS
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    for field, result in zip(tasks.keys(), results):
        translated[field] = result if isinstance(result, str) else insight.get(field, "")
    translated["_generated_by"] = insight.get("_generated_by", "gemini-2.0-flash") + "+deepl"
    translated["_legal_safe"]   = True
    return translated


# ─── Redis & Supabase ────────────────────────────────────────────────

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


# ─── Ana pipeline ────────────────────────────────────────────────────

async def translate_all_insights(
    insights: dict,          # { ticker: { ...ai_fields } }
    market_date: str,
    run_timestamp: str,
    semaphore_size: int = 3,
) -> dict:
    """
    Tüm hisseler için 6 dile çeviri yapar.

    Parametreler:
        insights      : finma514_ai_worker.generate_ai_insights() çıktısı
        market_date   : 'YYYY-MM-DD'
        run_timestamp : ISO string

    Döner:
        { ticker: { lang: { ...7_fields }, ... }, ... }
    """
    api_key = os.getenv("DEEPL_API_KEY", "")
    if not api_key:
        logger.warning("DEEPL_API_KEY eksik — çeviri atlandı (sadece Türkçe aktif)")
        return {}

    rc  = _get_redis()
    sb  = _get_supabase()
    sem = asyncio.Semaphore(semaphore_size)
    all_results: dict = {}
    sb_rows: list = []

    async def process_ticker(ticker: str, tr_insight: dict):
        ticker_results = {}

        for lang_code, deepl_lang in _LANG_MAP.items():
            # ── Cache kontrolü ──────────────────────────────────────
            if rc:
                cache_key = f"insight:{ticker}:{lang_code}:{market_date}"
                cached = rc.get(cache_key)
                if cached:
                    try:
                        ticker_results[lang_code] = json.loads(cached)
                        continue
                    except Exception:
                        pass

            # ── DeepL çevirisi ──────────────────────────────────────
            async with sem:
                translated = await _translate_insight(
                    tr_insight, lang_code, deepl_lang, api_key
                )

            ticker_results[lang_code] = translated

            # ── Redis'e yaz ─────────────────────────────────────────
            if rc:
                try:
                    rc.setex(
                        f"insight:{ticker}:{lang_code}:{market_date}",
                        86_400,
                        json.dumps(translated, ensure_ascii=False),
                    )
                except Exception as e:
                    logger.debug(f"Redis çeviri yazma hatası ({ticker}/{lang_code}): {e}")

            # ── Supabase satırı ─────────────────────────────────────
            sb_rows.append({
                "ticker":             ticker,
                "market_date":        market_date,
                "run_timestamp":      run_timestamp,
                "lang":               lang_code,
                "market_context":     translated.get("market_context", ""),
                "interest_zone_text": translated.get("interest_zone_text", ""),
                "scenario_bull":      translated.get("scenario_bull", ""),
                "scenario_bear":      translated.get("scenario_bear", ""),
                "scenario_neutral":   translated.get("scenario_neutral", ""),
                "risk_reference":     translated.get("risk_reference", ""),
                "strategy_note":      translated.get("strategy_note", ""),
                "generated_by":       translated.get("_generated_by", ""),
            })

        if ticker_results:
            all_results[ticker] = ticker_results

    tasks = [
        process_ticker(ticker, insight)
        for ticker, insight in insights.items()
    ]
    await asyncio.gather(*tasks)

    # ── Supabase toplu upsert ───────────────────────────────────────
    if sb and sb_rows:
        try:
            # 100'er satır batch
            batch_size = 100
            for i in range(0, len(sb_rows), batch_size):
                sb.table("ai_insights").upsert(
                    sb_rows[i:i + batch_size],
                    on_conflict="run_timestamp,ticker,lang",
                ).execute()
            logger.info(
                f"Çeviri tamamlandı: {len(sb_rows)} satır Supabase'e yazıldı "
                f"({len(insights)} hisse × {len(_LANG_MAP)} dil)"
            )
        except Exception as e:
            logger.error(f"Supabase çeviri upsert hatası: {e}")

    return all_results
