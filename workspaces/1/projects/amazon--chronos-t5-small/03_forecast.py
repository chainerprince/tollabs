# ── Run Forecast ─────────────────────────────────────────────
context = torch.tensor(df["close"].values[-200:], dtype=torch.float32)
prediction_length = 24  # forecast next 24 periods

try:
    forecast = pipeline.predict(context.unsqueeze(0), prediction_length)
    median = np.median(forecast[0].numpy(), axis=0)
    low  = np.percentile(forecast[0].numpy(), 10, axis=0)
    high = np.percentile(forecast[0].numpy(), 90, axis=0)
    print(f"Forecast ({prediction_length} steps):")
    print(f"  Median: {median[:5]}...")
    print(f"  80% CI: [{low[0]:.2f}, {high[0]:.2f}]")
except Exception as e:
    print(f"Forecast with basic approach: {e}")
    # Fallback: simple momentum forecast
    last_price = df["close"].iloc[-1]
    momentum = df["returns"].iloc[-20:].mean()
    forecast_prices = [last_price * (1 + momentum) ** i for i in range(1, prediction_length + 1)]
    print(f"Momentum forecast: {forecast_prices[:5]}")