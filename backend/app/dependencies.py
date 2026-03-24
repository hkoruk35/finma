"""
Auth dependencies for FastAPI route protection
"""

from fastapi import Header, HTTPException, Depends
from typing import Optional
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.config import get_settings
import os
import logging

logger = logging.getLogger(__name__)


from starlette.concurrency import run_in_threadpool


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
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


def require_pro(user: dict = Depends(get_current_user)) -> dict:
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


def require_premium(user: dict = Depends(get_current_user)) -> dict:
    """Require Pro or Admin tier (Legacy naming)"""
    return require_pro(user)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin role"""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Yönetici yetkisi gerekli")
    return user


def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
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


# ─── Tier-Based Access Control ───

def require_screener_access(user: dict = Depends(get_current_user)) -> dict:
    """Require screener access (tier-based limit check)"""
    from app.services.tier_manager import TierManager
    can_use, msg = TierManager.can_use_screener(user["username"])
    if not can_use:
        raise HTTPException(status_code=403, detail=msg)
    return user


def require_watchlist_access(user: dict = Depends(get_current_user)) -> dict:
    """Require watchlist access (tier-based limit check)"""
    from app.services.tier_manager import TierManager
    can_use, msg = TierManager.can_add_to_watchlist(user["username"])
    if not can_use:
        raise HTTPException(status_code=403, detail=msg)
    return user


def require_portfolio_access(user: dict = Depends(get_current_user)) -> dict:
    """Require portfolio access (tier-based limit check)"""
    from app.services.tier_manager import TierManager
    can_use, msg = TierManager.can_create_portfolio(user["username"])
    if not can_use:
        raise HTTPException(status_code=403, detail=msg)
    return user


def require_backtest_access(user: dict = Depends(get_current_user)) -> dict:
    """Require backtest access (Pro+ only)"""
    from app.services.tier_manager import TierManager
    can_use, msg = TierManager.can_access_backtest(user["username"])
    if not can_use:
        raise HTTPException(status_code=403, detail=msg)
    return user


# ─── FinMA514 Quota Sistemi ───────────────────────────────────────────────────

FREE_DAILY_STOCK_LIMIT   = 3    # Free kullanıcı günde 3 hisse detayı
FREE_TRACKING_LIMIT      = 1    # Free: 1 hisse takip
PRO_TRACKING_LIMIT       = 3    # Pro (add-on yok): 3 hisse takip
SMART_TRACKING_LIMIT     = 5    # Smart Tracking add-on: 5 hisse


def _redis_quota():
    """Redis bağlantısı — hata olursa None döner."""
    try:
        import redis as redis_lib
        url = os.getenv("REDIS_URL", "")
        if not url:
            return None
        return redis_lib.from_url(url, decode_responses=True)
    except Exception:
        return None


def check_stock_quota(user: dict = Depends(get_current_user)) -> dict:
    """
    /api/finma514/stock/{ticker} için günlük kota kontrolü.
    Free: 3/gün → 403 quota_exceeded
    Pro/Admin: sınırsız
    """
    role = user.get("role", "free")
    if role in ("pro", "admin"):
        return user   # sınırsız

    username = user.get("username", "anon")
    today    = datetime.utcnow().strftime("%Y-%m-%d")
    key      = f"quota:{username}:{today}:stock_views"

    r = _redis_quota()
    if r is None:
        return user   # Redis yoksa kota kontrol edilemez, geç

    try:
        current = r.get(key)
        count   = int(current) if current else 0
        if count >= FREE_DAILY_STOCK_LIMIT:
            raise HTTPException(
                status_code=403,
                detail="quota_exceeded",
                headers={"X-Quota-Limit": str(FREE_DAILY_STOCK_LIMIT),
                         "X-Quota-Used":  str(count)},
            )
        # Sayacı artır, gece yarısına kadar TTL
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expireat(key, int(datetime.utcnow().replace(
            hour=23, minute=59, second=59).timestamp()))
        pipe.execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Quota check hatası: {e}")   # Redis sorunu → sesiz geç

    return user


def check_tracking_limit(user: dict = Depends(get_current_user)) -> dict:
    """
    /api/tracking/add için takip limiti kontrolü.
    Free:  1 hisse
    Pro:   3 hisse
    Admin: 5 hisse (Smart Tracking)
    """
    role     = user.get("role", "free")
    username = user.get("username", "anon")

    limit_map = {"free": FREE_TRACKING_LIMIT, "pro": PRO_TRACKING_LIMIT, "admin": SMART_TRACKING_LIMIT}
    limit     = limit_map.get(role, FREE_TRACKING_LIMIT)

    r = _redis_quota()
    if r is None:
        return user

    try:
        key   = f"tracking:list:{username}"
        count = r.hlen(key)
        if count >= limit:
            raise HTTPException(
                status_code=403,
                detail="tracking_limit_exceeded",
                headers={"X-Tracking-Limit": str(limit),
                         "X-Tracking-Used":  str(count)},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Tracking limit check hatası: {e}")

    return user
