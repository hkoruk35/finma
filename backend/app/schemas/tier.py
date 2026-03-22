"""
Tier & Subscription Schemas
Free, Pro, Admin tier tanımları ve limit kuralları
"""

from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime


class TierLimits(BaseModel):
    """Bir tier'ın tüm limitlerini tanımlar"""
    name: str  # free, pro, admin
    trial_days: int  # Free trial için gün sayısı
    screener_scans_per_week: int  # Haftada kaç kez screener taraması
    watchlist_slots: int  # Kaç hissenin takip edilebileceği
    portfolios: int  # Kaç portföy oluşturulabilir
    trades_per_portfolio: int  # Portföy başına işlem limiti
    insider_lookback_days: int  # Insider trading verisi kaç gün geride
    news_articles_per_day: int  # Günde kaç haber makalesi gösterilir
    max_stock_requests_per_hour: int  # Saatlik API istek limiti
    can_use_backtest: bool = False  # Backtest erişimi
    can_use_ai_analysis: bool = False  # AI analiz erişimi
    can_batch_operations: bool = False  # Toplu işlem yapabilme
    featured_list_access: bool = True  # Fırsatlar listesine erişim


# ─── Tier Tanımları ───

TIER_DEFINITIONS: Dict[str, TierLimits] = {
    "free": TierLimits(
        name="free",
        trial_days=7,
        screener_scans_per_week=2,
        watchlist_slots=1,
        portfolios=1,
        trades_per_portfolio=5,
        insider_lookback_days=7,
        news_articles_per_day=10,
        max_stock_requests_per_hour=50,
        can_use_backtest=False,
        can_use_ai_analysis=False,
        can_batch_operations=False,
        featured_list_access=True,
    ),
    "pro": TierLimits(
        name="pro",
        trial_days=0,  # Pro tier'ın trial'ı yok (ödeme gerekir)
        screener_scans_per_week=10,
        watchlist_slots=10,
        portfolios=10,
        trades_per_portfolio=20,
        insider_lookback_days=90,
        news_articles_per_day=100,
        max_stock_requests_per_hour=500,
        can_use_backtest=True,
        can_use_ai_analysis=True,
        can_batch_operations=True,
        featured_list_access=True,
    ),
    "admin": TierLimits(
        name="admin",
        trial_days=0,
        screener_scans_per_week=999,
        watchlist_slots=999,
        portfolios=999,
        trades_per_portfolio=999,
        insider_lookback_days=999,
        news_articles_per_day=999,
        max_stock_requests_per_hour=9999,
        can_use_backtest=True,
        can_use_ai_analysis=True,
        can_batch_operations=True,
        featured_list_access=True,
    ),
}


class UserTierStatus(BaseModel):
    """Kullanıcının aktif tier durumu"""
    user_id: str
    subscription_tier: str  # free, pro, admin
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    is_trial_active: bool = False
    subscription_started_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None

    # Kullanım istatistikleri (bu hafta/ay)
    screener_scans_used: int = 0
    watchlist_used_slots: int = 0
    portfolios_created: int = 0
    stock_requests_this_hour: int = 0

    # Limits
    limits: Optional[TierLimits] = None


class AddOnRequest(BaseModel):
    """Add-on satın alma isteği"""
    user_id: str
    add_on_type: str  # screener_scans, watchlist_slots
    quantity: int  # +10 tarama, +10 slot vs.
    price_cents: int  # Stripe'da cent cinsinden


class CreditTransaction(BaseModel):
    """Kredi işlemi logu"""
    user_id: str
    transaction_type: str  # screener_used, portfolio_created, trial_started, subscription_purchased
    credits_delta: int  # Pozitif (ekle) veya negatif (çıkar)
    reason: str  # İşlemin nedeni
    created_at: datetime = None

    def __init__(self, **data):
        if "created_at" not in data:
            data["created_at"] = datetime.utcnow()
        super().__init__(**data)
