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

    # ── Profit-sharing defaults ───────────────────────────────
    DEFAULT_RESEARCHER_SHARE: float = 0.20   # 20 %
    PLATFORM_COMMISSION: float = 0.10        # 10 %

    # ── Mock mode flags ───────────────────────────────────────
    USE_MOCK_STRIPE: bool = True
    USE_MOCK_TRADING: bool = True
    USE_MOCK_MODAL: bool = True
    USE_MOCK_TRAINING: bool = True

    # ── Gemini AI ──────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── HuggingFace (for gated model downloads) ───────────────
    HUGGINGFACE_TOKEN: str = ""

    # ── Modal (production) ────────────────────────────────────
    MODAL_APP_NAME: str = "tollabs-compute"
    MODAL_VOLUME_NAME: str = "tollabs-financial-data"

    model_config = {"env_file": ".env"}


settings = Settings()
