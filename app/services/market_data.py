"""
Market data generator — provides realistic market headlines and price
data for the multi-step trading engine.

These are synthetic but realistic headlines used to feed the deployed
model during trade execution.
"""

import random
from datetime import datetime, timezone, timedelta
from typing import Any


# Pool of realistic headlines (model will classify these live)
BULLISH_HEADLINES = [
    "Tech stocks lead rally as earnings beat expectations across the board",
    "Federal Reserve signals dovish pivot, rate cut expectations rise",
    "Strong jobs report boosts market confidence, unemployment hits new low",
    "Consumer spending surges 4.2% in latest retail sales data",
    "Manufacturing PMI jumps to 57.3, signaling robust expansion",
    "Corporate buyback activity reaches record levels this quarter",
    "Inflation falls to 2.1%, within Fed's target range",
    "IPO market heats up as investor appetite for risk returns",
    "Institutional fund flows turn positive for equities",
    "M&A deals surge as companies seek growth through acquisitions",
    "Semiconductor sales hit all-time high on AI demand surge",
    "GDP growth revised upward to 3.8% annualized rate",
    "Housing market stabilizes as mortgage rates begin to ease",
    "Bank lending activity picks up, signaling economic optimism",
    "Copper prices rally 8% on strong industrial demand from Asia",
]

BEARISH_HEADLINES = [
    "Markets tumble as recession fears intensify amid weak economic data",
    "Federal Reserve warns of persistent inflation, signals more rate hikes",
    "Tech sector selloff accelerates, NASDAQ drops 3% in single session",
    "Consumer confidence falls to 6-month low on rising cost concerns",
    "Manufacturing index contracts for third consecutive month",
    "Credit card delinquencies rise sharply, consumer stress builds",
    "Corporate earnings miss estimates, companies cut guidance",
    "Geopolitical tensions escalate, supply chain disruptions worsen",
    "Oil prices spike on Middle East conflict fears",
    "Bond yields surge, 10-year Treasury hits multi-year high",
    "Regional bank failures spread, deposit flight continues",
    "Labor market weakens as initial jobless claims jump unexpectedly",
    "Retail giants warn of inventory glut and margin compression",
    "Commercial real estate defaults rise, office vacancy hits record",
    "Trade deficit widens as global demand softens",
]

NEUTRAL_HEADLINES = [
    "Markets trade sideways as investors await key economic data",
    "Fed officials express data-dependent approach to policy decisions",
    "Mixed earnings season continues with sector rotation evident",
    "Bond market shows little movement ahead of Treasury auction",
    "Currency markets stable as major pairs trade in tight ranges",
    "Oil prices steady as OPEC+ output meets expectations",
    "Existing home sales roughly in line with analyst forecasts",
    "Weekly jobless claims unchanged from prior week",
    "Consumer sentiment survey shows mixed signals on outlook",
    "Technology sector sees rotation between growth and value names",
]


def generate_market_headlines(
    asset: str,
    bias: str = "random",
    count: int = 8,
) -> list[str]:
    """
    Generate a batch of realistic market headlines for model analysis.

    Args:
        asset: The asset being traded (for contextual relevance)
        bias: "bullish", "bearish", "neutral", or "random"
        count: Number of headlines to generate

    Returns:
        List of headline strings
    """
    if bias == "bullish":
        pool = BULLISH_HEADLINES * 3 + NEUTRAL_HEADLINES + BEARISH_HEADLINES[:3]
    elif bias == "bearish":
        pool = BEARISH_HEADLINES * 3 + NEUTRAL_HEADLINES + BULLISH_HEADLINES[:3]
    elif bias == "neutral":
        pool = NEUTRAL_HEADLINES * 3 + BULLISH_HEADLINES[:3] + BEARISH_HEADLINES[:3]
    else:
        # Random mix
        pool = BULLISH_HEADLINES + BEARISH_HEADLINES + NEUTRAL_HEADLINES

    headlines = random.sample(pool, min(count, len(pool)))

    # Add asset-specific context to a couple of them
    asset_name = asset.replace("/", " ").upper()
    if len(headlines) > 2:
        headlines[0] = f"Breaking: {asset_name} — {headlines[0]}"
        headlines[-1] = f"Analysis: {asset_name} outlook — {headlines[-1].lower()}"

    return headlines


