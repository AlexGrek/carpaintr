# Shared helpers for local dev stack scripts.
# Requires bash 3.2+ (macOS default bash, Linux). Invoke via `task` or `bash script.sh`, not `zsh script.sh`.
#
# shellcheck shell=bash

_carpaintr_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CARPAINTR_ROOT="$(cd "${_carpaintr_lib_dir}/../.." && pwd)"
CARPAINTR_BACKEND_DIR="${CARPAINTR_ROOT}/backend-service-rust"
CARPAINTR_FRONTEND_DIR="${CARPAINTR_ROOT}/carpaintr-front"

export BACKEND_PORT="${BACKEND_PORT:-8080}"
export FRONTEND_PORT="${FRONTEND_PORT:-3000}"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:${FRONTEND_PORT}}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://localhost:${BACKEND_PORT}/api/v1/health}"

CARPAINTR_API_LOG="${CARPAINTR_API_LOG:-/tmp/carpaintr-api.log}"
CARPAINTR_FRONTEND_LOG="${CARPAINTR_FRONTEND_LOG:-/tmp/carpaintr-frontend.log}"
CARPAINTR_API_PID_FILE="${CARPAINTR_API_PID_FILE:-/tmp/carpaintr-api.pid}"
CARPAINTR_FRONTEND_PID_FILE="${CARPAINTR_FRONTEND_PID_FILE:-/tmp/carpaintr-frontend.pid}"

carpaintr_http_up() {
  curl -sf "$1" > /dev/null 2>&1
}

carpaintr_backend_up() {
  carpaintr_http_up "$BACKEND_HEALTH_URL"
}

carpaintr_frontend_up() {
  carpaintr_http_up "$FRONTEND_URL/"
}

# Portable wait loop (no reliance on seq).
carpaintr_wait_for() {
  local check_name=$1
  local max_seconds=${2:-60}
  local check_fn=$3
  local i=0

  echo -n "    Waiting for ${check_name}"
  while [ "$i" -lt "$max_seconds" ]; do
    if "$check_fn"; then
      echo " ready"
      return 0
    fi
    printf "."
    sleep 1
    i=$((i + 1))
  done
  echo ""
  return 1
}

carpaintr_read_pid_file() {
  local pid_file=$1
  if [ ! -f "$pid_file" ]; then
    return 1
  fi
  local pid
  pid="$(tr -d '[:space:]' < "$pid_file" 2>/dev/null || true)"
  if [ -z "${pid}" ]; then
    return 1
  fi
  printf '%s' "$pid"
}

carpaintr_stop_pid_file() {
  local pid
  pid="$(carpaintr_read_pid_file "$1" 2>/dev/null || true)"
  if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    if command -v pkill >/dev/null 2>&1; then
      pkill -P "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$1"
}

carpaintr_start_backend() {
  echo "==> Building backend..."
  (cd "$CARPAINTR_BACKEND_DIR" && cargo build -q)

  echo "==> Starting backend on :${BACKEND_PORT}..."
  (
    cd "$CARPAINTR_BACKEND_DIR" || exit 1
    exec env PORT="$BACKEND_PORT" cargo run >"$CARPAINTR_API_LOG" 2>&1
  ) &
  local pid=$!
  echo "$pid" > "$CARPAINTR_API_PID_FILE"
  printf '%s' "$pid"
}

carpaintr_start_frontend() {
  echo "==> Starting frontend on :${FRONTEND_PORT}..."
  (
    cd "$CARPAINTR_FRONTEND_DIR" || exit 1
    exec env FRONTEND_PORT="$FRONTEND_PORT" BACKEND_PORT="$BACKEND_PORT" npm run dev >"$CARPAINTR_FRONTEND_LOG" 2>&1
  ) &
  local pid=$!
  echo "$pid" > "$CARPAINTR_FRONTEND_PID_FILE"
  printf '%s' "$pid"
}

carpaintr_ensure_frontend_deps() {
  if [ ! -d "${CARPAINTR_FRONTEND_DIR}/node_modules" ]; then
    echo "    Installing npm packages..."
    (cd "$CARPAINTR_FRONTEND_DIR" && npm install)
  else
    echo "    node_modules present"
  fi
}
