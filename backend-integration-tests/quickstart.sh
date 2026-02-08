#!/bin/bash
set -e

echo "========================================"
echo "Backend Integration Tests - Quick Start"
echo "========================================"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed."
    echo "Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✅ uv is installed"
echo ""

# Create virtual environment
echo "📦 Creating virtual environment..."
uv venv
echo "✅ Virtual environment created"
echo ""

# Activate virtual environment and install dependencies
echo "📥 Installing dependencies..."
source .venv/bin/activate
uv pip install -e ".[dev]"
echo "✅ Dependencies installed"
echo ""

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
else
    echo "ℹ️  .env already exists"
fi
echo ""

# Check if backend is running
echo "🔍 Checking if backend is running..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/login > /dev/null 2>&1; then
    echo "✅ Backend is running at http://localhost:8080"
else
    echo "⚠️  Backend is NOT running at http://localhost:8080"
    echo ""
    echo "Please start the backend with:"
    echo "  cd ../backend-service-rust && cargo run"
    echo ""
    echo "Or from project root:"
    echo "  task backend"
fi
echo ""

echo "========================================"
echo "✨ Setup complete!"
echo "========================================"
echo ""
echo "To activate the environment:"
echo "  source .venv/bin/activate"
echo ""
echo "To run tests:"
echo "  task test          # Run all tests"
echo "  task test:auth     # Run auth tests only"
echo "  task test:cov      # Run with coverage"
echo ""
echo "Or directly with pytest:"
echo "  pytest -v"
echo "  pytest -m auth"
echo ""
echo "For more commands, run: task --list"
echo ""
