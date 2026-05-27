#!/usr/bin/env bash
# Sync bundled app data into the local dev data directory (same layout as entrypoint.sh).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${ROOT_DIR}/data/common"
TARGET="${ROOT_DIR}/backend-service-rust/data/common"

if [ ! -d "${SOURCE}" ]; then
  echo "Error: source directory not found: ${SOURCE}"
  exit 1
fi

mkdir -p "${TARGET}"
echo "Syncing app data:"
echo "  from: ${SOURCE}/"
echo "  to:   ${TARGET}/"

rsync -avu "${SOURCE}/" "${TARGET}/"

echo "Done. Dev backend reads DATA_DIR_PATH=data → backend-service-rust/data/"
