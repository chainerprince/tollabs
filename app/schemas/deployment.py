"""Deployment & credential Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── GPU Tier options for Modal ───────────────────────────────────

GPU_TIERS = [
    {"id": "t4", "name": "NVIDIA T4", "vram": "16 GB", "cost_hr": "$0.59", "best_for": "Fine-tuning small models (< 1B params)"},
    {"id": "l4", "name": "NVIDIA L4", "vram": "24 GB", "cost_hr": "$0.73", "best_for": "Fine-tuning medium models (1-3B params)"},
    {"id": "a10g", "name": "NVIDIA A10G", "vram": "24 GB", "cost_hr": "$1.10", "best_for": "Training & inference, good all-rounder"},
    {"id": "a100-40", "name": "NVIDIA A100 40GB", "vram": "40 GB", "cost_hr": "$3.00", "best_for": "Large model training (3-7B params)"},
    {"id": "a100-80", "name": "NVIDIA A100 80GB", "vram": "80 GB", "cost_hr": "$4.58", "best_for": "Very large models (7B+ params)"},
    {"id": "h100", "name": "NVIDIA H100", "vram": "80 GB", "cost_hr": "$6.98", "best_for": "Fastest training, production inference"},
]


# ── Credential management ────────────────────────────────────────

class ModalCredentialsUpdate(BaseModel):
    modal_token_id: str = Field(..., min_length=3)
    modal_token_secret: str = Field(..., min_length=3)


class HFTokenUpdate(BaseModel):
    hf_token: str = Field(..., min_length=3)


class CredentialsStatus(BaseModel):
    has_modal_credentials: bool
    has_hf_token: bool
    modal_app_name: str | None = None
    modal_token_id_preview: str | None = None   # e.g. "ak-***Vk"


# ── Deployment schemas ───────────────────────────────────────────

class DeployModelRequest(BaseModel):
    training_job_id: int
    name: str = Field(..., min_length=1, max_length=120)


class DeploymentResponse(BaseModel):
    id: int
    researcher_id: int
    training_job_id: int
    name: str
    modal_app_name: str | None
    status: str
    version: str
    base_model: str
    model_metrics: dict[str, Any]
    total_inferences: int
    total_trades_powered: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DeploymentListItem(BaseModel):
    id: int
    name: str
    training_job_id: int
    base_model: str
    status: str
    total_inferences: int
    total_trades_powered: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Marketplace publish ──────────────────────────────────────────

class PushToMarketplaceRequest(BaseModel):
    deployment_id: int
    name: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    asset_class: str = "stock"


# ── HuggingFace search result ────────────────────────────────────

class HFModelResult(BaseModel):
    model_id: str
    name: str
    description: str = ""
    downloads: int = 0
    likes: int = 0
    pipeline_tag: str = ""
    tags: list[str] = []


# ── Multi-trade schemas ─────────────────────────────────────────

class MultiTradeRequest(BaseModel):
    subscription_id: int
    capital_per_trade: float = Field(..., gt=0)
    num_trades: int = Field(default=5, ge=1, le=20)


class MultiTradeResponse(BaseModel):
    total_trades: int
    completed: int
    failed: int
    total_pnl: float
    total_pnl_pct: float
    capital_per_trade: float
    total_capital_deployed: float
    trades: list[dict[str, Any]]
