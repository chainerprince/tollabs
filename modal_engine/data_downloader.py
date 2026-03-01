"""
Modal function: Download and cache market data to a Volume.

Deploy as a cron:  modal deploy modal_engine/data_downloader.py
(runs every 5 minutes to fetch latest tick data)
"""

import modal
from modal_engine.app import app, image, volume


@app.function(
    image=image,
    volumes={"/data": volume},
    schedule=modal.Cron("*/5 * * * *"),
    timeout=120,
)
def fetch_market_data():
    """
    Fetch and store synthetic market data to the Modal Volume.
    In production, replace the generation logic with real API calls
    (e.g., Alpha Vantage, Polygon.io, OANDA).
    """
    import json
    import math
    import pathlib
    from datetime import datetime, timezone

    import numpy as np

    assets = ["EUR_USD", "GBP_USD", "USD_JPY", "AAPL", "TSLA"]
    rng = np.random.default_rng()

    for asset in assets:
        data_path = pathlib.Path(f"/data/{asset}.json")

        # Load existing data or start fresh
        if data_path.exists():
            existing = json.loads(data_path.read_text())
        else:
            existing = []

        # Generate a few new ticks
        last_price = existing[-1]["close"] if existing else (1.12 if "_" in asset and "USD" in asset else 150.0)
        new_ticks = []
        for _ in range(10):
            ret = rng.normal(0.0001, 0.005)
            last_price *= math.exp(ret)
            new_ticks.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "close": round(last_price, 5),
                "volume": int(rng.integers(1000, 50000)),
            })

        all_data = existing + new_ticks

        # Keep only last 10,000 ticks
        all_data = all_data[-10000:]

        data_path.write_text(json.dumps(all_data))

    # Commit changes so other containers can see them
    volume.commit()
    print(f"[{datetime.now(timezone.utc).isoformat()}] Updated {len(assets)} assets on volume.")
