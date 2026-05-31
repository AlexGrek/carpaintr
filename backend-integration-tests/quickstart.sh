#!/bin/bash
set -e

echo "========================================"
echo "Backend Integration Tests - Quick Start"
echo "========================================"
echo ""

if ! command -v uv &> /dev/null; then
    echo "uv is not installed."
    echo "Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "Installing Python dependencies (uv sync)..."
uv sync
echo ""

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

echo "Checking backend..."
if curl -sf http://localhost:8080/api/v1/health > /dev/null; then
    echo "Backend is running at http://localhost:8080"
else
    echo "Backend is NOT running. From repo root:"
    echo "  task itests     # start backend, run tests, stop"
    echo "  task backend    # dev server only"
fi
echo ""
echo "Run tests:"
echo "  uv run pytest -v"
echo "  task test"
echo "From repo root: task itests"
