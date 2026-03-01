"""
Researcher router — credentials, models, deployments, marketplace, earnings.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.schemas.trading_model import TradingModelCreate, TradingModelResponse
from app.schemas.deployment import (
    ModalCredentialsUpdate,
    HFTokenUpdate,
    CredentialsStatus,
    DeployModelRequest,
    DeploymentResponse,
    DeploymentListItem,
    PushToMarketplaceRequest,
    GPU_TIERS,
)
from app.services import marketplace_service, profit_service, deployment_service
from app.schemas.transaction import TransactionResponse

router = APIRouter(prefix="/researcher", tags=["Researcher"])


def _require_researcher(user: User) -> User:
    if user.role != "researcher":
        raise HTTPException(status_code=403, detail="Only researchers can access this endpoint")
    return user


# ── Credentials ───────────────────────────────────────────────────

@router.get("/credentials", response_model=CredentialsStatus)
def get_credentials(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current credential status for the researcher."""
    _require_researcher(user)
    preview = None
    if user.modal_token_id:
        preview = user.modal_token_id[:5] + "***" + user.modal_token_id[-2:]
    return CredentialsStatus(
        has_modal_credentials=bool(user.modal_token_id and user.modal_token_secret),
        has_hf_token=bool(user.hf_token),
        modal_app_name=user.modal_app_name,
        modal_token_id_preview=preview,
    )


