"""Notifications Router — Kullanıcı bildirimleri"""
from fastapi import APIRouter, Depends
from typing import List, Optional
from datetime import datetime
from app.dependencies import get_current_user
from app.database import get_supabase
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory fallback
_notifications_memory: List[dict] = []


def get_user_notifications(user_id: str, limit: int = 10) -> List[dict]:
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Notification fetch hatası: {e}")
    return [n for n in _notifications_memory if n.get("user_id") == user_id][:limit]


def mark_notification_read(notification_id: str) -> bool:
    sb = get_supabase()
    if sb:
        try:
            sb.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
            return True
        except Exception as e:
            logger.error(f"Notification mark read hatası: {e}")
    for n in _notifications_memory:
        if n.get("id") == notification_id:
            n["is_read"] = True
            return True
    return False


def create_notification(user_id: str, title: str, message: str = "", ntype: str = "system", action_url: str = "") -> dict:
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "message": message,
        "is_read": False,
        "action_url": action_url,
        "created_at": datetime.utcnow().isoformat(),
    }
    sb = get_supabase()
    if sb:
        try:
            result = sb.table("notifications").insert({k: v for k, v in notif.items() if k != "id"}).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            logger.error(f"Notification create hatası: {e}")
    _notifications_memory.append(notif)
    return notif


@router.get("")
async def get_notifications(limit: int = 10, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    notifications = get_user_notifications(user_id, limit)
    unread_count = sum(1 for n in notifications if not n.get("is_read", False))
    return {"notifications": notifications, "unread_count": unread_count}


@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    mark_notification_read(notification_id)
    return {"success": True}


@router.put("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    sb = get_supabase()
    if sb:
        try:
            sb.table("notifications").update({"is_read": True}).eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Mark all read hatası: {e}")
    else:
        for n in _notifications_memory:
            if n.get("user_id") == user_id:
                n["is_read"] = True
    return {"success": True}
