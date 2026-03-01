"""
Trading service — handles wallet funding, trade creation, execution (mocked),
and profit-sharing settlement for subscribers.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.trade import Trade
from app.models.subscription import Subscription
from app.models.trading_model import TradingModel
from app.models.transaction import Transaction
from app.models.user import User
from app.mocks import mock_trading, mock_stripe


def fund_wallet(db: Session, user_id: int, amount: float) -> dict:
    """Add mock funds to a user's wallet balance."""
    if amount <= 0:
        raise ValueError("Amount must be positive")
    if amount > 1_000_000:
        raise ValueError("Maximum single deposit is $1,000,000")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    user.balance += amount

    # Record the deposit transaction
    tx = Transaction(
        user_id=user_id,
        type="deposit",
        amount=amount,
        description=f"Wallet deposit: +${amount:,.2f} (mock)",
    )
    db.add(tx)
    db.commit()
    db.refresh(user)

    return {"balance": round(user.balance, 2), "message": f"Added ${amount:,.2f} to your wallet"}


def withdraw_wallet(db: Session, user_id: int, amount: float) -> dict:
    """Withdraw funds from a user's wallet balance."""
    if amount <= 0:
        raise ValueError("Amount must be positive")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    if amount > user.balance:
        raise ValueError(f"Insufficient balance. You have ${user.balance:,.2f}, requested ${amount:,.2f}")

    user.balance -= amount

    tx = Transaction(
        user_id=user_id,
        type="withdrawal",
        amount=-amount,
        description=f"Wallet withdrawal: -${amount:,.2f}",
    )
    db.add(tx)
    db.commit()
    db.refresh(user)

    return {"balance": round(user.balance, 2), "message": f"Withdrew ${amount:,.2f} from your wallet"}


