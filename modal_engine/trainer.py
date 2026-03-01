"""
Modal function: GPU fine-tuning of HuggingFace models.

This runs on Modal's A100 GPUs when USE_MOCK_TRAINING=False.
Supports LoRA/QLoRA for efficient fine-tuning.

Deploy with:  modal deploy modal_engine/app.py
"""

from modal_engine.app import app, volume

import modal

training_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch>=2.1.0",
    "transformers>=4.36.0",
    "peft>=0.7.0",
    "datasets>=2.16.0",
    "accelerate>=0.25.0",
    "safetensors>=0.4.0",
    "scipy>=1.11.0",
    "pandas>=2.1.0",
    "numpy>=1.26.0",
    "scikit-learn>=1.3.0",
    "huggingface_hub>=0.20.0",
)


@app.function(
    image=training_image,
    gpu="A100",
    volumes={"/data": volume},
    timeout=3600,
    memory=32768,
)
def run_fine_tune(
    base_model: str,
    dataset_path: str,
    config: dict,
    output_name: str,
    hf_token: str | None = None,
) -> dict:
    """
    Fine-tune a HuggingFace model on a CSV/JSON dataset.

    Args:
        base_model:   HuggingFace model id (e.g. "amazon/chronos-t5-small")
        dataset_path: Path on the Modal Volume (e.g. "/data/users/1/forex_data.csv")
        config:       Training hyperparameters
        output_name:  Name for the saved model
        hf_token:     Optional HuggingFace token for gated models

    Returns:
        Dict with metrics, output_path, and status
    """
    import json
    import pathlib
    import traceback

    import numpy as np
    import pandas as pd
    from transformers import (
        AutoModelForSequenceClassification,
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        Trainer,
    )
    from peft import LoraConfig, get_peft_model, TaskType

    epochs = config.get("epochs", 5)
    lr = config.get("learning_rate", 2e-5)
    batch_size = config.get("batch_size", 16)
    lora_rank = config.get("lora_rank", 8)

    output_dir = pathlib.Path(f"/data/models/{output_name}")
    output_dir.mkdir(parents=True, exist_ok=True)

    results = {"status": "running", "metrics": {}, "output_path": "", "error": None}

    try:
        # 1. Load dataset
        df = pd.read_csv(dataset_path)

        # 2. Load tokenizer and model
        token_kwargs = {"token": hf_token} if hf_token else {}
        tokenizer = AutoTokenizer.from_pretrained(base_model, **token_kwargs)

        # Determine task type from model
        is_causal = any(k in base_model.lower() for k in ["opt", "phi", "gpt", "llama"])

        if is_causal:
            model = AutoModelForCausalLM.from_pretrained(base_model, **token_kwargs)
            task_type = TaskType.CAUSAL_LM
        else:
            num_labels = df["label"].nunique() if "label" in df.columns else 2
            model = AutoModelForSequenceClassification.from_pretrained(
                base_model, num_labels=num_labels, **token_kwargs
            )
            task_type = TaskType.SEQ_CLS

        # 3. Apply LoRA if rank > 0
        if lora_rank > 0:
            peft_config = LoraConfig(
                task_type=task_type,
                r=lora_rank,
                lora_alpha=lora_rank * 2,
                lora_dropout=0.05,
                target_modules="all-linear",
            )
            model = get_peft_model(model, peft_config)
            model.print_trainable_parameters()

        # 4. Prepare dataset
        from datasets import Dataset

        if "text" in df.columns:
            dataset = Dataset.from_pandas(df[["text", "label"]] if "label" in df.columns else df[["text"]])
        elif "close" in df.columns:
            # Time-series: create sequences
            df["returns"] = df["close"].pct_change().fillna(0)
            df["label"] = (df["returns"] > 0).astype(int)
            df["text"] = df.apply(
                lambda r: f"price {r.get('close', 0):.4f} return {r.get('returns', 0):.6f}",
                axis=1,
            )
            dataset = Dataset.from_pandas(df[["text", "label"]].dropna())
        else:
            raise ValueError(f"Dataset must have 'text' or 'close' column. Found: {list(df.columns)}")

        def tokenize(examples):
            return tokenizer(
                examples["text"],
                padding="max_length",
                truncation=True,
                max_length=config.get("max_seq_length", 512),
            )

        tokenized = dataset.map(tokenize, batched=True)
        train_test = tokenized.train_test_split(test_size=0.1)

        # 5. Train
        training_args = TrainingArguments(
            output_dir=str(output_dir / "checkpoints"),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            learning_rate=lr,
            weight_decay=config.get("weight_decay", 0.01),
            warmup_steps=config.get("warmup_steps", 50),
            logging_steps=10,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            report_to="none",
        )

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_test["train"],
            eval_dataset=train_test["test"],
            tokenizer=tokenizer,
        )

        train_result = trainer.train()

        # 6. Save
        trainer.save_model(str(output_dir / "final"))
        tokenizer.save_pretrained(str(output_dir / "final"))

        eval_result = trainer.evaluate()

        results["status"] = "completed"
        results["output_path"] = str(output_dir / "final")
        results["metrics"] = {
            "train_loss": round(float(train_result.training_loss), 4),
            "eval_loss": round(float(eval_result.get("eval_loss", 0)), 4),
            "train_runtime": round(float(train_result.metrics.get("train_runtime", 0)), 1),
            "train_samples_per_second": round(
                float(train_result.metrics.get("train_samples_per_second", 0)), 1
            ),
            "epochs_completed": epochs,
        }

    except Exception:
        results["status"] = "failed"
        results["error"] = traceback.format_exc()

    # Write results summary
    (output_dir / "results.json").write_text(json.dumps(results, indent=2))

    return results
