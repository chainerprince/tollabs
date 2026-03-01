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


def _get_deployed_model_job_id(db: Session, model) -> tuple[int | None, int | None, int | None]:
    """
    Find the deployment info for a TradingModel.

    Returns (training_job_id, deployment_id, researcher_id).
    First checks for a linked ModelDeployment, then falls back to the
    latest completed training job from the same researcher.
    """
    from app.models.deployment import ModelDeployment
    from app.models.training_job import TrainingJob

    # 1. Direct deployment link
    if model.deployment_id:
        dep = db.query(ModelDeployment).filter(
            ModelDeployment.id == model.deployment_id,
            ModelDeployment.status == "active",
        ).first()
        if dep:
            return dep.training_job_id, dep.id, dep.researcher_id

    # 2. Fallback: latest completed training job from the creator
    job = (
        db.query(TrainingJob)
        .filter(
            TrainingJob.user_id == model.creator_id,
            TrainingJob.status == "completed",
            TrainingJob.model_artifact_path.isnot(None),
        )
        .order_by(TrainingJob.completed_at.desc())
        .first()
    )
    return (job.id, None, model.creator_id) if job else (None, None, None)


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

    # Check if model has a deployed Modal model (from a completed training job)
    deployed_job_id, deployment_id, researcher_id = _get_deployed_model_job_id(db, model)

    if deployed_job_id and not settings.USE_MOCK_TRADING:
        # ── Real Modal Multi-Step Trading ─────────────────────
        from app.services.modal_client import get_trading_decision
        from app.services.market_data import (
            generate_market_headlines,
            generate_simulated_trade_execution,
        )
        from app.mocks.mock_trading import generate_price_series

        # Generate simulated market data
        price_data = generate_price_series(asset=model.asset_class, periods=50)
        headlines = generate_market_headlines(asset=model.asset_class, count=8)

        # Call the deployed model for multi-step decision
        try:
            decision = get_trading_decision(
                job_id=deployed_job_id,
                market_headlines=headlines,
                price_data=price_data,
                capital=trade.capital,
                asset=model.asset_class,
                researcher_id=researcher_id,
            )
        except Exception as e:
            # Fallback to mock if Modal inference fails
            decision = {"error": str(e), "signal": "HOLD", "direction": "flat",
                        "steps": [], "confidence": 0, "position_size": 0,
                        "entry_price": price_data[-1]["close"] if price_data else 100.0}

        # Simulate the trade execution based on model's decision
        cycle = generate_simulated_trade_execution(
            decision=decision,
            capital=trade.capital,
            asset=model.asset_class,
        )

        trades_list = cycle["trades"]
        metrics = cycle["metrics"]

        # Scale PnL to capital
        total_pnl_pct = metrics.get("total_return_pct", 0) / 100
        actual_pnl = round(metrics.get("total_pnl", 0), 2)

        # Update trade record with multi-step details
        trade.pnl = actual_pnl
        trade.pnl_pct = round(total_pnl_pct * 100, 2)
        trade.num_trades = metrics.get("num_trades", 0)
        trade.execution_details = {
            "mode": "modal_ai",
            "deployed_job_id": deployed_job_id,
            "model_info": decision.get("model_info", {}),
            "signal": decision.get("signal", "HOLD"),
            "confidence": decision.get("confidence", 0),
            "steps": decision.get("steps", []),
            "headlines_analyzed": len(headlines),
            "metrics": metrics,
            "trades": trades_list,
        }

        if trades_list and trades_list[0].get("type") != "error":
            trade.entry_price = trades_list[0].get("entry_price")
            trade.exit_price = trades_list[0].get("exit_price")
            trade.direction = decision.get("direction", "long")
        else:
            trade.direction = decision.get("direction", "flat")
    else:
        # ── Mock Trading Engine (fallback) ────────────────────
        strategy_code = trade.modified_code if trade.modified_code else model.strategy_code
        cycle = mock_trading.run_single_model_cycle(
            strategy_code=strategy_code,
            asset=model.asset_class,
            periods=200,
        )

        trades_list = cycle["trades"]
        metrics = cycle["metrics"]

        total_pnl_pct = metrics.get("total_return_pct", 0) / 100
        actual_pnl = trade.capital * total_pnl_pct

        trade.pnl = round(actual_pnl, 2)
        trade.pnl_pct = round(total_pnl_pct * 100, 2)
        trade.num_trades = metrics.get("num_trades", 0)
        trade.execution_details = {
            "mode": "mock",
            "metrics": metrics,
            "num_simulated_trades": len(trades_list),
            "sample_trades": trades_list[:5] if trades_list else [],
        }

        if trades_list and trades_list[0].get("type") != "error":
            trade.entry_price = trades_list[0].get("entry_price")
            trade.exit_price = trades_list[-1].get("exit_price") if len(trades_list) > 0 else None
            trade.direction = "long"
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


# ── Multi-Trade Execution ─────────────────────────────────────────

def execute_multi_trade(
    db: Session,
    user_id: int,
    subscription_id: int,
    capital_per_trade: float,
    num_trades: int = 5,
) -> dict:
    """
    Execute multiple trades in sequence using the AI model.

    Each trade gets fresh market data and an independent AI decision,
    simulating a real multi-trade session where the model continuously
    analyzes new information and makes decisions.
    """
    results = []
    total_pnl = 0.0
    completed = 0
    failed = 0

    for i in range(num_trades):
        try:
            trade = create_trade(
                db=db,
                user_id=user_id,
                subscription_id=subscription_id,
                capital=capital_per_trade,
                modifications=f"Multi-trade batch #{i + 1} of {num_trades}",
            )

            result = execute_trade(db, trade.id, user_id)

            results.append({
                "trade_id": result.id,
                "batch_index": i + 1,
                "status": result.status,
                "direction": result.direction,
                "pnl": result.pnl,
                "pnl_pct": result.pnl_pct,
                "signal": (result.execution_details or {}).get("signal", "N/A"),
                "confidence": (result.execution_details or {}).get("confidence", 0),
                "entry_price": result.entry_price,
                "exit_price": result.exit_price,
            })

            total_pnl += result.pnl
            completed += 1

        except Exception as e:
            results.append({
                "batch_index": i + 1,
                "status": "failed",
                "error": str(e),
            })
            failed += 1

    total_capital = capital_per_trade * num_trades
    total_pnl_pct = (total_pnl / total_capital * 100) if total_capital > 0 else 0

    return {
        "total_trades": num_trades,
        "completed": completed,
        "failed": failed,
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "capital_per_trade": capital_per_trade,
        "total_capital_deployed": total_capital,
        "trades": results,
    }
