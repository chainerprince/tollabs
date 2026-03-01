# ── Backtest Evaluation ──────────────────────────────────────
# Walk-forward evaluation
window = 200
horizon = 24
errors = []

for start in range(0, len(df) - window - horizon, horizon):
    ctx = torch.tensor(df["close"].values[start:start + window], dtype=torch.float32)
    actual = df["close"].values[start + window:start + window + horizon]
    try:
        pred = pipeline.predict(ctx.unsqueeze(0), horizon)
        pred_median = np.median(pred[0].numpy(), axis=0)
    except:
        last = ctx[-1].item()
        pred_median = np.full(horizon, last)
    
    mae = np.mean(np.abs(pred_median[:len(actual)] - actual))
    errors.append(mae)

print(f"Walk-forward MAE: {np.mean(errors):.4f}")
print(f"Evaluations: {len(errors)}")