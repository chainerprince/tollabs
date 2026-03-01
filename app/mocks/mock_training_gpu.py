"""
Mock GPU Training — simulates a fine-tuning job without any GPU.

Runs training in a background thread that updates the DB row's progress,
metrics (fake loss curve), and finally writes a tiny mock model artifact
to the user's workspace.
"""

import json
import math
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"

# Keep references to running threads so we can cancel
_running_jobs: dict[int, threading.Event] = {}  # job_id → cancel_event


def start_mock_training(
    job_id: int,
    user_id: int,
    base_model: str,
    dataset_filename: str,
    config: dict,
    db_factory,
) -> None:
    """
    Kick off a background thread that simulates a training run.
    db_factory is a callable that returns a new DB session (SessionLocal).
    """
    cancel_event = threading.Event()
    _running_jobs[job_id] = cancel_event

    thread = threading.Thread(
        target=_training_loop,
        args=(job_id, user_id, base_model, dataset_filename, config, db_factory, cancel_event),
        daemon=True,
    )
    thread.start()


def cancel_mock_training(job_id: int) -> bool:
    """Signal a running mock job to stop. Returns True if the job was running."""
    event = _running_jobs.pop(job_id, None)
    if event:
        event.set()
        return True
    return False


def _training_loop(
    job_id: int,
    user_id: int,
    base_model: str,
    dataset_filename: str,
    config: dict,
    db_factory,
    cancel_event: threading.Event,
):
    """Simulated training: ~30 seconds, updates DB every second."""
    from app.models.training_job import TrainingJob

    epochs = config.get("epochs", 5)
    total_steps = epochs * 10  # 10 steps per epoch
    step_duration = 15.0 / total_steps  # Total ~15s

    loss_history: list[float] = []
    val_loss_history: list[float] = []
    initial_loss = random.uniform(2.0, 4.0)

    # Mark as running
    db = db_factory()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            job.logs = f"[{_ts()}] Starting mock training for {base_model}\n"
            job.logs += f"[{_ts()}] Dataset: {dataset_filename}\n"
            job.logs += f"[{_ts()}] Config: epochs={epochs}, lr={config.get('learning_rate', 2e-5)}, batch={config.get('batch_size', 16)}\n"
            job.logs += f"[{_ts()}] LoRA rank: {config.get('lora_rank', 8)}\n"
            job.logs += f"[{_ts()}] Loading base model weights...\n"
            db.commit()
    finally:
        db.close()

    time.sleep(1.5)  # Simulate model loading

    for step in range(1, total_steps + 1):
        if cancel_event.is_set():
            _update_job(db_factory, job_id, status="cancelled", log_line=f"[{_ts()}] Training cancelled by user\n")
            _running_jobs.pop(job_id, None)
            return

        time.sleep(step_duration)

        # Exponential decay + noise
        progress_frac = step / total_steps
        loss = initial_loss * math.exp(-3.0 * progress_frac) + random.gauss(0, 0.02)
        loss = max(0.01, loss)
        loss_history.append(round(loss, 4))

        val_loss = loss + random.gauss(0.05, 0.03)
        val_loss = max(0.01, val_loss)
        val_loss_history.append(round(val_loss, 4))

        epoch = (step - 1) // 10 + 1
        step_in_epoch = ((step - 1) % 10) + 1

        progress = round(progress_frac * 100, 1)
        log_line = ""
        if step_in_epoch == 10 or step == total_steps:
            log_line = f"[{_ts()}] Epoch {epoch}/{epochs} — loss: {loss:.4f}, val_loss: {val_loss:.4f}\n"

        metrics = {
            "loss_history": loss_history,
            "val_loss_history": val_loss_history,
            "current_loss": round(loss, 4),
            "current_val_loss": round(val_loss, 4),
            "best_loss": round(min(loss_history), 4),
            "epoch": epoch,
            "step": step,
            "total_steps": total_steps,
        }

        _update_job(db_factory, job_id, progress=progress, metrics=metrics, log_line=log_line)

    # Training complete — write mock artifact
    workspace = WORKSPACE_ROOT / str(user_id)
    models_dir = workspace / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    safe_name = base_model.replace("/", "_").replace(".", "-")
    artifact_name = f"{safe_name}_finetuned.pt"
    artifact_path = models_dir / artifact_name

    # Write a small mock file
    artifact_path.write_text(json.dumps({
        "mock": True,
        "base_model": base_model,
        "epochs": epochs,
        "final_loss": loss_history[-1] if loss_history else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }))

    relative_path = f"models/{artifact_name}"

    _update_job(
        db_factory,
        job_id,
        status="completed",
        progress=100.0,
        model_artifact_path=relative_path,
        log_line=f"[{_ts()}] Training complete! Model saved to {relative_path}\n[{_ts()}] Final loss: {loss_history[-1]:.4f}\n",
    )
    _running_jobs.pop(job_id, None)


def _update_job(db_factory, job_id: int, **kwargs):
    """Helper to update a training job row."""
    from app.models.training_job import TrainingJob

    db = db_factory()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if not job:
            return
        if "status" in kwargs:
            job.status = kwargs["status"]
        if "progress" in kwargs:
            job.progress = kwargs["progress"]
        if "metrics" in kwargs:
            job.metrics = kwargs["metrics"]
        if "model_artifact_path" in kwargs:
            job.model_artifact_path = kwargs["model_artifact_path"]
        if "log_line" in kwargs and kwargs["log_line"]:
            job.logs = (job.logs or "") + kwargs["log_line"]
        if kwargs.get("status") == "completed":
            job.completed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")
