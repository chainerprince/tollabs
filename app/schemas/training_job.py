"""
Pydantic schemas for the training / fine-tuning subsystem.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────

class TrainingConfig(BaseModel):
    epochs: int = Field(default=5, ge=1, le=100)
    learning_rate: float = Field(default=2e-5, gt=0, le=1)
    batch_size: int = Field(default=16, ge=1, le=256)
    lora_rank: int = Field(default=8, ge=0, le=128, description="0 = full fine-tune")
    warmup_steps: int = Field(default=50, ge=0)
    weight_decay: float = Field(default=0.01, ge=0, le=1)
    max_seq_length: int = Field(default=512, ge=32, le=4096)


class TrainingJobCreate(BaseModel):
    job_name: str = Field(..., min_length=1, max_length=120)
    base_model: str = Field(..., min_length=1, description="HuggingFace model id")
    dataset_filename: str = Field(..., min_length=1, description="Filename in workspace")
    config: TrainingConfig = Field(default_factory=TrainingConfig)


class ModelDownloadRequest(BaseModel):
    model_id: str = Field(..., min_length=1, description="HuggingFace model id")


class ModelSearchQuery(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=50)


# ── Response schemas ──────────────────────────────────────────────

class TrainingJobResponse(BaseModel):
    id: int
    user_id: int
    job_name: str
    base_model: str
    dataset_filename: str
    config: dict[str, Any]
    status: str
    progress: float
    metrics: dict[str, Any]
    model_artifact_path: str | None
    logs: str
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TrainingJobListItem(BaseModel):
    id: int
    job_name: str
    base_model: str
    status: str
    progress: float
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class BaseModelInfo(BaseModel):
    model_id: str
    name: str
    description: str
    parameter_count: str  # e.g. "8M", "200M", "1.3B"
    task: str  # e.g. "time-series-forecasting", "sentiment-analysis"
    tags: list[str] = []
    source_url: str
