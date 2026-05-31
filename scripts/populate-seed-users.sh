#!/usr/bin/env bash
# Ensure backend is on :8080, then run seed user populate (task populate logic).
# Starts backend only if needed; stops it on exit if this script started it.
# Portable: bash 3.2+ on macOS and Linux. Run via `task populate`.
set -euo pipefail

_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/dev-stack-common.sh
source "${_script_dir}/lib/dev-stack-common.sh"

ITESTS_DIR="${CARPAINTR_ROOT}/backend-integration-tests"
MODE="populate"
POPULATE_EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --licenses-only)
      MODE="licenses-only"
      shift
      ;;
    --no-license-on-create)
      POPULATE_EXTRA_ARGS=(--no-license-on-create)
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

STARTED_BACKEND=0

cleanup() {
  if [ "$STARTED_BACKEND" = "1" ]; then
    echo "==> Stopping backend started for populate..."
    carpaintr_stop_pid_file "$CARPAINTR_API_PID_FILE"
  fi
}

trap cleanup EXIT

if carpaintr_backend_up; then
  echo "==> Backend already running on :8080"
else
  carpaintr_start_backend
  STARTED_BACKEND=1
  if ! carpaintr_wait_for "backend" 60 carpaintr_backend_up; then
    echo "ERROR: backend did not start within 60s. Last logs:"
    tail -30 "$CARPAINTR_API_LOG" 2>/dev/null || true
    exit 1
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: 'uv' is required. Install: https://docs.astral.sh/uv/" >&2
  exit 1
fi

echo "==> Syncing integration-test dependencies..."
(
  cd "$ITESTS_DIR"
  if [ ! -f .uv-sync.stamp ] \
    || [ uv.lock -nt .uv-sync.stamp ] \
    || [ pyproject.toml -nt .uv-sync.stamp ]; then
    uv sync --frozen
    touch .uv-sync.stamp
  fi
)

echo "==> Populating seed users..."
EXIT_CODE=0
if [ "$MODE" = "licenses-only" ]; then
  (cd "$ITESTS_DIR" && uv run python -m tests.populate_licenses) || EXIT_CODE=$?
else
  (cd "$ITESTS_DIR" && uv run python -m tests.populate_users "${POPULATE_EXTRA_ARGS[@]}") || EXIT_CODE=$?
fi

exit "$EXIT_CODE"
