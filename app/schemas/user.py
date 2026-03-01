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
    has_modal_credentials: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            role=user.role,
            balance=user.balance,
            has_modal_credentials=bool(user.modal_token_id and user.modal_token_secret),
            created_at=user.created_at,
        )


class ModalCredentials(BaseModel):
    modal_token_id: str
    modal_token_secret: str


class ModalCredentialsStatus(BaseModel):
    has_credentials: bool
    modal_token_id_preview: str = ""  # e.g. "ak-nOJ...Vk"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
