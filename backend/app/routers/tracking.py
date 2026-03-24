"""
FinMA514 Smart Tracking API Router
────────────────────────────────────
Endpoint'ler:
  POST   /api/tracking/add             → Hisse ekle
  DELETE /api/tracking/{ticker}        → Hisse sil
  GET    /api/tracking/list            → Kullanici takip listesi (state dahil)
  PUT    /api/tracking/{ticker}        → Ayar guncelle (entry_price, profile)
  GET    /api/tracking/{ticker}/state  → Anlik state + direktif
  POST   /api/tracking/{ticker}/compute → Aninda direktif hesapla (on-demand)
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Pydantic modeller ───────────────────────────────────────────────────────

class AddTrackingRequest(BaseModel):
    ticker:       str
    entry_price:  float
    profile:      Literal["day", "swing"] = "swing"
    has_position: bool = False


class UpdateTrackingRequest(BaseModel):
    entry_price:  Optional[float] = None
    profile:      Optional[Literal["day", "swing"]] = None
    has_position: Optional[bool] = None


class TrackingState(BaseModel):
    directive:    str
    text:         str
    color:        str
    score:        int
    tp:           float
    sl:           float
    price:        float
    rsi:          float
    rvol:         float
    computed_at:  str


class TrackingItem(BaseModel):
    ticker:       str
    entry_price:  float
    profile:      str
    has_position: bool
    added_at:     str
    state:        Optional[TrackingState] = None


# ─── Yardimci: Kullanici ID al ──────────────────────────────────────────────

def get_user_id(request) -> str:
    """Authorization header'dan user_id al (JWT veya basit token)."""
    try:
        from app.routers.auth import get_current_user_from_token
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "")
        if token:
            return token[:32]   # hash prefix kullanici ID olarak
    except Exception:
        pass
    return "anonymous"


# ─── Redis yardimci ─────────────────────────────────────────────────────────

def _redis():
    import redis as redis_lib
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        raise HTTPException(503, "Redis baglantisi yok")
    return redis_lib.from_url(redis_url, decode_responses=True)


def _tracking_key(user_id: str) -> str:
    return f"tracking:list:{user_id}"


def _state_key(user_id: str, ticker: str) -> str:
    return f"state:{user_id}:{ticker}"


# ─── Supabase yardimci ──────────────────────────────────────────────────────

def _supabase():
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


# ─── Endpoint'ler ────────────────────────────────────────────────────────────

from fastapi import Request


@router.post("/add")
async def add_tracking(body: AddTrackingRequest, request: Request):
    """Takip listesine hisse ekle."""
    ticker    = body.ticker.upper().strip()
    user_id   = get_user_id(request)

    item = {
        "ticker":       ticker,
        "entry_price":  body.entry_price,
        "profile":      body.profile,
        "has_position": body.has_position,
        "added_at":     datetime.utcnow().isoformat(),
    }

    # Redis'e kaydet
    try:
        r = _redis()
        key = _tracking_key(user_id)
        existing_raw = r.hget(key, ticker)
        if existing_raw:
            # Guncelle
            existing = json.loads(existing_raw)
            existing.update({k: v for k, v in item.items() if v is not None})
            item = existing
        r.hset(key, ticker, json.dumps(item))
    except Exception as e:
        logger.error(f"Redis tracking ekle hatasi: {e}")

    # Supabase'e de kaydet
    try:
        sb = _supabase()
        if sb:
            sb.table("tracking_list").upsert({
                "user_id":      user_id,
                "ticker":       ticker,
                "entry_price":  body.entry_price,
                "entry_date":   datetime.utcnow().date().isoformat(),
                "profile":      body.profile,
            }).execute()
    except Exception as e:
        logger.warning(f"Supabase tracking ekle: {e}")

    return {"ok": True, "ticker": ticker, "message": f"{ticker} takip listesine eklendi"}


