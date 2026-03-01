"""
Admin router — simulation endpoints for triggering mock trading cycles.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.subscription import Subscription
from app.models.trading_model import TradingModel
from app.mocks.mock_trading import run_single_model_cycle
from app.services.profit_service import process_profit_for_subscription

router = APIRouter(prefix="/admin", tags=["Admin / Simulation"])


class SimulateCycleRequest(BaseModel):
    periods: int = 200
    model_id: int | None = None  # None = run all live models


@router.post("/simulate-cycle")
def simulate_cycle(
    body: SimulateCycleRequest = SimulateCycleRequest(),
    db: Session = Depends(get_db),
):
    """
    Trigger a full mock trading cycle:
    1. For each live model (or a specific one), generate trades.
    2. For each active subscription, apply the PnL and run profit-sharing.
    3. Return a summary of all splits.
    """
    if body.model_id:
        models = db.query(TradingModel).filter(TradingModel.id == body.model_id, TradingModel.status == "live").all()
    else:
        models = db.query(TradingModel).filter(TradingModel.status == "live").all()

    if not models:
        return {"message": "No live models found", "results": []}

    results = []

    for model in models:
        # Run the mock trading engine
        cycle = run_single_model_cycle(
            strategy_code=model.strategy_code,
            asset=model.asset_class,
            periods=body.periods,
        )

        # Update model performance metadata
        model.performance_metadata = cycle["metrics"]
        db.commit()

        # Process profit for every active subscriber
        subs = (
            db.query(Subscription)
            .filter(Subscription.model_id == model.id, Subscription.is_active == True)
            .all()
        )

        sub_results = []
        total_pnl = cycle["metrics"]["total_pnl"]

        for sub in subs:
            # Each subscriber gets the full model PnL (as if they had 1 unit)
            splits = process_profit_for_subscription(db, sub, total_pnl)
            sub_results.append({
                "subscription_id": sub.id,
                "subscriber_id": sub.subscriber_id,
                "cumulative_pnl": round(sub.cumulative_pnl, 5),
                "high_water_mark": round(sub.high_water_mark, 5),
                **splits,
            })

        results.append({
            "model_id": model.id,
            "model_name": model.name,
            "asset_class": model.asset_class,
            "cycle_metrics": cycle["metrics"],
            "num_trades": len(cycle["trades"]),
            "subscribers_processed": len(sub_results),
            "subscriber_splits": sub_results,
        })

    return {
        "message": f"Simulated {len(results)} model(s)",
        "results": results,
    }
