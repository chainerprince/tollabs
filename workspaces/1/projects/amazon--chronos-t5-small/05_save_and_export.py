# ── Save Results ─────────────────────────────────────────────
import json, os

OUTPUT_DIR = "./fine_tuned_chronos-t5-small"
os.makedirs(OUTPUT_DIR, exist_ok=True)

results = {
    "model_id": "amazon/chronos-t5-small",
    "mae": float(np.mean(errors)) if errors else None,
    "forecast_horizon": prediction_length,
    "context_length": window,
}

with open(f"{OUTPUT_DIR}/results.json", "w") as f:
    json.dump(results, f, indent=2)

print(f"✓ Results saved to {OUTPUT_DIR}")
print("\nNext: Click 'Save & Publish' to backtest →")