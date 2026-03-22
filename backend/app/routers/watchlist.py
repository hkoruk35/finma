"""Smart Watchlist Router — Akıllı Takip Listesi"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_current_user
from app.database import get_supabase
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# Tier limitleri
TIER_LIMITS = {
    "free": 1,
    "pro": 10,
    "admin": 999,
}

_watchlist_memory: List[dict] = []


class WatchlistAdd(BaseModel):
    ticker: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    alert_price: Optional[float] = None
    notes: Optional[str] = None


class WatchlistAlertUpdate(BaseModel):
    alert_price: Optional[float] = None
    notes: Optional[str] = None


def get_user_watchlist(user_id: str) -> List[dict]:
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("smart_watchlist").select("*").eq("user_id", user_id).order("added_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Watchlist fetch hatası: {e}")
    return [w for w in _watchlist_memory if w.get("user_id") == user_id]


def count_user_watchlist(user_id: str) -> int:
    return len(get_user_watchlist(user_id))


@router.get("")
async def get_watchlist(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    tier = current_user.get("subscription_tier", "free")
    items = get_user_watchlist(user_id)
    limit = TIER_LIMITS.get(tier, 1)
    return {"watchlist": items, "count": len(items), "limit": limit, "tier": tier}


@router.post("")
async def add_to_watchlist(item: WatchlistAdd, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    tier = current_user.get("subscription_tier", "free")
    limit = TIER_LIMITS.get(tier, 1)

    current_count = count_user_watchlist(user_id)
    if current_count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Takip listesi limitine ulaştınız ({limit}). Pro plana geçerek artırabilirsiniz."
        )

    ticker = item.ticker.upper()
    existing = get_user_watchlist(user_id)
    if any(w.get("ticker") == ticker for w in existing):
        raise HTTPException(status_code=400, detail=f"{ticker} zaten takip listenizde")

    new_item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "ticker": ticker,
        "company_name": item.company_name or ticker,
        "sector": item.sector or "Technology",
        "added_at": datetime.utcnow().isoformat(),
        "alert_price": item.alert_price,
        "notes": item.notes,
    }

    sb = get_supabase()
    if sb:
        try:
            result = sb.table("smart_watchlist").insert({k: v for k, v in new_item.items() if k != "id"}).execute()
            if result.data:
                return {"success": True, "item": result.data[0]}
        except Exception as e:
            logger.error(f"Watchlist add hatası: {e}")

    _watchlist_memory.append(new_item)
    return {"success": True, "item": new_item}


@router.delete("/{ticker}")
async def remove_from_watchlist(ticker: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    ticker = ticker.upper()

    sb = get_supabase()
    if sb:
        try:
            sb.table("smart_watchlist").delete().eq("user_id", user_id).eq("ticker", ticker).execute()
            return {"success": True}
        except Exception as e:
            logger.error(f"Watchlist remove hatası: {e}")

    global _watchlist_memory
    _watchlist_memory = [w for w in _watchlist_memory if not (w.get("user_id") == user_id and w.get("ticker") == ticker)]
    return {"success": True}


@router.put("/{ticker}/alert")
async def update_alert(ticker: str, update: WatchlistAlertUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    ticker = ticker.upper()
    updates = {}
    if update.alert_price is not None:
        updates["alert_price"] = update.alert_price
    if update.notes is not None:
        updates["notes"] = update.notes

    sb = get_supabase()
    if sb:
        try:
            sb.table("smart_watchlist").update(updates).eq("user_id", user_id).eq("ticker", ticker).execute()
            return {"success": True}
        except Exception as e:
            logger.error(f"Watchlist alert update hatası: {e}")

    for w in _watchlist_memory:
        if w.get("user_id") == user_id and w.get("ticker") == ticker:
            w.update(updates)
    return {"success": True}
