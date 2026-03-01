"""
Backtest router — run backtests and retrieve results.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import backtest_service

router = APIRouter(prefix="/backtest", tags=["Backtest"])


class BacktestRequest(BaseModel):
    strategy_code: str = ""
    asset: str = "EUR/USD"
    periods: int = 500
    volatility: float = 0.01


@router.post("/run")
def run_backtest(body: BacktestRequest):
    """Run a backtest against mock price data. Returns job_id + results."""
    result = backtest_service.run_backtest(
        strategy_code=body.strategy_code,
        asset=body.asset,
        periods=body.periods,
        volatility=body.volatility,
    )
    return result


@router.get("/results/{job_id}")
def get_results(job_id: str):
    """Retrieve results for a previously run backtest."""
    result = backtest_service.get_backtest_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Backtest job not found")
    return result


@router.get("/jobs")
def list_jobs():
    """List all backtest jobs."""
    return backtest_service.list_backtest_jobs()
