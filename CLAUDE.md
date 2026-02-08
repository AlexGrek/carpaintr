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

## Backup & Restore

**Full documentation**: See [docs/backup.md](docs/backup.md)

The application includes automated Kubernetes backups (daily by default, keeps last 10 backups):

```bash
# View backup status
kubectl get cronjob
kubectl get jobs | grep backup

# Manual backup
kubectl create job --from=cronjob/autolab-api-backup manual-backup-$(date +%s)

# View backup logs
kubectl logs job/<backup-job-name>

# Configure via Helm
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.retention=10 \
  --set backup.schedule="0 0 * * *"
```

## Integration Testing

A comprehensive pytest-based integration test suite is available in `backend-integration-tests/`.

### Quick Start

```bash
# Run all integration tests (auto-installs dependencies)
task test

# Run specific test categories
task test:auth         # Authentication tests
task test:admin        # Admin-specific tests
task test:license      # License management tests
task test:cov          # With coverage report

# Check if backend is running
task test:check
```

### Test Environment Setup

The test suite uses `uv` (modern Python package manager) and automatically sets up a virtual environment on first run:

```bash
# First time setup (if not using task commands)
cd backend-integration-tests
task setup             # Creates venv, installs dependencies
source .venv/bin/activate

# Or let test commands auto-setup
task test              # Will run setup if needed
```

