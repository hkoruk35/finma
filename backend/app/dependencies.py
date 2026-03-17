"""
Auth dependencies for FastAPI route protection
"""

from fastapi import Header, HTTPException, Depends
from typing import Optional
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.config import get_settings


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract and verify JWT token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Yetkilendirme başlığı eksik")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Geçersiz yetkilendirme formatı")

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        username = payload.get("sub")
        role = payload.get("role", "free")
        if not username:
            raise HTTPException(status_code=401, detail="Geçersiz token")
        return {"username": username, "role": role}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token doğrulaması başarısız")


async def require_pro(user: dict = Depends(get_current_user)) -> dict:
    """Require Pro or Admin tier"""
    if user["role"] not in ("pro", "admin"):
        raise HTTPException(status_code=403, detail="Bu özellik Pro üyelik gerektirir")

    # Trial expiration check
    from app.database import UsersDB
    user_data = UsersDB.get_by_username(user["username"])
    if user_data and user_data.get("subscription_tier") == "pro" and user_data.get("trial_start_date"):
        try:
            trial_start = datetime.fromisoformat(str(user_data["trial_start_date"]).replace("Z", "+00:00"))
            if datetime.utcnow().replace(tzinfo=trial_start.tzinfo) > trial_start + timedelta(days=14):
                raise HTTPException(status_code=403, detail="Deneme süreniz doldu. Pro üyeliğinizi yükseltin.")
        except (ValueError, TypeError):
            pass  # Invalid date format, skip check

    return user


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    """Require Pro or Admin tier (Legacy naming)"""
    return await require_pro(user)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin role"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Yönetici yetkisi gerekli")
    return user


async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Optionally extract user from token (no error if missing)"""
    if not authorization:
        return None
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        settings = get_settings()
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return {"username": payload.get("sub"), "role": payload.get("role", "free")}
    except Exception:
        return None
