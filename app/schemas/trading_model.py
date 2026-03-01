"""TradingModel Pydantic schemas."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel


class TradingModelCreate(BaseModel):
    name: str
    description: str = ""
    asset_class: str  # "forex" | "stock"
    strategy_code: str = ""


class TradingModelResponse(BaseModel):
    id: int
    creator_id: int
    name: str
    description: str
    asset_class: str
    status: str
    performance_metadata: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class TradingModelDetail(TradingModelResponse):
    strategy_code: str
    trade_history: list[dict[str, Any]] = []
