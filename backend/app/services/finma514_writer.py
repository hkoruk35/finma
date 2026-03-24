"""
finma514_writer.py — Supabase + Redis Yazıcı
─────────────────────────────────────────────
finma514.py scan tamamlandıktan sonra çağrılır:
  1. Supabase daily_scores tablosuna 54 hisseyi upsert eder
  2. Redis'e hot-cache (daily:top54:{date}) yazar
  3. Redis finma:finma514_stream'e SSE olayı yayınlar
  4. finma514_ai_worker + finma514_translation başlatır (arka plan)

Dışarıdan çağrı:
  from app.services.finma514_writer import write_to_db
  result = write_to_db(payload)  # sync
  # ya da
  result = await write_to_db_async(payload)
"""

import asyncio
import json
import logging
import math
import os
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ─── Bağlantılar ─────────────────────────────────────────────────────────────

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


# ─── Float sanitizer ─────────────────────────────────────────────────────────

def _f(val, default: float = 0.0) -> float:
    """NaN / Infinity → default (0.0). JSON ve Supabase uyumlu float döner."""
    try:
        v = float(val)
        return default if (math.isnan(v) or math.isinf(v)) else v
    except (TypeError, ValueError):
        return default


# ─── JSON → Supabase row dönüşümü ────────────────────────────────────────────

def _stock_to_row(stock: dict, run_ts: str, market_date: str,
                  market_regime: str, vix: float, run_time_ny: str) -> dict:
    """Bir hisse dict'ini daily_scores tablo satırına dönüştürür."""
    # interest_zone string ya da dict olabilir
    iz = stock.get("interest_zone", "")
    if isinstance(iz, dict):
        iz = f"{iz.get('low',0):.2f}-{iz.get('high',0):.2f}"

    breakdown = stock.get("score_breakdown") or stock.get("breakdown") or {}

    return {
        "run_timestamp":  run_ts,
        "market_date":    market_date,
        "run_time_ny":    run_time_ny,
        "market_regime":  market_regime,
        "vix":            _f(vix),
        "ticker":         stock.get("ticker", ""),
        "company_name":   stock.get("company_name", ""),
        "sector":         stock.get("sector", ""),
        "industry":       stock.get("industry", ""),
        "exchange":       stock.get("exchange", ""),
        "market_cap":     int(stock.get("market_cap", 0) or 0),
        "market_cap_fmt": stock.get("market_cap_fmt", ""),
        "tag":            stock.get("tag", "CORE"),
        "tier":           stock.get("tier", "WATCH"),
        "score":          int(stock.get("score", 0) or 0),
        "score_trend":    int(breakdown.get("trend", 0) or 0),
        "score_volume":   int(breakdown.get("volume", 0) or 0),
        "score_momentum": int(breakdown.get("momentum", 0) or 0),
        "score_context":  int(breakdown.get("context", 0) or 0),
        "price":          _f(stock.get("price")),
        "change_1d":      _f(stock.get("change_1d")),
        "change_5d":      _f(stock.get("change_5d")),
        "change_1m":      _f(stock.get("change_1m")),
        "rvol":           _f(stock.get("rvol")),
        "rsi":            _f(stock.get("rsi"), 50.0),
        "adx":            _f(stock.get("adx")),
        "atr_pct":        _f(stock.get("atr_pct")),
        "bb_width":       _f(stock.get("bb_width")),
        "ema20":          _f(stock.get("ema20")),
        "ema50":          _f(stock.get("ema50")),
        "ema200":         _f(stock.get("ema200")),
        "interest_zone":  str(iz),
        "stop_loss":      _f(stock.get("stop_loss")),
        "target_1":       _f(stock.get("target_1")),
        "target_2":       _f(stock.get("target_2")),
        # AI metin (template_v1 Türkçe)
        "ai_market_context":     str(stock.get("ai_text", {}).get("market_context", "")),
        "ai_interest_zone_text": str(stock.get("ai_text", {}).get("interest_zone_text", "")),
        "ai_scenario_bull":      str(stock.get("ai_text", {}).get("scenario_bull", "")),
        "ai_scenario_bear":      str(stock.get("ai_text", {}).get("scenario_bear", "")),
        "ai_scenario_neutral":   str(stock.get("ai_text", {}).get("scenario_neutral", "")),
        "ai_risk_reference":     str(stock.get("ai_text", {}).get("risk_reference", "")),
        "ai_strategy_note":      str(stock.get("ai_text", {}).get("strategy_note", "")),
    }


# ─── Ana yazıcı (sync wrapper) ───────────────────────────────────────────────

