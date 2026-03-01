"""Trade ORM model — tracks individual trades executed by subscribers."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey, JSON

from app.database import Base


class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    subscriber_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("trading_models.id"), nullable=False)

    # Trade parameters
    capital = Column(Float, nullable=False)  # Amount of money allocated
    status = Column(String, default="pending")  # "pending" | "confirmed" | "executing" | "completed" | "failed"

    # Strategy execution results (populated after execution)
    entry_price = Column(Float, nullable=True)
    exit_price = Column(Float, nullable=True)
    direction = Column(String, nullable=True)  # "long" | "short"
    pnl = Column(Float, default=0.0)
    pnl_pct = Column(Float, default=0.0)
    num_trades = Column(Integer, default=0)
    execution_details = Column(JSON, default=dict)  # full trade log

    # Profit sharing (filled after profitable trade)
    researcher_share = Column(Float, default=0.0)
    platform_share = Column(Float, default=0.0)
    subscriber_net = Column(Float, default=0.0)

    # AI modifications (if user asked the agent to tweak params)
    modifications = Column(Text, default="")
    modified_code = Column(Text, default="")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    executed_at = Column(DateTime, nullable=True)
