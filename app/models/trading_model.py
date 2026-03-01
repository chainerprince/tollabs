"""TradingModel ORM model."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON

from app.database import Base


class TradingModel(Base):
    __tablename__ = "trading_models"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    asset_class = Column(String, nullable=False)  # "forex" | "stock"
    strategy_code = Column(Text, default="")
    performance_metadata = Column(JSON, default=dict)  # {sharpe, max_drawdown, total_return, win_rate}
    status = Column(String, default="draft")  # "draft" | "live" | "archived"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # ── Links to deployment infrastructure ────────────────────
    training_job_id = Column(Integer, ForeignKey("training_jobs.id"), nullable=True)
    deployment_id = Column(Integer, ForeignKey("model_deployments.id"), nullable=True)

    # ── Backtest results (shown on marketplace) ───────────────
    backtest_metrics = Column(JSON, default=dict)  # {sharpe, max_dd, total_return, win_rate, equity_curve, trades}
    backtest_asset = Column(String, nullable=True)
    backtest_periods = Column(Integer, nullable=True)
