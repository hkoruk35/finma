"""
Auth API Router — Supabase PostgreSQL entegrasyonlu
Endpoints: register, login, google-login, me, update-tier, start-trial, users
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional
from app.config import get_settings
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.dependencies import get_current_user, require_admin
from app.database import UsersDB
from starlette.concurrency import run_in_threadpool
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Startup: admin kullanıcı yoksa oluştur ───
def ensure_admin_user():
    """Uygulama başlarken admin kullanıcı kontrolü"""
    existing = UsersDB.get_by_username("admin")
    if not existing:
        admin_data = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@finma.com",
            "password_hash": pwd_context.hash("Finma2026!"),
            "role": "admin",
            "subscription_tier": "admin",
            "full_name": "Admin",
            "account_type": "individual",
            "company": None,
            "created_at": datetime.utcnow().isoformat(),
        }
        UsersDB.create(admin_data)
        logger.info("Admin kullanıcı oluşturuldu")

# İlk importta otomatik oluştur-MA (main.py lifespan'de yapılacak)
# ensure_admin_user()


# Whitelist: Bu e-postalar ödeme yapmadan tam erişim alır
WHITELISTED_EMAILS = {"hkoruk3535@gmail.com"}


class GoogleLoginRequest(BaseModel):
    id_token: str


class UpdateTierRequest(BaseModel):
    username: str
    tier: str  # free, pro, admin


def create_token(data: dict) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Geçersiz token")


@router.post("/register", response_model=TokenResponse)
def register(user: UserCreate):
    """Yeni kullanıcı kaydı"""
    if UsersDB.get_by_username(user.username):
        raise HTTPException(status_code=400, detail="Kullanıcı adı zaten mevcut")
    if UsersDB.get_by_email(user.email):
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı")

    user_data = {
        "id": str(uuid.uuid4()),
        "username": user.username,
        "email": user.email,
        "password_hash": pwd_context.hash(user.password),
        "role": "free",
        "subscription_tier": "free",
        "full_name": user.full_name,
        "account_type": user.account_type,
        "company": user.company,
        "created_at": datetime.utcnow().isoformat(),
    }

    created = UsersDB.create(user_data)
    logger.info(f"Yeni kullanıcı kaydedildi: {user.username}")

    token = create_token({"sub": user.username, "role": "free"})
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in created.items()
                            if k not in ("password_hash", "google_id", "updated_at")}),
    )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    """Kullanıcı girişi"""
    user = UsersDB.get_by_username(credentials.username)
    if not user or not pwd_context.verify(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Geçersiz kimlik bilgileri")

    # Whitelist: Bu e-postalar her zaman pro tier alır
    user = dict(user)  # mutable kopya
    email = user.get("email", "").lower()
    if email in WHITELISTED_EMAILS and user.get("subscription_tier") not in ("pro", "admin"):
        user["role"] = "pro"
        user["subscription_tier"] = "pro"

    token = create_token({"sub": user["username"], "role": user["role"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in user.items()
                            if k not in ("password_hash", "google_id", "updated_at")}),
    )


@router.post("/google-login", response_model=TokenResponse)
async def google_login(request: GoogleLoginRequest):
    """Google OAuth ile giriş"""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth yapılandırılmamış")

    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={request.id_token}"
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(status_code=401, detail="Geçersiz Google token")
                google_data = await resp.json()

        email = google_data.get("email")
        name = google_data.get("name", "")
        google_id = google_data.get("sub")

        if not email:
            raise HTTPException(status_code=401, detail="Google hesabından e-posta alınamadı")

        # Whitelist kontrolü: Bu e-postalar otomatik pro alır
        is_whitelisted = email.lower() in WHITELISTED_EMAILS
        default_role = "pro" if is_whitelisted else "free"
        default_tier = "pro" if is_whitelisted else "free"

        # Mevcut kullanıcı ara
        existing_user = await run_in_threadpool(UsersDB.get_by_email, email)

        if existing_user:
            # Whitelisted kullanıcıyı otomatik pro yap (eğer değilse)
            if is_whitelisted and existing_user.get("subscription_tier") == "free":
                await run_in_threadpool(UsersDB.update, existing_user["username"], {
                    "role": "pro",
                    "subscription_tier": "pro",
                })
                existing_user["role"] = "pro"
                existing_user["subscription_tier"] = "pro"
                logger.info(f"Whitelisted kullanıcı pro yapıldı: {email}")

            token = create_token({"sub": existing_user["username"], "role": existing_user["role"]})
            return TokenResponse(
                access_token=token,
                user=UserResponse(**{k: v for k, v in existing_user.items()
                                    if k not in ("password_hash", "google_id", "updated_at")}),
            )
        else:
            # Yeni kullanıcı oluştur
            username = email.split("@")[0]
            base_username = username
            counter = 1
            while await run_in_threadpool(UsersDB.get_by_username, username):
                username = f"{base_username}{counter}"
                counter += 1

            user_data = {
                "id": str(uuid.uuid4()),
                "username": username,
                "email": email,
                "password_hash": "",
                "role": default_role,
                "subscription_tier": default_tier,
                "full_name": name,
                "account_type": "individual",
                "company": None,
                "google_id": google_id,
                "created_at": datetime.utcnow().isoformat(),
            }
            created = await run_in_threadpool(UsersDB.create, user_data)
            logger.info(f"Google ile yeni kullanıcı: {username} (tier: {default_tier})")

            token = create_token({"sub": username, "role": default_role})
            return TokenResponse(
                access_token=token,
                user=UserResponse(**{k: v for k, v in created.items()
                                    if k not in ("password_hash", "google_id", "updated_at")}),
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google giriş hatası: {str(e)}")


@router.get("/me", response_model=UserResponse)
def get_current_user_info(user: dict = Depends(get_current_user)):
    """Mevcut kullanıcı bilgilerini getir"""
    user_data = UsersDB.get_by_username(user["username"])
    if not user_data:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    # Whitelist: Bu e-postalar her zaman pro tier alır (DB constraint bypass)
    email = user_data.get("email", "").lower()
    if email in WHITELISTED_EMAILS and user_data.get("subscription_tier") != "pro" and user_data.get("subscription_tier") != "admin":
        user_data = dict(user_data)
        user_data["role"] = "pro"
        user_data["subscription_tier"] = "pro"

    return UserResponse(**{k: v for k, v in user_data.items()
                          if k not in ("password_hash", "google_id", "updated_at")})


@router.post("/start-trial", response_model=TokenResponse)
async def start_trial(user: dict = Depends(get_current_user)):
    """Free kullanıcıyı Pro deneme sürecine başlat (7 gün)"""
    user_data = UsersDB.get_by_username(user["username"])
    if not user_data:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if user_data.get("subscription_tier") != "free":
        raise HTTPException(status_code=400, detail="Deneme sadece ücretsiz üyeler için geçerlidir")

    UsersDB.update(user["username"], {
        "role": "pro",
        "subscription_tier": "pro",
        "trial_start_date": datetime.utcnow().isoformat(),
    })
    logger.info(f"{user['username']} Pro deneme başlattı")

    token = create_token({"sub": user["username"], "role": "pro"})
    updated_user = UsersDB.get_by_username(user["username"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in updated_user.items()
                            if k not in ("password_hash", "google_id", "updated_at")}),
    )


@router.post("/update-tier")
async def update_user_tier(request: UpdateTierRequest, admin: dict = Depends(require_admin)):
    """Kullanıcı üyelik seviyesini güncelle (Sadece admin)"""
    if request.tier not in ("free", "pro", "admin"):
        raise HTTPException(status_code=400, detail="Geçersiz üyelik seviyesi")

    user = UsersDB.get_by_username(request.username)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    UsersDB.update(request.username, {
        "role": request.tier,
        "subscription_tier": request.tier,
    })
    logger.info(f"{request.username} üyeliği güncellendi: {request.tier}")
    return {"message": f"{request.username} kullanıcısının üyeliği {request.tier} olarak güncellendi"}


@router.get("/users")
async def list_users(admin: dict = Depends(require_admin), limit: int = 100, offset: int = 0):
    """Tüm kullanıcıları listele (Sadece admin)"""
    users = UsersDB.get_all(limit=limit, offset=offset)
    return [
        {k: v for k, v in u.items() if k not in ("password_hash", "google_id")}
        for u in users
    ]


@router.get("/tier/info")
async def get_tier_info(user: dict = Depends(get_current_user)):
    """Kullanıcının mevcut tier bilgilerini ve limitlerini getir"""
    from app.services.tier_manager import TierManager
    return TierManager.get_usage_summary(user["username"])


@router.post("/tier/start-trial")
async def tier_start_trial(user: dict = Depends(get_current_user)):
    """Free kullanıcı için Pro trial'ı başlat"""
    from app.services.tier_manager import TierManager
    success = TierManager.start_trial(user["username"])
    if not success:
        raise HTTPException(status_code=400, detail="Trial başlatılamadı")
    return {"message": "Pro trial başlatıldı. 7 gün boyunca tüm özellikler açılmıştır."}


