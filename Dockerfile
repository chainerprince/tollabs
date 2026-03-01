# ── TOLLABS Backend ──────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app/ ./app/
COPY tests/ ./tests/
COPY run.py .

# Create persistent directories
RUN mkdir -p /app/data /app/workspaces

# Seed + Run
EXPOSE 8000
CMD ["sh", "-c", "python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
