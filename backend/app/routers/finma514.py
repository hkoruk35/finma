"""
FinMA514 API Router — Sprint 2
──────────────────────────────
Endpoint'ler:
  GET /api/finma514/daily-insights          → Günün 54 hissesi (tüm liste)
  GET /api/finma514/stock/{ticker}          → Tek hisse detayı + AI metin
  GET /api/finma514/categories              → Kategorilere göre gruplu liste
  GET /api/finma514/status                  → Son tarama bilgisi

Veri öncelik sırası (her endpoint için):
  1. Redis hot cache (< 1ms)
  2. Supabase daily_scores + ai_insights tabloları
  3. Lokal JSON dosyası (bots/output/finma514_latest.json)
  4. 404

Query params:
  ?lang=tr   dil seçimi (tr|en|es|pt|ar|id|ja) — default: tr
  ?date=YYYY-MM-DD  belirli bir tarih — default: bugün
"""

import json
import logging
import os
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Path helpers ────────────────────────────────────────────────────
_HERE       = os.path.dirname(os.path.abspath(__file__))          # .../app/routers
_BACKEND    = os.path.dirname(os.path.dirname(_HERE))             # .../backend
_LATEST_JSON = os.path.join(_BACKEND, "bots", "output", "finma514_latest.json")

SUPPORTED_LANGS = {"tr", "en", "es", "pt", "ar", "id", "ja"}
CATEGORIES_MAP = {
    "CORE":   "core_picks",
    "SECTOR": "sector_leaders",
    "VOLUME": "high_volume",
    "GAINER": "top_gainers",
    "LOSER":  "oversold_losers",
}


# ─── Pydantic şemaları ───────────────────────────────────────────────

class ScoreBreakdown(BaseModel):
    trend:    int = 0
    volume:   int = 0
    momentum: int = 0
    context:  int = 0


class AIText(BaseModel):
    market_context:     str = ""
    interest_zone_text: str = ""
    scenario_bull:      str = ""
    scenario_bear:      str = ""
    scenario_neutral:   str = ""
    risk_reference:     str = ""
    strategy_note:      str = ""
    generated_by:       str = "template_v1"


class StockRecord(BaseModel):
    ticker:          str
    company_name:    str = ""
    sector:          str = ""
    industry:        str = ""
    exchange:        str = ""
    market_cap:      int = 0
    market_cap_fmt:  str = ""
    tag:             str = ""
    tier:            str = ""
    score:           int = 0
    score_breakdown: ScoreBreakdown = ScoreBreakdown()
    price:           float = 0.0
    change_1d:       float = 0.0
    change_5d:       float = 0.0
    change_1m:       float = 0.0
    rvol:            float = 0.0
    rsi:             float = 0.0
    adx:             float = 0.0
    atr_pct:         float = 0.0
    bb_width:        float = 0.0
    ema20:           float = 0.0
    ema50:           float = 0.0
    ema200:          float = 0.0
    interest_zone:   str = ""
    stop_loss:       float = 0.0
    target_1:        float = 0.0
    target_2:        float = 0.0
    ai_text:         AIText = AIText()


class DailyInsightsResponse(BaseModel):
    bot_name:      str
    market_date:   str
    run_timestamp: str
    run_time_ny:   str
    market_regime: str
    vix:           float
    stock_count:   int
    lang:          str
    stocks:        List[StockRecord]


class StatusResponse(BaseModel):
    last_run:      Optional[str]
    market_date:   Optional[str]
    stock_count:   int
    market_regime: str
    vix:           float
    source:        str


# ─── Veri erişim katmanı ─────────────────────────────────────────────

def _get_redis():
    try:
        import redis as redis_lib
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(url, decode_responses=True, socket_timeout=2)
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


