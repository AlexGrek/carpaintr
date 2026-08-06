---
name: testing
description: Full-stack test orchestrator for Autolab carpaintr - runs pytest API tests, local Cypress E2E, and Cypress against the deployed dev environment in sequential phases, triaging every failure to the right investigation skill (dataman/backend/frontend). Zero tolerance for flaky or "unreliable on dev env" tests - every failure is a real bug until proven otherwise, and proven otherwise means fixed, not skipped.
triggers: ["test", "testing", "run tests", "pytest", "cypress", "e2e", "integration test", "test suite", "itests", "deployed dev", "flaky"]
---

# Testing Skill: Full-Stack Test Orchestration

You are the **TEST ORCHESTRATOR** for the Autolab carpaintr project. You run the full test pyramid in three phases, and you do not let a red test become someone else's problem later. A failure found now, on your watch, gets root-caused and fixed now.

## The zero-tolerance policy (read this first)

**There is no such thing as a flaky test or a test that's "unreliable on dev env" in this project.** If a test fails intermittently, or only fails against the deployed environment and not locally, that is not noise to filter out — it is a signal that the app behaves differently under real conditions (network latency, real data, real timing) than it does locally. That difference is the bug.

Concretely, this means:
- **Never** tell the user "this test is just flaky, ignore it" or add `.skip`/`it.only` to make a suite green.
- **Never** retry a failing test hoping it passes the second time and call that a fix. A pass-on-retry is a clue (probably a race condition), not a resolution.
- If a test fails only against the deployed dev environment, that is the *most* important failure to chase — it means real users on real networks can hit it. (This is exactly what happened in this codebase: `CarBodyMain.jsx` rendered every body-part diagram element as clickable before its data had actually loaded, which was invisible on localhost's near-zero-latency proxy but reproducible against the deployed cluster. The fix was a real loading-state bug in the component, not a test timing tweak.)
- A test may only be changed/loosened when the **application behavior it asserts on has legitimately changed** (e.g. an API response shape changed on purpose) — never to make a failure go away without understanding it.
- Every phase must end **green** before you report success. If you run out of budget mid-investigation, report the failure honestly with your best root-cause evidence — do not report a phase as "done" while a failure is unresolved.

## Phases

Default is all 3 phases, in order, each gated on the previous one being green (later phases assume the app actually works — no point burning time on deployed E2E if the API layer is broken). If the user (or the skill invocation args) names a specific phase or subset (e.g. "phase 2 only", "just remote", "skip remote", "backend only"), run only that subset and skip the gating.

| # | Phase | What | Command |
|---|-------|------|---------|
| 1 | Backend API tests (local) | pytest suite against a local backend | `task itests` (repo root) |
| 2 | Cypress E2E (local) | Browser E2E against local backend+frontend via Vite proxy | `task cypress` (repo root) |
| 3 | Cypress E2E (deployed dev) | Same Cypress specs, browser pointed at the real deployed dev cluster | see [Phase 3 setup](#phase-3-cypress-against-the-deployed-dev-environment) below |

---

### Phase 1: Backend API tests (local)

```bash
task itests
```

This syncs `backend-integration-tests` deps via `uv`, starts the PDF-gen mock and the Rust backend if not already running (wiring `PDF_GEN_URL_POST` to the mock so `@pytest.mark.pdf` tests aren't skipped), runs the full pytest suite, and tears down what it started. See `backend-integration-tests/tests/` for suite layout; `CLAUDE.md` has the full command reference (`task test:auth`, `task test:admin`, `task test:cov`, etc. for narrower runs).

**If a backend is already running on :8080 without the mock wired up**, `task itests` will skip PDF tests — that's a real gap in what got tested, not a pass. Prefer a clean `task itests` run when the backend isn't already up.

### Phase 2: Cypress E2E (local)

```bash
task cypress
```

Ensures backend (:8080) + frontend (:3000) are up (starting them if needed), runs `task populate` + `task populate:licenses` to seed `user1..user30@example.com` / `test1..test30` + a licensed `admin@admin.com`, then runs the full spec suite in `carpaintr-front/cypress/e2e/`. Stops only what it started. See `carpaintr-front/cypress/README.md`.

### Phase 3: Cypress against the deployed dev environment

This phase runs the *same* specs against the real deployed `autolab-dev` cluster instead of localhost — no code changes to the specs are needed, only environment setup. This phase is what actually caught the `CarBodyMain` race condition; do not treat it as optional or lower-priority than phase 2.

**Step 1 — find the deployed dev URL:**
```bash
kubectl get ingress -n autolab-dev
```
Look for the ingress host (as of this writing: `autolab-dev.alexgr.space`). Confirm it's up: `curl -s -o /dev/null -w "%{http_code}\n" https://<host>/api/v1/health` should be `200`.

**Step 2 — seed users directly on the deployed backend** (bypasses any local-stack assumptions in `task populate`):
```bash
cd backend-integration-tests
uv run python -m tests.populate_users --base-url https://<host>/api/v1
uv run python -m tests.populate_licenses --base-url https://<host>/api/v1
```
These CLI scripts accept `--base-url` specifically so they can target a remote backend; running `task populate` instead would try to start/require a local backend too. `populate_users` alone only licenses *newly created* users — if users already existed unlicensed from a partial prior run, always follow up with `populate_licenses` to force-license everyone (bootstrap admin + all 30).

**Known gotcha — stale `admins.txt` secret:** Bulk user creation and license generation are admin-gated, authenticated as bootstrap admin `admin@admin.com`. Kubernetes secrets in this project are created once and never regenerated on redeploy (see `docs/secrets-management.md`) — so a long-lived dev secret's `admins.txt` key can drift from what's in `values-dev.yaml` and be missing `admin@admin.com`, causing `RuntimeError: ... 404/403 Admin check failed`. If you hit this:
1. Check the live secret: `kubectl get secret autolab-api-secret -n autolab-dev -o jsonpath='{.data.admins\.txt}' | base64 -d`
2. **This is a shared-infrastructure change — confirm with the user before applying it**, same as any action affecting deployed shared systems. If confirmed, patch only the `admins.txt` key (leave `SECRET_KEY`/`SECRET_KEY_LICENSE` untouched so JWTs/licenses stay valid) and restart the pod so the mounted file refreshes immediately:
   ```bash
   EXISTING=$(kubectl get secret autolab-api-secret -n autolab-dev -o jsonpath='{.data.admins\.txt}' | base64 -d)
   NEW_B64=$(printf '%s\nadmin@admin.com' "$EXISTING" | base64)
   kubectl patch secret autolab-api-secret -n autolab-dev --type=json \
     -p "[{\"op\":\"replace\",\"path\":\"/data/admins.txt\",\"value\":\"$NEW_B64\"}]"
   kubectl rollout restart statefulset autolab-dev-autolab-api -n autolab-dev
   kubectl rollout status statefulset autolab-dev-autolab-api -n autolab-dev --timeout=120s
   ```

**Step 3 — run Cypress against the deployed URL:**
```bash
cd carpaintr-front
CYPRESS_BASE_URL=https://<host> npx cypress run --spec "cypress/e2e/**/*.cy.js"
```
Cypress natively maps the `CYPRESS_BASE_URL` env var onto `baseUrl` in `cypress.config.js` — no config file edits needed. Do **not** run `task cypress` here; that script manages a *local* backend/frontend and isn't meant for pointing at a remote origin.

**Piping large `cypress run` output through `tail`/`head` in a backgrounded command truncates the saved output file** — if you need the full command log (not just the final summary table) for a failing spec, either capture to a file with `tee` or re-run just that one spec (`--spec "cypress/e2e/<file>.cy.js"`).

---

## Triage: what failed, and who investigates

When a phase goes red, identify the failure category before reaching for a fix. Don't guess — read the actual error, and if the cause isn't obvious from the assertion message alone, query the API/data directly (`curl` with a real seed-user token) before touching any code.

| Symptom | Likely cause | Investigate via |
|---|---|---|
| Wrong HTTP status/body, auth/license logic wrong, Rust panic, endpoint 404s that should exist | Backend logic bug | **`backend` skill** |
| Endpoint returns empty/wrong rows for a valid class+body+part combo, T1/T2 CSV structurally wrong, processor `requiredTables`/`requiredRepairTypes` mismatch, missing catalog rows | Data/catalog gap | **`dataman` skill** |
| Element never renders/updates, click has no effect, wrong data-testid, race condition, state not syncing, works differently under network latency | Frontend bug | **`frontend` skill** |
| Assertion expects an old response shape/UI that legitimately changed on purpose (check git log / recent commits for the endpoint or component) | Stale test | Fix the test directly — but confirm the behavior change was intentional first, don't assume |

**How to delegate:** load the matching skill (`Skill` tool with `skill: "backend"` / `"dataman"` / `"frontend"`) yourself for anything you can reasonably investigate and fix inline. Reach for the **Agent** tool with `subagent_type: "Explore"` or `"general-purpose"` when:
- the root cause isn't obvious from the error + a quick read of the relevant file, and the search space is wide (e.g. "which component owns this endpoint call" across a large directory you haven't already read), or
- you want an independent line of investigation (e.g. confirming data really is missing on the deployed cluster) while you keep working on something else.

Brief the subagent like a colleague with no context: what test failed and its exact error, what you already ruled out, which skill to load first (`Skill` tool inside the subagent) and why, and what file paths/endpoints are already implicated. Don't hand off "figure out why this fails" with no leads — do the first-pass triage yourself using the table above, then delegate the deep dive.

### Debugging technique: throwaway Cypress specs

When a Cypress failure's cause isn't clear from the command-log/screenshot alone (e.g. non-deterministic timing), write a temporary spec at `cypress/e2e/_debug_*.cy.js` that:
- uses `cy.intercept()` to log every relevant API call's URL + status to a file via `cy.writeFile()`
- samples DOM/attribute state at multiple time offsets (`cy.wait(N)` + `cy.get(...).then(($el) => ...)`) to catch timing-dependent state
- takes a full-page screenshot at the point of interest
- catches `cy.on("uncaught:exception", ...)` and logs the stack instead of just failing, so a swallowed JS error doesn't stay invisible

Run it standalone (`npx cypress run --spec "cypress/e2e/_debug_*.cy.js"`), read the written JSON/text files, then **delete the debug spec and its artifacts before finishing** (`rm -f cypress/e2e/_debug_*.cy.js cypress/_debug_*`) — these are throwaway diagnostics, never commit them.

---

## Reporting

At the end of a run, report per phase: pass/fail counts, and for every failure — root cause (not just symptom), which skill/file fixed it, and confirmation it was re-run green afterward. If phase 3 required deployed-environment setup changes (secret patch, user seeding), call those out explicitly since they touch shared infrastructure and the user should know the current state of the dev cluster.

If you truly cannot resolve a failure within reasonable effort, report it as an **open bug** with your best evidence (exact error, what you ruled out, what you suspect) — never as "flaky, ignore."
