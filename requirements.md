# TOLLABS — Backend Requirements & Architecture

## 1. Overview

**TOLLABS** is a quant trading platform where researchers build and deploy Forex/Stock trading models, and subscribers pay via profit-sharing. The backend is built with **FastAPI**, **SQLite**, and **Modal.ai**, structured as modular micro-services.

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        TOLLABS Backend                           │
├────────────────┬─────────────────────┬───────────────────────────┤
│  Core API      │  Compute Engine     │  Payments                 │
│  (FastAPI)     │  (Modal.ai)         │  (Mock Stripe)            │
│                │                     │                           │
│  • Auth        │  • Notebook Runner  │  • Checkout Sessions      │
│  • Marketplace │  • Data Downloader  │  • Profit-Share Payouts   │
│  • Subscriptions│ • Backtest Engine  │  • Connected Accounts     │
│  • Researcher  │                     │                           │
├────────────────┴─────────────────────┴───────────────────────────┤
│                     Persistence Layer                            │
│  SQLite (relational data)  +  Modal Volumes (large datasets)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
tollabs/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app entry, CORS, lifespan, router includes
│   ├── config.py                # Settings (DB path, secrets, feature flags)
│   ├── database.py              # SQLAlchemy engine + SessionLocal for SQLite
│   │
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py              # User (email, role, stripe_customer_id)
│   │   ├── trading_model.py     # TradingModel (name, asset_class, perf metadata)
│   │   ├── subscription.py      # Subscription (user↔model, profit_share %)
│   │   └── transaction.py       # Transaction (payouts, commissions, ledger)
│   │
│   ├── schemas/                 # Pydantic v2 request/response schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── trading_model.py
│   │   ├── subscription.py
│   │   └── transaction.py
│   │
│   ├── routers/                 # FastAPI routers (one per domain)
│   │   ├── __init__.py
│   │   ├── auth.py              # POST /auth/register, /auth/login
│   │   ├── marketplace.py       # GET /marketplace/models, /marketplace/models/{id}
│   │   ├── subscription.py      # POST /subscribe/{model_id}, GET /subscriptions/me
│   │   ├── researcher.py        # GET /researcher/earnings, POST /researcher/deploy
│   │   ├── compute.py           # POST /compute/run-cell
│   │   └── backtest.py          # POST /backtest/run, GET /backtest/results/{job_id}
│   │
│   ├── services/                # Business logic layer
│   │   ├── __init__.py
│   │   ├── marketplace_service.py
│   │   ├── subscription_service.py
│   │   ├── profit_service.py    # High-water-mark calc, profit split logic
│   │   ├── backtest_service.py  # Orchestrates backtest runs
│   │   └── compute_service.py   # Proxies to Modal (or mock)
│   │
│   ├── mocks/                   # Mock engines (Stripe, Trading, Modal)
│   │   ├── __init__.py
│   │   ├── mock_stripe.py       # Fake Checkout, Transfers, Connected Accounts
│   │   ├── mock_trading.py      # Simulated trade generator (random walk + signals)
│   │   └── mock_modal.py        # In-process code execution (no real Modal)
│   │
│   └── utils/
│       ├── __init__.py
│       └── seed.py              # Seed: demo users, models, fake trade history
│
├── modal_engine/                # Real Modal.ai integration module
│   ├── __init__.py
│   ├── app.py                   # modal.App("tollabs-compute") definition
│   ├── backtest_runner.py       # @app.function for backtesting on GPU
│   ├── notebook_runner.py       # @app.function for sandboxed code execution
│   └── data_downloader.py       # @app.function to fetch & store tick data
│
├── tests/
│   ├── __init__.py
│   ├── test_marketplace.py
│   ├── test_subscriptions.py
│   ├── test_backtest.py
│   └── test_profit_sharing.py
│
├── tollabs.db                   # SQLite database (auto-created)
├── requirements.txt
├── requirements.md              # This file
└── run.py                       # uvicorn launcher
```

---

## 4. Database Schema (SQLite + SQLAlchemy)

### 4.1 `users`
| Column             | Type    | Notes                                |
|--------------------|---------|--------------------------------------|
| id                 | Integer | PK, autoincrement                    |
| email              | String  | Unique, indexed                      |
| hashed_password    | String  |                                      |
| role               | String  | "researcher" or "subscriber"         |
| stripe_customer_id | String  | Mock Stripe ID                       |
| balance            | Float   | Current account balance (default 0)  |
| created_at         | DateTime|                                      |

### 4.2 `trading_models`
| Column               | Type    | Notes                                  |
|----------------------|---------|----------------------------------------|
| id                   | Integer | PK, autoincrement                      |
| creator_id           | Integer | FK → users.id                          |
| name                 | String  |                                        |
| description          | Text    |                                        |
| asset_class          | String  | "forex" or "stock"                     |
| strategy_code        | Text    | Python code for the strategy           |
| performance_metadata | JSON    | {sharpe, max_drawdown, total_return}   |
| status               | String  | "draft", "live", or "archived"         |
| created_at           | DateTime|                                        |

### 4.3 `subscriptions`
| Column              | Type    | Notes                                |
|---------------------|---------|--------------------------------------|
| id                  | Integer | PK, autoincrement                    |
| subscriber_id       | Integer | FK → users.id                        |
| model_id            | Integer | FK → trading_models.id               |
| profit_share_pct    | Float   | e.g. 0.20 = 20% to researcher       |
| is_active           | Boolean | default True                         |
| high_water_mark     | Float   | Highest cumulative PnL               |
| stripe_session_id   | String  | Mock Stripe checkout session         |
| subscribed_at       | DateTime|                                      |

### 4.4 `transactions`
| Column          | Type    | Notes                                      |
|-----------------|---------|---------------------------------------------|
| id              | Integer | PK, autoincrement                           |
| subscription_id | Integer | FK → subscriptions.id                       |
| type            | String  | "trade_pnl", "researcher_payout", "commission" |
| amount          | Float   | Positive = credit, Negative = debit         |
| description     | String  | Human-readable description                  |
| created_at      | DateTime|                                              |

---

## 5. API Endpoints

### 5.1 Auth
| Method | Path             | Description                         |
|--------|------------------|-------------------------------------|
| POST   | /auth/register   | Register (email, password, role)    |
| POST   | /auth/login      | Login → returns bearer token        |

### 5.2 Marketplace
| Method | Path                      | Description                           |
|--------|---------------------------|---------------------------------------|
| GET    | /marketplace/models       | List all live models with perf stats  |
| GET    | /marketplace/models/{id}  | Single model detail + trade history   |

### 5.3 Subscriptions
| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| POST   | /subscribe/{model_id} | Subscribe via mock Stripe checkout       |
| GET    | /subscriptions/me     | My active subscriptions with PnL         |

### 5.4 Researcher
| Method | Path                          | Description                         |
|--------|-------------------------------|-------------------------------------|
| GET    | /researcher/earnings          | Researcher's payout summary         |
| POST   | /researcher/deploy/{model_id} | Move model draft → live             |
| POST   | /researcher/models            | Create a new trading model          |

### 5.5 Compute
| Method | Path              | Description                                    |
|--------|-------------------|------------------------------------------------|
| POST   | /compute/run-cell | Execute code cell (mock Modal sandbox)         |

### 5.6 Backtest
| Method | Path                        | Description                              |
|--------|-----------------------------|------------------------------------------|
| POST   | /backtest/run               | Run backtest → returns job_id            |
| GET    | /backtest/results/{job_id}  | Retrieve backtest metrics & trade list   |

### 5.7 Admin / Simulation
| Method | Path                    | Description                                 |
|--------|-------------------------|---------------------------------------------|
| POST   | /admin/simulate-cycle   | Trigger full mock trading cycle + payouts   |

---

## 6. Mock Engines

### 6.1 Mock Stripe (`mocks/mock_stripe.py`)
- `create_checkout_session(user_id, model_id)` → fake session ID, creates Subscription row
- `process_payout(researcher_id, amount)` → logs fake Stripe Transfer, inserts transaction
- `get_balance(user_id)` → sums transactions for the user
- Returns JSON objects that mimic real Stripe API responses

### 6.2 Mock Trading Engine (`mocks/mock_trading.py`)
- `generate_price_series(asset, periods)` → random-walk price series
- `simulate_trades(strategy_code, price_data)` → list of trades with entry/exit/PnL
- `run_trading_cycle(model_id, db)` → end-to-end: fetch subscribers, run trades, split profit

### 6.3 Mock Modal (`mocks/mock_modal.py`)
- `execute_cell(code, session_id)` → Python exec() in restricted namespace
- Maintains state across calls per session_id (in-memory dict)
- Returns stdout, stderr, and any generated figures as base64

---

## 7. Profit-Sharing Logic

### High-Water Mark Algorithm
1. Track each subscriber's **high_water_mark** (highest cumulative PnL).
2. `new_profit = current_cumulative_pnl - high_water_mark`
3. If `new_profit > 0`:
   - **Researcher** receives `profit_share_pct` (default 20%)
   - **TOLLABS** takes 10% commission
   - **Subscriber** keeps the remaining 70%
4. Update `high_water_mark = current_cumulative_pnl`
5. All splits recorded as `transaction` rows for auditability.

---

## 8. Modal.ai Integration (Production Path)

When ready to move beyond mocks, the `modal_engine/` module provides real Modal integration:

```python
# modal_engine/app.py
import modal

