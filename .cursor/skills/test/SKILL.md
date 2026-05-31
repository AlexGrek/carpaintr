---
name: test
description: >-
  Testing for carpaintr — Cypress E2E (carpaintr-front, real API) and backend API
  integration tests (pytest + httpx in backend-integration-tests/). Use when writing
  or running E2E tests, API tests, seed users, task cypress / task itests / task populate,
  debugging failures, or working with the PDF generation mock. Load project `frontend`
  skill for component patterns; this skill owns how to test and run tests.
---

# Testing (carpaintr)

Two complementary layers:

| Layer | Tooling | Location | Best for |
|-------|---------|----------|----------|
| **E2E (browser)** | Cypress | `carpaintr-front/cypress/` | Full UI flows, routing, RSuite widgets, `data-testid` |
| **API (HTTP)** | pytest + httpx + uv | `backend-integration-tests/tests/` | Auth, licenses, admin, PDF pipeline, fast regression |

Both hit the **real Axum backend** on `:8080` (no `cy.intercept` mocks for happy paths). Cypress also needs Vite on `:3000`.

For component implementation and `data-testid` conventions, load the project **`frontend`** skill. This skill owns **how to run tests** and **how to write them**.

---

## Local stack

| Service | URL | Notes |
|---------|-----|--------|
| Frontend (Vite) | `http://localhost:3000` | Cypress `baseUrl`; proxies `/api` → backend |
| Backend (Axum) | `http://localhost:8080` | Health: `GET /api/v1/health` |
| PDF mock (itests only) | dynamic `127.0.0.1:*` | Stub for `pdf_backend`; not used by Cypress |

`vite.config.js` sets `server.port: 3000`. Older docs may mention `:5173`; Cypress and `ensure-dev` use **:3000**.

---

## Task commands (repo root)

Run from the carpaintr repo root.

### E2E (Cypress)

| Task | Purpose |
|------|---------|
| **`task cypress`** | **Primary E2E:** start missing backend/frontend, `populate` + `populate:licenses`, `npm run cypress:run`, stop only services this run started |
| `task check-dev` | Verify `:8080` + `:3000` respond |
| `task ensure-dev` | Start missing services; leave them running |
| `task kill-dev` | Kill stale `:8080`, `:3000`, `:5173`, cargo-watch |
| `task dev` | Full dev (`dev-watch.sh`) |

### API (pytest)

| Task | Purpose |
|------|---------|
| **`task itests`** | **Primary API entry:** `uv sync`, start **PDF mock**, start backend with `PDF_GEN_URL_POST` if needed, pytest (4 workers), teardown mock/backend it started |
| `task test` | pytest only — **backend must already be on :8080** (no mock orchestration) |
| `task test:auth` / `test:admin` / `test:cov` | Filtered or coverage runs (delegate to `backend-integration-tests/`) |
| `task test:check` | `curl` health on `:8080` |

### Seed data (shared by Cypress + pytest)

| Task | Purpose |
|------|---------|
| **`task populate`** | Bootstrap admin + bulk-create `user1…user30`; **starts backend if needed**; licenses **bootstrap admin** + newly created seed users |
| **`task populate:licenses`** | Force 365d `premium` licenses for bootstrap admin + all 30 seed users; starts backend if needed |
| `task reset` | Wipe Sled DB + user files; re-sync `data/common` |
| `task reset POPULATE=1` | Reset + `task populate` |

