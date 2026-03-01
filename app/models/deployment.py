"""ModelDeployment ORM — tracks models deployed to Modal for live inference."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON

from app.database import Base


class ModelDeployment(Base):
    __tablename__ = "model_deployments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    researcher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    training_job_id = Column(Integer, ForeignKey("training_jobs.id"), nullable=False)

    name = Column(String, nullable=False)
    modal_app_name = Column(String, nullable=True)
    modal_function_name = Column(String, default="predict_sentiment")
    status = Column(String, default="deploying")  # deploying | active | stopped | failed
    version = Column(String, default="v1")
    base_model = Column(String, default="")

    # Performance tracking
    model_metrics = Column(JSON, default=dict)
    endpoint_info = Column(JSON, default=dict)
    total_inferences = Column(Integer, default=0)
    total_trades_powered = Column(Integer, default=0)
    avg_latency_ms = Column(Float, default=0.0)
    error_message = Column(String, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
