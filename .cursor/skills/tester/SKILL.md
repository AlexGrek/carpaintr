---
name: tester
description: >-
  Cypress E2E testing for carpaintr — run specs, set up local dev stack, check/kill
  ports, PDF mock, k8s dev deployment access, and write new browser tests. Use when
  running task cypress, writing Cypress specs, debugging E2E failures, or asking
  about local test prerequisites. For pytest API tests use the project `test` skill.
---

# Tester (Cypress E2E)

Cypress browser tests in `carpaintr-front/cypress/`. They hit the **real Axum backend** on `:8080` (no `cy.intercept` mocks on happy paths). Vite frontend on `:3000` proxies `/api` → backend.

For API integration tests (pytest), see [`.cursor/skills/test/SKILL.md`](../test/SKILL.md).

---

## Prerequisites

| Tool | Why |
|------|-----|
| Node.js + npm | Cypress, Vite |
| `task` ([go-task](https://taskfile.dev)) | `task cypress`, `task ensure-dev`, `task populate` |
| Rust + cargo | Scripts build/start backend if not running |
| kubectl + helm | Optional — dev cluster access only |

**Seed users:** `user{N}@example.com` / `test{N}` (`N`=1…30). Cypress defaults to `user1`. Licenses required for `/api/v1/user/*` — run `task populate:licenses` on fresh DB.

**Credentials:** `carpaintr-front/cypress.env.json` (from `cypress.env.example.json`) or env `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SEEDED_USER_INDEX`.

---

## Local stack

| Service | URL | Health check |
|---------|-----|--------------|
| Frontend (Vite) | `http://localhost:3000` | `curl -sf http://localhost:3000/` |
| Backend (Axum) | `http://localhost:8080` | `curl -sf http://localhost:8080/api/v1/health` |
| PDF mock (local only) | `http://localhost:5000` | Started by `task dev` or manually (see below) |

Logs when started by scripts: `/tmp/carpaintr-api.log`, `/tmp/carpaintr-frontend.log`.

---

## Before running tests: check ports

**Always verify the right process owns the ports.** Another app on `:8080` breaks Cypress (e.g. health returns HTML 404 instead of JSON).

```bash
# Quick check (repo root)
task check-dev

# Or manually
curl -sf http://localhost:8080/api/v1/health && echo " backend OK"
curl -sf -o /dev/null http://localhost:3000/ && echo " frontend OK"
lsof -i :8080 -i :3000 -i :5000 2>/dev/null | head -20
```

**If ports are wrong or stale:**

```bash
task kill-dev          # kills :8080, :3000, :5173, cargo-watch
# optional — also frees PDF mock port:
lsof -ti :5000 | xargs kill -9 2>/dev/null
pkill -f mock-pdf-server 2>/dev/null
```

Then start fresh:

```bash
task ensure-dev        # start backend + frontend, leave running
task populate
task populate:licenses
```

---

## Running Cypress

### Primary (recommended)

```bash
task cypress
```

From repo root. Script (`scripts/cypress-e2e.sh`): ensures deps → starts missing backend/frontend → `task populate` + `task populate:licenses` → `npm run cypress:run` → stops only services **it** started.

### Single spec / interactive

```bash
cd carpaintr-front
npm run cypress:run -- --spec cypress/e2e/collapse-tables.cy.js
npm run cypress:open
```

### PDF-heavy specs (`full-calc-to-pdf.cy.js`)

Backend defaults to `PDF_GEN_URL_POST=http://localhost:5000/generate`. Start the **local PDF mock** before Cypress if not using `task dev`:

```bash
python3 scripts/mock-pdf-server.py &   # :5000 — minimal %PDF + HTML stubs
```

`task dev` starts frontend + backend + this mock together (`scripts/dev-watch.sh`).

---

## PDF services (local vs cluster)

| Service | Local? | Notes |
|---------|--------|-------|
| **`scripts/mock-pdf-server.py`** | Yes | **Use this for Cypress and local dev.** Stubs `POST …/generate/pdf` and `…/html`. |
| **`backend-integration-tests/tests/pdfgen_mock.py`** | Yes | pytest `task itests` only — dynamic port, not Cypress. |
| **`pdf_backend_playwright/`** (real pdfgen) | **No** | Playwright/Chromium service deployed in k8s (`pdfgen` pod). **Do not try to run locally for E2E** — heavy deps, not wired into `task cypress`. |
| **`pdf_backend/`** (legacy WeasyPrint) | **No** | Deprecated; same story — cluster only. |

Real template rendering with Chromium runs on **dev/staging/prod clusters**, not on a typical laptop Cypress run.

---

## Dev deployment (k8s)

| Item | Value |
|------|-------|
| Namespace | `autolab-dev` |
| Helm release | `autolab-dev` |
| Public URL | `https://autolab-dev.alexgr.space` |
| API pod (StatefulSet) | `autolab-dev-autolab-api-0` |
| PDF pod | `deployment/autolab-pdfgen` in same namespace |
| Values file | `autolab-chart/autolab-chart/autolab/values-dev.yaml` |

**Common commands (repo root):**

```bash
task status ENV=dev              # helm status + pods
task status-all                  # dev / staging / prod overview
task deploy-dev                  # helm upgrade --install
task redeploy-dev                # build, push images, deploy
task restart ENV=dev             # rollout restart API + pdfgen

kubectl get pods -n autolab-dev
kubectl get ingress -n autolab-dev
kubectl logs -f autolab-dev-autolab-api-0 -n autolab-dev
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- wget -qO- http://localhost:8080/api/v1/health
```

Manual testing against dev: open `https://autolab-dev.alexgr.space` (not localhost). Cypress always targets **localhost:3000** unless you change `baseUrl`.

---

## Spec inventory

| File | Coverage |
|------|----------|
| `main-path.cy.js` | Calc2 wizard data entry |
| `full-calc-to-pdf.cy.js` | Calc2 → print drawer → HTML/PDF (needs PDF mock on :5000) |
| `collapse-tables.cy.js` | Final-stage collapse tables + read-only note |
| `public-routes.cy.js` | Marketing, login, register |
| `authenticated-routes.cy.js` | `/app/*` smoke |
| `dashboard-apps.cy.js` | Dashboard app cards |
| `catalog-tabs.cy.js` | Catalog tab switching |

---

## Custom commands (`cypress/support/commands.js`)

| Command | Purpose |
|---------|---------|
| `cy.getByTestId(id)` | `[data-testid="id"]` |
| `cy.ensureSeedUserLicensed()` | API register + admin license (`before` hook) |
| `cy.loginAsSeedUser(index?)` | UI login → dashboard |
| `cy.visitAppRoute(path, pageTestId)` | Visit + assert page marker |
| `cy.openNewCalculation()` | New calc → car-select stage |
| `cy.ensureVehicleClassPickerMode()` | Switch vehicle form to class picker |
| `cy.selectPartWithAction(partTestId)` | Diagram part + action in drawer |
| `cy.reachCalcFinalStage()` | Full wizard shortcut to final tables stage |
| `cy.setCollapseTables(checked)` | Toggle collapse-tables checkbox |

---

## Writing new tests

### Policies

1. **Real API** on happy paths — no intercept mocks except when asserting request payloads.
2. **`cy.getByTestId`** over CSS/text; add `data-testid` in the same PR.
3. **`cy.clearLocalStorage()`** handled by `loginAsSeedUser`; re-login in `beforeEach` if tests need isolation.
4. **20s timeouts** on lazy routes / wizard transitions.
5. Assert buttons **enabled** before clicking Accept.
6. **Locale-agnostic assertions** — prefer `data-testid` over English copy (`read-only` fails when UI is Ukrainian).

### Checklist

1. Add `carpaintr-front/cypress/e2e/<flow>.cy.js`
2. Reuse commands from `commands.js`
3. Add testids to components; document in [`.cursor/skills/test/test-ids.md`](../test/test-ids.md)
4. Run: `task cypress` or single `--spec`
5. RSuite: year picker uses `.rs-picker-select-menu-item`; checkboxes often need `.find('input').check({ force: true })`

### Source map (low-token lookup)

**Do not load full component files blindly.** Use [source-map.md](source-map.md) to find which file owns which `data-testid`, then read only that file.

Grep when unsure:

```bash
rg 'data-testid|dataTestId|testId' carpaintr-front/src --glob '*.jsx'
```

Route registry: `carpaintr-front/cypress/support/app-routes.js`.

---

## Debugging failures

| Symptom | Fix |
|---------|-----|
| Cypress can't reach `:3000` | `task ensure-dev` or `task kill-dev` then `task ensure-dev` |
| Health check fails / wrong response on `:8080` | `task kill-dev` — foreign process on port |
| Stuck on `/app/license` | `task populate:licenses` |
| Color Accept disabled | Click `calc-color-grid-*-color-*`, not `-container` |
| PDF spec fails | Start `python3 scripts/mock-pdf-server.py` on :5000 |
| Collapse checkbox doesn't toggle in UI | Ensure `StageView` `setStageData` supports functional updates |
| Screenshots / video | `carpaintr-front/cypress/screenshots/`, `cypress/videos/` |

---

## Related files

| Path | Role |
|------|------|
| `scripts/cypress-e2e.sh` | Full E2E orchestration |
| `scripts/ensure-dev-stack.sh` | Start backend + frontend |
| `scripts/reset-local-dev-kill.sh` | Port cleanup (`task kill-dev`) |
| `scripts/mock-pdf-server.py` | Local PDF/HTML stub |
| `scripts/lib/dev-stack-common.sh` | Health checks, PID files |
| `.cursor/skills/test/test-ids.md` | Full testid reference |
| `.cursor/skills/test/SKILL.md` | pytest + shared seed/PDF mock docs |
