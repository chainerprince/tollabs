# TOLLABS — Deployment Guide

> Deploy the backend to **Railway** and the frontend to **Vercel** from a **single GitHub monorepo**.

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
| Railway account | [railway.app](https://railway.app) — free tier available |
| Vercel account | [vercel.com](https://vercel.com) — free tier (Hobby) |
| Gemini API key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free |
| HuggingFace token (optional) | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |

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

## Step 2 — Deploy Backend on Railway

### 2.1 Create a new project

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select your `tollabs` repository
4. Railway will auto-detect the `Procfile` or `Dockerfile` at the repo root

### 2.2 Configure the root directory

Railway deploys from the repo root by default — this is correct since `requirements.txt`, `Procfile`, and `app/` are all at the root. No changes needed.

### 2.3 Set environment variables

Go to your Railway service → **Variables** tab → add:

| Variable | Value |
|:---------|:------|
| `DATABASE_URL` | `sqlite:///./tollabs.db` |
| `SECRET_KEY` | Generate one: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GEMINI_API_KEY` | Your Gemini API key |
| `HUGGINGFACE_TOKEN` | Your HuggingFace token (optional) |
| `USE_MOCK_STRIPE` | `True` |
| `USE_MOCK_TRADING` | `True` |
| `USE_MOCK_MODAL` | `True` |
| `USE_MOCK_TRAINING` | `True` |
| `PORT` | `8000` |

> **Note:** Railway auto-injects `$PORT`. The Procfile uses it: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 2.4 Deploy settings

In the Railway service **Settings** tab:

- **Build Command:** *(leave empty — Railway uses Dockerfile or pip + Procfile)*
- **Start Command:** *(auto-detected from Procfile)*
- **Watch Paths:** Leave default (deploys on any push to `main`)

If Railway picks the Dockerfile over the Procfile and you want the simpler Procfile deploy:

1. Go to **Settings** → **Build** section
2. Set **Builder** to `Nixpacks` (not Docker)
3. Nixpacks auto-detects Python from `requirements.txt` and uses the `Procfile`

### 2.5 Seed the database

After the first deploy succeeds, go to the Railway service and open the **terminal** or use the Railway CLI:

```bash
# Option A: Railway CLI
railway run python -m app.utils.seed

# Option B: Add a one-time deploy command
# In Railway Settings → Deploy → Custom Start Command (temporarily):
python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT
# After the first deploy, revert to just the Procfile command.
```

### 2.6 Get your backend URL

Once deployed, Railway gives you a public URL like:

```
https://tollabs-production.up.railway.app
```

Copy this — you'll need it for the frontend. Test it by visiting:

```
https://tollabs-production.up.railway.app/docs
```

You should see the Swagger UI with all 40+ endpoints.

### 2.7 Generate a domain (optional)

In Railway → **Settings** → **Networking** → **Generate Domain** or add a custom domain.

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
| `NEXT_PUBLIC_API_URL` | `https://tollabs-production.up.railway.app` ← your Railway URL |

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
      "destination": "https://tollabs-production.up.railway.app/:path*"
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
curl https://tollabs-production.up.railway.app/health
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

### Railway CLI cheatsheet

```bash
# Install
npm install -g @railway/cli

# Login
railway login

# Link to your project
cd tollabs
railway link

# Deploy manually
railway up

# View logs
railway logs

# Run a one-off command
railway run python -m app.utils.seed

# Open the deployed app
railway open
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

### Backend (Railway)

| Variable | Required | Default | Notes |
|:---------|:---------|:--------|:------|
| `DATABASE_URL` | No | `sqlite:///./tollabs.db` | Use PostgreSQL for production |
| `SECRET_KEY` | **Yes** | Insecure default | Generate a real secret |
| `GEMINI_API_KEY` | **Yes** | Empty | Required for AI features |
| `HUGGINGFACE_TOKEN` | No | Empty | Only for model downloads |
| `USE_MOCK_STRIPE` | No | `True` | Keep `True` for demo |
| `USE_MOCK_TRADING` | No | `True` | Keep `True` for demo |
| `USE_MOCK_MODAL` | No | `True` | Keep `True` for demo |
| `USE_MOCK_TRAINING` | No | `True` | Keep `True` for demo |
| `PORT` | Auto | Set by Railway | Don't override manually |

### Frontend (Vercel)

| Variable | Required | Notes |
|:---------|:---------|:------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Full Railway URL, no trailing slash |

---

## Troubleshooting

### "Module not found" on Railway
Railway's Nixpacks builder auto-detects Python. If it fails, ensure `requirements.txt` is at the repo root (not inside `frontend/`).

### Frontend shows "Loading…" forever
The API calls are failing. Check:
1. `NEXT_PUBLIC_API_URL` is set correctly in Vercel env vars (no trailing slash)
2. The Railway backend is running (`/health` returns `ok`)
3. CORS is configured (`allow_origins=["*"]`)

### "SQLite database is locked" on Railway
SQLite works fine for demo. If you get locking errors under load, switch to PostgreSQL:
1. Add a PostgreSQL plugin in Railway
2. Set `DATABASE_URL` to the Railway-provided Postgres connection string
3. SQLAlchemy handles the switch automatically

### Vercel build fails
Make sure the **Root Directory** in Vercel is set to `frontend`. If Vercel tries to build from the repo root, it won't find `package.json`.

### Seed data missing after Railway redeploy
Railway's filesystem is ephemeral — SQLite data resets on each deploy. Options:
1. Add seed to the start command: `python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
2. Use Railway's persistent volume (attach a volume to `/app`)
3. Switch to PostgreSQL (data persists across deploys)

---

## Production Checklist

For a hackathon demo, the above is sufficient. For a production deployment:

- [ ] Replace SQLite with PostgreSQL (Railway has a one-click Postgres plugin)
- [ ] Set a real `SECRET_KEY` (never use the default)
- [ ] Restrict CORS to your Vercel domain
- [ ] Add a Railway persistent volume for file uploads
- [ ] Set `USE_MOCK_*` flags to `False` and connect real services
- [ ] Add a custom domain on both Railway and Vercel
- [ ] Enable Vercel Analytics for frontend monitoring
- [ ] Set up Railway health checks pointing to `/health`
