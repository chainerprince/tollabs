#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  TOLLABS — Quick Start Script
# ─────────────────────────────────────────────
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║        T O L L A B S             ║${NC}"
echo -e "${CYAN}║   AI Trading Infrastructure      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""

# Check .env
if [ ! -f .env ]; then
  echo -e "${RED}⚠  No .env file found.${NC}"
  echo -e "   Creating from template..."
  cp .env.example .env
  echo -e "${GREEN}✓  .env created — edit it to add your GEMINI_API_KEY${NC}"
fi

# Backend setup
echo -e "\n${CYAN}[1/4]${NC} Installing Python dependencies..."
pip install -q -r requirements.txt

# Seed data
echo -e "${CYAN}[2/4]${NC} Seeding demo data..."
python -m app.utils.seed 2>/dev/null && echo -e "${GREEN}✓  Seed complete${NC}" || echo -e "${GREEN}✓  Database already seeded${NC}"

# Frontend setup
echo -e "${CYAN}[3/4]${NC} Installing frontend dependencies..."
cd frontend && npm install --silent && cd ..

# Launch
echo -e "${CYAN}[4/4]${NC} Starting servers..."
echo ""
echo -e "${GREEN}  Backend  → http://localhost:8000${NC}"
echo -e "${GREEN}  Frontend → http://localhost:3000${NC}"
echo -e "${GREEN}  API Docs → http://localhost:8000/docs${NC}"
echo ""
echo -e "  Demo login: ${CYAN}charlie@gmail.com / password123${NC}"
echo ""

# Start backend in background
python run.py &
BACKEND_PID=$!

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

# Trap cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

wait
