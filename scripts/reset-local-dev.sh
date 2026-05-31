#!/usr/bin/env bash
# Reset local development state: Sled database + per-user data directories.
# Keeps bundled catalog data under data/common (re-synced from repo data/common).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend-service-rust"

# Honour backend config.env when present (paths relative to backend-service-rust).
if [ -f "${BACKEND_DIR}/config.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${BACKEND_DIR}/config.env"
  set +a
fi

DATA_DIR="${BACKEND_DIR}/${DATA_DIR_PATH:-data}"
DATABASE_PATH="${BACKEND_DIR}/${DATABASE_URL:-data/sled_db}"

POPULATE="${POPULATE:-0}"

echo "==> Stopping local dev servers..."
"${ROOT_DIR}/scripts/reset-local-dev-kill.sh"

rm_path() {
  local path="$1"
  local label="$2"
  if [ -e "${path}" ]; then
    rm -rf "${path}"
    echo "    removed ${label}: ${path}"
  else
    echo "    ${label}: not present (${path})"
  fi
}

echo "==> Wiping local database..."
rm_path "${DATABASE_PATH}" "Sled DB"

echo "==> Removing user file trees..."
rm_path "${DATA_DIR}/users" "users/"
rm_path "${DATA_DIR}/deleted_users" "deleted_users/"

echo "==> Removing dev log artifacts..."
rm_path "${DATA_DIR}/frontend_failure_reports.log" "frontend_failure_reports.log"
rm_path "${BACKEND_DIR}/application.log" "application.log"

echo "==> Re-syncing bundled common data (data/common)..."
"${ROOT_DIR}/scripts/load-dev-data.sh"

if [ "${POPULATE}" = "1" ]; then
  echo "==> Registering seed users (task populate)..."
  bash "${ROOT_DIR}/scripts/populate-seed-users.sh" || {
    echo "ERROR: populate failed"
    exit 1
  }
  echo "    Seed users registered (user1@example.com … user30@example.com)"
fi

echo ""
echo "==> Local dev reset complete."
echo "    Next: task dev"
if [ "${POPULATE}" != "1" ]; then
  echo "    Optional: task populate"
  echo "    Or:       task reset POPULATE=1"
fi
