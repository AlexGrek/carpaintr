#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

(cd carpaintr-front && npm run dev) &
FE_PID=$!
(cd backend-service-rust && cargo watch -x run) &
BE_PID=$!

cleanup() {
    trap '' EXIT INT TERM HUP
    # Kill children first so they don't get orphaned when the parent subshells die
    pkill -P "$BE_PID" 2>/dev/null || true
    pkill -P "$FE_PID" 2>/dev/null || true
    kill "$FE_PID" "$BE_PID" 2>/dev/null || true
    # Belt-and-suspenders: kill anything left on the dev ports
    pkill -f "cargo.watch" 2>/dev/null || true
    lsof -ti :8080 | xargs kill -9 2>/dev/null || true
    lsof -ti :5173 | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

wait "$FE_PID" "$BE_PID"
