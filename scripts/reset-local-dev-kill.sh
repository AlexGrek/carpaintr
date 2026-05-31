#!/usr/bin/env bash
# Stop dev servers before reset (shared with task kill-dev).
set -euo pipefail

lsof -ti :8080 | xargs kill -9 2>/dev/null && echo "  Killed backend (:8080)" || echo "  No backend on :8080"
lsof -ti :3000 | xargs kill -9 2>/dev/null && echo "  Killed frontend (:3000)" || echo "  No frontend on :3000"
lsof -ti :5173 | xargs kill -9 2>/dev/null && echo "  Killed frontend (:5173)" || echo "  No frontend on :5173"
pkill -f "cargo.watch" 2>/dev/null && echo "  Killed cargo-watch" || true
