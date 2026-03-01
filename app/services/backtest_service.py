"""
Backtest service — orchestrates backtest runs using the mock trading engine.
Stores results in-memory keyed by job_id.
"""

import uuid
from typing import Any

from app.mocks.mock_trading import (
    generate_price_series,
    simulate_trades,
    compute_metrics,
)


# In-memory job store
_backtest_jobs: dict[str, dict[str, Any]] = {}


def run_backtest(
    strategy_code: str,
    asset: str,
    periods: int = 500,
    volatility: float = 0.01,
) -> dict[str, Any]:
    """
    Kick off a backtest: generate prices, run strategy, compute metrics.
    Returns the job result immediately (synchronous mock).
    """
    job_id = uuid.uuid4().hex[:12]

    prices = generate_price_series(asset, periods=periods, volatility=volatility)
    trades = simulate_trades(strategy_code, prices)
    metrics = compute_metrics(trades)

    result = {
        "job_id": job_id,
        "status": "completed",
        "asset": asset,
        "periods": periods,
        "metrics": metrics,
        "trades": trades,
        "prices_summary": {
            "count": len(prices),
            "first": prices[0] if prices else None,
            "last": prices[-1] if prices else None,
        },
    }
    _backtest_jobs[job_id] = result
    return result


def get_backtest_result(job_id: str) -> dict[str, Any] | None:
    return _backtest_jobs.get(job_id)


def list_backtest_jobs() -> list[dict[str, Any]]:
    return [
        {"job_id": jid, "status": j["status"], "asset": j["asset"]}
        for jid, j in _backtest_jobs.items()
    ]
