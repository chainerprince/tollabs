# Using fine-tuned model: amazon_chronos-t5-small_finetuned.pt
import json, pathlib
model_path = pathlib.Path("models/amazon_chronos-t5-small_finetuned.pt")
model_config = json.loads(model_path.read_text())

# Strategy using the fine-tuned model predictions
def on_tick(tick):
    # sentiment = model.predict(tick.headline)
    # if sentiment > 0.7: buy()
    # if sentiment < 0.3: sell()
    pass
