# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Start full development environment (frontend + backend with hot reload)
task dev

# Individual services
task frontend          # Vite dev server (proxies /api to localhost:8080)
task backend           # cargo watch -x run

# Frontend linting
cd carpaintr-front && npm run lint
cd carpaintr-front && npm run lint:fix

# Build backend
cd backend-service-rust && cargo build --release

# Docker
task docker-build      # Build all images (backend + pdfgen in parallel)
task docker-push       # Push to localhost:5000 registry
task redeploy          # Build, push, restart k8s pods
```

## Architecture Overview

Three-service architecture:

```
Frontend (React/Vite)  →  Backend API (Axum/Rust)  →  PDF Service (Flask/Python)
     :3000                     :8080                      :5000
```

### Backend (`backend-service-rust/`)

Axum-based REST API with Sled embedded database.

**Key directories:**
- `src/api/v1/` - Route handlers organized by feature (auth, user, admin, editor, calc/)
- `src/auth/` - JWT creation/validation, admin check
- `src/middleware/` - jwt_auth, admin_check, license_expiry middlewares
- `src/db/` - Sled database operations (users, requests, attachments)
- `src/calc/` - Business logic for car paint calculations
- `src/state.rs` - AppState (shared across handlers via Arc)

**Auth flow:** JWT tokens with bcrypt passwords. Protected routes use `AuthenticatedUser` extractor. Admin routes additionally check against `admins.txt` file.

**Route hierarchy:**
- Public: `/register`, `/login`
- User (jwt_auth + license check): `/api/v1/user/*`
- Admin (jwt_auth + admin check): `/api/v1/admin/*`
- Editor: `/api/v1/editor/*` (user file management with git-like commits)

### Frontend (`carpaintr-front/`)

React 19 SPA with RSuite UI components and TailwindCSS.

**Key patterns:**
- `src/utils/authFetch.js` - All API calls go through `authFetchJson()`, `authFetchYaml()`, etc. These add JWT Bearer token automatically.
- `src/pages/` - Lazy-loaded page components
- `src/components/calc/` - Multi-step calculation wizard with car diagram
- `src/localization/LocaleContext.jsx` - i18n support

**State:** JWT token and company info stored in localStorage. No Redux/Zustand.

## Frontend Localization (i18n)

Supported languages: `en` (English), `ua` (Ukrainian). English keys are used as-is; Ukrainian has translations.

**Key files:**
- `src/localization/LocaleContext.jsx` - Core context, `TRANSLATIONS_BASIC`, `registerTranslations()`
- `src/localization/Trans.jsx` - Translation component

### Adding translations to a component

```javascript
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";

// Register at module level (outside component)
registerTranslations("ua", {
  "My button": "Моя кнопка",
  "Welcome": "Ласкаво просимо",
});

const MyComponent = () => {
  const { str } = useLocale();
  
  return (
    <div>
      <Trans>Welcome</Trans>           {/* Simple strings */}
      <button>{str("My button")}</button>  {/* Dynamic/conditional */}
    </div>
  );
};
```

### Translation methods

| Method | Use case |
|--------|----------|
| `<Trans>Text</Trans>` | Simple inline strings in JSX |
| `str("Text")` | Variables, conditionals, data arrays |
| `registerTranslations("ua", {...})` | Add translations at module load |
| `addTranslation("ua", {...})` | Runtime/dynamic translations |

### Adding a new language

1. Add language code to `SUPPORTED_LANGUAGES` array in `LocaleContext.jsx`
2. Add translations to `TRANSLATIONS_BASIC` for core strings
3. Add `registerTranslations()` calls in components that need the new language

### PDF Backend (`pdf_backend/`)

Flask service using WeasyPrint for HTML→PDF conversion. Receives calculation data from main backend, renders Jinja2 templates, returns PDF bytes.

## Database

Sled embedded key-value store at `/data/sled_db`. No migrations - schema is implicit in key patterns like `users::{id}`, `licenses::{email}`, `calculations::{user_id}::{calc_id}`.

## Environment Variables (Backend)

Key variables: `JWT_SECRET`, `LICENSE_JWT_SECRET`, `DATABASE_URL`, `DATA_DIR_PATH`, `PDF_GEN_URL_POST`, `ADMIN_FILE_PATH`

## Deployment

Multi-stage Docker build: Node builds frontend → Rust compiles backend with static files → Debian slim runtime. Deployed to k3s via Helm chart or raw manifests in `k8s-deploy/`.
