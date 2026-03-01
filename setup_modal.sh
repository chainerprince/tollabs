#!/bin/bash
# ──────────────────────────────────────────────────────────────
#  TOLLABS — Modal GPU Setup
#
#  This deploys the fine-tuning + inference functions to Modal.
#  Run this ONCE from your local machine. After that, your
#  Render/Railway server calls Modal remotely using env vars.
#
#  You do NOT run this on Render — just set MODAL_TOKEN_ID and
#  MODAL_TOKEN_SECRET as environment variables there.
# ──────────────────────────────────────────────────────────────

set -e

echo "🚀 TOLLABS Modal Setup"
echo "────────────────────────"
echo ""

# Step 1: Check Modal is installed
if ! command -v modal &> /dev/null; then
    echo "📦 Installing Modal..."
    pip install "modal>=0.70.0"
fi

echo "✅ Modal version: $(python -c 'import modal; print(modal.__version__)')"

# Step 2: Authenticate (local only — on Render use env vars instead)
echo ""
echo "🔐 Authenticating with Modal..."
echo "   If prompted, follow the browser link to authenticate."
echo ""
modal token new

echo ""
echo "💡 Copy your token for Render.com:"
echo "   Go to https://modal.com/settings#tokens"
echo "   Copy MODAL_TOKEN_ID and MODAL_TOKEN_SECRET"
echo "   Paste them into Render → Environment Variables"
echo ""

# Step 3: Deploy the app
echo "🚀 Deploying TOLLABS Modal app (GPU training + inference)..."
cd "$(dirname "$0")"
modal deploy app/modal_app.py

echo ""
echo "✅ Modal app deployed successfully!"
echo ""
echo "📋 What's deployed on Modal (runs on Modal's GPUs, NOT on Render):"
echo "   • finetune_finbert — Fine-tunes FinBERT on financial sentiment (T4 GPU)"
echo "   • predict_sentiment — Inference on deployed fine-tuned models"
echo "   • trading_decision — Multi-step AI trading decisions"
echo ""
echo "🌐 For Render.com deployment:"
echo "   1. Go to https://modal.com/settings#tokens"
echo "   2. Create a new token (or use the one you just created)"
echo "   3. On Render dashboard → your service → Environment"
echo "   4. Set:  MODAL_TOKEN_ID = <your token id>"
echo "   5. Set:  MODAL_TOKEN_SECRET = <your token secret>"
echo "   6. That's it — Render calls Modal remotely via these env vars"
echo ""