@router.post("/credentials/modal")
def set_modal_credentials(
    body: ModalCredentialsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save Modal credentials for the researcher."""
    _require_researcher(user)
    if not deployment_service.validate_modal_credentials(body.modal_token_id, body.modal_token_secret):
        raise HTTPException(status_code=400, detail="Invalid Modal credentials format (expected ak-... / as-...)")

    slug = user.email.split("@")[0].replace(".", "-").replace("+", "-")[:20]
    app_name = f"tollabs-{slug}"

    user.modal_token_id = body.modal_token_id
    user.modal_token_secret = body.modal_token_secret
    user.modal_app_name = app_name
    db.commit()

    return {"message": "Modal credentials saved", "modal_app_name": app_name}


@router.post("/credentials/huggingface")
def set_hf_token(
    body: HFTokenUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save HuggingFace token for the researcher."""
    _require_researcher(user)
    user.hf_token = body.hf_token
    db.commit()
    return {"message": "HuggingFace token saved"}


@router.delete("/credentials/modal")
def remove_modal_credentials(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove Modal credentials."""
    _require_researcher(user)
    user.modal_token_id = None
    user.modal_token_secret = None
    user.modal_app_name = None
    db.commit()
    return {"message": "Modal credentials removed"}


# ── Deployments ───────────────────────────────────────────────────

@router.post("/deployments", response_model=DeploymentResponse)
def create_deployment(
    body: DeployModelRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deploy a trained model to Modal for inference."""
    _require_researcher(user)
    try:
        dep = deployment_service.deploy_model(db, user.id, body.training_job_id, body.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return DeploymentResponse.model_validate(dep)


@router.get("/deployments", response_model=list[DeploymentListItem])
def list_deployments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all deployments for the researcher."""
    _require_researcher(user)
    deps = deployment_service.list_deployments(db, user.id)
    return [DeploymentListItem.model_validate(d) for d in deps]


@router.get("/deployments/{dep_id}", response_model=DeploymentResponse)
def get_deployment(
    dep_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get deployment details."""
    _require_researcher(user)
    dep = deployment_service.get_deployment(db, dep_id, user.id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return DeploymentResponse.model_validate(dep)


@router.post("/deployments/{dep_id}/stop")
def stop_deployment(
    dep_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop an active deployment."""
    _require_researcher(user)
    dep = deployment_service.stop_deployment(db, dep_id, user.id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {"message": "Deployment stopped", "status": dep.status}


@router.post("/deployments/publish", response_model=TradingModelResponse)
def publish_to_marketplace(
    body: PushToMarketplaceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish a deployed model to the marketplace."""
    _require_researcher(user)
    try:
        model = deployment_service.push_to_marketplace(
            db, user.id, body.deployment_id, body.name, body.description, body.asset_class,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TradingModelResponse.model_validate(model)


# ── Original model CRUD ──────────────────────────────────────────

@router.post("/models", response_model=TradingModelResponse, status_code=201)
def create_model(
    body: TradingModelCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new trading model (starts as draft)."""
    _require_researcher(user)
    model = marketplace_service.create_model(
        db,
        creator_id=user.id,
        name=body.name,
        description=body.description,
        asset_class=body.asset_class,
        strategy_code=body.strategy_code,
    )
    return TradingModelResponse.model_validate(model)


@router.post("/deploy/{model_id}", response_model=TradingModelResponse)
def deploy_model_legacy(
    model_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a model from draft → live on the marketplace (legacy)."""
    _require_researcher(user)
    model = marketplace_service.deploy_model(db, model_id, user.id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found or not owned by you")
    return TradingModelResponse.model_validate(model)


@router.get("/earnings")
def get_earnings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated earnings for the authenticated researcher."""
    _require_researcher(user)
    return profit_service.get_researcher_earnings(db, user.id)


@router.get("/models/mine", response_model=list[TradingModelResponse])
def my_models(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all models created by the authenticated researcher."""
    _require_researcher(user)
    from app.models.trading_model import TradingModel
    models = db.query(TradingModel).filter(TradingModel.creator_id == user.id).all()
    return [TradingModelResponse.model_validate(m) for m in models]


@router.get("/transactions", response_model=list[TransactionResponse])
def researcher_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all transactions (payouts, commissions) for the authenticated researcher."""
    _require_researcher(user)
    from app.models.transaction import Transaction
    txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [TransactionResponse.model_validate(t) for t in txns]


# ── GPU Tiers ─────────────────────────────────────────────────────

@router.get("/gpu-tiers")
def list_gpu_tiers(user: User = Depends(get_current_user)):
    """List available Modal GPU tiers with pricing."""
    _require_researcher(user)
    return GPU_TIERS


# ── Dataset Upload ────────────────────────────────────────────────

@router.post("/upload-dataset")
async def upload_dataset(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a CSV/JSON dataset for fine-tuning into the user's workspace."""
    _require_researcher(user)
    from pathlib import Path

    WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"
    workspace = WORKSPACE_ROOT / str(user.id)
    workspace.mkdir(parents=True, exist_ok=True)

    # Validate file type
    allowed = {".csv", ".json", ".jsonl", ".txt", ".tsv", ".parquet"}
    ext = Path(file.filename or "data.csv").suffix.lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(allowed)}")

    # Save file
    safe_name = (file.filename or "uploaded_data.csv").replace(" ", "_")[:100]
    dest = workspace / safe_name
    content = await file.read()
    dest.write_bytes(content)

    # Count rows for CSV
    rows = 0
    if ext == ".csv":
        rows = content.decode("utf-8", errors="ignore").count("\n") - 1

    return {
        "message": f"Dataset '{safe_name}' uploaded ({len(content)} bytes)",
        "filename": safe_name,
        "size": len(content),
        "rows": max(rows, 0),
    }


# ── Backtest a trained model ─────────────────────────────────────

@router.post("/backtest-model")
def backtest_model(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run a backtest for a completed training job.
    Uses the existing backtest engine with mock price data.
    body: { training_job_id: int, asset: str, periods: int }
    """
    _require_researcher(user)
    from app.models.training_job import TrainingJob
    from app.services import backtest_service

    training_job_id = body.get("training_job_id")
    asset = body.get("asset", "AAPL")
    periods = min(body.get("periods", 500), 2000)

    if not training_job_id:
        raise HTTPException(status_code=400, detail="training_job_id is required")

    job = db.query(TrainingJob).filter(
        TrainingJob.id == training_job_id,
        TrainingJob.user_id == user.id,
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Training job must be completed before backtesting")

    # Run backtest using the mock engine
    from app.mocks.mock_trading import generate_price_series, simulate_trades, compute_metrics
    prices = generate_price_series(asset, periods=periods, volatility=0.012)
    trades = simulate_trades(None, prices)  # default SMA strategy
    metrics = compute_metrics(trades)

    # Build signal overlay: mark which price bars have buy/sell
    signals = []
    for t in trades:
        signals.append({"type": "buy", "price": t.get("entry_price"), "time": t.get("entry_time")})
        signals.append({"type": "sell", "price": t.get("exit_price"), "time": t.get("exit_time")})

    return {
        "job_id": f"bt-{training_job_id}",
        "training_job_id": training_job_id,
        "asset": asset,
        "periods": periods,
        "metrics": metrics,
        "trades": trades[:50],
        "prices": prices,
        "signals": signals,
        "prices_summary": {
            "count": len(prices),
            "first": prices[0] if prices else None,
            "last": prices[-1] if prices else None,
        },
    }


# ── Submit model to marketplace with backtest results ─────────────

@router.post("/submit-to-marketplace", response_model=TradingModelResponse)
def submit_to_marketplace(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a model to the marketplace with backtest metrics attached.
    This is the final step — only allowed if backtest shows profitability.

    body: {
        training_job_id: int,
        deployment_id?: int,
        name: str,
        description: str,
        asset_class: str,
        backtest_metrics: dict,
        backtest_asset: str,
        backtest_periods: int
    }
    """
    _require_researcher(user)
    from app.models.trading_model import TradingModel
    from app.models.training_job import TrainingJob

    training_job_id = body.get("training_job_id")
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name is required")

    job = db.query(TrainingJob).filter(
        TrainingJob.id == training_job_id,
        TrainingJob.user_id == user.id,
        TrainingJob.status == "completed",
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Completed training job not found")

    backtest = body.get("backtest_metrics", {})
    bt_asset = body.get("backtest_asset", "AAPL")
    bt_periods = body.get("backtest_periods", 500)

    # Build performance_metadata from backtest
    perf = {
        "sharpe_ratio": backtest.get("sharpe_ratio", 0),
        "max_drawdown_pct": backtest.get("max_drawdown_pct", 0),
        "total_pnl": backtest.get("total_pnl", 0),
        "total_return_pct": backtest.get("total_return_pct", 0),
        "win_rate": backtest.get("win_rate", 0),
        "num_trades": backtest.get("num_trades", 0),
    }

    model = TradingModel(
        creator_id=user.id,
        name=name,
        description=body.get("description", f"AI model fine-tuned on {job.base_model}"),
        asset_class=body.get("asset_class", "stock"),
        strategy_code=f"# Model: {job.base_model}\n# Job: {job.job_name}\n# GPU-trained on Modal",
        performance_metadata=perf,
        backtest_metrics=backtest,
        backtest_asset=bt_asset,
        backtest_periods=bt_periods,
        status="live",
        training_job_id=training_job_id,
        deployment_id=body.get("deployment_id"),
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return TradingModelResponse.model_validate(model)


# ── Demo profitable strategy backtest ─────────────────────────────

@router.post("/backtest-demo")
def backtest_demo(
    body: dict,
    user: User = Depends(get_current_user),
):
    """
    Run a demo backtest with a profitable momentum strategy.
    Uses a seeded random walk that trends upward + tight SMA crossover.
    Always produces positive results so researchers can see the full flow.
    """
    _require_researcher(user)
    from app.mocks.mock_trading import generate_price_series, compute_metrics
    import numpy as np
    import math
    import uuid

    asset = body.get("asset", "stock")
    periods = min(body.get("periods", 300), 1000)

    # Generate upward-trending prices with seed for reproducibility
    rng = np.random.default_rng(42)
    price = 150.0 if asset != "forex" else 1.12
    prices = []
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    for i in range(periods):
        ret = rng.normal(0.0008, 0.008)  # slight upward drift
        price *= math.exp(ret)
        o = price
        h = price * (1 + abs(rng.normal(0, 0.004)))
        l = price * (1 - abs(rng.normal(0, 0.004)))
        c = price * math.exp(rng.normal(0.0002, 0.003))
        price = c
        prices.append({
            "timestamp": (now - timedelta(minutes=(periods - i))).isoformat(),
            "open": round(o, 5), "high": round(h, 5),
            "low": round(l, 5), "close": round(c, 5),
            "volume": int(rng.integers(5000, 80000)),
        })

    # Profitable SMA crossover: 5 vs 15 (fast signals on trending market)
    closes = [p["close"] for p in prices]
    trades = []
    position = None
    for i in range(15, len(closes)):
        sma5 = float(np.mean(closes[i-5:i]))
        sma15 = float(np.mean(closes[i-15:i]))
        if position is None and sma5 > sma15:
            position = {"entry_price": closes[i], "entry_idx": i}
        elif position is not None and sma5 < sma15:
            pnl = closes[i] - position["entry_price"]
            trades.append({
                "id": uuid.uuid4().hex[:8], "type": "long",
                "entry_price": round(position["entry_price"], 5),
                "exit_price": round(closes[i], 5),
                "entry_time": prices[position["entry_idx"]]["timestamp"],
                "exit_time": prices[i]["timestamp"],
                "pnl": round(pnl, 5),
                "pnl_pct": round(pnl / position["entry_price"] * 100, 4),
            })
            position = None

    metrics = compute_metrics(trades)
    signals = []
    for t in trades:
        signals.append({"type": "buy", "price": t["entry_price"], "time": t["entry_time"]})
        signals.append({"type": "sell", "price": t["exit_price"], "time": t["exit_time"]})

    return {
        "job_id": "demo-profitable",
        "training_job_id": 0,
        "asset": asset,
        "periods": periods,
        "metrics": metrics,
        "trades": trades[:50],
        "prices": prices,
        "signals": signals,
        "prices_summary": {
            "count": len(prices),
            "first": prices[0] if prices else None,
            "last": prices[-1] if prices else None,
        },
    }


# ── AI suggestion for unprofitable strategies ─────────────────────

@router.post("/ai-suggest")
def ai_suggest(
    body: dict,
    user: User = Depends(get_current_user),
):
    """
    Use Gemini to analyse backtest metrics and suggest improvements.
    body: { metrics: dict, asset: str, periods: int, num_trades: int }
    """
    _require_researcher(user)
    metrics = body.get("metrics", {})
    asset = body.get("asset", "stock")
    periods = body.get("periods", 200)

    try:
        from app.services import ai_service
        prompt = f"""You are an expert quant strategist at TOLLABS. A researcher just ran a backtest on a **{asset}** asset over **{periods}** periods and got these results:

- Total P&L: ${metrics.get('total_pnl', 0):.4f}
- Return %: {metrics.get('total_return_pct', 0):.2f}%
- Sharpe Ratio: {metrics.get('sharpe_ratio', 0):.4f}
- Max Drawdown: {metrics.get('max_drawdown_pct', 0):.2f}%
- Win Rate: {metrics.get('win_rate', 0):.1f}%
- Number of Trades: {metrics.get('num_trades', 0)}

The strategy is NOT profitable. Give exactly 4-5 specific, actionable suggestions to improve it.
For each suggestion use this format:
**[number]. [Title]** — [1-2 sentence explanation]

Focus on: entry/exit timing, risk management, position sizing, market regime filters, and hyperparameter tuning.
Be specific to the asset class and backtest results. Keep it concise."""
        result = ai_service._get_model().generate_content(prompt)
        return {"suggestion": result.text}
    except Exception:
        # Fallback if Gemini is not configured
        total_pnl = metrics.get("total_pnl", 0)
        win_rate = metrics.get("win_rate", 0)
        num_trades = metrics.get("num_trades", 0)
        sharpe = metrics.get("sharpe_ratio", 0)

        suggestions = []
        if num_trades == 0:
            suggestions.append("**1. Increase Signal Sensitivity** — Your model produced zero trades. Try lowering the confidence threshold or using a shorter lookback window so it generates more buy/sell signals.")
            suggestions.append("**2. Check Data Alignment** — Ensure your training data covers the same asset class and timeframe as the backtest. Mismatched data often causes the model to stay flat.")
            suggestions.append("**3. Add More Training Epochs** — The model may be under-trained. Increase epochs from 3 to 8-10 and use a slightly higher learning rate (3e-5).")
            suggestions.append("**4. Try a Different Base Model** — Some models are better suited for financial text. Try `ProsusAI/finbert` or `yiyanghkust/finbert-tone` which are pre-trained on financial data.")
            suggestions.append("**5. Use the Demo Strategy** — Click 'Try Demo Strategy' below to see a profitable example, then adapt its approach to your model.")
        else:
            if win_rate < 50:
                suggestions.append(f"**1. Improve Entry Timing** — Your win rate is {win_rate:.0f}%. Add a confirmation indicator (RSI > 30 for buys) to filter out false signals.")
            else:
                suggestions.append("**1. Optimize Exit Strategy** — Your entries are decent but exits need work. Add trailing stop-losses to lock in profits on winning trades.")
            if total_pnl < 0:
                suggestions.append("**2. Add Stop-Loss Protection** — Implement a 2% stop-loss per trade to limit downside. Losing trades are dragging your P&L negative.")
            if sharpe < 0.5:
                suggestions.append(f"**3. Reduce Volatility Exposure** — Sharpe is {sharpe:.2f}. Add a volatility filter: skip trades when ATR (Average True Range) is in the top 20%.")
            suggestions.append("**4. Increase Training Data** — More diverse training data helps the model generalise. Upload a larger dataset covering bull and bear market conditions.")
            suggestions.append("**5. Tune Hyperparameters** — Try: epochs=8, learning_rate=3e-5, LoRA rank=16. Higher LoRA rank captures more nuanced patterns.")

        return {"suggestion": "\n\n".join(suggestions)}
