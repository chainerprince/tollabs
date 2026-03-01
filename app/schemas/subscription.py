"""Subscription Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel


class SubscriptionCreate(BaseModel):
    profit_share_pct: float = 0.20


class SubscriptionResponse(BaseModel):
    id: int
    subscriber_id: int
    model_id: int
    model_name: str = ""
    asset_class: str = ""
    profit_share_pct: float
    is_active: bool
    high_water_mark: float
    cumulative_pnl: float
    stripe_session_id: str | None
    subscribed_at: datetime

    model_config = {"from_attributes": True}
