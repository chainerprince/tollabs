"""Trade Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel


class FundWalletRequest(BaseModel):
    amount: float  # Amount to add to wallet (mocked)


class WithdrawWalletRequest(BaseModel):
    amount: float  # Amount to withdraw from wallet


class TradeConfigRequest(BaseModel):
    subscription_id: int
    capital: float  # How much money to trade with
    modifications: str = ""  # Optional natural-language modifications


class TradeConfirmRequest(BaseModel):
    trade_id: int


class AgentChatRequest(BaseModel):
    subscription_id: int
    message: str
    history: list[dict] = []
    capital: float | None = None  # optional context about how much they want to trade


class TradeResponse(BaseModel):
    id: int
    subscription_id: int
    subscriber_id: int
    model_id: int
    capital: float
    status: str
    entry_price: float | None
    exit_price: float | None
    direction: str | None
    pnl: float
    pnl_pct: float
    num_trades: int
    execution_details: dict
    researcher_share: float
    platform_share: float
    subscriber_net: float
    modifications: str
    created_at: datetime
    executed_at: datetime | None

    model_config = {"from_attributes": True}


class TradeSummaryResponse(BaseModel):
    trade_id: int
    model_name: str
    asset_class: str
    capital: float
    strategy_summary: str
    modifications: str
    estimated_risk: str  # "Low" | "Medium" | "High"
    profit_share_pct: float
    status: str


class WalletResponse(BaseModel):
    balance: float
    message: str


class ProfitSharingDetail(BaseModel):
    trade_id: int
    trade_pnl: float
    researcher_share: float
    platform_share: float
    subscriber_net: float
    researcher_email: str
    model_name: str
    executed_at: datetime | None
