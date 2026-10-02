#!/usr/bin/env bash
# Run backend integration tests: start PDF mock + backend if needed, run pytest, tear down.
# Invoked by `task itests`. Must run under real bash: Task's embedded shell has no working
# `kill` and `$!` is not a PID there, so started processes could never be stopped.
#
# Env: BACKEND_PORT (default 8080). Other backend env (DATABASE_URL, DATA_DIR_PATH, ...) is
# passed through to the backend process and takes precedence over config.env.

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ITESTS_DIR="${ROOT}/backend-integration-tests"
BACKEND_DIR="${ROOT}/backend-service-rust"

BACKEND_PORT="${BACKEND_PORT:-8080}"
BACKEND_HEALTH_URL="http://localhost:${BACKEND_PORT}/api/v1/health"

STARTED_BACKEND=0
STARTED_PDF_MOCK=0
REPLACED_EXISTING_BACKEND=0

cleanup() {
  if [ "$STARTED_BACKEND" = "1" ]; then
    echo "==> Stopping backend..."
    kill "$(cat /tmp/carpaintr-api.pid)" 2>/dev/null || true
    rm -f /tmp/carpaintr-api.pid
  fi
  if [ "$REPLACED_EXISTING_BACKEND" = "1" ]; then
    echo "==> Note: a previously running process on :${BACKEND_PORT} was replaced for this itest run."
  fi
  if [ "$STARTED_PDF_MOCK" = "1" ]; then
    echo "==> Stopping PDF mock..."
    kill "$(cat /tmp/carpaintr-pdfgen-mock.pid)" 2>/dev/null || true
    rm -f /tmp/carpaintr-pdfgen-mock.pid /tmp/carpaintr-pdfgen-mock.port /tmp/carpaintr-pdfgen-mock.url
  fi
}
trap cleanup EXIT

echo "==> Checking Python dependencies (backend-integration-tests)..."
if [ ! -f "${ITESTS_DIR}/.uv-sync.stamp" ] \
  || [ "${ITESTS_DIR}/uv.lock" -nt "${ITESTS_DIR}/.uv-sync.stamp" ] \
  || [ "${ITESTS_DIR}/pyproject.toml" -nt "${ITESTS_DIR}/.uv-sync.stamp" ]; then
  echo "    Syncing dependencies..."
  (cd "$ITESTS_DIR" && uv sync --frozen)
  touch "${ITESTS_DIR}/.uv-sync.stamp"
else
  echo "    Dependencies already synced (lockfile unchanged)"
fi

if ! [ -f /tmp/carpaintr-pdfgen-mock.pid ] \
  || ! kill -0 "$(cat /tmp/carpaintr-pdfgen-mock.pid)" 2>/dev/null; then
  echo "==> Starting PDF generation mock..."
  rm -f /tmp/carpaintr-pdfgen-mock.pid /tmp/carpaintr-pdfgen-mock.port /tmp/carpaintr-pdfgen-mock.url
  PDF_MOCK_LOG=/tmp/carpaintr-pdfgen-mock.log
  (cd "$ITESTS_DIR" && uv run python -m tests.run_pdfgen_mock > "$PDF_MOCK_LOG" 2>&1 &)
  for i in $(seq 1 30); do
    if [ -f /tmp/carpaintr-pdfgen-mock.url ]; then
      break
    fi
    sleep 0.2
  done
  if [ ! -f /tmp/carpaintr-pdfgen-mock.url ]; then
    echo "ERROR: PDF mock did not start. Log:"
    tail -20 "$PDF_MOCK_LOG" 2>/dev/null || true
    exit 1
  fi
  STARTED_PDF_MOCK=1
  export PDF_GEN_URL_POST="$(cat /tmp/carpaintr-pdfgen-mock.url)"
  export PDFGEN_MOCK_URL="${PDF_GEN_URL_POST%/generate}"
  echo "    PDF mock at $PDFGEN_MOCK_URL"
else
  echo "==> PDF mock already running"
  export PDF_GEN_URL_POST="$(cat /tmp/carpaintr-pdfgen-mock.url)"
  export PDFGEN_MOCK_URL="${PDF_GEN_URL_POST%/generate}"
fi

if curl -sf "$BACKEND_HEALTH_URL" > /dev/null 2>&1; then
  echo "==> Backend already running on :${BACKEND_PORT}"
  export CARPAINTR_ITEST_SKIP_PDF=1
  echo "    PDF output tests will be skipped (restart via task itests for full coverage)"
else
  echo "==> Building backend..."
  (cd "$BACKEND_DIR" && cargo build)

  for round in $(seq 1 40); do
    PIDS="$(lsof -ti TCP:${BACKEND_PORT} -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$PIDS" ] && break
    REPLACED_EXISTING_BACKEND=1
    if [ "$round" -eq 1 ]; then
      echo "==> Freeing port ${BACKEND_PORT} (pid(s): $(echo "$PIDS" | tr '\n' ' ' | sed 's/ $//'))..."
      for pid in $PIDS; do kill "$pid" 2>/dev/null || true; done
    else
      for pid in $PIDS; do kill -9 "$pid" 2>/dev/null || true; done
    fi
    sleep 0.2
  done

  echo "==> Starting backend on :${BACKEND_PORT} (PDF_GEN_URL_POST=$PDF_GEN_URL_POST)..."
  pushd "$BACKEND_DIR" > /dev/null
  # Run the built binary directly (not `cargo run`) so $! is the server PID and cleanup stops it.
  PORT="$BACKEND_PORT" PDF_GEN_URL_POST="$PDF_GEN_URL_POST" ./target/debug/rust-web-service > /tmp/carpaintr-api.log 2>&1 &
  echo $! > /tmp/carpaintr-api.pid
  popd > /dev/null
  STARTED_BACKEND=1

  echo -n "    Waiting for backend"
  for i in $(seq 1 60); do
    if curl -sf "$BACKEND_HEALTH_URL" > /dev/null 2>&1; then
      echo " ready"
      break
    fi
    printf "."
    sleep 1
  done

  if ! curl -sf "$BACKEND_HEALTH_URL" > /dev/null 2>&1; then
    echo ""
    echo "ERROR: backend did not start within 60s. Last logs:"
    tail -30 /tmp/carpaintr-api.log
    exit 1
  fi
fi

EXIT_CODE=0
(cd "$ITESTS_DIR" && BACKEND_BASE_URL="http://localhost:${BACKEND_PORT}" uv run pytest) || EXIT_CODE=$?

exit "$EXIT_CODE"
