#!/usr/bin/env bash
# Stop dev servers before reset (shared with task kill-dev).
# Ports via BACKEND_PORT/FRONTEND_PORT/PDFGEN_PORT env vars (default :8080/:3000/:5000).
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
PDFGEN_PORT="${PDFGEN_PORT:-5000}"

lsof -ti ":${BACKEND_PORT}" | xargs kill -9 2>/dev/null && echo "  Killed backend (:${BACKEND_PORT})" || echo "  No backend on :${BACKEND_PORT}"
lsof -ti ":${FRONTEND_PORT}" | xargs kill -9 2>/dev/null && echo "  Killed frontend (:${FRONTEND_PORT})" || echo "  No frontend on :${FRONTEND_PORT}"
lsof -ti ":${PDFGEN_PORT}" | xargs kill -9 2>/dev/null && echo "  Killed mock-pdf (:${PDFGEN_PORT})" || echo "  No mock-pdf on :${PDFGEN_PORT}"
# Vite's own default port, in case it's ever run without FRONTEND_PORT set.
if [ "$FRONTEND_PORT" != "5173" ]; then
  lsof -ti :5173 | xargs kill -9 2>/dev/null && echo "  Killed frontend (:5173)" || true
fi
pkill -f "cargo.watch" 2>/dev/null && echo "  Killed cargo-watch" || true
