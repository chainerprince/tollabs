"""
Training service — orchestrates fine-tuning jobs via mock or real Modal GPU.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.training_job import TrainingJob
from app.schemas.training_job import BaseModelInfo

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"

# ── Curated base models ──────────────────────────────────────────

CURATED_MODELS: list[BaseModelInfo] = [
    BaseModelInfo(
        model_id="amazon/chronos-t5-small",
        name="Chronos T5 Small",
        description="Probabilistic time-series forecasting model based on T5. Ideal for price prediction and volatility forecasting on financial data.",
        parameter_count="8M",
        task="time-series-forecasting",
        tags=["time-series", "forecasting", "finance", "lightweight"],
        source_url="https://huggingface.co/amazon/chronos-t5-small",
    ),
    BaseModelInfo(
        model_id="amazon/chronos-t5-base",
        name="Chronos T5 Base",
        description="Larger Chronos variant with higher accuracy for time-series forecasting. Better for complex market patterns.",
        parameter_count="200M",
        task="time-series-forecasting",
        tags=["time-series", "forecasting", "finance"],
        source_url="https://huggingface.co/amazon/chronos-t5-base",
    ),
    BaseModelInfo(
        model_id="google/timesfm-1.0-200m",
        name="TimesFM 1.0",
        description="Google's foundation model for time-series forecasting. Supports zero-shot and fine-tuned forecasting across domains.",
        parameter_count="200M",
        task="time-series-forecasting",
        tags=["time-series", "forecasting", "zero-shot", "google"],
        source_url="https://huggingface.co/google/timesfm-1.0-200m",
    ),
    BaseModelInfo(
        model_id="ProsusAI/finbert",
        name="FinBERT",
        description="Financial sentiment analysis model pre-trained on financial text. Classifies news, reports, and tweets as positive/negative/neutral.",
        parameter_count="110M",
        task="sentiment-analysis",
        tags=["sentiment", "nlp", "finance", "bert"],
        source_url="https://huggingface.co/ProsusAI/finbert",
    ),
    BaseModelInfo(
        model_id="yiyanghkust/finbert-tone",
        name="FinBERT Tone",
        description="FinBERT variant fine-tuned on analyst reports for tone classification. Great for earnings call analysis and trading signals.",
        parameter_count="110M",
        task="sentiment-analysis",
        tags=["sentiment", "nlp", "finance", "tone"],
        source_url="https://huggingface.co/yiyanghkust/finbert-tone",
    ),
    BaseModelInfo(
        model_id="microsoft/phi-2",
        name="Phi-2",
        description="Small but powerful language model for reasoning and code generation. Useful for building strategy logic agents.",
        parameter_count="2.7B",
        task="text-generation",
        tags=["llm", "reasoning", "code", "small"],
        source_url="https://huggingface.co/microsoft/phi-2",
    ),
    BaseModelInfo(
        model_id="facebook/opt-1.3b",
        name="OPT 1.3B",
        description="Open pre-trained transformer for text generation. Good baseline for fine-tuning custom financial text models.",
        parameter_count="1.3B",
        task="text-generation",
        tags=["llm", "text-generation", "open-source"],
        source_url="https://huggingface.co/facebook/opt-1.3b",
    ),
    BaseModelInfo(
        model_id="distilbert-base-uncased",
        name="DistilBERT",
        description="Lightweight BERT distillation — fast and efficient for text classification tasks like news sentiment.",
        parameter_count="66M",
        task="text-classification",
        tags=["nlp", "classification", "lightweight", "bert"],
        source_url="https://huggingface.co/distilbert-base-uncased",
    ),
]


def list_base_models(task_filter: str | None = None) -> list[BaseModelInfo]:
    """Return curated model list, optionally filtered by task type."""
    if task_filter:
        return [m for m in CURATED_MODELS if m.task == task_filter]
    return CURATED_MODELS


def search_models(query: str, limit: int = 10) -> list[BaseModelInfo]:
    """Search curated models by name / description / tags."""
    q = query.lower()
    results = []
    for m in CURATED_MODELS:
        score = 0
        if q in m.model_id.lower():
            score += 3
        if q in m.name.lower():
            score += 3
        if q in m.description.lower():
            score += 1
        if any(q in t for t in m.tags):
            score += 2
        if score > 0:
            results.append((score, m))
    results.sort(key=lambda x: -x[0])
    return [m for _, m in results[:limit]]


def download_model_to_workspace(user_id: int, model_id: str) -> dict:
    """
    In mock mode: creates a placeholder file in the user's workspace.
    In production: would pull from HuggingFace Hub.
    """
    workspace = WORKSPACE_ROOT / str(user_id) / "models"
    workspace.mkdir(parents=True, exist_ok=True)

    safe_name = model_id.replace("/", "_")
    model_dir = workspace / safe_name
    model_dir.mkdir(exist_ok=True)

    # Write placeholder config
    import json
    config_path = model_dir / "config.json"
    config_path.write_text(json.dumps({
        "model_id": model_id,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "mock": settings.USE_MOCK_TRAINING,
        "note": "This is a placeholder. In production, actual model weights are downloaded from HuggingFace.",
    }, indent=2))

    readme_path = model_dir / "README.md"
    info = next((m for m in CURATED_MODELS if m.model_id == model_id), None)
    desc = info.description if info else f"Model: {model_id}"
    readme_path.write_text(f"# {model_id}\n\n{desc}\n\nDownloaded for TOLLABS fine-tuning.\n")

    return {
        "model_id": model_id,
        "path": f"models/{safe_name}",
        "files": ["config.json", "README.md"],
    }


def submit_job(db: Session, user_id: int, data: dict) -> TrainingJob:
    """Create a training job and dispatch it (mock or Modal)."""
    # Verify dataset exists
    workspace = WORKSPACE_ROOT / str(user_id)
    dataset_path = workspace / data["dataset_filename"]
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset '{data['dataset_filename']}' not found in workspace")

    config = data.get("config", {})
    if isinstance(config, dict):
        config_dict = config
    else:
        config_dict = config.model_dump() if hasattr(config, "model_dump") else dict(config)

    job = TrainingJob(
        user_id=user_id,
        job_name=data["job_name"],
        base_model=data["base_model"],
        dataset_filename=data["dataset_filename"],
        config=config_dict,
        status="queued",
        progress=0.0,
        metrics={},
        logs=f"Job queued at {datetime.now(timezone.utc).strftime('%H:%M:%S')}\n",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Dispatch to mock or real Modal
    if settings.USE_MOCK_TRAINING:
        from app.mocks.mock_training_gpu import start_mock_training

        start_mock_training(
            job_id=job.id,
            user_id=user_id,
            base_model=data["base_model"],
            dataset_filename=data["dataset_filename"],
            config=config_dict,
            db_factory=SessionLocal,
        )
    else:
        # Real Modal dispatch (future)
        raise NotImplementedError("Real Modal GPU training not yet wired.")

    return job


def get_job(db: Session, job_id: int, user_id: int) -> TrainingJob | None:
    """Get a single training job (must belong to user)."""
    return (
        db.query(TrainingJob)
        .filter(TrainingJob.id == job_id, TrainingJob.user_id == user_id)
        .first()
    )


def list_jobs(db: Session, user_id: int) -> list[TrainingJob]:
    """List all training jobs for a user, newest first."""
    return (
        db.query(TrainingJob)
        .filter(TrainingJob.user_id == user_id)
        .order_by(TrainingJob.created_at.desc())
        .all()
    )


def cancel_job(db: Session, job_id: int, user_id: int) -> TrainingJob | None:
    """Cancel a running/queued job."""
    job = get_job(db, job_id, user_id)
    if not job:
        return None
    if job.status not in ("queued", "running"):
        return job  # Already completed/failed/cancelled

    if settings.USE_MOCK_TRAINING:
        from app.mocks.mock_training_gpu import cancel_mock_training
        cancel_mock_training(job_id)

    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    job.logs = (job.logs or "") + f"Cancelled at {datetime.now(timezone.utc).strftime('%H:%M:%S')}\n"
    db.commit()
    db.refresh(job)
    return job


def list_user_artifacts(user_id: int) -> list[dict]:
    """List all fine-tuned model artifacts in the user's workspace."""
    models_dir = WORKSPACE_ROOT / str(user_id) / "models"
    if not models_dir.exists():
        return []

    artifacts = []
    # Look for .pt files (fine-tuned outputs)
    for f in models_dir.glob("*_finetuned.pt"):
        artifacts.append({
            "filename": f.name,
            "path": f"models/{f.name}",
            "size": f.stat().st_size,
            "modified": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
        })
    return artifacts
