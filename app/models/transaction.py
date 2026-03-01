"""Transaction ORM model — full ledger for profit-sharing."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # "trade_pnl" | "researcher_payout" | "commission" | "subscription_fee"
    amount = Column(Float, nullable=False)  # positive = credit, negative = debit
    description = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
