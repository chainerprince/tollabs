"""
Modal client bridge — calls real Modal functions from FastAPI.

This module provides wrappers around the Modal functions defined in
modal_app.py.  When a researcher_id is given the client temporarily
swaps in that researcher's Modal credentials so the call lands on
their own Modal account.

Requires `modal token set` or MODAL_TOKEN_ID/MODAL_TOKEN_SECRET in env.
"""

from __future__ import annotations

import os
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import modal
except ImportError:
    modal = None  # type: ignore[assignment]

from app.config import settings
from app.database import SessionLocal
from app.models.training_job import TrainingJob

# Default app handle (platform-wide fallback)
_DEFAULT_APP_NAME = "tollabs-finbert"

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent / "workspaces"


# ── Per-researcher credential helpers ────────────────────────────

def _set_researcher_credentials(researcher_id: int | None) -> dict[str, str]:
    """Swap env vars to a researcher's Modal creds. Returns originals to restore."""
    originals = {
        "MODAL_TOKEN_ID": os.environ.get("MODAL_TOKEN_ID", ""),
        "MODAL_TOKEN_SECRET": os.environ.get("MODAL_TOKEN_SECRET", ""),
    }
    if researcher_id is None:
        return originals

    db = SessionLocal()
    try:
        from app.models.user import User
        user = db.query(User).filter(User.id == researcher_id).first()
        if user and user.modal_token_id:
            os.environ["MODAL_TOKEN_ID"] = user.modal_token_id
        if user and user.modal_token_secret:
            os.environ["MODAL_TOKEN_SECRET"] = user.modal_token_secret
    finally:
        db.close()

    return originals


def _restore_credentials(originals: dict[str, str]) -> None:
    for k, v in originals.items():
        if v:
            os.environ[k] = v
        elif k in os.environ:
            del os.environ[k]


def _get_app_name(researcher_id: int | None) -> str:
    """Resolve Modal app name — researcher override or platform default."""
    if researcher_id is None:
        return _DEFAULT_APP_NAME
    db = SessionLocal()
    try:
        from app.models.user import User
        user = db.query(User).filter(User.id == researcher_id).first()
        if user and user.modal_app_name:
            return user.modal_app_name
    finally:
        db.close()
    return _DEFAULT_APP_NAME


# ── Dataset reader ────────────────────────────────────────────────

def _read_dataset(user_id: int, filename: str) -> str:
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
    researcher_id: int | None = None,
) -> None:
    """Dispatch a fine-tuning job to Modal GPUs (background thread)."""
    dataset_text = _read_dataset(user_id, dataset_filename)
    rid = researcher_id or user_id

    def _run():
        db = SessionLocal()
        originals = _set_researcher_credentials(rid)
        try:
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if not job:
                return
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            job.progress = 5.0
            job.logs = (job.logs or "") + "Dispatching to Modal GPU...\n"
            db.commit()

            app_name = _get_app_name(rid)
            finetune_fn = modal.Function.from_name(app_name, "finetune_finbert")
            result = finetune_fn.remote(
                job_id=job_id,
                base_model=base_model,
                dataset_text=dataset_text,
                config=config,
            )

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
            _restore_credentials(originals)
            db.close()

    thread = threading.Thread(target=_run, daemon=True, name=f"modal-train-{job_id}")
    thread.start()


# ── Inference ─────────────────────────────────────────────────────

def predict_with_model(
    job_id: int,
    texts: list[str],
    researcher_id: int | None = None,
) -> list[dict]:
    """Run inference on a deployed fine-tuned model."""
    originals = _set_researcher_credentials(researcher_id)
    try:
        app_name = _get_app_name(researcher_id)
        predict_fn = modal.Function.from_name(app_name, "predict_sentiment")
        return predict_fn.remote(job_id=job_id, texts=texts)
    finally:
        _restore_credentials(originals)


# ── Multi-Step Trading Decision ──────────────────────────────────

def get_trading_decision(
    job_id: int,
    market_headlines: list[str],
    price_data: list[dict],
    capital: float,
    asset: str,
    researcher_id: int | None = None,
) -> dict:
    """Get a multi-step trading decision from the deployed model."""
    originals = _set_researcher_credentials(researcher_id)
    try:
        app_name = _get_app_name(researcher_id)
        decision_fn = modal.Function.from_name(app_name, "trading_decision")
        return decision_fn.remote(
            job_id=job_id,
            market_headlines=market_headlines,
            price_data=price_data,
            capital=capital,
            asset=asset,
        )
    finally:
        _restore_credentials(originals)


# ── Model Info ────────────────────────────────────────────────────

def get_deployed_model_info(
    job_id: int,
    researcher_id: int | None = None,
) -> dict | None:
    """Check if a model is deployed and return its metadata."""
    originals = _set_researcher_credentials(researcher_id)
    try:
        app_name = _get_app_name(researcher_id)
        predict_fn = modal.Function.from_name(app_name, "predict_sentiment")
        result = predict_fn.remote(job_id=job_id, texts=["test"])
        if result and not result[0].get("error"):
            return {"job_id": job_id, "status": "deployed", "test_result": result[0]}
        return None
    except Exception:
        return None
    finally:
        _restore_credentials(originals)
