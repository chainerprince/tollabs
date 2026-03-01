"""User-related Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "subscriber"  # "researcher" | "subscriber"


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    balance: float
    created_at: datetime
    has_modal_credentials: bool = False
    has_hf_token: bool = False
    modal_app_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            role=user.role,
            balance=user.balance,
            created_at=user.created_at,
            has_modal_credentials=bool(user.modal_token_id and user.modal_token_secret),
            has_hf_token=bool(user.hf_token),
            modal_app_name=user.modal_app_name,
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
