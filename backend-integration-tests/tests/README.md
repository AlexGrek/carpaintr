# Integration Tests — carpaintr backend

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | ≥ 3.11 | |
| [uv](https://docs.astral.sh/uv/) | any recent | `curl -LsSf https://astral.sh/uv/install.sh \| sh` or `brew install uv` |
| [task](https://taskfile.dev) | any recent | optional; `brew install go-task` |
| Rust / cargo | stable | needed when `task itests` starts the backend for you |

## Setup

Install Python dependencies (run once from `backend-integration-tests/`):

```sh
cd backend-integration-tests
uv sync
```

## Running the Tests

### Option A — full flow (recommended)

From the repo root, `task itests` syncs Python deps, starts the backend if it is not already listening on `:8080`, runs pytest, then stops a backend it started.

```sh
task itests
```

### Option B — backend already running

```sh
# Terminal 1 (repo root)
task backend

# Terminal 2
cd backend-integration-tests
uv run pytest -v
```

Single file:

```sh
uv run pytest tests/test_auth.py -v
```

## Environment Variables

All variables are optional — defaults work for a standard local setup.

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | Origin of the API (no path suffix) |
| `API_BASE_PATH` | `/api/v1` | API prefix prepended to httpx client `base_url` |
| `REQUEST_TIMEOUT` | `30` | HTTP timeout in seconds |
| `TEST_USER_EMAIL` | `test_user@example.com` | Fixture user email |
| `TEST_USER_PASSWORD` | `testpassword123` | Fixture user password |
| `TEST_ADMIN_EMAIL` | `test_admin@example.com` | Admin fixture email (must be in `backend-service-rust/admins.txt`) |
| `TEST_ADMIN_PASSWORD` | `adminpassword123` | Admin fixture password |

## Test Files

| File | Coverage |
|------|----------|
| `test_health.py` | `GET /api/v1/health` |
| `test_auth.py` | Register, login, admin check, JWT on protected routes |
| `test_license.py` | Admin license generate / invalidate |
| `test_license_protection.py` | License middleware on user routes |
| `test_pdf_generation.py` | PDF/HTML output via PDF mock (`pdfgen_mock.py`) |
| `test_seeded_users.py` | Seed user pool login and idempotent registration |

## Markers

```sh
uv run pytest -m auth
uv run pytest -m admin
uv run pytest -m license
uv run pytest -m pdf
```

PDF tests need the mock service. From repo root, `task itests` starts `tests/pdfgen_mock.py` and sets `PDF_GEN_URL_POST` on the backend automatically.

## Seed users

1. Bootstrap admin: `admin@admin.com` / `admin123` (in `backend-service-rust/admins.txt`)
2. Seed users `user1@example.com` … `user30@example.com` / `test1` … `test30` via **`POST /admin/users/bulk`** (one request)
3. **Licenses** — issued only for users **newly created** in that run (365 days, `premium`); existing users are skipped

Created automatically before tests (`tests/seed_users.py` autouse fixture).

```sh
task populate              # from repo root (starts backend if needed)
task populate:licenses     # force licenses for bootstrap admin + all 30 seed users
```
