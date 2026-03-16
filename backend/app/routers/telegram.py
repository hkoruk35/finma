"""
Telegram API Router
Endpoints: send, test, send-signal, broadcast-signals, broadcast-trades
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.services.telegram_service import (
    send_telegram_message,
    format_signal_message,
    broadcast_signals,
    broadcast_trade_update,
)
from app.dependencies import require_admin

router = APIRouter()


class TelegramMessage(BaseModel):
    message: str
    chat_id: Optional[str] = None


class SignalBroadcastRequest(BaseModel):
    signals: List[dict]
    regime: dict


@router.post("/send")
async def send_message(msg: TelegramMessage, admin: dict = Depends(require_admin)):
    """Telegram mesajı gönder (Sadece admin)"""
    success = await send_telegram_message(msg.message, msg.chat_id)
    if success:
        return {"status": "sent", "message": "Mesaj gönderildi"}
    raise HTTPException(status_code=500, detail="Mesaj gönderilemedi. Token ve Chat ID kontrol edin.")


@router.post("/test")
async def test_telegram():
    """Test mesajı gönder"""
    test_msg = "🧪 <b>FinMA Terminal v4.0</b>\n\nTelegram bağlantısı başarılı! ✅\n\n🤖 Backend aktif."
    success = await send_telegram_message(test_msg)
    if success:
        return {"status": "ok", "message": "Test mesajı gönderildi"}
    raise HTTPException(status_code=500, detail="Bağlantı başarısız. Token ve Chat ID kontrol edin.")


@router.post("/send-signal")
async def send_signal(signal: dict):
    """Tek sinyal bildirimini Telegram'a gönder"""
    message = format_signal_message(signal)
    success = await send_telegram_message(message)
    if success:
        return {"status": "sent"}
    raise HTTPException(status_code=500, detail="Sinyal gönderilemedi")


@router.post("/broadcast-signals")
async def broadcast_all_signals(request: SignalBroadcastRequest, admin: dict = Depends(require_admin)):
    """Tüm sinyalleri Telegram'a gönder (Sadece admin)"""
    success = await broadcast_signals(request.signals, request.regime)
    if success:
        return {"status": "sent", "count": len(request.signals)}
    raise HTTPException(status_code=500, detail="Yayın gönderilemedi")


@router.post("/broadcast-trades")
async def broadcast_active_trades(trades: List[dict], admin: dict = Depends(require_admin)):
    """Açık pozisyonları Telegram'a gönder (Sadece admin)"""
    success = await broadcast_trade_update(trades)
    if success:
        return {"status": "sent"}
    raise HTTPException(status_code=500, detail="İşlem raporu gönderilemedi")
