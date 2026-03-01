"""
Marketplace router — public endpoints for browsing trading models.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.subscription import Subscription
from app.models.trading_model import TradingModel
from app.models.transaction import Transaction
from app.schemas.trading_model import TradingModelResponse, TradingModelDetail
from app.services import marketplace_service

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


@router.get("/models", response_model=list[TradingModelResponse])
def list_models(db: Session = Depends(get_db)):
    """List all live trading models with performance stats."""
    models = marketplace_service.list_live_models(db)
    return [TradingModelResponse.model_validate(m) for m in models]


@router.get("/models/{model_id}")
def get_model(model_id: int, db: Session = Depends(get_db)):
    """Get detailed info for a single model, including trade history."""
    detail = marketplace_service.get_model_detail(db, model_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Model not found")

    model = detail["model"]
    return {
        "id": model.id,
        "creator_id": model.creator_id,
        "creator_email": detail["creator_email"],
        "name": model.name,
        "description": model.description,
        "asset_class": model.asset_class,
        "strategy_code": model.strategy_code,
        "status": model.status,
        "performance_metadata": model.performance_metadata,
        "created_at": model.created_at.isoformat() if model.created_at else "",
        "trade_history": detail["trade_history"],
    }


@router.get("/stats")
def marketplace_stats(db: Session = Depends(get_db)):
    """Public platform-wide statistics for the marketplace sidebar."""
    total_models = db.query(func.count(TradingModel.id)).filter(TradingModel.status == "live").scalar() or 0
    total_subscribers = db.query(func.count(Subscription.id)).filter(Subscription.is_active == True).scalar() or 0
    total_volume = db.query(func.coalesce(func.sum(func.abs(Transaction.amount)), 0)).filter(
        Transaction.type == "trade_pnl"
    ).scalar() or 0
    total_payouts = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
        Transaction.type == "researcher_payout"
    ).scalar() or 0
    return {
        "total_models": total_models,
        "active_subscribers": total_subscribers,
        "total_volume": round(float(total_volume), 2),
        "developer_payouts": round(float(total_payouts), 2),
    }
