"""Marketplace service — listing and retrieving trading models."""

from sqlalchemy.orm import Session

from app.models.trading_model import TradingModel
from app.models.user import User
from app.models.transaction import Transaction


def list_live_models(db: Session) -> list[TradingModel]:
    """Return all models with status='live'."""
    return db.query(TradingModel).filter(TradingModel.status == "live").all()


def get_model_by_id(db: Session, model_id: int) -> TradingModel | None:
    return db.query(TradingModel).filter(TradingModel.id == model_id).first()


def get_model_detail(db: Session, model_id: int) -> dict | None:
    """Return model + recent trade history from transactions."""
    model = get_model_by_id(db, model_id)
    if model is None:
        return None

    creator = db.query(User).filter(User.id == model.creator_id).first()

    # Gather trade_pnl transactions related to subscriptions of this model
    from app.models.subscription import Subscription

    sub_ids = [
        s.id for s in db.query(Subscription).filter(Subscription.model_id == model_id).all()
    ]
    trades = (
        db.query(Transaction)
        .filter(Transaction.subscription_id.in_(sub_ids), Transaction.type == "trade_pnl")
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )

    return {
        "model": model,
        "creator_email": creator.email if creator else "unknown",
        "trade_history": [
            {
                "id": t.id,
                "amount": t.amount,
                "description": t.description,
                "created_at": t.created_at.isoformat() if t.created_at else "",
            }
            for t in trades
        ],
    }


def create_model(
    db: Session,
    creator_id: int,
    name: str,
    description: str,
    asset_class: str,
    strategy_code: str,
) -> TradingModel:
    model = TradingModel(
        creator_id=creator_id,
        name=name,
        description=description,
        asset_class=asset_class,
        strategy_code=strategy_code,
        status="draft",
        performance_metadata={},
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def deploy_model(db: Session, model_id: int, creator_id: int) -> TradingModel | None:
    """Set model status to 'live' — only if owned by creator_id."""
    model = db.query(TradingModel).filter(
        TradingModel.id == model_id,
        TradingModel.creator_id == creator_id,
    ).first()
    if model is None:
        return None
    model.status = "live"
    db.commit()
    db.refresh(model)
    return model
