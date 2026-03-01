# ── Generate Synthetic Market Data ────────────────────────────
import numpy as np
import pandas as pd

np.random.seed(42)
n = 500
dates = pd.date_range("2024-01-01", periods=n, freq="h")
trend = np.linspace(100, 120, n)
noise = np.cumsum(np.random.randn(n) * 0.3)
prices = trend + noise

df = pd.DataFrame({"date": dates, "close": prices})
df["returns"] = df["close"].pct_change()
df["volatility"] = df["returns"].rolling(20).std()

print(f"Generated {n} hourly price bars")
print(f"Price range: ${df['close'].min():.2f} — ${df['close'].max():.2f}")
print(f"Mean return: {df['returns'].mean():.6f}")
print(f"\n{df.tail(5).to_string(index=False)}")