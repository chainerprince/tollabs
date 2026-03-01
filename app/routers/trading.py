"""
Trading router — subscriber wallet, trade lifecycle, and profit sharing.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.trade import (
    FundWalletRequest,
    WithdrawWalletRequest,
    TradeConfigRequest,
    TradeConfirmRequest,
    AgentChatRequest,
    TradeResponse,
    TradeSummaryResponse,
    WalletResponse,
    ProfitSharingDetail,
)
from app.services import trading_service
from app.services import ai_service

router = APIRouter(prefix="/trading", tags=["Trading"])


# ── Wallet ────────────────────────────────────────────────────────

@router.post("/wallet/fund", response_model=WalletResponse)
def fund_wallet(
    body: FundWalletRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add mock funds to subscriber's wallet."""
    try:
        result = trading_service.fund_wallet(db, user.id, body.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.post("/wallet/withdraw", response_model=WalletResponse)
def withdraw_wallet(
    body: WithdrawWalletRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Withdraw funds from subscriber's wallet."""
    try:
        result = trading_service.withdraw_wallet(db, user.id, body.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/wallet/balance")
def get_balance(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current wallet balance."""
    return {"balance": round(user.balance, 2), "email": user.email}


# ── Strategy Agent Chat ──────────────────────────────────────────

@router.post("/agent/chat")
def agent_chat(
    body: AgentChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chat with an AI agent trained on the subscribed strategy."""
    from app.models.subscription import Subscription
    from app.models.trading_model import TradingModel

    sub = (
        db.query(Subscription)
        .filter(Subscription.id == body.subscription_id, Subscription.subscriber_id == user.id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if not sub.is_active:
        raise HTTPException(status_code=400, detail="Subscription is not active")

    model = db.query(TradingModel).filter(TradingModel.id == sub.model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        response = ai_service.strategy_agent_chat(
            strategy_code=model.strategy_code,
            model_name=model.name,
            asset_class=model.asset_class,
            description=model.description,
            performance=model.performance_metadata or {},
            message=body.message,
            history=body.history,
            capital=body.capital,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    return {"response": response}


# ── Trade Lifecycle ──────────────────────────────────────────────

@router.post("/trades/configure", response_model=TradeSummaryResponse)
def configure_trade(
    body: TradeConfigRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a pending trade and get summary for confirmation."""
    try:
        trade = trading_service.create_trade(
            db=db,
            user_id=user.id,
            subscription_id=body.subscription_id,
            capital=body.capital,
            modifications=body.modifications,
        )
        summary = trading_service.get_trade_summary(db, trade.id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return summary


@router.post("/trades/{trade_id}/execute", response_model=TradeResponse)
def execute_trade(
    trade_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute a confirmed trade (mocked brokerage integration)."""
    try:
        trade = trading_service.execute_trade(db, trade_id, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TradeResponse(
        id=trade.id,
        subscription_id=trade.subscription_id,
        subscriber_id=trade.subscriber_id,
        model_id=trade.model_id,
        capital=trade.capital,
        status=trade.status,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        direction=trade.direction,
        pnl=trade.pnl,
        pnl_pct=trade.pnl_pct,
        num_trades=trade.num_trades,
        execution_details=trade.execution_details or {},
        researcher_share=trade.researcher_share,
        platform_share=trade.platform_share,
        subscriber_net=trade.subscriber_net,
        modifications=trade.modifications,
        created_at=trade.created_at,
        executed_at=trade.executed_at,
    )


@router.get("/trades", response_model=list[TradeResponse])
def list_trades(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all trades for the authenticated user."""
    trades = trading_service.get_user_trades(db, user.id)
    return [TradeResponse(
        id=t.id,
        subscription_id=t.subscription_id,
        subscriber_id=t.subscriber_id,
        model_id=t.model_id,
        capital=t.capital,
        status=t.status,
        entry_price=t.entry_price,
        exit_price=t.exit_price,
        direction=t.direction,
        pnl=t.pnl,
        pnl_pct=t.pnl_pct,
        num_trades=t.num_trades,
        execution_details=t.execution_details or {},
        researcher_share=t.researcher_share,
        platform_share=t.platform_share,
        subscriber_net=t.subscriber_net,
        modifications=t.modifications,
        created_at=t.created_at,
        executed_at=t.executed_at,
    ) for t in trades]


@router.get("/trades/subscription/{subscription_id}", response_model=list[TradeResponse])
def list_subscription_trades(
    subscription_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all trades for a specific subscription."""
    trades = trading_service.get_subscription_trades(db, subscription_id, user.id)
    return [TradeResponse(
        id=t.id,
        subscription_id=t.subscription_id,
        subscriber_id=t.subscriber_id,
        model_id=t.model_id,
        capital=t.capital,
        status=t.status,
        entry_price=t.entry_price,
        exit_price=t.exit_price,
        direction=t.direction,
        pnl=t.pnl,
        pnl_pct=t.pnl_pct,
        num_trades=t.num_trades,
        execution_details=t.execution_details or {},
        researcher_share=t.researcher_share,
        platform_share=t.platform_share,
        subscriber_net=t.subscriber_net,
        modifications=t.modifications,
        created_at=t.created_at,
        executed_at=t.executed_at,
    ) for t in trades]


# ── Profit Sharing ───────────────────────────────────────────────

@router.get("/profit-sharing", response_model=list[ProfitSharingDetail])
def get_profit_sharing(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get profit sharing breakdown for all completed trades."""
    return trading_service.get_profit_sharing_details(db, user.id)


# ── Multi-Trade Execution ───────────────────────────────────────

@router.post("/trades/multi")
def execute_multi_trade(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Execute multiple trades in sequence using the AI model.
    Body: {subscription_id, capital_per_trade, num_trades (1-20)}
    """
    subscription_id = body.get("subscription_id")
    capital_per_trade = body.get("capital_per_trade", 1000)
    num_trades = min(body.get("num_trades", 5), 20)

    if not subscription_id:
        raise HTTPException(status_code=400, detail="subscription_id is required")
    if capital_per_trade <= 0:
        raise HTTPException(status_code=400, detail="capital_per_trade must be positive")

    try:
        result = trading_service.execute_multi_trade(
            db=db,
            user_id=user.id,
            subscription_id=subscription_id,
            capital_per_trade=capital_per_trade,
            num_trades=num_trades,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result
