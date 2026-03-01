"""
TOLLABS configuration — loaded from environment or defaults.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./tollabs.db"

    # ── Auth / JWT ────────────────────────────────────────────
    SECRET_KEY: str = "tollabs-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: str = "*"  # comma-separated list, or "*" for dev

    # ── Profit-sharing defaults ───────────────────────────────
    DEFAULT_RESEARCHER_SHARE: float = 0.20   # 20 %
    PLATFORM_COMMISSION: float = 0.10        # 10 %

    # ── Mock mode flags ───────────────────────────────────────
    USE_MOCK_STRIPE: bool = True       # Keep wallet/payments mocked
    USE_MOCK_TRADING: bool = False     # Use real Modal model for trade decisions
    USE_MOCK_MODAL: bool = True        # Cloud notebook (compute) still mocked
    USE_MOCK_TRAINING: bool = False    # Use real Modal GPU for training

    # ── Gemini AI ──────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── HuggingFace (for gated model downloads) ───────────────
    HUGGINGFACE_TOKEN: str = ""

    # ── Modal (production) ────────────────────────────────────
    MODAL_APP_NAME: str = "tollabs-compute"
    MODAL_VOLUME_NAME: str = "tollabs-financial-data"
    MODAL_TOKEN_ID: str = ""
    MODAL_TOKEN_SECRET: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
