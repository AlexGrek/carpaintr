# Cypress E2E (Real API)

End-to-end tests hit the real backend through the Vite dev server proxy. No API mocking.

## Quick start (recommended)

From the **repo root**:

```bash
task cypress
```

This will:

1. Start backend (`:8080`) and frontend (`:3000`) if they are not already up
2. Run `task populate` + `task populate:licenses` (seed users and licenses for `/api/v1/user/*`)
3. Run the full Cypress suite
4. Stop only the services this run started

## Specs

| File | Coverage |
|------|----------|
| `main-path.cy.js` | Login → calc wizard data input (full flow) |
| `public-routes.cy.js` | `/`, login, register, landing auth links |
| `authenticated-routes.cy.js` | Direct visit to each `/app/*` route (+ 404) |
| `dashboard-apps.cy.js` | Dashboard app cards + license marker |
| `catalog-tabs.cy.js` | Catalog tab switching |

Route list is centralized in `cypress/support/app-routes.js`.

## Manual control

```bash
task check-dev    # verify both services respond
task ensure-dev   # start missing services (keeps them running)
task populate     # seed users (starts backend if needed)
cd carpaintr-front && npm run cypress:run
```

Interactive mode:

```bash
task ensure-dev
cd carpaintr-front && npm run cypress:open
```

## Credentials

Default login uses seeded users from `task populate`:

- `user1@example.com` / `test1` (default)
- `userN@example.com` / `testN` via `E2E_SEEDED_USER_INDEX` (`1..30`)

Optional overrides in `cypress.env.json` (see `cypress.env.example.json`):

```json
{
  "E2E_SEEDED_USER_INDEX": 1,
  "E2E_EMAIL": "user1@example.com",
  "E2E_PASSWORD": "test1"
}
```

## Prerequisites

- Node.js + npm (`carpaintr-front/node_modules`)
- Rust/cargo (if `task cypress` needs to start the backend)
- [task](https://taskfile.dev) (for `task cypress` / `task populate`)
- [uv](https://docs.astral.sh/uv/) (for populate, via backend-integration-tests)
- **bash 3.2+** for `scripts/*.sh` (macOS/Linux). Tasks invoke scripts with `bash`, not your interactive `zsh` shell.
