"""Notifications Router — Kullanıcı bildirimleri CRUD"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.dependencies import get_current_user, require_admin
from app.database import NotificationsDB, UsersDB
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    is_read: bool
    created_at: str
    action_url: Optional[str] = None


@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    user: dict = Depends(get_current_user),
    limit: int = Query(10, le=50),
    offset: int = Query(0, ge=0),
):
    """Son bildirimleri getir (max 10 varsayılan)"""
    notifications = NotificationsDB.get_user_notifications(user["username"], limit=limit, offset=offset)
    return notifications


@router.get("/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Okunmamış bildirim sayısı"""
    count = NotificationsDB.get_unread_count(user["username"])
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str, user: dict = Depends(get_current_user)):
    """Bildirimi okundu işaretle"""
    result = NotificationsDB.mark_as_read(notification_id, user["username"])
    if not result:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"message": "Okundu işaretlendi"}


@router.post("/read-all")
async def mark_all_as_read(user: dict = Depends(get_current_user)):
    """Tüm bildirimleri okundu işaretle"""
    count = NotificationsDB.mark_all_as_read(user["username"])
    return {"message": f"{count} bildirim okundu işaretlendi"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user)):
    """Bildirimi sil"""
    result = NotificationsDB.delete_notification(notification_id, user["username"])
    if not result:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"message": "Bildirim silindi"}


# ─── ADMIN ───

@router.post("/admin/broadcast")
async def broadcast_notification(
    title: str,
    message: str,
    category: str = "system",
    admin: dict = Depends(require_admin),
):
    """Tüm kullanıcılara bildirim gönder"""
    count = NotificationsDB.broadcast(title, message, category)
    logger.info(f"Broadcast: {count} kullanıcıya {category} bildirimi gönderildi")
    return {"message": f"{count} bildirim gönderildi"}
