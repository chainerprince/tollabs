"""Transaction Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel


class TransactionResponse(BaseModel):
    id: int
    subscription_id: int | None
    user_id: int
    type: str
    amount: float
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}
