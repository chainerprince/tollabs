"""
TOLLABS — Main FastAPI application.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, marketplace, subscription, researcher, compute, backtest, ai, training
from app.routers.admin import router as admin_router
from app.routers.trading import router as trading_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create DB tables. Shutdown: nothing special."""
    init_db()
    yield


app = FastAPI(
    title="TOLLABS",
    description="Quant Trading Platform — Marketplace, Backtesting & Profit-Sharing",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────
_origins = (
    ["*"] if settings.CORS_ORIGINS == "*"
    else [o.strip() for o in settings.CORS_ORIGINS.split(",")]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(marketplace.router)
app.include_router(subscription.router)
app.include_router(researcher.router)
app.include_router(compute.router)
app.include_router(backtest.router)
app.include_router(ai.router)
app.include_router(training.router)
app.include_router(admin_router)
app.include_router(trading_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "TOLLABS API",
        "version": "0.1.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
