from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "FinMA API"
    debug: bool = False
    frontend_url: str = "https://finmasmart.com"

    # Database
    supabase_url: str = ""
    supabase_key: str = ""
    redis_url: str = ""

    # Bot
    bot_api_key: str = "finma-bot-secret-key"
    backend_url: str = "https://finma-production.up.railway.app"

    # Auth
    jwt_secret: str = "finma-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 72

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # AI
    gemini_api_key: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    alpha_vantage_api_key: str = ""
    fmp_api_key: str = ""
    finnhub_api_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Bot paths
    bots_dir: str = "bots"
    signals_output_dir: str = "bots/output"

    # Redis
    redis_url: str = "redis://localhost:6379"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
