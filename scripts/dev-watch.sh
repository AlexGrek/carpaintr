#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

export BACKEND_PORT="${BACKEND_PORT:-8080}"
export FRONTEND_PORT="${FRONTEND_PORT:-3000}"
PDFGEN_PORT="${PDFGEN_PORT:-5000}"

(cd carpaintr-front && env FRONTEND_PORT="$FRONTEND_PORT" BACKEND_PORT="$BACKEND_PORT" npm run dev) &
FE_PID=$!
(cd backend-service-rust && env PORT="$BACKEND_PORT" cargo watch -x run) &
BE_PID=$!
python3 "$ROOT_DIR/scripts/mock-pdf-server.py" "$PDFGEN_PORT" &
PDF_PID=$!

cleanup() {
    trap '' EXIT INT TERM HUP
    # Kill children first so they don't get orphaned when the parent subshells die
    pkill -P "$BE_PID" 2>/dev/null || true
    pkill -P "$FE_PID" 2>/dev/null || true
    kill "$FE_PID" "$BE_PID" "$PDF_PID" 2>/dev/null || true
    # Belt-and-suspenders: kill anything left on the dev ports
    pkill -f "cargo.watch" 2>/dev/null || true
    pkill -f "mock-pdf-server" 2>/dev/null || true
    lsof -ti ":${BACKEND_PORT}" | xargs kill -9 2>/dev/null || true
    lsof -ti ":${PDFGEN_PORT}" | xargs kill -9 2>/dev/null || true
    lsof -ti ":${FRONTEND_PORT}" | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

wait "$FE_PID" "$BE_PID" "$PDF_PID"
