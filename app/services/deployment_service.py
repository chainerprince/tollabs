"""
Deployment service — manages the lifecycle of models deployed to Modal.

Researchers deploy trained models → get inference endpoints → push to marketplace.
"""

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.models.deployment import ModelDeployment
from app.models.training_job import TrainingJob
from app.models.trading_model import TradingModel
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────

def _get_researcher_app_name(user: User) -> str:
    """Derive a Modal app name for a researcher."""
    if user.modal_app_name:
        return user.modal_app_name
    slug = user.email.split("@")[0].replace(".", "-").replace("+", "-")[:20]
    return f"tollabs-{slug}"


def _set_researcher_modal_env(user: User) -> dict[str, str]:
    """Temporarily set Modal env vars to a researcher's credentials. Returns originals."""
    originals = {
        "MODAL_TOKEN_ID": os.environ.get("MODAL_TOKEN_ID", ""),
        "MODAL_TOKEN_SECRET": os.environ.get("MODAL_TOKEN_SECRET", ""),
    }
    if user.modal_token_id:
        os.environ["MODAL_TOKEN_ID"] = user.modal_token_id
    if user.modal_token_secret:
        os.environ["MODAL_TOKEN_SECRET"] = user.modal_token_secret
    return originals


def _restore_modal_env(originals: dict[str, str]) -> None:
    """Restore original Modal env vars."""
    for k, v in originals.items():
        if v:
            os.environ[k] = v
        elif k in os.environ:
            del os.environ[k]


# ── Credential validation ────────────────────────────────────────

def validate_modal_credentials(token_id: str, token_secret: str) -> bool:
    """Quick check that Modal credentials look valid (format-only for now)."""
    if not token_id or not token_secret:
        return False
    if not token_id.startswith("ak-"):
        return False
    if not token_secret.startswith("as-"):
        return False
    return True


# ── Deploy ────────────────────────────────────────────────────────

def deploy_model(
    db: Session,
    researcher_id: int,
    training_job_id: int,
    name: str,
) -> ModelDeployment:
    """Create a deployment record and kick off async deploy to Modal."""
    user = db.query(User).filter(User.id == researcher_id).first()
    if not user:
        raise ValueError("Researcher not found")

    job = db.query(TrainingJob).filter(
        TrainingJob.id == training_job_id,
        TrainingJob.user_id == researcher_id,
        TrainingJob.status == "completed",
    ).first()
    if not job:
        raise ValueError("Completed training job not found")

    app_name = _get_researcher_app_name(user)

    deployment = ModelDeployment(
        researcher_id=researcher_id,
        training_job_id=training_job_id,
        name=name,
        modal_app_name=app_name,
        base_model=job.base_model,
        model_metrics=job.metrics or {},
        status="deploying",
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    # In mock mode, instantly mark as active
    if settings.USE_MOCK_TRAINING:
        deployment.status = "active"
        deployment.endpoint_info = {
            "url": f"https://modal.run/{app_name}/predict_sentiment",
            "job_id": training_job_id,
        }
        db.commit()
        db.refresh(deployment)
    else:
        # Real Modal deploy would happen async here
        _deploy_to_modal_async(db, deployment.id, user, job)

    return deployment


def _deploy_to_modal_async(db: Session, deployment_id: int, user: User, job: TrainingJob) -> None:
    """Background thread to verify the model is accessible on Modal."""
    import threading

    def _run():
        from app.database import SessionLocal
        local_db = SessionLocal()
        try:
            dep = local_db.query(ModelDeployment).filter(ModelDeployment.id == deployment_id).first()
            if not dep:
                return

            originals = _set_researcher_modal_env(user)
            try:
                from app.services.modal_client import get_deployed_model_info
                info = get_deployed_model_info(job.id)
                if info:
                    dep.status = "active"
                    dep.endpoint_info = info
                else:
                    dep.status = "failed"
                    dep.error_message = "Model not accessible on Modal"
            except Exception as e:
                dep.status = "failed"
                dep.error_message = str(e)
            finally:
                _restore_modal_env(originals)

            local_db.commit()
        except Exception as e:
            logger.error(f"Deploy async error: {e}")
        finally:
            local_db.close()

    thread = threading.Thread(target=_run, daemon=True, name=f"deploy-{deployment_id}")
    thread.start()


# ── Query ─────────────────────────────────────────────────────────

def get_deployment(db: Session, deployment_id: int, researcher_id: int) -> ModelDeployment | None:
    return db.query(ModelDeployment).filter(
        ModelDeployment.id == deployment_id,
        ModelDeployment.researcher_id == researcher_id,
    ).first()


def list_deployments(db: Session, researcher_id: int) -> list[ModelDeployment]:
    return (
        db.query(ModelDeployment)
        .filter(ModelDeployment.researcher_id == researcher_id)
        .order_by(ModelDeployment.created_at.desc())
        .all()
    )


def stop_deployment(db: Session, deployment_id: int, researcher_id: int) -> ModelDeployment | None:
    dep = get_deployment(db, deployment_id, researcher_id)
    if not dep:
        return None
    dep.status = "stopped"
    db.commit()
    db.refresh(dep)
    return dep


# ── Marketplace publish ──────────────────────────────────────────

def push_to_marketplace(
    db: Session,
    researcher_id: int,
    deployment_id: int,
    name: str,
    description: str = "",
    asset_class: str = "stock",
) -> TradingModel:
    """Create a TradingModel linked to an active deployment."""
    dep = db.query(ModelDeployment).filter(
        ModelDeployment.id == deployment_id,
        ModelDeployment.researcher_id == researcher_id,
        ModelDeployment.status == "active",
    ).first()
    if not dep:
        raise ValueError("Active deployment not found")

    job = db.query(TrainingJob).filter(TrainingJob.id == dep.training_job_id).first()

    model = TradingModel(
        creator_id=researcher_id,
        name=name,
        description=description or f"AI model fine-tuned on {dep.base_model}",
        asset_class=asset_class,
        strategy_code=f"# Deployed Modal model: {dep.modal_app_name}\n# Training job: {dep.training_job_id}\n# Base: {dep.base_model}",
        performance_metadata=dep.model_metrics or {},
        status="live",
        training_job_id=dep.training_job_id,
        deployment_id=dep.id,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


# ── Usage tracking ────────────────────────────────────────────────

def get_active_deployment_for_model(db: Session, model: TradingModel) -> ModelDeployment | None:
    """Find the active deployment linked to a TradingModel."""
    if model.deployment_id:
        dep = db.query(ModelDeployment).filter(
            ModelDeployment.id == model.deployment_id,
            ModelDeployment.status == "active",
        ).first()
        if dep:
            return dep
    return None


def record_inference(db: Session, deployment_id: int) -> None:
    dep = db.query(ModelDeployment).filter(ModelDeployment.id == deployment_id).first()
    if dep:
        dep.total_inferences = (dep.total_inferences or 0) + 1
        db.commit()


def record_trade(db: Session, deployment_id: int) -> None:
    dep = db.query(ModelDeployment).filter(ModelDeployment.id == deployment_id).first()
    if dep:
        dep.total_trades_powered = (dep.total_trades_powered or 0) + 1
        db.commit()