@router.post("/tier/upgrade-pro")
async def tier_upgrade_pro(user: dict = Depends(get_current_user)):
    """Kullanıcıyı Pro'ya yüksel (Stripe payment sonrasında çağrılacak)"""
    from app.services.tier_manager import TierManager
    success = TierManager.upgrade_to_pro(user["username"])
    if not success:
        raise HTTPException(status_code=400, detail="Yükseltme başarısız oldu")
    token = create_token({"sub": user["username"], "role": "pro"})
    return {"message": "Pro üyeliğiniz aktivasyon oldu", "access_token": token}


@router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(require_admin)):
    """Admin dashboard istatistikleri"""
    from app.database import TradesDB
    from app.services.bot_runner import get_bot_status, BOT_CONFIGS
    import os

    all_users = UsersDB.get_all(limit=9999)
    total_users = len(all_users)
    free_users = sum(1 for u in all_users if u.get("subscription_tier") == "free")
    pro_users = sum(1 for u in all_users if u.get("subscription_tier") == "pro")
    admin_users = sum(1 for u in all_users if u.get("subscription_tier") == "admin")

    # Count open trades across all users
    all_trades = 0
    try:
        all_trades = len(TradesDB.get_all(status="OPEN"))
    except Exception:
        pass

    # Bot status
    try:
        bot_status = get_bot_status()
        running = sum(1 for v in bot_status.values() if v.get("is_running"))
        scheduled = sum(1 for v in bot_status.values() if v.get("scheduled"))
    except Exception:
        running = 0
        scheduled = 0

    return {
        "total_users": total_users,
        "free_users": free_users,
        "pro_users": pro_users,
        "admin_users": admin_users,
        "active_users": total_users,  # TODO: filter by last_login
        "total_trades": all_trades,
        "signals_today": 0,
        "bots_running": f"{running}/{len(BOT_CONFIGS)} bot aktif",
        "bots_scheduled": scheduled,
    }
