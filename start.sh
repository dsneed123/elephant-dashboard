#!/usr/bin/env bash
# Elephant Dashboard — start backend + frontend (dev) or production build
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8300}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
MODE="${1:-dev}"

# ── helpers ──────────────────────────────────────────────────────────────────

log()  { echo "[elephant] $*"; }
die()  { echo "[elephant] ERROR: $*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || die "'$1' is not installed or not on PATH"
}

# ── dependency checks ─────────────────────────────────────────────────────────

require python3
require pip

if [[ "$MODE" != "prod" ]]; then
  require node
  require npm
fi

# ── install Python deps if needed ─────────────────────────────────────────────

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  log "Creating Python virtual environment…"
  python3 -m venv "$BACKEND_DIR/.venv"
fi

log "Installing/updating Python dependencies…"
"$BACKEND_DIR/.venv/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ── production mode: build frontend and serve via FastAPI ────────────────────

if [[ "$MODE" == "prod" ]]; then
  log "Building frontend for production…"
  cd "$FRONTEND_DIR"
  npm install --silent
  npm run build

  DIST_DIR="$FRONTEND_DIR/dist"
  log "Frontend built → $DIST_DIR"
  log "Starting backend on port $BACKEND_PORT (serving static files)…"
  cd "$REPO_DIR"
  ELEPHANT_STATIC_DIR="$DIST_DIR" \
    exec "$BACKEND_DIR/.venv/bin/uvicorn" \
      backend.app.main:app \
      --host 0.0.0.0 \
      --port "$BACKEND_PORT" \
      --workers 1
fi

# ── dev mode: run backend and frontend concurrently ──────────────────────────

log "Starting in dev mode (backend :$BACKEND_PORT, frontend :$FRONTEND_PORT)…"
log "Press Ctrl+C to stop both processes."

cleanup() {
  log "Shutting down…"
  kill 0
}
trap cleanup SIGINT SIGTERM

# Backend
cd "$REPO_DIR"
"$BACKEND_DIR/.venv/bin/uvicorn" \
  backend.app.main:app \
  --host 0.0.0.0 \
  --port "$BACKEND_PORT" \
  --reload &
BACKEND_PID=$!
log "Backend started (PID $BACKEND_PID)"

# Frontend
cd "$FRONTEND_DIR"
npm install --silent
VITE_PORT=$FRONTEND_PORT npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
log "Frontend started (PID $FRONTEND_PID)"

log "Dashboard → http://localhost:$FRONTEND_PORT"
log "API        → http://localhost:$BACKEND_PORT"

wait