def _load_from_json() -> Optional[dict]:
    """Lokal JSON dosyasından yükle (fallback)."""
    try:
        if os.path.exists(_LATEST_JSON):
            with open(_LATEST_JSON, encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.debug(f"JSON fallback hatası: {e}")
    return None


def _get_ai_text(ticker: str, lang: str, market_date: str, rc, sb) -> dict:
    """Redis → Supabase sırasıyla AI metni çeker."""
    # 1. Redis
    if rc:
        cached = rc.get(f"insight:{ticker}:{lang}:{market_date}")
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass

    # 2. Supabase
    if sb:
        try:
            res = (
                sb.table("ai_insights")
                .select("*")
                .eq("ticker", ticker)
                .eq("market_date", market_date)
                .eq("lang", lang)
                .order("run_timestamp", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                return {
                    "market_context":     row.get("market_context", ""),
                    "interest_zone_text": row.get("interest_zone_text", ""),
                    "scenario_bull":      row.get("scenario_bull", ""),
                    "scenario_bear":      row.get("scenario_bear", ""),
                    "scenario_neutral":   row.get("scenario_neutral", ""),
                    "risk_reference":     row.get("risk_reference", ""),
                    "strategy_note":      row.get("strategy_note", ""),
                    "generated_by":       row.get("generated_by", "template_v1"),
                }
        except Exception as e:
            logger.debug(f"Supabase ai_insights hatası ({ticker}/{lang}): {e}")

    return {}


def _fetch_daily_stocks(market_date: str, lang: str) -> Optional[dict]:
    """
    Günlük 54 hisseyi çeker.
    Kaynak: Redis → Supabase → lokal JSON
    """
    rc = _get_redis()
    sb = _get_supabase()

    # ── 1. Redis hot cache ──────────────────────────────────────────
    if rc:
        cached = rc.get(f"daily:top54:{market_date}")
        if cached:
            try:
                stocks = json.loads(cached)
                # AI metinleri istenen dilde yükle
                if lang != "tr":
                    for s in stocks:
                        ai = _get_ai_text(s.get("ticker", ""), lang, market_date, rc, sb)
                        if ai:
                            s["ai_text"] = ai
                return {"source": "redis", "stocks": stocks}
            except Exception:
                pass

    # ── 2. Supabase ─────────────────────────────────────────────────
    if sb:
        try:
            res = (
                sb.table("daily_scores")
                .select("*")
                .eq("market_date", market_date)
                .order("score", desc=True)
                .execute()
            )
            if res.data:
                stocks = []
                for row in res.data:
                    ai = _get_ai_text(row["ticker"], lang, market_date, rc, sb)
                    stocks.append({**row, "ai_text": ai})
                return {"source": "supabase", "stocks": stocks}
        except Exception as e:
            logger.debug(f"Supabase daily_scores hatası: {e}")

    # ── 3. Lokal JSON fallback ───────────────────────────────────────
    payload = _load_from_json()
    if payload and payload.get("all_54"):
        return {"source": "local_json", "stocks": payload["all_54"], "payload": payload}

    return None


# ─── Endpoint'ler ────────────────────────────────────────────────────

@router.get(
    "/daily-insights",
    response_model=DailyInsightsResponse,
    summary="Günün 54 hissesi",
    description="Bugünün finma514 tarama sonuçlarını döner. Redis → Supabase → JSON fallback.",
)
async def daily_insights(
    lang: str = Query("tr", description="Dil kodu: tr|en|es|pt|ar|id|ja"),
    target_date: Optional[str] = Query(None, alias="date",
                                       description="YYYY-MM-DD formatında tarih (default: bugün)"),
):
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Desteklenmeyen dil: {lang}. Seçenekler: {sorted(SUPPORTED_LANGS)}")

    market_date = target_date or date.today().isoformat()

    data = _fetch_daily_stocks(market_date, lang)
    if not data:
        raise HTTPException(404, f"{market_date} tarihi için tarama verisi bulunamadı.")

    stocks = data["stocks"]
    payload = data.get("payload", {})

    # Metadata
    regime    = payload.get("market_regime", "UNKNOWN")
    vix       = float(payload.get("vix", 0.0))
    run_ts    = payload.get("run_timestamp", "")
    run_time  = payload.get("run_time_ny", "")
    bot_name  = payload.get("bot_name", "finma514")

    # Supabase'den metadata al (lokal JSON yoksa)
    if not regime or regime == "UNKNOWN":
        try:
            sb = _get_supabase()
            if sb:
                res = (
                    sb.table("daily_scores")
                    .select("market_regime,vix,run_timestamp,run_time_ny")
                    .eq("market_date", market_date)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    row = res.data[0]
                    regime   = row.get("market_regime", "UNKNOWN")
                    vix      = float(row.get("vix", 0.0))
                    run_ts   = row.get("run_timestamp", "")
                    run_time = row.get("run_time_ny", "")
        except Exception:
            pass

    return DailyInsightsResponse(
        bot_name      = bot_name,
        market_date   = market_date,
        run_timestamp = run_ts,
        run_time_ny   = run_time,
        market_regime = regime,
        vix           = vix,
        stock_count   = len(stocks),
        lang          = lang,
        stocks        = stocks,
    )


@router.get(
    "/stock/{ticker}",
    summary="Tek hisse detayı",
    description="Belirtilen hisse için skor, teknik indikatörler ve AI metin döner.",
)
async def stock_detail(
    ticker: str,
    lang: str = Query("tr", description="Dil kodu: tr|en|es|pt|ar|id|ja"),
    target_date: Optional[str] = Query(None, alias="date",
                                       description="YYYY-MM-DD (default: bugün)"),
):
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Desteklenmeyen dil: {lang}.")

    ticker      = ticker.upper().strip()
    market_date = target_date or date.today().isoformat()
    rc          = _get_redis()
    sb          = _get_supabase()

    # ── 1. Redis'ten günlük liste ───────────────────────────────────
    stock_data = None
    if rc:
        cached = rc.get(f"daily:top54:{market_date}")
        if cached:
            try:
                all_stocks = json.loads(cached)
                for s in all_stocks:
                    if s.get("ticker") == ticker:
                        stock_data = s
                        break
            except Exception:
                pass

    # ── 2. Supabase ─────────────────────────────────────────────────
    if not stock_data and sb:
        try:
            res = (
                sb.table("daily_scores")
                .select("*")
                .eq("ticker", ticker)
                .eq("market_date", market_date)
                .order("run_timestamp", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                stock_data = res.data[0]
        except Exception as e:
            logger.debug(f"Supabase stock_detail hatası ({ticker}): {e}")

    # ── 3. Lokal JSON fallback ───────────────────────────────────────
    if not stock_data:
        payload = _load_from_json()
        if payload:
            for s in payload.get("all_54", []):
                if s.get("ticker") == ticker:
                    stock_data = s
                    break

    if not stock_data:
        raise HTTPException(
            404,
            f"{ticker} hissesi {market_date} listesinde bulunamadı."
        )

    # ── AI metin ─────────────────────────────────────────────────────
    ai = _get_ai_text(ticker, lang, market_date, rc, sb)

    # JSON'daki Türkçe template metin (Gemini yoksa fallback)
    if not ai:
        ai = stock_data.get("ai_text", {})

    return {**stock_data, "ai_text": ai, "lang": lang}


@router.get(
    "/categories",
    summary="Kategorilere göre 54 hisse",
    description="core_picks, sector_leaders, high_volume, top_gainers, oversold_losers.",
)
async def categories(
    lang: str = Query("tr"),
    target_date: Optional[str] = Query(None, alias="date"),
):
    market_date = target_date or date.today().isoformat()
    data = _fetch_daily_stocks(market_date, lang)
    if not data:
        raise HTTPException(404, f"{market_date} için veri bulunamadı.")

    stocks = data["stocks"]
    grouped: dict = {v: [] for v in CATEGORIES_MAP.values()}

    for s in stocks:
        tag = s.get("tag", "CORE")
        cat = CATEGORIES_MAP.get(tag, "core_picks")
        grouped[cat].append(s)

    return {
        "market_date": market_date,
        "lang":        lang,
        "categories":  grouped,
        "total":       len(stocks),
    }


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="Son tarama durumu",
)
async def status():
    rc = _get_redis()
    sb = _get_supabase()

    # Lokal JSON önce
    payload = _load_from_json()
    if payload:
        return StatusResponse(
            last_run      = payload.get("run_timestamp"),
            market_date   = payload.get("market_date"),
            stock_count   = payload.get("stock_count", 0),
            market_regime = payload.get("market_regime", "UNKNOWN"),
            vix           = float(payload.get("vix", 0.0)),
            source        = "local_json",
        )

    # Supabase fallback
    if sb:
        try:
            res = (
                sb.table("daily_scores")
                .select("run_timestamp,market_date,market_regime,vix")
                .order("run_timestamp", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                row = res.data[0]
                count_res = (
                    sb.table("daily_scores")
                    .select("id", count="exact")
                    .eq("market_date", row["market_date"])
                    .execute()
                )
                return StatusResponse(
                    last_run      = row.get("run_timestamp"),
                    market_date   = row.get("market_date"),
                    stock_count   = count_res.count or 0,
                    market_regime = row.get("market_regime", "UNKNOWN"),
                    vix           = float(row.get("vix", 0.0)),
                    source        = "supabase",
                )
        except Exception as e:
            logger.debug(f"Status Supabase hatası: {e}")

    return StatusResponse(
        last_run=None, market_date=None,
        stock_count=0, market_regime="UNKNOWN",
        vix=0.0, source="none",
    )
