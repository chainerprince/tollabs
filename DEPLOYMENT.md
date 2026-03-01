# TOLLABS — Deployment Guide

> Deploy the backend to **Render** (or Railway) and the frontend to **Vercel** from a **single GitHub monorepo**.  
> Real GPU training runs on **Modal.com** — your server just calls it remotely.

---

## Architecture on Render

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  Vercel          │       │  Render           │       │  Modal.com      │
│  (Next.js)       │──────▶│  (FastAPI)        │──────▶│  (T4 GPU)       │
│                  │  API  │                   │ remote│                 │
│  Frontend        │ calls │  Backend          │ calls │  Training +     │
│  Static + SSR    │       │  REST API + DB    │       │  Inference      │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                │
                                │ env vars:
                                │ MODAL_TOKEN_ID
                                │ MODAL_TOKEN_SECRET
```

**Key insight:** Modal functions run on Modal's GPUs, not on Render. Your Render server uses `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` env vars to authenticate and call Modal remotely. No interactive login needed.

---

## Repository Structure

Your GitHub repo looks like this:

```
tollabs/                    ← repo root (Railway deploys from here)
├── app/                    ← FastAPI backend
├── tests/
├── run.py
├── requirements.txt
├── Procfile
├── Dockerfile
├── .env.example
├── frontend/               ← Next.js frontend (Vercel deploys from here)
│   ├── src/
│   ├── package.json
│   ├── vercel.json
│   └── ...
└── README.md
```

Both services deploy from the **same repo** — Railway watches the root, Vercel watches the `frontend/` directory.

---

## Prerequisites

| What | Where to get it |
|:-----|:----------------|
| GitHub account | [github.com](https://github.com) |
| Render account | [render.com](https://render.com) — free tier available |
| Vercel account | [vercel.com](https://vercel.com) — free tier (Hobby) |
| Modal account | [modal.com](https://modal.com) — $30 free credits |
| Gemini API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free |

---

## Step 0 — Deploy Modal Functions (one-time, from your laptop)

Modal functions (GPU training + inference) run on **Modal's infrastructure**, not on Render. You deploy them once from your local machine:

```bash
# Install & authenticate Modal
pip install modal
modal token new          # opens browser to log in

# Deploy the TOLLABS GPU functions
cd tollabs
modal deploy app/modal_app.py
```

Then get your token for Render:

1. Go to **[modal.com/settings#tokens](https://modal.com/settings#tokens)**
2. Click **"Create new token"**
3. Copy the **Token ID** and **Token Secret**

> You'll paste these into Render in Step 2. That's how Render authenticates with Modal — no interactive login, no copying tokens into containers.

---

## Step 1 — Push to GitHub

```bash
cd tollabs

# Initialize git (if not already)
git init
git add .
git commit -m "TOLLABS — hackathon submission"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/tollabs.git
git branch -M main
git push -u origin main
```

Make sure `.env` is in your `.gitignore` (it already is). Never push secrets.

---

## Step 2 — Deploy Backend on Render

### Option A: One-click deploy (recommended)

Click this button (after pushing to GitHub):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This uses the `render.yaml` blueprint in the repo root. It creates both services automatically.

### Option B: Manual setup

#### 2.1 Create a Web Service

1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your `tollabs` GitHub repository
4. Configure:

| Setting | Value |
|:--------|:------|
| **Name** | `tollabs-api` |
| **Root Directory** | *(leave empty — repo root)* |
| **Runtime** | `Python` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

#### 2.2 Set environment variables

Go to your Render service → **Environment** tab → add:

| Variable | Value | Notes |
|:---------|:------|:------|
| `SECRET_KEY` | *(generate one)* | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | `sqlite:///./tollabs.db` | |
| `GEMINI_API_KEY` | Your Gemini key | Required for AI features |
| `MODAL_TOKEN_ID` | *(from Step 0)* | **This is how Render talks to Modal** |
| `MODAL_TOKEN_SECRET` | *(from Step 0)* | **No interactive login needed** |
| `USE_MOCK_STRIPE` | `True` | Wallet stays mocked |
| `USE_MOCK_TRADING` | `False` | Real AI model for trades |
| `USE_MOCK_MODAL` | `True` | Notebook execution mocked |
| `USE_MOCK_TRAINING` | `False` | Real GPU training via Modal |
| `PYTHON_VERSION` | `3.12.0` | |

> **How does auth work?** The `modal` Python package automatically reads `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` from environment variables. When your Render server calls `modal.Function.from_name(...)`, it authenticates using these env vars. No browser login, no copying tokens into containers.

#### 2.3 Add a disk (optional but recommended)

For SQLite persistence across deploys:

1. Go to your service → **Disks** tab
2. Add a disk:
   - **Name:** `tollabs-data`
   - **Mount Path:** `/app/data`
   - **Size:** 1 GB

> Without a disk, SQLite resets on every deploy. For production, switch to PostgreSQL.

#### 2.4 Get your backend URL

Once deployed, Render gives you:

```
https://tollabs-api.onrender.com
```

Test it: `https://tollabs-api.onrender.com/docs` should show the Swagger UI.

---

## Step 3 — Deploy Frontend on Vercel

