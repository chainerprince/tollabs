"""
Modal function: Run backtest on serverless GPU.

Usage (remote):
    import modal
    f = modal.Function.from_name("tollabs-compute", "run_backtest")
    result = f.remote(strategy_code="...", asset="EUR/USD", periods=1000)
"""

from modal_engine.app import app, image, volume


@app.function(image=image, volumes={"/data": volume}, timeout=300)
def run_backtest(strategy_code: str, asset: str, periods: int = 1000) -> dict:
    """
    Execute a trading strategy backtest inside a Modal container.
    Reads price data from the /data volume, executes strategy, returns metrics.
    """
    import json
    import math
    import pathlib

    import numpy as np

    # 1. Try to load cached price data from the volume
    data_path = pathlib.Path(f"/data/{asset.replace('/', '_')}.json")
    if data_path.exists():
        prices = json.loads(data_path.read_text())[:periods]
    else:
        # Generate synthetic data if no cached data exists
        rng = np.random.default_rng(42)
        price = 1.12 if "/" in asset else 150.0
        prices = []
        for i in range(periods):
            ret = rng.normal(0.0001, 0.01)
            price *= math.exp(ret)
            prices.append({"close": round(price, 5), "index": i})

    # 2. Execute the strategy
    namespace = {"prices": prices, "np": np, "math": math, "trades": []}
    try:
        exec(strategy_code, {"__builtins__": {}}, namespace)
        trades = namespace.get("trades", [])
    except Exception as e:
        return {"error": str(e), "trades": [], "metrics": {}}

    # 3. Compute metrics
    pnls = [t.get("pnl", 0) for t in trades]
    total_pnl = sum(pnls)
    mean_pnl = np.mean(pnls) if pnls else 0
    std_pnl = np.std(pnls) if len(pnls) > 1 else 1
    sharpe = (mean_pnl / std_pnl) * math.sqrt(252) if std_pnl > 0 else 0

    return {
        "trades": trades,
        "metrics": {
            "sharpe_ratio": round(float(sharpe), 4),
            "total_pnl": round(float(total_pnl), 5),
            "num_trades": len(trades),
        },
    }
