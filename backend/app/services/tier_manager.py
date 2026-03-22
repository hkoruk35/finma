"""
Tier & Credit Management Service
Kullanıcıların tier'larına göre limit kontrolü, credit tracking, rate limiting
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from app.database import UsersDB
from app.schemas.tier import TierLimits, TIER_DEFINITIONS, UserTierStatus

logger = logging.getLogger(__name__)

# ─── In-Memory Credit Tracking (üretim için Redis'e geçilmeli) ───
_user_credits: Dict[str, Dict] = {}


class TierManager:
    """Tier ve credit management"""

    @staticmethod
    def get_user_tier(username: str) -> str:
        """Kullanıcının subscription tier'ını döndür"""
        user = UsersDB.get_by_username(username)
        if not user:
            return "free"
        return user.get("subscription_tier", "free")

    @staticmethod
    def get_tier_limits(tier: str) -> TierLimits:
        """Tier'ın limitlerini döndür"""
        return TIER_DEFINITIONS.get(tier, TIER_DEFINITIONS["free"])

    @staticmethod
    def check_user_tier_status(username: str) -> UserTierStatus:
        """Kullanıcının mevcut tier durumunu kontrol et"""
        user = UsersDB.get_by_username(username)
        if not user:
            return UserTierStatus(
                user_id="",
                subscription_tier="free",
                is_trial_active=False,
                limits=TIER_DEFINITIONS["free"],
            )

        tier = user.get("subscription_tier", "free")
        limits = TIER_DEFINITIONS.get(tier, TIER_DEFINITIONS["free"])

        # Trial kontrolü
        trial_started = user.get("trial_started_at")
        is_trial_active = False
        trial_ends_at = None

        if trial_started and limits.trial_days > 0:
            trial_start = datetime.fromisoformat(trial_started) if isinstance(trial_started, str) else trial_started
            trial_end = trial_start + timedelta(days=limits.trial_days)
            is_trial_active = datetime.utcnow() < trial_end
            trial_ends_at = trial_end

        return UserTierStatus(
            user_id=user.get("id", ""),
            subscription_tier=tier,
            trial_started_at=trial_started,
            trial_ends_at=trial_ends_at,
            is_trial_active=is_trial_active,
            limits=limits,
        )

    @staticmethod
    def can_use_screener(username: str) -> Tuple[bool, str]:
        """Screener erişim kontrolü"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if status.subscription_tier == "admin":
            return True, "OK"

        if status.screener_scans_used >= status.limits.screener_scans_per_week:
            return False, f"Haftaya tarama limitiniz {status.limits.screener_scans_per_week} bitti"

        return True, "OK"

    @staticmethod
    def can_add_to_watchlist(username: str) -> Tuple[bool, str]:
        """Watchlist erişim kontrolü"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if status.subscription_tier == "admin":
            return True, "OK"

        # TODO: Gerçek watchlist slot sayısını veritabanından oku
        if status.watchlist_used_slots >= status.limits.watchlist_slots:
            return False, f"Takip listesi limitiniz {status.limits.watchlist_slots} dolu"

        return True, "OK"

    @staticmethod
    def can_create_portfolio(username: str) -> Tuple[bool, str]:
        """Portfolio oluşturma erişim kontrolü"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if status.subscription_tier == "admin":
            return True, "OK"

        # TODO: Gerçek portfolio sayısını veritabanından oku
        if status.portfolios_created >= status.limits.portfolios:
            return False, f"Portföy limitiniz {status.limits.portfolios} doldu"

        return True, "OK"

    @staticmethod
    def can_make_api_request(username: str) -> Tuple[bool, str]:
        """API rate limiting"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if status.subscription_tier == "admin":
            return True, "OK"

        # TODO: Redis'ten gerçek istek sayısını oku (saat cinsinden)
        if status.stock_requests_this_hour >= status.limits.max_stock_requests_per_hour:
            return (
                False,
                f"Saatlik API limit ({status.limits.max_stock_requests_per_hour}) aşıldı",
            )

        return True, "OK"

    @staticmethod
    def can_access_backtest(username: str) -> Tuple[bool, str]:
        """Backtest erişim kontrolü"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if not status.limits.can_use_backtest:
            return False, "Backtest özelliği sadece Pro üyelikte mevcut"

        return True, "OK"

    @staticmethod
    def can_use_batch_operations(username: str) -> Tuple[bool, str]:
        """Toplu işlem kontrolü"""
        status = TierManager.check_user_tier_status(username)
        if status.limits is None:
            return False, "Tier bilgisi bulunamadı"

        if not status.limits.can_batch_operations:
            return False, "Toplu işlemler sadece Pro üyelikte mevcut"

        return True, "OK"

    @staticmethod
    def start_trial(username: str) -> bool:
        """Kullanıcı için free trial başlat"""
        user = UsersDB.get_by_username(username)
        if not user:
            return False

        trial_started = datetime.utcnow().isoformat()
        result = UsersDB.update(username, {"trial_started_at": trial_started})
        return result is not None

    @staticmethod
    def upgrade_to_pro(username: str) -> bool:
        """Kullanıcıyı Pro'ya yüksel"""
        user = UsersDB.get_by_username(username)
        if not user:
            return False

        result = UsersDB.update(
            username,
            {
                "subscription_tier": "pro",
                "role": "pro",
                "subscription_started_at": datetime.utcnow().isoformat(),
            },
        )
        logger.info(f"Kullanıcı Pro'ya yükseltildi: {username}")
        return result is not None

    @staticmethod
    def log_screener_scan(username: str):
        """Screener taraması kullanımını kaydet"""
        # TODO: Gerçek veritabanına yaz
        logger.info(f"Screener taraması kaydedildi: {username}")

    @staticmethod
    def log_api_request(username: str):
        """API isteğini kaydet"""
        # TODO: Redis'e yaz (saatlik rate limit tracking)
        logger.info(f"API isteği kaydedildi: {username}")

    @staticmethod
    def get_usage_summary(username: str) -> Dict:
        """Kullanıcının kullanım özetini döndür"""
        status = TierManager.check_user_tier_status(username)
        if not status.limits:
            return {}

        return {
            "current_tier": status.subscription_tier,
            "is_trial_active": status.is_trial_active,
            "trial_ends_at": status.trial_ends_at,
            "limits": {
                "screener_scans_per_week": status.limits.screener_scans_per_week,
                "watchlist_slots": status.limits.watchlist_slots,
                "portfolios": status.limits.portfolios,
                "trades_per_portfolio": status.limits.trades_per_portfolio,
            },
            "usage": {
                "screener_scans_used": status.screener_scans_used,
                "watchlist_used_slots": status.watchlist_used_slots,
                "portfolios_created": status.portfolios_created,
            },
        }
