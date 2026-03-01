"""
Profit-sharing service — implements the High-Water Mark algorithm
and splits profit between subscriber, researcher, and TOLLABS.
"""

from sqlalchemy.orm import Session

from app.config import settings
from app.models.subscription import Subscription
from app.models.trading_model import TradingModel
from app.models.transaction import Transaction
from app.models.user import User
from app.mocks import mock_stripe


def process_profit_for_subscription(
    db: Session,
    subscription: Subscription,
    trade_pnl: float,
) -> dict:
    """
    Apply a single trade's PnL to a subscription, run the HWM algorithm,
    and create the appropriate transaction rows.

    Returns a summary dict of the splits.
    """
    model = db.query(TradingModel).filter(TradingModel.id == subscription.model_id).first()
    researcher = db.query(User).filter(User.id == model.creator_id).first() if model else None

    # 1. Record the raw trade PnL
    tx_trade = Transaction(
        subscription_id=subscription.id,
        user_id=subscription.subscriber_id,
        type="trade_pnl",
        amount=trade_pnl,
        description=f"Trade PnL for model '{model.name if model else '?'}': {trade_pnl:+.5f}",
    )
    db.add(tx_trade)

    # 2. Update cumulative PnL
    subscription.cumulative_pnl += trade_pnl

    # 3. High-water mark check
    splits = {
        "trade_pnl": round(trade_pnl, 5),
        "new_profit": 0.0,
        "researcher_payout": 0.0,
        "platform_commission": 0.0,
        "subscriber_net": 0.0,
    }

    if subscription.cumulative_pnl > subscription.high_water_mark:
        new_profit = subscription.cumulative_pnl - subscription.high_water_mark

        researcher_share = new_profit * subscription.profit_share_pct
        platform_share = new_profit * settings.PLATFORM_COMMISSION
        subscriber_net = new_profit - researcher_share - platform_share

        # Update HWM
        subscription.high_water_mark = subscription.cumulative_pnl

        splits["new_profit"] = round(new_profit, 5)
        splits["researcher_payout"] = round(researcher_share, 5)
        splits["platform_commission"] = round(platform_share, 5)
        splits["subscriber_net"] = round(subscriber_net, 5)

        # 4. Record researcher payout transaction
        if researcher and researcher_share > 0:
            tx_researcher = Transaction(
                subscription_id=subscription.id,
                user_id=researcher.id,
                type="researcher_payout",
                amount=researcher_share,
                description=f"Profit share from subscriber #{subscription.subscriber_id} on '{model.name}'",
            )
            db.add(tx_researcher)
            researcher.balance += researcher_share

            # Mock Stripe transfer
            mock_stripe.process_payout(
                researcher_id=researcher.id,
                amount=researcher_share,
                description=f"Profit share: model '{model.name}'",
            )

        # 5. Platform commission
        tx_commission = Transaction(
            subscription_id=subscription.id,
            user_id=subscription.subscriber_id,
            type="commission",
            amount=-platform_share,
            description=f"TOLLABS commission ({settings.PLATFORM_COMMISSION*100:.0f}%)",
        )
        db.add(tx_commission)

    db.commit()
    return splits


def get_researcher_earnings(db: Session, researcher_id: int) -> dict:
    """Aggregate all researcher_payout transactions for a researcher."""
    payouts = (
        db.query(Transaction)
        .filter(Transaction.user_id == researcher_id, Transaction.type == "researcher_payout")
        .all()
    )
    total = sum(t.amount for t in payouts)
    researcher = db.query(User).filter(User.id == researcher_id).first()

    # Group by model
    model_earnings: dict[int, float] = {}
    for t in payouts:
        sub = db.query(Subscription).filter(Subscription.id == t.subscription_id).first()
        if sub:
            model_earnings[sub.model_id] = model_earnings.get(sub.model_id, 0) + t.amount

    models_summary = []
    for mid, earned in model_earnings.items():
        m = db.query(TradingModel).filter(TradingModel.id == mid).first()
        models_summary.append({
            "model_id": mid,
            "model_name": m.name if m else "Unknown",
            "total_earned": round(earned, 5),
        })

    return {
        "researcher_id": researcher_id,
        "email": researcher.email if researcher else "",
        "total_earnings": round(total, 5),
        "current_balance": round(researcher.balance, 5) if researcher else 0,
        "num_payouts": len(payouts),
        "per_model": models_summary,
        "stripe_transfers": mock_stripe.get_transfers_for_user(researcher_id),
    }
