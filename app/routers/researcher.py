"""
Researcher router — create models, deploy, check earnings.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.trading_model import TradingModelCreate, TradingModelResponse
from app.services import marketplace_service, profit_service
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/researcher", tags=["Researcher"])


def _require_researcher(user: User) -> User:
    if user.role != "researcher":
        raise HTTPException(status_code=403, detail="Only researchers can access this endpoint")
    return user


@router.post("/models", response_model=TradingModelResponse, status_code=201)
def create_model(
    body: TradingModelCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new trading model (starts as draft)."""
    _require_researcher(user)
    model = marketplace_service.create_model(
        db,
        creator_id=user.id,
        name=body.name,
        description=body.description,
        asset_class=body.asset_class,
        strategy_code=body.strategy_code,
    )
    return TradingModelResponse.model_validate(model)


@router.post("/deploy/{model_id}", response_model=TradingModelResponse)
def deploy_model(
    model_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a model from draft → live on the marketplace."""
    _require_researcher(user)
    model = marketplace_service.deploy_model(db, model_id, user.id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found or not owned by you")
    return TradingModelResponse.model_validate(model)


@router.get("/earnings")
def get_earnings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated earnings for the authenticated researcher."""
    _require_researcher(user)
    return profit_service.get_researcher_earnings(db, user.id)


@router.get("/models/mine", response_model=list[TradingModelResponse])
def my_models(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all models created by the authenticated researcher."""
    _require_researcher(user)
    from app.models.trading_model import TradingModel
    models = db.query(TradingModel).filter(TradingModel.creator_id == user.id).all()
    return [TradingModelResponse.model_validate(m) for m in models]


@router.get("/transactions", response_model=list[TransactionResponse])
def researcher_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all transactions (payouts, commissions) for the authenticated researcher."""
    _require_researcher(user)
    from app.models.transaction import Transaction
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [TransactionResponse.model_validate(t) for t in txns]