### 3.1 Import project

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New…"** → **"Project"**
3. Select your `tollabs` GitHub repository
4. **Important:** Set the **Root Directory** to `frontend`

   ![Root Directory setting](https://vercel.com/_next/image?url=%2Fdocs-proxy%2Fstatic%2Fdocs%2Fconcepts%2Fmonorepos%2Froot-directory.png&w=1920&q=75)

### 3.2 Configure build settings

Vercel should auto-detect Next.js. Verify these settings:

| Setting | Value |
|:--------|:------|
| **Framework Preset** | Next.js |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (auto-detected) |
| **Output Directory** | `.next` (auto-detected) |
| **Install Command** | `npm install` (auto-detected) |

### 3.3 Set environment variables

In the Vercel project → **Settings** → **Environment Variables** → add:

| Variable | Value |
|:---------|:------|
| `NEXT_PUBLIC_API_URL` | `https://tollabs-api.onrender.com` ← your Render URL |

> **Critical:** This must be `NEXT_PUBLIC_` prefixed so Next.js exposes it to the browser. The API client in `src/lib/api.ts` reads it:
> ```ts
> const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
> ```

### 3.4 Update vercel.json (optional API proxy)

The `frontend/vercel.json` has a rewrite rule. Update the backend URL:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://tollabs-api.onrender.com/:path*"
    }
  ]
}
```

> This rewrite is optional. The frontend calls the backend directly via `NEXT_PUBLIC_API_URL`. The rewrite is only needed if you want `/api/*` routes to proxy through Vercel (useful for hiding the backend URL from the browser).

### 3.5 Deploy

Click **"Deploy"**. Vercel will:

1. Install `npm` dependencies from `frontend/package.json`
2. Run `npm run build` (Next.js static + SSR build)
3. Deploy to its edge network

Your frontend will be live at:

```
https://tollabs.vercel.app
```

(or whatever domain Vercel assigns)

---

## Step 4 — Verify End-to-End

### 4.1 Health check

```bash
# Backend
curl https://tollabs-api.onrender.com/health
# → {"status":"ok"}

# Frontend
open https://tollabs.vercel.app
```

### 4.2 Test the full flow

1. Open your Vercel frontend URL
2. Click a demo login button (e.g., `charlie@gmail.com / password123`)
3. Browse the Marketplace
4. Subscribe to a model
5. Go to Strategy Detail → Add Capital → Fund wallet
6. Open Trading Portal → Chat with AI agent → Execute a trade
7. Verify profit sharing shows up

### 4.3 CORS (should work out of the box)

The backend has `allow_origins=["*"]` in CORS middleware. For production, you'd restrict this to your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tollabs.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For the hackathon demo, `"*"` is fine.

---

## Quick Reference

### Render CLI cheatsheet

```bash
# Render doesn't have a CLI — use the web dashboard.
# Or use the Render API: https://api.render.com/v1

# View logs: Render dashboard → your service → Logs tab
# Restart: Render dashboard → your service → Manual Deploy → Deploy
# Shell: Render dashboard → your service → Shell tab
```

### Vercel CLI cheatsheet

```bash
# Install
npm install -g vercel

# Login
vercel login

# Deploy from frontend dir
cd tollabs/frontend
vercel

# Deploy to production
vercel --prod

# Set env variable
vercel env add NEXT_PUBLIC_API_URL
```

---

## Environment Variables Summary

### Backend (Render)

| Variable | Required | Default | Notes |
|:---------|:---------|:--------|:------|
| `DATABASE_URL` | No | `sqlite:///./tollabs.db` | Use PostgreSQL for production |
| `SECRET_KEY` | **Yes** | Insecure default | Generate a real secret |
| `GEMINI_API_KEY` | **Yes** | Empty | Required for AI features |
| `MODAL_TOKEN_ID` | **Yes** | Empty | From modal.com/settings#tokens |
| `MODAL_TOKEN_SECRET` | **Yes** | Empty | From modal.com/settings#tokens |
| `USE_MOCK_STRIPE` | No | `True` | Keep `True` (wallet mocked) |
| `USE_MOCK_TRADING` | No | `False` | `False` = real AI model inference |
| `USE_MOCK_MODAL` | No | `True` | Notebook execution mocked |
| `USE_MOCK_TRAINING` | No | `False` | `False` = real Modal GPU training |
| `PORT` | Auto | Set by Render | Don't override manually |

### Frontend (Vercel)

| Variable | Required | Notes |
|:---------|:---------|:------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Full Railway URL, no trailing slash |

---

## Troubleshooting

### "Module not found" on Render
Ensure `requirements.txt` is at the repo root (not inside `frontend/`) and `PYTHON_VERSION=3.12.0` is set.

### Frontend shows "Loading…" forever
The API calls are failing. Check:
1. `NEXT_PUBLIC_API_URL` is set correctly in Vercel env vars (no trailing slash)
2. The Render backend is running (`/health` returns `ok`)
3. CORS is configured (`allow_origins=["*"]`)

### Modal training fails with "Token missing"
Your `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` are missing or wrong on Render. Go to:
1. [modal.com/settings#tokens](https://modal.com/settings#tokens) → create a new token
2. Render dashboard → your service → Environment → paste both values
3. Re-deploy

### "SQLite database is locked" on Render
SQLite works fine for demo. For production, use Render's managed PostgreSQL.

### Vercel build fails
Make sure the **Root Directory** in Vercel is set to `frontend`.

### Seed data missing after Render redeploy
Render's filesystem is ephemeral — SQLite data resets on each deploy. Options:
1. The start command already includes `python -m app.utils.seed` (auto-seeds on boot)
2. Add a Render disk (mount at `/app/data`)
3. Switch to PostgreSQL

---

## Production Checklist

For a hackathon demo, the above is sufficient. For a production deployment:

- [ ] Replace SQLite with PostgreSQL (Render has managed Postgres)
- [ ] Set a real `SECRET_KEY` (never use the default)
- [ ] Restrict CORS to your Vercel domain
- [ ] Add a Render disk for persistent storage
- [ ] Verify `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` are set
- [ ] Deploy Modal app: `modal deploy app/modal_app.py`
- [ ] Add a custom domain on both Render and Vercel
- [ ] Enable Vercel Analytics for frontend monitoring
- [ ] Set up Render health checks pointing to `/health`