@router.delete("/{ticker}")
async def remove_tracking(ticker: str, request: Request):
    """Takip listesinden cikar."""
    ticker  = ticker.upper().strip()
    user_id = get_user_id(request)

    try:
        r = _redis()
        r.hdel(_tracking_key(user_id), ticker)
        r.delete(_state_key(user_id, ticker))
    except Exception as e:
        logger.error(f"Redis silme hatasi: {e}")

    try:
        sb = _supabase()
        if sb:
            sb.table("tracking_list").delete().eq("user_id", user_id).eq("ticker", ticker).execute()
    except Exception as e:
        logger.warning(f"Supabase silme: {e}")

    return {"ok": True, "ticker": ticker, "message": f"{ticker} listeden cikarildi"}


@router.get("/list")
async def get_tracking_list(request: Request):
    """Kullanicinin takip listesini state ile birlikte doner."""
    user_id = get_user_id(request)
    items   = []

    try:
        r     = _redis()
        key   = _tracking_key(user_id)
        raw_map = r.hgetall(key)

        for ticker_raw, item_json in raw_map.items():
            try:
                item = json.loads(item_json)
                # Mevcut state varsa ekle
                state_raw = r.get(_state_key(user_id, ticker_raw))
                if state_raw:
                    item["state"] = json.loads(state_raw)
                items.append(item)
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Redis list hatasi: {e}")

    # Supabase fallback (Redis bossa)
    if not items:
        try:
            sb = _supabase()
            if sb:
                rows = sb.table("tracking_list").select("*").eq("user_id", user_id).execute()
                items = rows.data or []
        except Exception as e:
            logger.warning(f"Supabase list fallback: {e}")

    return {"items": items, "count": len(items)}


@router.put("/{ticker}")
async def update_tracking(ticker: str, body: UpdateTrackingRequest, request: Request):
    """Takip ayarini guncelle (entry_price, profile, has_position)."""
    ticker  = ticker.upper().strip()
    user_id = get_user_id(request)

    try:
        r   = _redis()
        key = _tracking_key(user_id)
        raw = r.hget(key, ticker)
        if not raw:
            raise HTTPException(404, f"{ticker} takip listesinde yok")

        item = json.loads(raw)
        if body.entry_price  is not None: item["entry_price"]  = body.entry_price
        if body.profile      is not None: item["profile"]      = body.profile
        if body.has_position is not None: item["has_position"] = body.has_position
        r.hset(key, ticker, json.dumps(item))

        return {"ok": True, "ticker": ticker, "item": item}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{ticker}/state")
async def get_state(ticker: str, request: Request):
    """Mevcut state + direktif doner (Redis'ten)."""
    ticker  = ticker.upper().strip()
    user_id = get_user_id(request)

    try:
        r   = _redis()
        raw = r.get(_state_key(user_id, ticker))
        if raw:
            return json.loads(raw)
    except Exception:
        pass

    raise HTTPException(404, f"{ticker} icin aktif state yok (bot henuz calismamis olabilir)")


@router.post("/{ticker}/compute")
async def compute_state(ticker: str, request: Request):
    """Aninda direktif hesapla (bot beklemeden)."""
    ticker  = ticker.upper().strip()
    user_id = get_user_id(request)

    try:
        r   = _redis()
        key = _tracking_key(user_id)
        raw = r.hget(key, ticker)
    except Exception:
        raw = None

    if not raw:
        raise HTTPException(404, f"{ticker} takip listesinde bulunamadi")

    item = json.loads(raw)

    from bots.finma514_tracking import get_daily_score, get_live_price, compute_directive
    daily = get_daily_score(ticker)
    live  = get_live_price(ticker)
    state = compute_directive(
        ticker,
        float(item.get("entry_price", 0)),
        item.get("profile", "swing"),
        bool(item.get("has_position", False)),
        daily,
        live,
    )

    # Redis'e yaz
    try:
        r.setex(_state_key(user_id, ticker), 300, json.dumps(state))
    except Exception:
        pass

    return state
