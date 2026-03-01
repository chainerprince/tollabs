"""Subscription ORM model."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Float, Boolean, String, DateTime, ForeignKey

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subscriber_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("trading_models.id"), nullable=False)
    profit_share_pct = Column(Float, default=0.20)  # 20 % to researcher by default
    is_active = Column(Boolean, default=True)
    high_water_mark = Column(Float, default=0.0)
    cumulative_pnl = Column(Float, default=0.0)
    stripe_session_id = Column(String, nullable=True)
    subscribed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
