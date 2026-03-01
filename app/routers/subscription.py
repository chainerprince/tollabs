"""
Subscription router — subscribe to models, view active subscriptions.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse
from app.services import subscription_service

router = APIRouter(tags=["Subscriptions"])


@router.post("/subscribe/{model_id}")
def subscribe(
    model_id: int,
    body: SubscriptionCreate = SubscriptionCreate(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Subscribe to a trading model via mock Stripe checkout."""
    try:
        result = subscription_service.subscribe_to_model(
            db, user.id, model_id, body.profit_share_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sub = result["subscription"]
    return {
        "message": "Subscribed successfully",
        "subscription": SubscriptionResponse(
            id=sub.id,
            subscriber_id=sub.subscriber_id,
            model_id=sub.model_id,
            profit_share_pct=sub.profit_share_pct,
            is_active=sub.is_active,
            high_water_mark=sub.high_water_mark,
            cumulative_pnl=sub.cumulative_pnl,
            stripe_session_id=sub.stripe_session_id,
            subscribed_at=sub.subscribed_at,
        ),
        "checkout_session": result["checkout_session"],
    }


@router.get("/subscriptions/me", response_model=list[SubscriptionResponse])
def my_subscriptions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all subscriptions for the authenticated user."""
    subs = subscription_service.get_user_subscriptions(db, user.id)
    return [SubscriptionResponse(**s) for s in subs]


@router.delete("/subscriptions/{subscription_id}")
def cancel(
    subscription_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a subscription."""
    ok = subscription_service.cancel_subscription(db, subscription_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription cancelled"}
