"""
TrainingJob — tracks GPU fine-tuning jobs submitted by researchers.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)

from app.database import Base


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    job_name = Column(String, nullable=False)
    base_model = Column(String, nullable=False)  # e.g. "amazon/chronos-t5-small"
    dataset_filename = Column(String, nullable=False)  # file in user workspace
    config = Column(JSON, default=dict)  # {epochs, lr, batch_size, lora_rank, ...}

    status = Column(String, default="queued")  # queued | running | completed | failed | cancelled
    progress = Column(Float, default=0.0)  # 0-100
    metrics = Column(JSON, default=dict)  # {loss_history: [], val_loss: [], best_loss: ...}
    model_artifact_path = Column(String, nullable=True)  # path to saved weights
    logs = Column(Text, default="")
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
