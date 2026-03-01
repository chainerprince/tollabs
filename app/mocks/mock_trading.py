"""
Mock Trading Engine — simulates realistic trades with random-walk prices
and simple technical strategies.  Used by the backtest and simulation endpoints.
"""

import math
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any

import numpy as np


# ── Price Generation ──────────────────────────────────────────────


def generate_price_series(
    asset: str,
    periods: int = 500,
    start_price: float | None = None,
    volatility: float = 0.01,
    seed: int | None = None,
) -> list[dict[str, Any]]:
    """
    Generate a random-walk price series for a forex pair or stock ticker.

    Returns a list of {"timestamp", "open", "high", "low", "close", "volume"} dicts.
    """
    if seed is not None:
        rng = np.random.default_rng(seed)
    else:
        rng = np.random.default_rng()

    # Default starting prices per asset class feel
    if start_price is None:
        start_price = 1.1200 if "/" in asset else 150.0  # forex vs stock heuristic

    prices: list[dict[str, Any]] = []
    price = start_price
    now = datetime.now(timezone.utc)

    for i in range(periods):
        # Geometric Brownian Motion step
        ret = rng.normal(0.0001, volatility)
        price *= math.exp(ret)

        open_ = price
        high = price * (1 + abs(rng.normal(0, volatility * 0.5)))
        low = price * (1 - abs(rng.normal(0, volatility * 0.5)))
        close = price * math.exp(rng.normal(0, volatility * 0.3))
        price = close  # carry forward

        prices.append({
            "timestamp": (now - timedelta(minutes=(periods - i))).isoformat(),
            "open": round(open_, 5),
            "high": round(high, 5),
            "low": round(low, 5),
            "close": round(close, 5),
            "volume": int(rng.integers(1000, 100000)),
        })

    return prices


# ── Strategy Execution ────────────────────────────────────────────

def _default_strategy(prices: list[dict]) -> list[dict[str, Any]]:
    """
    Simple moving-average crossover strategy as a fallback.
    Uses 10-period vs 30-period SMA.
    """
    closes = [p["close"] for p in prices]
    trades: list[dict[str, Any]] = []
    position = None  # None | {"entry_price", "entry_idx"}

    for i in range(30, len(closes)):
        sma_short = np.mean(closes[i - 10 : i])
        sma_long = np.mean(closes[i - 30 : i])

        if position is None and sma_short > sma_long:
            # BUY signal
            position = {"entry_price": closes[i], "entry_idx": i}
        elif position is not None and sma_short < sma_long:
            # SELL signal
            pnl = closes[i] - position["entry_price"]
            trades.append({
                "id": uuid.uuid4().hex[:8],
                "type": "long",
                "entry_price": round(position["entry_price"], 5),
                "exit_price": round(closes[i], 5),
                "entry_time": prices[position["entry_idx"]]["timestamp"],
                "exit_time": prices[i]["timestamp"],
                "pnl": round(pnl, 5),
                "pnl_pct": round(pnl / position["entry_price"] * 100, 4),
            })
            position = None

    return trades


def simulate_trades(
    strategy_code: str | None,
    price_data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Execute a strategy against price data.
    If strategy_code is None or empty, uses the default SMA crossover.
    """
    if not strategy_code or strategy_code.strip() == "":
        return _default_strategy(price_data)

    # Execute user-provided strategy in a restricted namespace
    namespace: dict[str, Any] = {
        "prices": price_data,
        "np": np,
        "math": math,
        "uuid": uuid,
        "trades": [],
    }
    try:
        exec(strategy_code, {"__builtins__": {}}, namespace)
        return namespace.get("trades", [])
    except Exception as e:
        # On failure, return a single "error" trade
        return [{"id": "error", "type": "error", "pnl": 0, "error": str(e)}]


# ── Backtest Metrics ──────────────────────────────────────────────

def compute_metrics(trades: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute Sharpe, max drawdown, win rate, total PnL from a list of trades."""
    if not trades or trades[0].get("type") == "error":
        return {
            "sharpe_ratio": 0.0,
            "max_drawdown_pct": 0.0,
            "total_pnl": 0.0,
            "total_return_pct": 0.0,
            "win_rate": 0.0,
            "num_trades": 0,
            "error": trades[0].get("error") if trades else None,
        }

    pnls = [t["pnl"] for t in trades]
    cumulative = np.cumsum(pnls)

    # Sharpe (annualised, assuming ~252 trading days)
    mean_pnl = np.mean(pnls)
    std_pnl = np.std(pnls) if len(pnls) > 1 else 1.0
    sharpe = (mean_pnl / std_pnl) * math.sqrt(252) if std_pnl > 0 else 0.0

    # Max drawdown
    peak = np.maximum.accumulate(cumulative)
    drawdowns = (peak - cumulative)
    max_dd = float(np.max(drawdowns)) if len(drawdowns) else 0.0
    first_entry = trades[0].get("entry_price", 1.0) or 1.0
    max_dd_pct = (max_dd / first_entry) * 100

    wins = sum(1 for p in pnls if p > 0)

    return {
        "sharpe_ratio": round(float(sharpe), 4),
        "max_drawdown_pct": round(float(max_dd_pct), 4),
        "total_pnl": round(float(sum(pnls)), 5),
        "total_return_pct": round(float(sum(pnls) / first_entry * 100), 4),
        "win_rate": round(wins / len(pnls) * 100, 2) if pnls else 0.0,
        "num_trades": len(trades),
    }


# ── Full Trading Cycle (used by /admin/simulate-cycle) ───────────

def run_single_model_cycle(
    strategy_code: str | None,
    asset: str,
    periods: int = 500,
) -> dict[str, Any]:
    """
    Run one complete cycle: generate prices → execute trades → compute metrics.
    Returns { "prices_count", "trades", "metrics" }.
    """
    prices = generate_price_series(asset, periods=periods)
    trades = simulate_trades(strategy_code, prices)
    metrics = compute_metrics(trades)
    return {
        "prices_count": len(prices),
        "trades": trades,
        "metrics": metrics,
    }
