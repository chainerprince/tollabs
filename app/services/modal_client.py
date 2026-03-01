"""
Modal client bridge — calls real Modal functions from FastAPI.

This module provides async wrappers around the Modal functions defined
in modal_app.py so the training and trading services can dispatch work
to Modal GPUs without blocking the API event loop.

Requires `modal token set` or MODAL_TOKEN_ID/MODAL_TOKEN_SECRET in env.
"""

from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import modal

from app.config import settings
from app.database import SessionLocal
from app.models.training_job import TrainingJob

# Re-use the same app handle defined in modal_app.py
_APP_NAME = "tollabs-finbert"

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent / "workspaces"

# ── Helpers ───────────────────────────────────────────────────────

def _read_dataset(user_id: int, filename: str) -> str:
    """Read a user's dataset file and return its text content."""
    path = WORKSPACE_ROOT / str(user_id) / filename
    if not path.exists():
        raise FileNotFoundError(f"Dataset '{filename}' not found in workspace")
    return path.read_text()


# ── Training Dispatch ─────────────────────────────────────────────

def dispatch_modal_training(
    job_id: int,
    user_id: int,
    base_model: str,
    dataset_filename: str,
    config: dict,
) -> None:
    """
    Dispatch a fine-tuning job to Modal GPUs.

    This runs the Modal function in a background thread so it doesn't
    block the FastAPI request. The thread updates the DB as the job
    progresses and completes.
    """
    dataset_text = _read_dataset(user_id, dataset_filename)

    def _run():
        db = SessionLocal()
        try:
            # Mark job as running
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if not job:
                return
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            job.progress = 5.0
            job.logs = (job.logs or "") + f"Dispatching to Modal GPU...\n"
            db.commit()

            # Call the real Modal function
            finetune_fn = modal.Function.from_name(_APP_NAME, "finetune_finbert")
            result = finetune_fn.remote(
                job_id=job_id,
                base_model=base_model,
                dataset_text=dataset_text,
                config=config,
            )

            # Update job with results
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if not job:
                return

            if result.get("status") == "completed":
                job.status = "completed"
                job.progress = 100.0
                job.metrics = result.get("metrics", {})
                job.model_artifact_path = result.get("artifact_path")
                job.logs = (job.logs or "") + (result.get("logs", "") or "")
                job.completed_at = datetime.now(timezone.utc)
            else:
                job.status = "failed"
                job.progress = 0.0
                job.error_message = result.get("error", "Unknown error")
                job.logs = (job.logs or "") + (result.get("logs", "") or "")
                job.completed_at = datetime.now(timezone.utc)

            db.commit()

        except Exception as e:
            # Handle Modal errors
            try:
                job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
                if job:
                    job.status = "failed"
                    job.error_message = f"Modal error: {str(e)}"
                    job.logs = (job.logs or "") + f"\n[ERROR] {str(e)}\n"
                    job.completed_at = datetime.now(timezone.utc)
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()

    thread = threading.Thread(target=_run, daemon=True, name=f"modal-train-{job_id}")
    thread.start()


# ── Inference ─────────────────────────────────────────────────────

def predict_with_model(job_id: int, texts: list[str]) -> list[dict]:
    """
    Run inference on a deployed fine-tuned model.

    Args:
        job_id: The training job ID (model is stored under deployed/{job_id})
        texts: List of text strings to classify

    Returns:
        List of prediction dicts with label, confidence, probabilities
    """
    predict_fn = modal.Function.from_name(_APP_NAME, "predict_sentiment")
    return predict_fn.remote(job_id=job_id, texts=texts)


# ── Multi-Step Trading Decision ──────────────────────────────────

def get_trading_decision(
    job_id: int,
    market_headlines: list[str],
    price_data: list[dict],
    capital: float,
    asset: str,
) -> dict:
    """
    Get a multi-step trading decision from the deployed model.

    The model:
    1. Analyzes sentiment of market headlines
    2. Aggregates into a directional signal
    3. Sizes the position based on confidence
    4. Plans entry/exit with stop-loss and take-profit

    Returns full trading plan with step-by-step reasoning.
    """
    decision_fn = modal.Function.from_name(_APP_NAME, "trading_decision")
    return decision_fn.remote(
        job_id=job_id,
        market_headlines=market_headlines,
        price_data=price_data,
        capital=capital,
        asset=asset,
    )


# ── Model Info ────────────────────────────────────────────────────

def get_deployed_model_info(job_id: int) -> dict | None:
    """Check if a model is deployed and return its metadata."""
    try:
        predict_fn = modal.Function.from_name(_APP_NAME, "predict_sentiment")
        # Quick smoke test with a single sentence
        result = predict_fn.remote(job_id=job_id, texts=["test"])
        if result and not result[0].get("error"):
            return {"job_id": job_id, "status": "deployed", "test_result": result[0]}
        return None
    except Exception:
        return None
