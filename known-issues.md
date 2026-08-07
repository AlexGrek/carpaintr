# Known Issues

Tracked, reproducible problems that are understood but not yet fixed. Each entry has enough evidence to pick the fix back up without re-investigating from scratch.

---

## 2026-08-07 — `autolab-pdfgen` (Playwright) can hang for minutes and crash its worker

**Status:** Open, not yet fixed. Real generation works most of the time; this is an intermittent reliability bug, not a total outage.

**Where:** `pdf_backend_playwright/` (deployed as the `autolab-pdfgen` pod, e.g. `autolab-dev` namespace). Backend endpoints affected: `POST /api/v1/user/generate_html_table` and `POST /api/v1/user/generate_pdf_table` on `backend-service-rust`, which proxy to `pdf_backend_playwright`'s `/generate/html` and `/generate/pdf`.

**Symptom:** A request to generate an HTML preview or PDF can hang indefinitely (observed: no response after 60s+, worker eventually killed after several minutes) instead of returning a result or an error. The caller (frontend, or a test) is left waiting with no feedback.

**Root cause (evidence-based, not fully confirmed):**

`pdf_backend_playwright/app.py`'s `BrowserManager` closes its headless Chromium instance after `BROWSER_IDLE_TIMEOUT` (180s) of inactivity, to save memory. The pod's Kubernetes resource limits are very tight for running Chromium:

```yaml
# autolab-chart/autolab-chart/autolab/values-dev.yaml
pdfgen:
  resources:
    limits:
      cpu: "250m"
      memory: "256Mi"
    requests:
      cpu: "50m"
      memory: "128Mi"
```

When a request arrives after the browser has been idle-closed, `BrowserManager.get_browser()` cold-launches a new Chromium instance under that 250m/256Mi ceiling. Confirmed from `kubectl logs -n autolab-dev -l app=autolab-pdfgen`:

```
[2026-08-07 09:13:51,454] INFO in app: Starting new Playwright browser...
[2026-08-07 09:13:56,253] INFO in app: Browser started successfully
10.42.0.88 - - [07/Aug/2026:09:14:06 +0000] "POST /generate/pdf HTTP/1.1" 200 31493 "-" "-"
```
— a warm/successful case: browser starts in ~5s, real PDF (31KB) returned in ~15s total. But on a later cold start:
```
[2026-08-07 09:24:02,401] INFO in app: Starting new Playwright browser...
[2026-08-07 09:31:21 +0000] [1] [CRITICAL] WORKER TIMEOUT (pid:7)
```
— the browser launch never completed. Gunicorn's own `--timeout 120` watchdog (`pdf_backend_playwright/Dockerfile`) didn't even fire until ~7m19s later, well past its configured 120s, suggesting the container was so CPU/memory-starved during the cold Chromium launch that gunicorn's master process itself couldn't service its timeout check promptly. The client-side request (verified via a Cypress `cy.wait()` on the intercepted response) never received a response at all.

**How this was found:** During E2E testing (see [`testing` skill](.claude/skills/testing/SKILL.md)), phase 3 (Cypress against deployed dev) initially passed with a real PDF generated successfully. A follow-up direct verification of the actual PDF bytes returned by the deployed server (to answer "does it actually produce PDFs on real server?") reproduced the hang on a cold browser start.

**Suggested next steps (not yet done):**
- Raise `pdfgen.resources.limits` (memory especially — 256Mi is tight for Chromium) in `values-dev.yaml` / `values.yaml`, and re-test cold-start behavior under load.
- Add an explicit timeout around `browser_manager.get_browser()` / Playwright launch in `app.py`, so a stuck cold start fails fast with a clear error instead of hanging until gunicorn's watchdog (which itself may be delayed under resource starvation).
- Consider disabling or lengthening `BROWSER_IDLE_TIMEOUT` (currently 180s) to reduce how often cold starts happen, trading idle memory for reliability.
- Re-run phase 3 of the `testing` skill repeatedly (including with an idle gap >180s before the PDF step) to confirm a fix actually closes the gap, not just the happy path.

**We will fix this later.**