**Prerequisites:** Node/npm + `task` (Cypress); Python 3.11+ + [uv](https://docs.astral.sh/uv/) + Rust/cargo when scripts must build/start the backend.

**npm (from `carpaintr-front/`):**

| Script | Command |
|--------|---------|
| Headless CI-style | `npm run cypress:run` |
| Interactive | `npm run cypress:open` |
| Single spec | `npm run test:e2e` → `main-path.cy.js` |

**pytest (from `backend-integration-tests/` after `uv sync`):**

```bash
uv run pytest -v                          # all (needs backend on :8080)
uv run pytest tests/test_auth.py -v       # one file
uv run pytest -m auth -v                  # marker
uv run pytest -m pdf -v                   # PDF tests (need mock — use task itests)
uv run pytest -n 0 -v tests/test_foo.py  # single process (debug)
```

Or from repo root: `task itests` (full stack) / `task test` (pytest only).

---

## Seed users & licenses

Defined in `backend-integration-tests/tests/seed_users.py`:

| Account | Credentials | Role |
|---------|-------------|------|
| Bootstrap admin | `admin@admin.com` / `admin123` | In `backend-service-rust/admins.txt`; used for bulk user create |
| Seed pool | `user{N}@example.com` / `test{N}` (`N` = 1…30) | E2E login pool, `seed_user` fixture |
| Pytest fixtures | `test_user@example.com`, `test_admin@example.com` | Ephemeral register/login per test file |

Bulk create: `POST /api/v1/admin/users/bulk` (after admin login).

**License middleware** blocks many `/api/v1/user/*` routes without a license → frontend redirects to `/app/license`.

For Cypress on a fresh DB:

```bash
task populate
task populate:licenses   # task cypress runs both automatically
```

**pytest:** session autouse fixture `seeded_users` calls the same `ensure_all_seed_users_sync()` before tests (with `license_on_create=True` for new users only).

Cypress credentials: `cypress.env.json` (from `cypress.env.example.json`) or `E2E_SEEDED_USER_INDEX`, `E2E_EMAIL`, `E2E_PASSWORD`.

---

## API integration tests (pytest + httpx)

### Layout

```
backend-integration-tests/
├── pyproject.toml          # deps, pytest markers, xdist (-n 4)
├── uv.lock                 # commit this
├── Taskfile.yml            # sync, test, populate (python-only if backend up)
├── tests/
│   ├── conftest.py         # fixtures (clients, tokens, pdfgen, seeded_users)
│   ├── helpers.py          # register_user, login_user, bearer_headers
│   ├── seed_users.py       # populate logic (shared with task populate)
│   ├── populate_users.py   # CLI: python -m tests.populate_users
│   ├── populate_licenses.py
│   ├── pdfgen_mock.py      # HTTP mock + PdfGenMockServer/Client
│   ├── run_pdfgen_mock.py  # daemon for task itests
│   ├── test_health.py
│   ├── test_auth.py
│   ├── test_license.py
│   ├── test_license_protection.py
│   ├── test_pdf_generation.py
│   ├── test_seeded_users.py
│   └── README.md
```

Docs: `backend-integration-tests/README.md`, `tests/README.md`, `docs/api.md` for endpoint shapes.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | API origin (no path) |
| `API_BASE_PATH` | `/api/v1` | Prepended to httpx `base_url` |
| `REQUEST_TIMEOUT` | `30` | Seconds |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | `test_user@example.com` / `testpassword123` | `authenticated_client` |
| `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` | `test_admin@example.com` / `adminpassword123` | Must be in `admins.txt` |
| `PDFGEN_MOCK_URL` | (from mock daemon) | Mock base, e.g. `http://127.0.0.1:PORT` |
| `PDF_GEN_URL_POST` | `{PDFGEN_MOCK_URL}/generate` | Set on **backend** when `task itests` starts it |
| `CARPAINTR_ITEST_SKIP_PDF` | `1` if backend was already up | PDF tests skipped via `pdfgen_mock_configured` |

### Auth flow (matches production)

1. `POST /register` → `200` empty body (no token)
2. `POST /login` → `200` `{"token": "..."}`
3. Protected routes: `Authorization: Bearer <token>`

### Key fixtures (`conftest.py`)

| Fixture | Scope | Use |
|---------|-------|-----|
| `http_client` | function | Unauthenticated async httpx |
| `authenticated_client` | function | JWT for `TEST_USER_*` |
| `admin_authenticated_client` | function | JWT for `TEST_ADMIN_*` |
| `generate_license` | function | Async helper: `await generate_license(email, days=90, level="premium")` |
| `seeded_users` | session, autouse | Ensures `user1…user30` exist |
| `seed_user` / `seed_user_token` / `seed_authenticated_client` | function | First seed user |
| `pdfgen_mock` | session | Talks to daemon or in-process `PdfGenMockServer` |
| `pdfgen_mock_configured` | session | Skips `@pytest.mark.pdf` if `CARPAINTR_ITEST_SKIP_PDF=1` |
| `backend_health_check` | session | Fails fast if `:8080` down |

### Pytest markers

```ini
auth, admin, license, pdf, integration
```

Register new markers in `pyproject.toml` if you add categories.

### Writing a new API test

1. Add `tests/test_<feature>.py`.
2. Use `pytest.mark.integration` (and `auth` / `license` / `pdf` as appropriate).
3. Prefer existing fixtures over raw register/login unless you need an isolated user.

```python
import pytest

@pytest.mark.integration
async def test_my_endpoint(authenticated_client):
    response = await authenticated_client.get("/user/some_endpoint")
    assert response.status_code == 200
    assert "expected_field" in response.json()
```

**Licensed user routes** (e.g. calc, PDF):

```python
@pytest.mark.integration
async def test_needs_license(authenticated_client, generate_license, test_user_credentials):
    email = test_user_credentials["email"]
    await generate_license(email, days=365, level="premium")
    response = await authenticated_client.get("/user/carmakes")
    assert response.status_code == 200
```

**Unique user** (avoid pollution from prior license tests):

```python
import uuid
from .helpers import login_user, register_user

@pytest.mark.integration
async def test_fresh_user(http_client):
    email = f"itest-{uuid.uuid4().hex[:12]}@example.com"
    password = "testpass123"
    await register_user(http_client, email, password)
    token = await login_user(http_client, email, password)
    assert token
```

**Admin-only:**

```python
async def test_admin_only(admin_authenticated_client):
    response = await admin_authenticated_client.post(
        "/admin/license/generate",
        json={"email": "user@example.com", "days": 30},
    )
    assert response.status_code == 200
```

4. Run: `task itests` (full) or `task backend` + `cd backend-integration-tests && uv run pytest tests/test_<feature>.py -v`.

### When to add Cypress vs pytest

| Prefer pytest | Prefer Cypress |
|---------------|----------------|
| Status codes, JWT, admin APIs | Multi-step wizard, URL routing |
| License middleware edge cases | RSuite pickers, mobile layout |
| PDF/HTML bytes and mock request log | `data-testid` regression |
| Fast CI signal on API contracts | Login → dashboard → calc happy path |

Often both: pytest locks the API; Cypress locks the UI wiring.

---

## PDF generation mock

The real PDF service (`pdf_backend_playwright/`) is **not** required locally for integration tests. `task itests` starts a lightweight Python HTTP server that stubs what the Rust backend calls via `PDF_GEN_URL_POST`.

### How it is wired

1. `task itests` runs `uv run python -m tests.run_pdfgen_mock` (background).
2. Writes `/tmp/carpaintr-pdfgen-mock.url` → value like `http://127.0.0.1:<port>/generate`.
3. Starts backend with `PDF_GEN_URL_POST=<that url>` so Rust posts to `{PDF_GEN_URL_POST}/pdf` and `.../html`.
4. Exports `PDFGEN_MOCK_URL` for pytest (`pdfgen_mock` fixture reads env or temp files).
5. On teardown, kills mock if this run started it.

If **backend was already running** on `:8080` before `task itests`, it sets `CARPAINTR_ITEST_SKIP_PDF=1` and **PDF-marked tests are skipped** (backend lacks mock URL). Fix: stop backend, run `task itests` only.

Manual mock (debug):

```bash
cd backend-integration-tests
uv run python -m tests.run_pdfgen_mock   # prints PDF_GEN_URL_POST, writes /tmp/carpaintr-pdfgen-mock.*
# In another terminal, start backend with that URL:
cd backend-service-rust
PDF_GEN_URL_POST="$(cat /tmp/carpaintr-pdfgen-mock.url)" cargo run
```

### Mock endpoints (`tests/pdfgen_mock.py`)

| Method | Path | Response |
|--------|------|----------|
| `POST` | `/generate/pdf` | Minimal valid `%PDF` bytes |
| `POST` | `/generate/html` | Stub HTML document |
| `GET` | `/health` | `{"status": "healthy", ...}` |
| `GET` | `/_mock/requests` | JSON list of recorded backend calls |
| `POST` | `/_mock/reset` | Clear request log |

### Testing PDF from pytest

Mark tests with `@pytest.mark.pdf` and use fixture `pdfgen_mock_configured` (via `pytestmark` on the module or class).

Example pattern (`test_pdf_generation.py`):

```python
async def test_generate_pdf(licensed_authenticated_client, pdfgen_mock):
    pdfgen_mock.reset_requests()
    response = await licensed_authenticated_client.post(
        "/user/generate_pdf_table",
        json={"calculation": {"identifier": "ITEST-001"}, "metadata": {}},
    )
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    requests = pdfgen_mock.fetch_requests()
    assert any(r["path"] == "/generate/pdf" for r in requests)
```

User endpoints under test: `POST /user/generate_pdf_table`, `POST /user/generate_html_table` (require license + mock reachable from backend).

---

## Cypress E2E

### Policies

1. **Real API only** — no `cy.intercept` mocks for happy-path flows.
2. **`cy.clearLocalStorage()`** in `beforeEach` — JWT in localStorage.
3. Prefer **`cy.getByTestId(...)`** over CSS/text selectors.
4. **20s timeouts** on lazy routes, YAML fetches, wizard transitions.
5. Assert **enabled** before clicking stage Accept buttons.

### Layout

```
carpaintr-front/
├── cypress.config.js
├── cypress/e2e/
│   ├── main-path.cy.js
│   ├── public-routes.cy.js
│   ├── authenticated-routes.cy.js
│   ├── dashboard-apps.cy.js
│   └── catalog-tabs.cy.js
├── cypress/support/
│   ├── commands.js       # getByTestId, loginAsSeedUser, …
│   └── app-routes.js     # route → testid registry
└── cypress/README.md
```

### Specs

| File | Coverage |
|------|----------|
| `main-path.cy.js` | Full calc wizard data input |
| `public-routes.cy.js` | `/`, login, register, landing auth links |
| `authenticated-routes.cy.js` | Direct visit each `/app/*` route + 404 |
| `dashboard-apps.cy.js` | Dashboard app cards + license marker |
| `catalog-tabs.cy.js` | Catalog tab switching |

### Custom commands

| Command | Behavior |
|---------|----------|
| `cy.getByTestId(id, options?)` | `[data-testid="id"]` |
| `cy.loginAsSeedUser(index?)` | UI login → `/app/dashboard` |
| `cy.visitAppRoute(path, pageTestId)` | Visit + assert testid, not on login |
| `cy.openNewCalculation()` | `calc-main-create-new-button` → `calc-car-select-stage` |
| `cy.ensureVehicleClassPickerMode()` | class picker mode for vehicle stage |

### Main path (`main-path.cy.js`)

`login` → `dashboard` → `calc2` → new calculation → car (class, body, year) → color + paint type → body part → final stage.

**RSuite:** year uses `.rs-picker-select-menu-item` (no testid on menu items).

Full calc/login/dashboard testid inventory: [test-ids.md](test-ids.md).

---

## Debugging

### Cypress

1. Screenshots: `carpaintr-front/cypress/screenshots/`
2. Videos: `carpaintr-front/cypress/videos/`
3. Stuck on `/app/license` → `task populate:licenses`
4. Backend logs: `/tmp/carpaintr-api.log` when started by scripts

| Symptom | Fix |
|---------|-----|
| `calc-car-select-stage` missing | Licenses; confirm create card click |
| Color Accept disabled | Click a `[data-testid*="-color-"]` tile, not `-container` |
| 403 in command log | `task populate:licenses` |

### pytest

1. `task test:check` or `curl -sf http://localhost:8080/api/v1/health`
2. PDF tests skipped → stop existing backend; use `task itests`
3. PDF mock log: `/tmp/carpaintr-pdfgen-mock.log`
4. Backend log: `/tmp/carpaintr-api.log` (when started by `task itests`)
5. Single-worker debug: `uv run pytest -n 0 -v --tb=long tests/test_foo.py`

| Symptom | Fix |
|---------|-----|
| `Backend server is not running` | `task backend` or `task itests` |
| PDF tests skipped message | Restart with `task itests` (not pre-running backend) |
| 409 / login failed on fixture user | DB state; `task reset POPULATE=1` |
| xdist flake on shared resource | Use `-n 0` or unique users per test |

---

## Adding tests (checklist)

### New Cypress spec

1. `carpaintr-front/cypress/e2e/your-flow.cy.js`
2. Reuse `getByTestId` + shared commands
3. Add `data-testid` in the same PR ([test-ids.md](test-ids.md))
4. `task cypress` or `npm run cypress:run -- --spec cypress/e2e/your-flow.cy.js`

### New pytest module

1. `backend-integration-tests/tests/test_<name>.py`
2. Markers + fixtures from table above
3. For PDF: `@pytest.mark.pdf` + `pdfgen_mock`; run under `task itests`
4. Document non-obvious endpoints in `docs/api.md` if new public API

### Lint (frontend, pre-commit)

```bash
cd carpaintr-front && npm run lint && npm run lint:fix
```

---

## Related scripts

| Script | Role |
|--------|------|
| `scripts/cypress-e2e.sh` | Backend/frontend ensure + `task populate` + Cypress |
| `scripts/populate-seed-users.sh` | Backend ensure + `populate_users` / `populate_licenses` |
| `scripts/lib/dev-stack-common.sh` | `carpaintr_start_backend`, health wait, PID files |

---

**Last updated:** 2026-05-27  
**Scope:** E2E (`carpaintr-front`) + API (`backend-integration-tests`)
