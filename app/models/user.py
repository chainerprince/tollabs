"""User ORM model."""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, DateTime

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="subscriber")  # "researcher" | "subscriber"
    stripe_customer_id = Column(String, nullable=True)
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
