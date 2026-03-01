"""
Auth router — register, login, and JWT-based current-user dependency.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, ModalCredentials, ModalCredentialsStatus
from app.mocks.mock_stripe import create_connected_account

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


# ── Helpers ───────────────────────────────────────────────────────


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency — extracts and validates the JWT bearer token."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    if body.role not in ("researcher", "subscriber"):
        raise HTTPException(status_code=400, detail="Role must be 'researcher' or 'subscriber'")

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=_hash_password(body.password),
        role=body.role,
        stripe_customer_id=f"cus_mock_{body.email.split('@')[0]}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-create Stripe Connected Account for researchers
    if user.role == "researcher":
        create_connected_account(user.id, user.email)

    token = _create_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse.from_user(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = _create_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user=UserResponse.from_user(user),
    )


# ── Modal Credentials ────────────────────────────────────────────


@router.put("/me/modal-credentials", response_model=ModalCredentialsStatus)
def save_modal_credentials(
    body: ModalCredentials,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save researcher's Modal token ID and secret."""
    user.modal_token_id = body.modal_token_id.strip()
    user.modal_token_secret = body.modal_token_secret.strip()
    db.commit()
    preview = user.modal_token_id[:6] + "..." + user.modal_token_id[-2:] if len(user.modal_token_id) > 8 else "****"
    return ModalCredentialsStatus(has_credentials=True, modal_token_id_preview=preview)


@router.get("/me/modal-credentials", response_model=ModalCredentialsStatus)
def get_modal_credentials(
    user: User = Depends(get_current_user),
):
    """Check if researcher has Modal credentials stored."""
    has = bool(user.modal_token_id and user.modal_token_secret)
    preview = ""
    if has and len(user.modal_token_id) > 8:
        preview = user.modal_token_id[:6] + "..." + user.modal_token_id[-2:]
    return ModalCredentialsStatus(has_credentials=has, modal_token_id_preview=preview)


@router.delete("/me/modal-credentials")
def delete_modal_credentials(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove researcher's Modal credentials."""
    user.modal_token_id = None
    user.modal_token_secret = None
    db.commit()
    return {"message": "Modal credentials removed"}