def create_trade(
    db: Session,
    user_id: int,
    subscription_id: int,
    capital: float,
    modifications: str = "",
    modified_code: str = "",
) -> Trade:
    """Create a pending trade for a subscription."""
    # Validate subscription
    sub = (
        db.query(Subscription)
        .filter(Subscription.id == subscription_id, Subscription.subscriber_id == user_id)
        .first()
    )
    if not sub:
        raise ValueError("Subscription not found")
    if not sub.is_active:
        raise ValueError("Subscription is not active")

    # Validate capital
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    if capital <= 0:
        raise ValueError("Capital must be positive")
    if capital > user.balance:
        raise ValueError(f"Insufficient balance. You have ${user.balance:,.2f}, requested ${capital:,.2f}")

    model = db.query(TradingModel).filter(TradingModel.id == sub.model_id).first()
    if not model:
        raise ValueError("Trading model not found")

    trade = Trade(
        subscription_id=subscription_id,
        subscriber_id=user_id,
        model_id=sub.model_id,
        capital=capital,
        status="pending",
        modifications=modifications,
        modified_code=modified_code,
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade


def get_trade_summary(db: Session, trade_id: int, user_id: int) -> dict:
    """Get a trade summary for confirmation."""
    trade = db.query(Trade).filter(Trade.id == trade_id, Trade.subscriber_id == user_id).first()
    if not trade:
        raise ValueError("Trade not found")

    model = db.query(TradingModel).filter(TradingModel.id == trade.model_id).first()
    sub = db.query(Subscription).filter(Subscription.id == trade.subscription_id).first()

    # Determine risk level based on capital / metrics
    metrics = model.performance_metadata or {} if model else {}
    sharpe = metrics.get("sharpe_ratio", 0)
    max_dd = metrics.get("max_drawdown_pct", 0)

    if sharpe > 1.5 and max_dd < 5:
        risk = "Low"
    elif sharpe > 0.5 and max_dd < 15:
        risk = "Medium"
    else:
        risk = "High"

    return {
        "trade_id": trade.id,
        "model_name": model.name if model else "Unknown",
        "asset_class": model.asset_class if model else "",
        "capital": trade.capital,
        "strategy_summary": model.description if model else "",
        "modifications": trade.modifications,
        "estimated_risk": risk,
        "profit_share_pct": sub.profit_share_pct if sub else 0.20,
        "status": trade.status,
    }


def execute_trade(db: Session, trade_id: int, user_id: int) -> Trade:
    """Execute a trade (mocked) — runs strategy against simulated prices, computes PnL, does profit sharing."""
    trade = db.query(Trade).filter(Trade.id == trade_id, Trade.subscriber_id == user_id).first()
    if not trade:
        raise ValueError("Trade not found")
    if trade.status not in ("pending", "confirmed"):
        raise ValueError(f"Trade cannot be executed (status: {trade.status})")

    model = db.query(TradingModel).filter(TradingModel.id == trade.model_id).first()
    sub = db.query(Subscription).filter(Subscription.id == trade.subscription_id).first()
    user = db.query(User).filter(User.id == user_id).first()

    if not model or not sub or not user:
        raise ValueError("Invalid trade configuration")

    # Debit the capital from user's wallet
    if user.balance < trade.capital:
        raise ValueError("Insufficient balance")
    user.balance -= trade.capital

    trade.status = "executing"
    db.commit()

    # Run the mock trading engine
    strategy_code = trade.modified_code if trade.modified_code else model.strategy_code
    cycle = mock_trading.run_single_model_cycle(
        strategy_code=strategy_code,
        asset=model.asset_class,
        periods=200,
    )

    trades_list = cycle["trades"]
    metrics = cycle["metrics"]

    # Scale PnL to the capital amount
    total_pnl_pct = metrics.get("total_return_pct", 0) / 100
    actual_pnl = trade.capital * total_pnl_pct

    # Update trade record
    trade.pnl = round(actual_pnl, 2)
    trade.pnl_pct = round(total_pnl_pct * 100, 2)
    trade.num_trades = metrics.get("num_trades", 0)
    trade.execution_details = {
        "metrics": metrics,
        "num_simulated_trades": len(trades_list),
        "sample_trades": trades_list[:5] if trades_list else [],
    }

    if trades_list and trades_list[0].get("type") != "error":
        trade.entry_price = trades_list[0].get("entry_price")
        trade.exit_price = trades_list[-1].get("exit_price") if len(trades_list) > 0 else None
        trade.direction = "long"  # default for mock
    else:
        trade.direction = "error"

    trade.status = "completed"
    trade.executed_at = datetime.now(timezone.utc)

    # Return capital + PnL to user's wallet
    user.balance += trade.capital + actual_pnl

    # Profit sharing (only if profitable)
    if actual_pnl > 0:
        researcher_share = actual_pnl * sub.profit_share_pct
        platform_share = actual_pnl * settings.PLATFORM_COMMISSION
        subscriber_net = actual_pnl - researcher_share - platform_share

        trade.researcher_share = round(researcher_share, 2)
        trade.platform_share = round(platform_share, 2)
        trade.subscriber_net = round(subscriber_net, 2)

        # Debit profit shares from user wallet
        user.balance -= (researcher_share + platform_share)

        # Credit researcher
        researcher = db.query(User).filter(User.id == model.creator_id).first()
        if researcher:
            researcher.balance += researcher_share

            tx_researcher = Transaction(
                subscription_id=sub.id,
                user_id=researcher.id,
                type="researcher_payout",
                amount=round(researcher_share, 2),
                description=f"Profit share from trade #{trade.id} on '{model.name}' (${actual_pnl:,.2f} PnL)",
            )
            db.add(tx_researcher)

            mock_stripe.process_payout(
                researcher_id=researcher.id,
                amount=researcher_share,
                description=f"Trade #{trade.id} profit share",
            )

        # Platform commission transaction
        tx_commission = Transaction(
            subscription_id=sub.id,
            user_id=user_id,
            type="commission",
            amount=round(-platform_share, 2),
            description=f"TOLLABS commission on trade #{trade.id} ({settings.PLATFORM_COMMISSION*100:.0f}%)",
        )
        db.add(tx_commission)

        # Update subscription cumulative PnL
        sub.cumulative_pnl += actual_pnl
        if sub.cumulative_pnl > sub.high_water_mark:
            sub.high_water_mark = sub.cumulative_pnl
    else:
        trade.researcher_share = 0
        trade.platform_share = 0
        trade.subscriber_net = round(actual_pnl, 2)
        sub.cumulative_pnl += actual_pnl

    # Record trade PnL transaction
    tx_pnl = Transaction(
        subscription_id=sub.id,
        user_id=user_id,
        type="trade_pnl",
        amount=round(actual_pnl, 2),
        description=f"Trade #{trade.id} PnL on '{model.name}': {actual_pnl:+,.2f}",
    )
    db.add(tx_pnl)

    db.commit()
    db.refresh(trade)
    return trade


def get_user_trades(db: Session, user_id: int) -> list[Trade]:
    """Get all trades for a user, ordered by most recent first."""
    return (
        db.query(Trade)
        .filter(Trade.subscriber_id == user_id)
        .order_by(Trade.created_at.desc())
        .all()
    )


def get_subscription_trades(db: Session, subscription_id: int, user_id: int) -> list[Trade]:
    """Get all trades for a specific subscription."""
    return (
        db.query(Trade)
        .filter(Trade.subscription_id == subscription_id, Trade.subscriber_id == user_id)
        .order_by(Trade.created_at.desc())
        .all()
    )


def get_profit_sharing_details(db: Session, user_id: int) -> list[dict]:
    """Get profit sharing breakdown for all completed trades."""
    trades = (
        db.query(Trade)
        .filter(Trade.subscriber_id == user_id, Trade.status == "completed")
        .order_by(Trade.created_at.desc())
        .all()
    )

    details = []
    for trade in trades:
        model = db.query(TradingModel).filter(TradingModel.id == trade.model_id).first()
        researcher = db.query(User).filter(User.id == model.creator_id).first() if model else None

        details.append({
            "trade_id": trade.id,
            "trade_pnl": trade.pnl,
            "researcher_share": trade.researcher_share,
            "platform_share": trade.platform_share,
            "subscriber_net": trade.subscriber_net,
            "researcher_email": researcher.email if researcher else "Unknown",
            "model_name": model.name if model else "Unknown",
            "executed_at": trade.executed_at,
        })

    return details