app = modal.App("tollabs-compute")
volume = modal.Volume.from_name("tollabs-financial-data", create_if_missing=True)
image = modal.Image.debian_slim().pip_install("pandas", "numpy", "ta-lib")

@app.function(image=image, volumes={"/data": volume})
def run_backtest(strategy_code: str, asset: str, periods: int = 1000):
    # Load data from /data volume
    # exec strategy_code
    # Return metrics (Sharpe, Drawdown, PnL)
    pass

@app.function(image=image)
def run_notebook_cell(code: str, session_state: dict):
    # Execute code in sandboxed environment
    # Return stdout + updated state
    pass

@app.function(image=image, volumes={"/data": volume}, schedule=modal.Cron("*/5 * * * *"))
def fetch_market_data():
    # Download latest tick data
    # Save to /data volume
    # volume.commit()
    pass
```

### Key Modal Patterns Used:
- **`modal.App`** — Groups functions for atomic deployment
- **`modal.Volume.from_name(..., create_if_missing=True)`** — Persistent storage for datasets
- **`@app.function(gpu="A100")`** — GPU-accelerated compute for training
- **`volume.commit()`** — Persist file changes after writes
- **`volume.reload()`** — Fetch latest data in long-running containers
- **`modal.Image.debian_slim().pip_install(...)`** — Custom container images
- **`modal deploy`** — Deploy persistent apps with web endpoints and cron jobs

---

## 9. Tech Stack

| Component       | Technology                    |
|-----------------|-------------------------------|
| Web Framework   | FastAPI + Uvicorn             |
| ORM             | SQLAlchemy 2.0                |
| Database        | SQLite                        |
| Validation      | Pydantic v2                   |
| Auth            | Simple JWT (PyJWT)            |
| Compute         | Modal.ai (mocked locally)     |
| Payments        | Stripe Connect (mocked)       |
| Testing         | pytest + httpx                |

---

## 10. Running the System

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database
python -m app.utils.seed

# Start the server
python run.py
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

---

## 11. Demo Workflow

1. **Register** a researcher and subscriber via `/auth/register`
2. **Create a model** via `/researcher/models`
3. **Deploy** the model via `/researcher/deploy/{model_id}`
4. **Subscribe** via `/subscribe/{model_id}` (mock Stripe checkout)
5. **Simulate a trading cycle** via `/admin/simulate-cycle`
6. **Check earnings** via `/researcher/earnings`
7. **Check subscriber PnL** via `/subscriptions/me`
8. **Run code cells** via `/compute/run-cell`
9. **Backtest strategies** via `/backtest/run`
