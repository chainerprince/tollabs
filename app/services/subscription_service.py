"""Subscription service — handles subscribing to models via mock Stripe."""

from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.models.trading_model import TradingModel
from app.models.user import User
from app.mocks import mock_stripe


def subscribe_to_model(
    db: Session,
    user_id: int,
    model_id: int,
    profit_share_pct: float = 0.20,
) -> dict:
    """
    Create a subscription + mock Stripe checkout session.
    Returns {"subscription": Subscription, "checkout_session": dict}.
    """
    model = db.query(TradingModel).filter(TradingModel.id == model_id).first()
    if model is None:
        raise ValueError(f"Model {model_id} not found")
    if model.status != "live":
        raise ValueError(f"Model {model_id} is not live (status={model.status})")

    # Check for existing active subscription
    existing = (
        db.query(Subscription)
        .filter(
            Subscription.subscriber_id == user_id,
            Subscription.model_id == model_id,
            Subscription.is_active == True,
        )
        .first()
    )
    if existing:
        raise ValueError("Already subscribed to this model")

    # Create mock Stripe checkout
    session = mock_stripe.create_checkout_session(
        user_id=user_id,
        model_id=model_id,
        model_name=model.name,
        profit_share_pct=profit_share_pct,
    )

    # Create subscription row
    sub = Subscription(
        subscriber_id=user_id,
        model_id=model_id,
        profit_share_pct=profit_share_pct,
        is_active=True,
        high_water_mark=0.0,
        cumulative_pnl=0.0,
        stripe_session_id=session["id"],
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return {"subscription": sub, "checkout_session": session}


def get_user_subscriptions(db: Session, user_id: int) -> list[dict]:
    """Return all active subscriptions for a user with model metadata."""
    subs = (
        db.query(Subscription)
        .filter(Subscription.subscriber_id == user_id)
        .all()
    )
    result = []
    for sub in subs:
        model = db.query(TradingModel).filter(TradingModel.id == sub.model_id).first()
        result.append({
            "id": sub.id,
            "subscriber_id": sub.subscriber_id,
            "model_id": sub.model_id,
            "model_name": model.name if model else "Unknown",
            "asset_class": model.asset_class if model else "",
            "profit_share_pct": sub.profit_share_pct,
            "is_active": sub.is_active,
            "high_water_mark": sub.high_water_mark,
            "cumulative_pnl": sub.cumulative_pnl,
            "stripe_session_id": sub.stripe_session_id,
            "subscribed_at": sub.subscribed_at,
        })
    return result


def cancel_subscription(db: Session, subscription_id: int, user_id: int) -> bool:
    sub = (
        db.query(Subscription)
        .filter(Subscription.id == subscription_id, Subscription.subscriber_id == user_id)
        .first()
    )
    if sub is None:
        return False
    sub.is_active = False
    db.commit()
    return True
