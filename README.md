<p align="center">
  <strong>T O L L A B S</strong><br/>
  <em>AI-Powered Quantitative Trading Infrastructure</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js_14-000?style=flat&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=flat&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/41_Tests-passing-brightgreen" />
</p>

---

## What is TOLLABS?

TOLLABS is a **full-stack quant trading platform** that connects strategy **researchers** who build and backtest trading algorithms with **subscribers** who deploy those strategies with real capital — with built-in AI-powered analysis, profit sharing, and a cloud notebook environment.

### The Problem

Quantitative trading is fragmented: researchers build strategies in isolation, investors can't easily access algorithmic returns, and there's no standard way to share profits fairly.

### The Solution

| For Researchers | For Subscribers |
|:---|:---|
| Build strategies with natural language or code | Browse a marketplace of vetted algorithms |
| Backtest against simulated market data | Chat with an AI agent trained on each strategy |
| Deploy to marketplace, earn passive income | Configure trades, execute, and track profit sharing |
| Train & fine-tune ML models on GPU | Cloud notebook for custom analysis |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js 14 Frontend                       │
│  Landing · Marketplace · Trading Portal · Compute Notebook       │
│  Dashboard · Training Hub · Earnings · Strategy Detail           │
└────────────────────────┬─────────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────────────────┐
│                     FastAPI Backend (Python)                      │
│  Auth · Marketplace · Subscriptions · Backtest · Compute · AI    │
│  Trading · Training · Profit-Sharing · Admin                     │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│   SQLite DB  │  Gemini 2.5  │ Mock Stripe  │  Mock Trading Engine│
│  (SQLAlchemy)│  Flash (AI)  │  (Payments)  │  (Price Sim + Exec) │
└──────────────┴──────────────┴──────────────┴─────────────────────┘
```

---

## Quick Start

### Prerequisites

- Python 3.11+ and Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/tollabs.git
cd tollabs

# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Seed Demo Data

```bash
python -m app.utils.seed
```

This creates 2 researchers, 3 subscribers, 4 live trading models, subscriptions, and simulated trade history — everything you need for a full demo.

### 4. Run

```bash
# Terminal 1 — Backend (port 8000)
python run.py

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

Open **http://localhost:3000** and you're live.

---

## Demo Accounts

The seed script creates these accounts (all passwords: `password123`):

| Email | Role | Notes |
|:------|:-----|:------|
| `alice@tollabs.io` | Researcher | Has 2 live models with subscribers |
| `bob@tollabs.io` | Researcher | Has 2 live models |
| `charlie@gmail.com` | Subscriber | $10,000 balance, 2 active subscriptions |
| `diana@gmail.com` | Subscriber | $25,000 balance, 2 active subscriptions |
| `eve@gmail.com` | Subscriber | $5,000 balance, 1 active subscription |

> 💡 **Tip:** The login page has one-click demo buttons that auto-fill credentials.

---

## Key Features

### 🧠 NL Strategy Builder
Describe a strategy in plain English → Gemini generates executable Python code → review → backtest → open in cloud notebook.

### 🤖 Strategy Agent
Each subscribed strategy comes with a personal AI agent that can answer questions about the strategy logic, risk level, suggest capital allocation, and explain profit sharing.

### 💰 Profit Sharing Engine
High-water mark algorithm ensures researchers only earn on *new* profits:
- **Subscriber keeps 70%** of profits
- **Researcher earns 20%** (configurable)
- **TOLLABS takes 10%** platform commission

### 🔬 Cloud Notebook
A full Colab-like environment with:
- Code cells with ⌘⏎ execution
- AI code assistant
- File manager (upload, import from URL)
- Strategy import from the NL builder (auto-splits code into cells)

### 🏋️ Model Training Hub
Fine-tune language models for financial tasks:
- Browse HuggingFace models
- Configure training (epochs, learning rate, LoRA rank)
- Real-time job monitoring with loss curves

---

## API Endpoints (11 routers, 40+ endpoints)

| Router | Prefix | Key Endpoints |
|:-------|:-------|:-------------|
| Auth | `/auth` | register, login |
| Marketplace | `/marketplace` | list models, model detail, platform stats |
| Subscriptions | `/subscribe` | subscribe, my subscriptions, cancel |
| Researcher | `/researcher` | create model, deploy, earnings, transactions |
| Trading | `/trading` | fund wallet, agent chat, configure/execute trade, profit sharing |
| Backtest | `/backtest` | run backtest, get results |
| Compute | `/compute` | run cell, file management |
| AI | `/ai` | explain, ask, extract params, code assist, build strategy |
| Training | `/training` | submit job, list jobs, browse/download models |
| Admin | `/admin` | simulate trading cycle |

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | Next.js 14.2, React 18, TypeScript 5.4, Tailwind CSS 3.4 |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Python 3.12 |
| AI | Google Gemini 2.5 Flash |
| Database | SQLite (dev) / PostgreSQL-ready (prod) |
| Auth | JWT (python-jose + bcrypt) |
| Testing | Pytest — 41 tests |

---

## Project Structure

```
tollabs/
├── app/
│   ├── main.py              # FastAPI app + router registration
│   ├── config.py             # Environment settings
│   ├── database.py           # SQLAlchemy engine + session
│   ├── models/               # 6 ORM models (User, TradingModel, Trade, ...)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── routers/              # 11 API routers
│   ├── services/             # Business logic (AI, trading, profit, ...)
│   ├── mocks/                # Mock Stripe, trading engine, Modal, training
│   └── utils/seed.py         # Demo data seeder
├── frontend/
│   ├── src/app/              # 13 Next.js pages
│   ├── src/components/       # 30+ React components (9 folders)
│   └── src/lib/              # API client, auth context, types
├── tests/                    # 41 pytest tests
├── run.py                    # Uvicorn launcher
├── Dockerfile                # Production backend container
├── docker-compose.yml        # Full-stack Docker setup
└── requirements.txt          # Python dependencies
```

---

## Deployment

### Docker (Recommended)

```bash
docker-compose up --build
```

Backend on `:8000`, frontend on `:3000`.

### Manual

```bash
# Backend
python run.py

# Frontend
cd frontend && npm run build && npm start
```

### Cloud

- **Frontend**: Deploy `frontend/` to [Vercel](https://vercel.com) — `vercel.json` included
- **Backend**: Deploy to [Railway](https://railway.app) or any Docker host

---

## Testing

```bash
python -m pytest tests/ -q
# 41 passed ✓
```

---

## Team

Built at **UIUC** for the 2026 hackathon.

---

<p align="center"><strong>TOLLABS</strong> — Where Quant Meets AI</p>