def generate_simulated_trade_execution(
    decision: dict,
    capital: float,
    asset: str,
) -> dict[str, Any]:
    """
    Simulate trade execution based on the model's multi-step decision.

    Uses the model's entry/exit plan to generate a realistic trade outcome.
    Price simulation adds noise around the model's predicted levels.

    Args:
        decision: The trading_decision result from the deployed model
        capital: Amount of capital allocated
        asset: Asset being traded

    Returns:
        Execution result with final PnL
    """
    direction = decision.get("direction", "flat")
    entry_price = decision.get("entry_price", 100.0)
    stop_loss = decision.get("stop_loss")
    take_profit = decision.get("take_profit")
    position_size = decision.get("position_size", 0.0)
    confidence = decision.get("confidence", 0.5)
    signal = decision.get("signal", "HOLD")

    if direction == "flat" or position_size <= 0:
        return {
            "trades": [],
            "metrics": {
                "sharpe_ratio": 0.0,
                "max_drawdown_pct": 0.0,
                "total_pnl": 0.0,
                "total_return_pct": 0.0,
                "win_rate": 0.0,
                "num_trades": 0,
            },
            "decision": decision,
        }

    # Simulate the trade outcome
    # Higher confidence → more likely to hit take-profit
    # Signal strength affects the outcome probability
    r = random.random()

    if signal in ("STRONG_BUY", "STRONG_SELL"):
        # Strong signals have higher success probability
        win_probability = 0.55 + (confidence - 0.5) * 0.3
    else:
        win_probability = 0.48 + (confidence - 0.5) * 0.2

    if r < win_probability and take_profit is not None:
        # Win scenario — price hits take-profit
        exit_price = take_profit + random.uniform(-0.001, 0.001) * entry_price
        outcome = "take_profit"
    elif stop_loss is not None:
        # Loss scenario — price hits stop-loss
        exit_price = stop_loss + random.uniform(-0.001, 0.001) * entry_price
        outcome = "stop_loss"
    else:
        # Flat — minor movement
        noise = random.uniform(-0.005, 0.005) * entry_price
        exit_price = entry_price + noise
        outcome = "timeout"

    # Calculate PnL
    if direction == "long":
        price_pnl_pct = (exit_price - entry_price) / entry_price
    else:  # short
        price_pnl_pct = (entry_price - exit_price) / entry_price

    actual_pnl = position_size * price_pnl_pct
    actual_pnl_pct = (actual_pnl / capital) * 100 if capital > 0 else 0

    trade = {
        "id": f"modal_{random.randint(10000, 99999)}",
        "type": direction,
        "entry_price": round(entry_price, 5),
        "exit_price": round(exit_price, 5),
        "pnl": round(actual_pnl, 2),
        "pnl_pct": round(price_pnl_pct * 100, 4),
        "outcome": outcome,
        "signal_strength": signal,
        "model_confidence": round(confidence, 4),
    }

    metrics = {
        "sharpe_ratio": round(random.uniform(0.3, 2.5) * (1 if actual_pnl > 0 else -0.5), 4),
        "max_drawdown_pct": round(abs(min(0, price_pnl_pct * 100)) * 1.2, 4),
        "total_pnl": round(actual_pnl, 2),
        "total_return_pct": round(actual_pnl_pct, 4),
        "win_rate": 100.0 if actual_pnl > 0 else 0.0,
        "num_trades": 1,
    }

    return {
        "trades": [trade],
        "metrics": metrics,
        "decision": decision,
    }
