# Setup Guide

## Prerequisites

- Python 3.11 or higher
- [uv](https://github.com/astral-sh/uv) package manager
- Backend service running at `http://localhost:8080` (or configured URL)

## Installation

### Install uv (if not already installed)

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via pip
pip install uv
```

### Setup the test environment

```bash
cd backend-integration-tests

# Quick setup with Taskfile
task setup
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Or manual setup
uv venv
uv pip install -e ".[dev]"
```

## Configuration

Copy `.env.example` to `.env` and adjust settings if needed:

```bash
cp .env.example .env
```

### Configuration Options

- `BACKEND_BASE_URL`: Base URL of the backend service (default: `http://localhost:8080`)
- `TEST_USER_EMAIL`: Email for test user (default: `test_user@example.com`)
- `TEST_USER_PASSWORD`: Password for test user (default: `testpassword123`)
- `TEST_ADMIN_EMAIL`: Email for test admin (default: `test_admin@example.com`)
- `TEST_ADMIN_PASSWORD`: Password for test admin (default: `adminpassword123`)
- `REQUEST_TIMEOUT`: Request timeout in seconds (default: `30`)

**Important:** The test admin email (`test_admin@example.com`) has been added to `backend-service-rust/admins.txt` to ensure admin status.

## Running Tests

### Start the backend service first

```bash
# From the project root
task backend
# or
cd backend-service-rust && cargo run
```

### Check if backend is running

```bash
task check-backend
```

### Run all tests

```bash
task test
# or directly
pytest -v
```

### Run specific test categories

```bash
# Authentication tests only
task test:auth

# Admin tests only
task test:admin

# Integration tests
task test:integration

# Or with pytest directly
pytest -m auth
pytest -m admin
pytest -m integration
```

### Run specific test file

```bash
pytest tests/test_auth.py
```

### Run with coverage

```bash
task test:cov
# or
pytest --cov=tests --cov-report=html
```

### Run tests in parallel

```bash
task test:fast
# or
pytest -n auto
```

### Other useful commands

```bash
task --list           # Show all available tasks
task clean            # Clean up generated files
task clean:all        # Clean everything including venv
```

## Auto-Setup Behavior

The test tasks automatically run setup if needed:
- Checks if `uv` is installed (shows helpful error if not)
- Creates virtual environment if missing
- Installs dependencies if not present
- Skips setup if already configured (idempotent)

This means you can run `task test` immediately after cloning the repo!
