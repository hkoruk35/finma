"""
Invite Code Router — Premium üyelik davet sistemi
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
import secrets
import string
from app.dependencies import get_current_user, require_admin
from app.database import InviteCodesDB, UsersDB

router = APIRouter()


class RedeemRequest(BaseModel):
    code: str


def generate_code(length: int = 8) -> str:
    """8 karakterli alfanumerik davet kodu üret"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.post("/generate")
def generate_invite(admin: dict = Depends(require_admin)):
    """Yeni davet kodu oluştur (Sadece admin)"""
    code = generate_code()
    while InviteCodesDB.get_by_code(code):
        code = generate_code()

    data = {
        "code": code,
        "created_by": admin["username"],
        "created_at": datetime.utcnow().isoformat(),
    }
    created = InviteCodesDB.create(data)
    return {"code": code, "created_at": created.get("created_at")}


@router.post("/redeem")
def redeem_invite(request: RedeemRequest, user: dict = Depends(get_current_user)):
    """Davet kodunu kullan ve Premium'a yükselt"""
    invite = InviteCodesDB.get_by_code(request.code.upper().strip())
    if not invite:
        raise HTTPException(status_code=404, detail="Geçersiz davet kodu")

    if invite.get("used_by"):
        raise HTTPException(status_code=400, detail="Bu davet kodu zaten kullanılmış")

    user_data = UsersDB.get_by_username(user["username"])
    if not user_data:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    if user_data.get("subscription_tier") == "pro":
        raise HTTPException(status_code=400, detail="Zaten Pro üyesiniz")

    # Upgrade to pro
    UsersDB.update(user["username"], {
        "role": "pro",
        "subscription_tier": "pro",
    })

    InviteCodesDB.mark_used(request.code.upper().strip(), user_data.get("id", ""))

    return {"message": "Pro üyeliğiniz aktif edildi!", "tier": "pro"}


@router.get("/list")
def list_invites(admin: dict = Depends(require_admin)):
    """Tüm davet kodlarını listele (Sadece admin)"""
    return InviteCodesDB.get_all()
