#!/usr/bin/env bash
# Ensure local backend + frontend are up, seed test users, run Cypress (real API).
# Portable: bash 3.2+ on macOS and Linux. Run via `task cypress` or `bash scripts/cypress-e2e.sh`.
set -euo pipefail

_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-stack-common.sh
source "${_script_dir}/lib/dev-stack-common.sh"

STARTED_BACKEND=0
STARTED_FRONTEND=0

cleanup() {
  if [ "$STARTED_FRONTEND" = "1" ]; then
    echo "==> Stopping frontend started for Cypress..."
    carpaintr_stop_pid_file "$CARPAINTR_FRONTEND_PID_FILE"
  fi
  if [ "$STARTED_BACKEND" = "1" ]; then
    echo "==> Stopping backend started for Cypress..."
    carpaintr_stop_pid_file "$CARPAINTR_API_PID_FILE"
  fi
}

trap cleanup EXIT

echo "==> Checking frontend dependencies..."
carpaintr_ensure_frontend_deps

if carpaintr_backend_up; then
  echo "==> Backend already running on :8080"
else
  carpaintr_start_backend >/dev/null
  STARTED_BACKEND=1
  if ! carpaintr_wait_for "backend" 60 carpaintr_backend_up; then
    echo "ERROR: backend did not start within 60s. Last logs:"
    tail -30 "$CARPAINTR_API_LOG" 2>/dev/null || true
    exit 1
  fi
fi

if carpaintr_frontend_up; then
  echo "==> Frontend already running at $FRONTEND_URL"
else
  carpaintr_start_frontend >/dev/null
  STARTED_FRONTEND=1
  if ! carpaintr_wait_for "frontend" 60 carpaintr_frontend_up; then
    echo "ERROR: frontend did not start within 60s. Last logs:"
    tail -30 "$CARPAINTR_FRONTEND_LOG" 2>/dev/null || true
    exit 1
  fi
fi

echo "==> Ensuring seed users (task populate)..."
if ! command -v task >/dev/null 2>&1; then
  echo "ERROR: 'task' is required. Install go-task or run from repo with task in PATH." >&2
  exit 1
fi
(cd "$CARPAINTR_ROOT" && task populate)
echo "==> Ensuring seed user licenses (required for /api/v1/user/*)..."
(cd "$CARPAINTR_ROOT" && task populate:licenses)

echo "==> Running Cypress E2E suite (real API)..."
EXIT_CODE=0
(cd "$CARPAINTR_FRONTEND_DIR" && npm run cypress:run) || EXIT_CODE=$?

exit "$EXIT_CODE"