def write_to_db(payload: dict) -> dict:
    """
    Senkron giriş noktası — finma514.py'den asyncio.to_thread() ile çağrılır.

    Döner:
        { supabase_ok, redis_ok, rows_written, errors }
    """
    result = {
        "supabase_ok":  False,
        "redis_ok":     False,
        "rows_written": 0,
        "errors":       [],
    }

    all_54      = payload.get("all_54", [])
    run_ts      = payload.get("run_timestamp", datetime.utcnow().isoformat())
    market_date = payload.get("market_date", run_ts[:10])
    regime      = payload.get("market_regime", "UNKNOWN")
    vix         = float(payload.get("vix", 0.0))
    run_time    = payload.get("run_time_ny", "")

    if not all_54:
        result["errors"].append("all_54 listesi boş — yazma atlandı")
        return result

    rows = [
        _stock_to_row(s, run_ts, market_date, regime, vix, run_time)
        for s in all_54
        if s.get("ticker")
    ]

    # ── 1. Supabase upsert ────────────────────────────────────────
    sb = _get_supabase()
    if sb:
        try:
            batch_size = 50
            written = 0
            for i in range(0, len(rows), batch_size):
                sb.table("daily_scores").upsert(
                    rows[i:i + batch_size],
                    on_conflict="run_timestamp,ticker",
                ).execute()
                written += len(rows[i:i + batch_size])
            result["supabase_ok"]  = True
            result["rows_written"] = written
            logger.info(f"Supabase: {written} satır daily_scores tablosuna yazıldı")
        except Exception as e:
            msg = f"Supabase upsert hatası: {e}"
            logger.error(msg)
            result["errors"].append(msg)
    else:
        result["errors"].append("Supabase bağlantısı yok (env eksik?)")

    # ── 2. Redis hot-cache ────────────────────────────────────────
    rc = _get_redis()
    if rc:
        try:
            cache_key = f"daily:top54:{market_date}"
            # Tablo için sadeleştirilmiş veri (ai_text dahil)
            slim_list = [
                {
                    k: v for k, v in s.items()
                    if k not in ("notes", "beta")
                }
                for s in all_54
            ]
            rc.setex(cache_key, 86_400, json.dumps(slim_list, ensure_ascii=False, default=str))

            # Meta cache
            rc.setex(
                f"daily:meta:{market_date}",
                86_400,
                json.dumps({
                    "market_regime": regime,
                    "vix":           vix,
                    "run_timestamp": run_ts,
                    "run_time_ny":   run_time,
                    "stock_count":   len(all_54),
                }, ensure_ascii=False),
            )

            result["redis_ok"] = True
            logger.info(f"Redis: daily:top54:{market_date} güncellendi")
        except Exception as e:
            msg = f"Redis cache hatası: {e}"
            logger.error(msg)
            result["errors"].append(msg)
    else:
        result["errors"].append("Redis bağlantısı yok")

    # ── 3. Redis SSE stream olayı yayınla ─────────────────────────
    if rc:
        try:
            event_payload = json.dumps({
                "event_type":    "FINMA514_UPDATED",
                "market_date":   market_date,
                "run_timestamp": run_ts,
                "run_time_ny":   run_time,
                "stock_count":   len(all_54),
                "market_regime": regime,
                "vix":           vix,
            }, ensure_ascii=False)

            rc.xadd(
                "finma:finma514_stream",
                {"payload": event_payload},
                maxlen=100,
            )
            logger.info("Redis finma:finma514_stream olayı yayınlandı")
        except Exception as e:
            result["errors"].append(f"Redis stream xadd hatası: {e}")

    # ── 4. Gemini AI + DeepL (arka plan thread) ───────────────────
    _launch_ai_background(all_54, market_date, run_ts, regime)

    return result


def _launch_ai_background(
    all_54: list, market_date: str, run_ts: str, regime: str
):
    """Gemini AI üretimi + DeepL çevirisini arka planda başlatır."""
    import threading

    def _run():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_ai_pipeline(all_54, market_date, run_ts, regime))
            loop.close()
        except Exception as e:
            logger.warning(f"AI arka plan pipeline hatası: {e}")

    t = threading.Thread(target=_run, daemon=True, name="finma514_ai")
    t.start()
    logger.info("AI arka plan pipeline başlatıldı (Gemini + DeepL)")


async def _ai_pipeline(
    all_54: list, market_date: str, run_ts: str, regime: str
):
    """Gemini AI üretimi + DeepL çevirisi."""
    try:
        from app.services.finma514_ai_worker import generate_ai_insights
        insights = await generate_ai_insights(
            all_54, market_date, run_ts, regime=regime
        )
        logger.info(f"Gemini AI: {len(insights)} hisse için metin üretildi")

        if insights:
            from app.services.finma514_translation import translate_all_insights
            await translate_all_insights(insights, market_date, run_ts)
            logger.info("DeepL çeviri pipeline tamamlandı")

    except ImportError as e:
        logger.warning(f"AI worker import hatası: {e}")
    except Exception as e:
        logger.error(f"AI pipeline hatası: {e}")