**Requirements:**
- Python 3.11+
- `uv` package manager (install: `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Backend running at `localhost:8080`

### Test Structure

```
backend-integration-tests/
├── tests/
│   ├── conftest.py          # Reusable fixtures (auth, clients, etc.)
│   ├── test_auth.py         # Authentication & admin tests
│   ├── test_license.py      # License management tests
│   └── test_example_*.py    # Additional test examples
├── pyproject.toml           # Dependencies & pytest config
├── Taskfile.yml             # Test tasks
└── README.md                # Detailed documentation
```

### Key Fixtures (in `conftest.py`)

- **`http_client`** - Unauthenticated async HTTP client
- **`authenticated_client`** - Auto-authenticated test user client
- **`admin_authenticated_client`** - Auto-authenticated admin client
- **`test_user_token`** / **`test_admin_token`** - JWT tokens
- **`generate_license`** - Helper function to generate licenses (requires admin auth)
- **`backend_health_check`** - Ensures backend is running before tests

### Authentication Flow (Important)

The backend uses a two-step authentication flow:

1. **`POST /api/v1/register`** - Creates user account
   - Returns: `200` with **empty body** (no token)
   - Example: `{"email": "user@example.com", "password": "pass123", "company_name": "Company"}`

2. **`POST /api/v1/login`** - Authenticates and gets token
   - Returns: `200` with JSON `{"token": "jwt_token_here"}`
   - Example: `{"email": "user@example.com", "password": "pass123"}`

3. **Protected routes** - Use JWT token in `Authorization: Bearer <token>` header

### Admin Users

Admin status is determined by `backend-service-rust/admins.txt`. The test admin email (`test_admin@example.com`) is already configured.

### License Management Testing

The test suite includes comprehensive license management testing capabilities:

**Endpoint:** `POST /api/v1/admin/license/generate` (admin-only)

**Using the `generate_license` fixture:**
```python
async def test_with_license(generate_license, test_user_credentials):
    user_email = test_user_credentials["email"]

    # Generate a 90-day premium license
    result = await generate_license(user_email, days=90, level="premium")
    assert result is not None
```

**Direct API call:**
```python
async def test_license_gen(admin_authenticated_client):
    response = await admin_authenticated_client.post(
        "/admin/license/generate",
        json={
            "email": "user@example.com",
            "days": 365,
            "level": "premium"  # optional
        }
    )
    assert response.status_code == 200
```

*Note: The backend uses an untagged enum, so JSON is sent directly without variant tags.*

**License cache invalidation:** `POST /api/v1/admin/license/invalidate/{email}` (admin-only)

### Writing New Tests

```python
import pytest
import httpx

@pytest.mark.integration
async def test_my_endpoint(authenticated_client):
    """Test with auto-authenticated user."""
    response = await authenticated_client.get("/api/v1/user/my_endpoint")
    assert response.status_code == 200
    data = response.json()
    assert "expected_field" in data
```

### Coverage

```bash
task test:cov          # Run with coverage report
# Opens htmlcov/index.html for detailed coverage analysis
```

For more details, see `backend-integration-tests/README.md`.

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

**Logging:** Custom logging system via `src/exlogging.rs`. Use `log_event(LogLevel, message, user)` for structured logging. Logs are written to file specified by `LOG_FILE_PATH` env var (default: `application.log`).

**Debug logging in calc modules:**
- `src/calc/t2.rs` - Comprehensive debug logging for T2 table processing:
  - Data loading (file paths, row counts, CSV structure)
  - Filtering operations (match counts, empty results warnings)
  - Row parsing (field validation, action parsing, success details)
  - Batch operations (progress tracking, error counts)
  - Use `LogLevel::Debug` for operational info, `LogLevel::Trace` for detailed row data

### Frontend (`carpaintr-front/`)

React 19 SPA with RSuite UI components and TailwindCSS.

**Key patterns:**
- `src/utils/authFetch.js` - All API calls go through `authFetchJson()`, `authFetchYaml()`, etc. These add JWT Bearer token automatically.
- `src/pages/` - Lazy-loaded page components
- `src/components/calc/` - Multi-step calculation wizard with car diagram
- `src/localization/LocaleContext.jsx` - i18n support

**State:** JWT token and company info stored in localStorage. No Redux/Zustand.

## UI Libraries & Dependencies

### Core UI Libraries
- **RSuite** - Primary UI component library (Button, Panel, Message, Loader, etc.)
  - Import from `"rsuite"`
  - Provides pre-built form components, navigation, and layout utilities
- **TailwindCSS** - Utility-first CSS framework for custom styling
- **lucide-react** - Modern icon library (LogIn, UserPlus, etc.)
  - Import individual icons: `import { LogIn, UserPlus } from "lucide-react"`
- **react-responsive** - Media query hook for responsive design
  - `useMediaQuery({ maxWidth: 767 })` for mobile detection

### Styling Approach
- Use RSuite components for complex UI elements (forms, buttons, modals)
- Use TailwindCSS classes for layout and spacing
- Use inline styles for component-specific styling
- Custom CSS modules for complex layouts (e.g., `ColorGrid.css`, `BottomStickyLayout.css`)

## Custom Components & Layouts

### Layout Components

#### `StageView` (`src/components/layout/StageView.jsx`)
Multi-step wizard component with smooth transitions between stages.

**Usage:**
```javascript
import StageView from "../layout/StageView";

<StageView
  stages={[
    { name: "step1", component: Step1Component },
    { name: "step2", component: Step2Component }
  ]}
  initialState={{}}
  animationDelay={300}  // Transition duration in ms
  onSave={(data) => console.log(data)}
/>
```

**Features:**
- Lazy-loaded stage components
- Fade + slide + scale transitions (300ms with cubic-bezier easing)
- Navigation via `onMoveForward`, `onMoveBack`, `onMoveTo`
- Shared `stageData` object passed between stages
- Each stage receives props: `index`, `enabled`, `fadeOutStarted`, `stageData`, `setStageData`, `onMoveForward`, `onMoveBack`, `onMoveTo`

**Stage Component Structure:**
```javascript
const MyStage = ({
  stageData,
  setStageData,
  onMoveForward,
  onMoveBack,
  fadeOutStarted
}) => {
  return <div>{/* stage content */}</div>;
};
```

#### `BottomStickyLayout` (`src/components/layout/BottomStickyLayout.jsx`)
Responsive layout with sticky bottom panel for navigation buttons.

**Usage:**
```javascript
import BottomStickyLayout from "../layout/BottomStickyLayout";

<BottomStickyLayout
  bottomPanel={
    <HStack justifyContent="space-between">
      <Button onClick={onBack}>Back</Button>
      <Button onClick={onNext}>Next</Button>
    </HStack>
  }
>
  {/* Main content */}
</BottomStickyLayout>
```

**Behavior:**
- **Mobile (≤767px):** Bottom panel is `position: fixed` at bottom with backdrop blur
- **Desktop (>767px):** Bottom panel is `position: static` with top margin
- Automatically adds 100px padding-bottom on mobile to prevent content overlap
- Z-index: 100 for mobile sticky mode

### Calculation Components

#### `CarBodyMain` (`src/components/calc/CarBodyMain.jsx`)
Car body diagram selector with interactive SVG visualization.

**Key features:**
- Fetches car parts from `/api/v1/user/carparts/{class}/{body}`
- Fetches T2 subcomponents from `/api/v1/user/carparts_t2/{class}/{body}`
- Debug mode with ⚙️ button to view technical data
- Centered layout with max-width: 900px

#### `ColorPicker` (`src/components/calc/ColorPicker.jsx`)
Color selection grid with loading placeholder.

**Key features:**
- Fetches colors from `/api/v1/user/global/colors.json`
- Custom skeleton loader (`ColorGridPlaceholder`) - 5×4 grid of semi-transparent tiles
- No lazy loading (preloaded with stage)
- Uses `ColorGrid` component for rendering actual colors

#### `ColorGrid` (`src/components/ColorGrid.jsx`)
Responsive grid layout for displaying color swatches.

**Layout:**
- 4-column grid (`repeat(4, minmax(24px, 1fr))`)
- Each color card: 60px preview + label section
- Hover effects with scale transform
- Selected state with border and shadow

### Component Patterns

#### Lazy Loading
Components are preloaded by `StageView` - avoid `React.lazy()` for nested components to prevent loading delays.

#### Media Queries
```javascript
import { useMediaQuery } from "react-responsive";

const isMobile = useMediaQuery({ maxWidth: 767 });
```

#### Auth Fetch Pattern
All API calls use wrappers from `src/utils/authFetch.js`:
```javascript
import { authFetchJson, authFetchYaml } from "../../utils/authFetch";

const data = await authFetchJson("/api/v1/user/endpoint");
const config = await authFetchYaml("/api/v1/user/config.yaml");
```

#### Error Handling
Use RSuite's `Message` and `toaster` for user feedback:
```javascript
import { Message, toaster } from "rsuite";

toaster.push(
  <Message type="error" showIcon closable>Error message</Message>,
  { placement: 'topCenter', duration: 5000 }
);
```

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
