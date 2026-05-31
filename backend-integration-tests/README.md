# Backend Integration Tests

Integration test suite for the carpaintr / Autolab backend API, using **pytest**, **httpx**, and **uv** (same layout as `consensual_family/itests-py`).

## Quick Start

```bash
# From repo root — starts backend if needed, runs tests, tears down
task itests

# Or manually (backend must be on :8080)
cd backend-integration-tests
uv sync
uv run pytest -v
```

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | ≥ 3.11 |
| [uv](https://docs.astral.sh/uv/) | recent |
| Backend | `http://localhost:8080` (or use `task itests`) |

Admin tests expect `test_admin@example.com` in `backend-service-rust/admins.txt` (already listed there).

## Commands

From `backend-integration-tests/`:

```bash
task sync           # uv sync (cached via .uv-sync.stamp)
task test           # all tests (4 workers via pytest-xdist)
task test:auth      # -m auth
task test:admin     # -m admin
task test:license   # -m license
task test:serial    # single process (debugging)
task test:cov       # coverage (serial)
task check-backend  # curl health endpoint
```

From repo root:

```bash
task itests         # full orchestration
task test           # pytest only (backend must already run)
task test:auth
task test:cov
```

## Project Layout

```
backend-integration-tests/
├── pyproject.toml      # deps + pytest config
├── uv.lock             # pinned versions (commit this)
├── Taskfile.yml
├── .env.example
├── tests/
│   ├── README.md
│   ├── conftest.py     # fixtures
│   ├── helpers.py
│   ├── test_health.py
│   ├── test_auth.py
│   ├── test_license.py
│   └── test_license_protection.py
└── docs/               # detailed guides
```

## Writing Tests

```python
import pytest

@pytest.mark.integration
async def test_my_endpoint(authenticated_client):
    response = await authenticated_client.get("/user/some_endpoint")
    assert response.status_code == 200
```

See [tests/README.md](tests/README.md) and [docs/fixtures.md](docs/fixtures.md).
