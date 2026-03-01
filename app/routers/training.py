"""
Training router — fine-tuning jobs, model hub, artifact management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.training_job import (
    BaseModelInfo,
    ModelDownloadRequest,
    ModelSearchQuery,
    TrainingJobCreate,
    TrainingJobListItem,
    TrainingJobResponse,
)
from app.services import training_service

router = APIRouter(prefix="/training", tags=["Training"])


# ── Training jobs ─────────────────────────────────────────────────

@router.post("/jobs", response_model=TrainingJobResponse)
def submit_training_job(
    data: TrainingJobCreate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a new fine-tuning job."""
    try:
        job = training_service.submit_job(
            db,
            user_id=user.id,
            data=data.model_dump(),
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return job


@router.get("/jobs", response_model=list[TrainingJobListItem])
def list_training_jobs(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all training jobs for the current user."""
    return training_service.list_jobs(db, user.id)


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
def get_training_job(
    job_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single training job with full details."""
    job = training_service.get_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return job


@router.delete("/jobs/{job_id}", response_model=TrainingJobResponse)
def cancel_training_job(
    job_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a queued or running training job."""
    job = training_service.cancel_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return job


# ── Model Hub ─────────────────────────────────────────────────────

@router.get("/models", response_model=list[BaseModelInfo])
def list_base_models(task: str | None = None, user=Depends(get_current_user)):
    """Browse curated base models, optionally filter by task."""
    return training_service.list_base_models(task)


@router.get("/models/search", response_model=list[BaseModelInfo])
def search_base_models(
    q: str,
    limit: int = 10,
    user=Depends(get_current_user),
):
    """Search curated models by query."""
    return training_service.search_models(q, limit)


@router.post("/models/download")
def download_model(
    data: ModelDownloadRequest,
    user=Depends(get_current_user),
):
    """Download a base model to the user's workspace."""
    result = training_service.download_model_to_workspace(user.id, data.model_id)
    return {"message": f"Model {data.model_id} downloaded", **result}


# ── Artifacts ─────────────────────────────────────────────────────

@router.get("/artifacts")
def list_artifacts(user=Depends(get_current_user)):
    """List all fine-tuned model artifacts in the user's workspace."""
    return training_service.list_user_artifacts(user.id)
