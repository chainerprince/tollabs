"""
TOLLABS — Real Modal GPU Training & Inference

This module defines Modal apps for:
1. Fine-tuning FinBERT on financial sentiment data (GPU)
2. Deploying the fine-tuned model as an inference endpoint
3. Multi-step trading decision engine using the deployed model

Requires: MODAL_TOKEN_ID and MODAL_TOKEN_SECRET in environment.
"""

import modal

# ── Modal App ─────────────────────────────────────────────────────

app = modal.App("tollabs-finbert")

# Persistent volume for model weights & datasets
volume = modal.Volume.from_name("tollabs-models", create_if_missing=True)

# GPU image with all ML deps pre-installed
training_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.1.0",
        "transformers>=4.36.0",
        "datasets>=2.16.0",
        "peft>=0.7.0",
        "accelerate>=0.25.0",
        "scikit-learn>=1.3.0",
        "pandas>=2.1.0",
        "numpy>=1.26.0",
        "huggingface-hub>=0.20.0",
    )
)

# Lighter image for inference
inference_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.1.0",
        "transformers>=4.36.0",
        "peft>=0.7.0",
        "numpy>=1.26.0",
    )
)

VOLUME_PATH = "/vol/tollabs-models"


# ── Fine-Tuning Function (runs on GPU) ───────────────────────────

