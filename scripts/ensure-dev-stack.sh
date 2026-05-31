#!/usr/bin/env bash
# Start backend (:8080) and frontend (:3000) if not already running. Leaves them up.
# Portable: bash 3.2+ on macOS and Linux. Run via `task ensure-dev` or `bash scripts/ensure-dev-stack.sh`.
set -euo pipefail

_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-stack-common.sh
source "${_script_dir}/lib/dev-stack-common.sh"

if [ "${1:-}" = "--check" ]; then
  carpaintr_backend_up || {
    echo "Backend is NOT running at $BACKEND_HEALTH_URL"
    exit 1
  }
  carpaintr_frontend_up || {
    echo "Frontend is NOT running at $FRONTEND_URL"
    exit 1
  }
  echo "Dev stack is up (backend :8080, frontend $FRONTEND_URL)"
  exit 0
fi

carpaintr_ensure_frontend_deps

if carpaintr_backend_up; then
  echo "==> Backend already running"
else
  carpaintr_start_backend >/dev/null
  if ! carpaintr_wait_for "backend" 60 carpaintr_backend_up; then
    echo "Backend failed to start. Log:"
    tail -30 "$CARPAINTR_API_LOG" 2>/dev/null || true
    exit 1
  fi
fi

if carpaintr_frontend_up; then
  echo "==> Frontend already running at $FRONTEND_URL"
else
  carpaintr_start_frontend >/dev/null
  if ! carpaintr_wait_for "frontend" 60 carpaintr_frontend_up; then
    echo "Frontend failed to start. Log:"
    tail -30 "$CARPAINTR_FRONTEND_LOG" 2>/dev/null || true
    exit 1
  fi
  echo "    Frontend ready at $FRONTEND_URL"
fi