@app.function(
    image=training_image,
    gpu="T4",
    timeout=3600,
    volumes={VOLUME_PATH: volume},
)
def finetune_finbert(
    job_id: int,
    base_model: str,
    dataset_text: str,
    config: dict,
    callback_url: str | None = None,
) -> dict:
    """
    Fine-tune a HuggingFace model (default: FinBERT) on financial text data.

    Args:
        job_id: TOLLABS job ID for tracking
        base_model: HuggingFace model ID (e.g. "ProsusAI/finbert")
        dataset_text: CSV content with 'text' and 'label' columns
        config: Training hyperparameters {epochs, learning_rate, batch_size, lora_rank, ...}
        callback_url: Optional URL to POST progress updates to

    Returns:
        Dict with final metrics and artifact path
    """
    import json
    import os
    import pandas as pd
    from io import StringIO
    from datetime import datetime, timezone

    import torch
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        TrainingArguments,
        Trainer,
    )
    from peft import LoraConfig, get_peft_model, TaskType
    from datasets import Dataset
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, f1_score

    logs = []
    def log(msg):
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        logs.append(f"[{ts}] {msg}")
        print(f"[{ts}] {msg}")

    log(f"Starting fine-tuning job #{job_id}")
    log(f"Base model: {base_model}")
    log(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    log(f"Config: {json.dumps(config, indent=2)}")

    # ── Parse dataset ─────────────────────────────────────────
    try:
        df = pd.read_csv(StringIO(dataset_text))
        if "text" not in df.columns:
            # Try common alternatives
            text_col = next((c for c in df.columns if c.lower() in ("text", "sentence", "content", "headline")), df.columns[0])
            df = df.rename(columns={text_col: "text"})
        if "label" not in df.columns:
            label_col = next((c for c in df.columns if c.lower() in ("label", "sentiment", "class", "target")), None)
            if label_col:
                df = df.rename(columns={label_col: "label"})
            else:
                # Auto-generate labels using keyword heuristic for demo
                def _simple_label(t):
                    t = str(t).lower()
                    if any(w in t for w in ["gain", "profit", "bull", "up", "surge", "rise", "growth", "positive"]):
                        return 2  # positive
                    elif any(w in t for w in ["loss", "drop", "bear", "down", "fall", "crash", "negative", "decline"]):
                        return 0  # negative
                    return 1  # neutral
                df["label"] = df["text"].apply(_simple_label)

        # Ensure labels are integers
        if df["label"].dtype == object:
            label_map = {l: i for i, l in enumerate(sorted(df["label"].unique()))}
            df["label"] = df["label"].map(label_map)

        df = df[["text", "label"]].dropna()
        num_labels = int(df["label"].nunique())
        log(f"Dataset: {len(df)} rows, {num_labels} classes")
    except Exception as e:
        return {"status": "failed", "error": f"Dataset parsing failed: {str(e)}", "logs": "\n".join(logs)}

    # ── Load tokenizer & model ────────────────────────────────
    log("Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForSequenceClassification.from_pretrained(
        base_model,
        num_labels=num_labels,
        ignore_mismatched_sizes=True,
    )

    # ── Apply LoRA if requested ───────────────────────────────
    lora_rank = config.get("lora_rank", 8)
    if lora_rank > 0:
        log(f"Applying LoRA (rank={lora_rank})")
        peft_config = LoraConfig(
            task_type=TaskType.SEQ_CLS,
            r=lora_rank,
            lora_alpha=lora_rank * 2,
            lora_dropout=0.1,
            target_modules=["query", "value"],
        )
        model = get_peft_model(model, peft_config)
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in model.parameters())
        log(f"Trainable params: {trainable:,} / {total:,} ({trainable/total*100:.1f}%)")

    # ── Prepare datasets ──────────────────────────────────────
    train_df, val_df = train_test_split(df, test_size=0.15, random_state=42, stratify=df["label"])
    log(f"Train: {len(train_df)}, Validation: {len(val_df)}")

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=config.get("max_seq_length", 256))

    train_ds = Dataset.from_pandas(train_df).map(tokenize, batched=True)
    val_ds = Dataset.from_pandas(val_df).map(tokenize, batched=True)
    train_ds.set_format("torch", columns=["input_ids", "attention_mask", "label"])
    val_ds.set_format("torch", columns=["input_ids", "attention_mask", "label"])

    # ── Training ──────────────────────────────────────────────
    epochs = config.get("epochs", 3)
    batch_size = config.get("batch_size", 16)
    lr = config.get("learning_rate", 2e-5)

    output_dir = f"{VOLUME_PATH}/jobs/{job_id}"
    os.makedirs(output_dir, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        learning_rate=lr,
        weight_decay=config.get("weight_decay", 0.01),
        warmup_steps=config.get("warmup_steps", 50),
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_steps=10,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        report_to="none",
    )

    def compute_metrics(eval_pred):
        preds = eval_pred.predictions.argmax(-1)
        labels = eval_pred.label_ids
        return {
            "accuracy": accuracy_score(labels, preds),
            "f1": f1_score(labels, preds, average="weighted"),
        }

    log(f"Starting training: {epochs} epochs, batch_size={batch_size}, lr={lr}")

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=compute_metrics,
    )

    result = trainer.train()
    log(f"Training complete! Loss: {result.training_loss:.4f}")

    # ── Evaluate ──────────────────────────────────────────────
    eval_result = trainer.evaluate()
    log(f"Eval accuracy: {eval_result.get('eval_accuracy', 0):.4f}")
    log(f"Eval F1: {eval_result.get('eval_f1', 0):.4f}")

    # ── Save final model ──────────────────────────────────────
    final_path = f"{VOLUME_PATH}/deployed/{job_id}"
    os.makedirs(final_path, exist_ok=True)
    trainer.save_model(final_path)
    tokenizer.save_pretrained(final_path)

    # Save metadata
    metadata = {
        "job_id": job_id,
        "base_model": base_model,
        "num_labels": num_labels,
        "lora_rank": lora_rank,
        "epochs": epochs,
        "train_loss": round(result.training_loss, 4),
        "eval_accuracy": round(eval_result.get("eval_accuracy", 0), 4),
        "eval_f1": round(eval_result.get("eval_f1", 0), 4),
        "train_samples": len(train_df),
        "val_samples": len(val_df),
        "label_map": {str(i): str(i) for i in range(num_labels)},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with open(f"{final_path}/tollabs_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    volume.commit()
    log(f"Model saved to {final_path}")

    # Build loss history from trainer state
    loss_history = [
        round(entry["loss"], 4)
        for entry in trainer.state.log_history
        if "loss" in entry
    ]
    val_loss_history = [
        round(entry["eval_loss"], 4)
        for entry in trainer.state.log_history
        if "eval_loss" in entry
    ]

    return {
        "status": "completed",
        "job_id": job_id,
        "artifact_path": f"deployed/{job_id}",
        "metrics": {
            "train_loss": round(result.training_loss, 4),
            "eval_accuracy": round(eval_result.get("eval_accuracy", 0), 4),
            "eval_f1": round(eval_result.get("eval_f1", 0), 4),
            "loss_history": loss_history,
            "val_loss_history": val_loss_history,
            "current_loss": loss_history[-1] if loss_history else None,
            "best_loss": min(loss_history) if loss_history else None,
            "epoch": epochs,
            "step": result.global_step,
            "total_steps": result.global_step,
        },
        "logs": "\n".join(logs),
    }


# ── Inference Function (deployed model) ──────────────────────────

@app.function(
    image=inference_image,
    volumes={VOLUME_PATH: volume},
    timeout=120,
)
def predict_sentiment(job_id: int, texts: list[str]) -> list[dict]:
    """
    Run inference on a fine-tuned model.

    Args:
        job_id: The training job ID (used to locate model weights)
        texts: List of text strings to classify

    Returns:
        List of {text, label, confidence, probabilities} dicts
    """
    import json
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    model_path = f"{VOLUME_PATH}/deployed/{job_id}"

    # Load metadata
    meta_path = f"{model_path}/tollabs_metadata.json"
    try:
        with open(meta_path) as f:
            metadata = json.load(f)
    except FileNotFoundError:
        return [{"error": f"Model not found for job {job_id}"}]

    # Reload volume to get latest files
    volume.reload()

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()

    label_names = {0: "bearish", 1: "neutral", 2: "bullish"}
    num_labels = metadata.get("num_labels", 3)
    if num_labels == 2:
        label_names = {0: "bearish", 1: "bullish"}

    results = []
    with torch.no_grad():
        for text in texts:
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)[0]
            pred_idx = probs.argmax().item()
            results.append({
                "text": text[:200],
                "label": label_names.get(pred_idx, f"class_{pred_idx}"),
                "confidence": round(probs[pred_idx].item(), 4),
                "probabilities": {
                    label_names.get(i, f"class_{i}"): round(p.item(), 4)
                    for i, p in enumerate(probs)
                },
            })

    return results


# ── Multi-Step Trading Decision Engine ────────────────────────────

@app.function(
    image=inference_image,
    volumes={VOLUME_PATH: volume},
    timeout=180,
)
def trading_decision(
    job_id: int,
    market_headlines: list[str],
    price_data: list[dict],
    capital: float,
    asset: str,
) -> dict:
    """
    Multi-step AI trading decision pipeline:

    Step 1 — Sentiment Analysis: Classify each headline using the fine-tuned model
    Step 2 — Signal Aggregation: Compute aggregate market sentiment score
    Step 3 — Position Sizing: Determine direction and size based on confidence
    Step 4 — Entry/Exit Planning: Set entry, stop-loss, and take-profit levels

    Args:
        job_id: Training job ID for the deployed model
        market_headlines: Recent news/headlines to analyze
        price_data: Recent OHLCV price bars
        capital: Amount of capital to trade
        asset: Asset being traded

    Returns:
        Full trading plan with multi-step reasoning
    """
    import json
    import numpy as np
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    model_path = f"{VOLUME_PATH}/deployed/{job_id}"

    volume.reload()

    try:
        with open(f"{model_path}/tollabs_metadata.json") as f:
            metadata = json.load(f)
    except FileNotFoundError:
        return {"error": f"Model not found for job {job_id}", "steps": []}

    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)
    model.eval()

    num_labels = metadata.get("num_labels", 3)
    steps = []

    # ── Step 1: Sentiment Analysis ────────────────────────────
    sentiments = []
    with torch.no_grad():
        for headline in market_headlines:
            inputs = tokenizer(headline, return_tensors="pt", truncation=True, max_length=256)
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)[0]
            pred_idx = probs.argmax().item()

            if num_labels == 3:
                label_map = {0: "bearish", 1: "neutral", 2: "bullish"}
                # Score: bearish=-1, neutral=0, bullish=+1
                score = probs[2].item() - probs[0].item()
            else:
                label_map = {0: "bearish", 1: "bullish"}
                score = probs[1].item() - probs[0].item() if num_labels == 2 else 0

            sentiments.append({
                "headline": headline[:150],
                "label": label_map.get(pred_idx, f"class_{pred_idx}"),
                "confidence": round(probs[pred_idx].item(), 4),
                "score": round(score, 4),
            })

    steps.append({
        "step": 1,
        "name": "Sentiment Analysis",
        "description": f"Analyzed {len(sentiments)} headlines using fine-tuned {metadata.get('base_model', 'model')}",
        "result": sentiments,
    })

    # ── Step 2: Signal Aggregation ────────────────────────────
    scores = [s["score"] for s in sentiments]
    avg_score = float(np.mean(scores)) if scores else 0
    confidence = float(np.mean([s["confidence"] for s in sentiments])) if sentiments else 0
    bullish_count = sum(1 for s in sentiments if s["label"] == "bullish")
    bearish_count = sum(1 for s in sentiments if s["label"] == "bearish")
    neutral_count = sum(1 for s in sentiments if s["label"] == "neutral")

    if avg_score > 0.15:
        signal = "STRONG_BUY"
    elif avg_score > 0.05:
        signal = "BUY"
    elif avg_score < -0.15:
        signal = "STRONG_SELL"
    elif avg_score < -0.05:
        signal = "SELL"
    else:
        signal = "HOLD"

    steps.append({
        "step": 2,
        "name": "Signal Aggregation",
        "description": "Aggregated sentiment into a directional trading signal",
        "result": {
            "average_sentiment_score": round(avg_score, 4),
            "average_confidence": round(confidence, 4),
            "bullish": bullish_count,
            "bearish": bearish_count,
            "neutral": neutral_count,
            "signal": signal,
        },
    })

    # ── Step 3: Position Sizing ───────────────────────────────
    # Kelly-inspired sizing: higher confidence = larger position
    if signal in ("STRONG_BUY", "STRONG_SELL"):
        position_pct = min(0.8, abs(avg_score) * 2 * confidence)
    elif signal in ("BUY", "SELL"):
        position_pct = min(0.5, abs(avg_score) * 1.5 * confidence)
    else:
        position_pct = 0.0  # HOLD = no trade

    direction = "long" if signal in ("STRONG_BUY", "BUY") else ("short" if signal in ("STRONG_SELL", "SELL") else "flat")
    position_size = round(capital * position_pct, 2)

    steps.append({
        "step": 3,
        "name": "Position Sizing",
        "description": f"Calculated position size using sentiment-weighted Kelly criterion",
        "result": {
            "direction": direction,
            "position_pct": round(position_pct * 100, 1),
            "position_size": position_size,
            "capital": capital,
        },
    })

    # ── Step 4: Entry/Exit Plan ───────────────────────────────
    if price_data:
        current_price = price_data[-1].get("close", 100.0)
        recent_high = max(p.get("high", current_price) for p in price_data[-20:])
        recent_low = min(p.get("low", current_price) for p in price_data[-20:])
        atr = (recent_high - recent_low) / max(len(price_data[-20:]), 1)  # Simplified ATR
    else:
        current_price = 100.0
        atr = current_price * 0.01

    if direction == "long":
        entry = current_price
        stop_loss = round(entry - atr * 2, 5)
        take_profit = round(entry + atr * 3, 5)
        risk_reward = 1.5
    elif direction == "short":
        entry = current_price
        stop_loss = round(entry + atr * 2, 5)
        take_profit = round(entry - atr * 3, 5)
        risk_reward = 1.5
    else:
        entry = current_price
        stop_loss = None
        take_profit = None
        risk_reward = 0

    steps.append({
        "step": 4,
        "name": "Entry/Exit Planning",
        "description": "Set entry, stop-loss, and take-profit based on ATR and sentiment strength",
        "result": {
            "entry_price": round(entry, 5),
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "risk_reward_ratio": risk_reward,
            "current_price": round(current_price, 5),
            "atr": round(atr, 5),
        },
    })

    return {
        "job_id": job_id,
        "asset": asset,
        "signal": signal,
        "direction": direction,
        "confidence": round(confidence, 4),
        "position_size": position_size,
        "entry_price": round(entry, 5),
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "steps": steps,
        "model_info": {
            "base_model": metadata.get("base_model", "unknown"),
            "eval_f1": metadata.get("eval_f1", 0),
            "eval_accuracy": metadata.get("eval_accuracy", 0),
        },
    }
