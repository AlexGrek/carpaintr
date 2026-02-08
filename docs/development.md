# Development Guide

This guide covers local development setup and workflows for Carpaintr (Autolab).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Organization](#code-organization)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [PDF Service Development](#pdf-service-development)
- [Common Tasks](#common-tasks)

## Prerequisites

### Required Tools

- **[Task](https://taskfile.dev/)** - Task runner (install: `go install github.com/go-task/task/v3/cmd/task@latest`)
- **[Rust](https://rustup.rs/)** (latest stable) with `cargo-watch` (`cargo install cargo-watch`)
- **[Node.js](https://nodejs.org/)** v24+ (v24.9.0 or later recommended)
- **[Python](https://www.python.org/)** 3.11+ (for PDF service and integration tests)
- **[uv](https://astral.sh/uv)** - Modern Python package manager (for integration tests)
- **Git** - Version control

### Optional Tools

- **Docker** - For containerized development
- **kubectl** - For testing Kubernetes deployments locally
- **k3s/k3d** - Lightweight Kubernetes for local testing

## Quick Start

```bash
# Clone the repository
git clone https://github.com/AlexGrek/carpaintr.git
cd carpaintr

# Start full development environment (frontend + backend)
task dev
```

This command will:
1. Install frontend dependencies (if not already installed)
2. Start Vite dev server on port 3000 (with API proxy)
3. Start Rust backend with hot reload on port 8080

**Access the application:** http://localhost:3000

## Project Structure

```
carpaintr/
├── backend-service-rust/       # Rust backend API (Axum + Sled)
│   ├── src/
│   │   ├── api/v1/            # API route handlers
│   │   ├── auth/              # JWT authentication
│   │   ├── middleware/        # Auth, admin, license middlewares
│   │   ├── db/                # Sled database operations
│   │   ├── calc/              # Business logic
│   │   ├── state.rs           # Application state
│   │   └── main.rs            # Entry point
│   ├── Cargo.toml
│   └── admins.txt             # Admin users (for local dev)
│
├── carpaintr-front/           # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/             # Page components (lazy-loaded)
│   │   ├── components/        # Reusable components
│   │   ├── localization/      # i18n support (en, ua)
│   │   ├── utils/             # Auth helpers, API wrappers
│   │   └── App.jsx            # Root component
│   ├── package.json
│   └── vite.config.js
│
├── pdf_backend/               # PDF generation service (Flask)
│   ├── app.py                 # Flask API
│   ├── templates/             # Jinja2 HTML templates
│   └── requirements.txt
│
├── backend-integration-tests/ # Integration test suite (pytest)
│   ├── tests/
│   ├── pyproject.toml
│   └── Taskfile.yml
│
├── autolab-chart/             # Helm chart for Kubernetes
│   └── autolab-chart/autolab/
│       ├── values.yaml
│       └── templates/
│
├── docs/                      # Documentation
│   ├── backup.md
│   ├── deployment.md
│   └── development.md (this file)
│
├── data/                      # Initial data for deployment
├── Taskfile.yml               # Main task definitions
├── CLAUDE.md                  # AI assistant instructions
└── README.md                  # Project overview
```

## Development Workflow

### 1. Start Development Environment

```bash
# Start both frontend and backend
task dev
```

**What happens:**
- Backend runs on `localhost:8080`
- Frontend runs on `localhost:3000`
- Frontend proxies `/api` requests to backend
- Both services have hot reload enabled

### 2. Start Services Individually

**Backend only:**
```bash
task backend
# Or manually:
cd backend-service-rust && cargo watch -x run
```

**Frontend only:**
```bash
task frontend
# Or manually:
cd carpaintr-front && npm run dev
```

**PDF service** (usually not needed for frontend development):
```bash
cd pdf_backend
pip install -r requirements.txt
python app.py
```

### 3. Run Tests

```bash
# Run all integration tests
task test

# Run specific test categories
task test:auth         # Authentication tests
task test:admin        # Admin functionality
task test:license      # License management
task test:cov          # With coverage report

# Check if backend is running
task test:check
```

See [Integration Testing](#integration-testing) section below for details.

## Testing

### Integration Testing

Comprehensive pytest-based test suite in `backend-integration-tests/`.

**Prerequisites:**
- Python 3.11+
- `uv` package manager (auto-installed on macOS/Linux)
- Backend running at `localhost:8080`

**Quick start:**
```bash
task test              # Runs all tests (auto-setup on first run)
```

**Test structure:**
- `conftest.py` - Shared fixtures (auth clients, test users, license generators)
- `test_auth.py` - Authentication flow, admin checks
- `test_license.py` - License generation and management
- Additional test files for specific features

**Key fixtures:**
- `http_client` - Unauthenticated async HTTP client
- `authenticated_client` - Auto-authenticated regular user
- `admin_authenticated_client` - Auto-authenticated admin user
- `generate_license` - Helper to create licenses (admin)

**Writing tests:**
```python
import pytest

@pytest.mark.integration
async def test_my_feature(authenticated_client):
    """Test description."""
    response = await authenticated_client.get("/api/v1/user/endpoint")
    assert response.status_code == 200
    data = response.json()
    assert "field" in data
```

**More details:** See `backend-integration-tests/README.md`

### Frontend Tests

```bash
cd carpaintr-front

# Linting
npm run lint
npm run lint:fix

# Type checking
npx tsc --noEmit
```

## Code Organization

### Backend Code Structure

**Route organization** (`backend-service-rust/src/api/v1/`):
```
api/v1/
├── auth.rs              # /register, /login
├── user.rs              # /user/* endpoints
├── admin.rs             # /admin/* endpoints
├── editor.rs            # /editor/* file operations
├── calc/                # Calculation endpoints
│   ├── mod.rs
│   ├── carparts.rs
│   └── colors.rs
└── mod.rs               # Route registration
```

**Key modules:**
- `auth/` - JWT creation/validation, password hashing
- `middleware/` - Authentication, admin checks, license validation
- `db/` - Sled database operations (users, licenses, calculations)
- `calc/` - Business logic for paint calculations
- `state.rs` - Shared application state (Arc<AppState>)

### Frontend Code Structure

**Component organization** (`carpaintr-front/src/`):
```
src/
├── pages/               # Top-level page components (lazy-loaded)
│   ├── HomePage.jsx
│   ├── LoginPage.jsx
│   └── CalcPage.jsx
├── components/
│   ├── layout/          # Layout components (StageView, BottomStickyLayout)
│   ├── calc/            # Calculation-specific components
│   └── ColorGrid.jsx    # Shared components
├── localization/        # i18n (LocaleContext, Trans)
├── utils/
│   ├── authFetch.js     # API wrappers with JWT
│   └── storage.js       # localStorage helpers
└── App.jsx              # Root component with routing
```

**Key patterns:**
- All API calls use `authFetchJson()`, `authFetchYaml()` from `utils/authFetch.js`
- JWT token stored in `localStorage`
- Lazy-loaded pages via `React.lazy()`
- RSuite components for UI
- TailwindCSS for styling

## Frontend Development

### UI Component Libraries

- **RSuite** - Primary UI components (Button, Panel, Form, etc.)
- **TailwindCSS** - Utility-first CSS
- **lucide-react** - Icons
- **react-responsive** - Media queries

### Adding New Pages

1. Create page component in `src/pages/`:
```javascript
// src/pages/NewPage.jsx
import React from 'react';
import { Panel, Button } from 'rsuite';

const NewPage = () => {
  return (
    <Panel header="New Feature" bordered>
      <p>Content here</p>
    </Panel>
  );
};

export default NewPage;
```

2. Add route in `App.jsx`:
```javascript
const NewPage = React.lazy(() => import('./pages/NewPage'));

// Inside Routes:
<Route path="/new-feature" element={<NewPage />} />
```

### Localization (i18n)

Add translations for Ukrainian language:

```javascript
import { registerTranslations, useLocale } from '../localization/LocaleContext';
import Trans from '../localization/Trans';

// Register at module level
registerTranslations('ua', {
  'English text': 'Український текст',
  'Another string': 'Інший рядок'
});

const MyComponent = () => {
  const { str } = useLocale();

  return (
    <div>
      <Trans>English text</Trans>
      <button>{str('Another string')}</button>
    </div>
  );
};
```

### API Integration

Use auth fetch wrappers:

```javascript
import { authFetchJson, authFetchYaml } from '../../utils/authFetch';

// GET JSON
const data = await authFetchJson('/api/v1/user/endpoint');

// POST JSON
const result = await authFetchJson('/api/v1/user/action', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' })
});

// GET YAML
const config = await authFetchYaml('/api/v1/user/config.yaml');
```

## Backend Development

### Adding New API Endpoints

1. Create handler in `src/api/v1/`:
```rust
// src/api/v1/myfeature.rs
use axum::{extract::State, Json};
use crate::state::AppState;
use crate::middleware::jwt_auth::AuthenticatedUser;

pub async fn my_endpoint(
    State(state): State<Arc<AppState>>,
    user: AuthenticatedUser,
) -> Result<Json<ResponseData>, StatusCode> {
    // Implementation
    Ok(Json(ResponseData { ... }))
}
```

2. Register route in `src/api/v1/mod.rs`:
```rust
mod myfeature;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/user/my-endpoint", get(myfeature::my_endpoint))
        // ... other routes
}
```

### Authentication & Authorization

**Require authentication:**
```rust
use crate::middleware::jwt_auth::AuthenticatedUser;

pub async fn protected_endpoint(
    user: AuthenticatedUser,  // Automatically checks JWT
) -> impl IntoResponse {
    let user_email = user.email;
    // ...
}
```

**Require admin:**
```rust
use crate::middleware::admin_check::AdminUser;

pub async fn admin_endpoint(
    admin: AdminUser,  // Checks JWT + admin list
) -> impl IntoResponse {
    // Only admins can access
}
```

### Database Operations

```rust
use crate::db::users::{get_user, create_user};

// Get user
let user = get_user(&state.db, &email).await?;

// Create user
create_user(&state.db, email, password_hash, company).await?;
```

### Logging

Use the custom logging system:

```rust
use crate::exlogging::{log_event, LogLevel};

log_event(
    LogLevel::Info,
    format!("User {} performed action", user.email),
    Some(&user.email),
);

// Debug logging
log_event(LogLevel::Debug, "Detailed info", None);

// Error logging
log_event(LogLevel::Error, format!("Error: {}", err), Some(&user.email));
```

## PDF Service Development

The PDF service is typically stable and doesn't need frequent changes.

**Running standalone:**
```bash
cd pdf_backend
pip install -r requirements.txt
python app.py
```

**Testing PDF generation:**
```bash
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d @test_data.json \
  --output test.pdf
```

## Common Tasks

### Available Task Commands

```bash
task --list              # Show all available tasks

# Development
task dev                 # Start frontend + backend
task frontend            # Start frontend only
task backend             # Start backend only

# Testing
task test                # Run all integration tests
task test:auth           # Authentication tests
task test:admin          # Admin tests
task test:license        # License tests
task test:cov            # Tests with coverage
task test:check          # Check backend health

# Docker
task docker-build        # Build all images
task docker-push         # Push to registry
task all                 # Build + push
task redeploy            # Build, push, restart k8s

# Deployment
task deploy-service      # Deploy to Kubernetes
task deploy-pdfgen       # Deploy PDF service
```

### Task Variables

Override defaults with `--var`:

```bash
task docker-build --var NAME=my-api --var NAMESPACE=dev
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NAME` | `autolab-api` | Backend image name |
| `PDFGEN_NAME` | `autolab-pdfgen` | PDF generator image name |
| `NAMESPACE` | `autolab` | Kubernetes namespace |

### Database Management

**Location:** `backend-service-rust/data/sled_db/`

**Viewing data:**
```bash
# Start backend in debug mode
RUST_LOG=debug cargo run

# Or use Sled CLI tools (if available)
```

**Reset database:**
```bash
# WARNING: Deletes all data
rm -rf backend-service-rust/data/sled_db/
# Backend will recreate on next run
```

### Admins Configuration

**Local development:**
Edit `backend-service-rust/admins.txt`:
```
admin@example.com
test_admin@example.com
```

**In deployment:**
Configure via Helm values or Kubernetes secret (see [deployment.md](./deployment.md)).

### Environment Variables

**Backend** (in `backend-service-rust/.env` or shell):
```bash
JWT_SECRET=your-secret-key
LICENSE_JWT_SECRET=your-license-key
DATABASE_URL=/path/to/sled_db
DATA_DIR_PATH=/path/to/data
PDF_GEN_URL_POST=http://localhost:5000/generate
ADMIN_FILE_PATH=/path/to/admins.txt
LOG_FILE_PATH=application.log
RUST_LOG=info                # Options: trace, debug, info, warn, error
```

**Frontend proxy** (configured in `vite.config.js`):
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

## Code Style & Best Practices

### Rust (Backend)

- Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
- Use `rustfmt`: `cargo fmt`
- Use `clippy`: `cargo clippy`
- Keep handlers thin, move logic to separate modules
- Use proper error types (avoid `.unwrap()` in production code)
- Add logging for important operations

### JavaScript/React (Frontend)

- Use ESLint: `npm run lint`
- Use functional components with hooks
- Keep components small and focused
- Avoid inline styles (use TailwindCSS or CSS modules)
- Add loading states for async operations
- Handle errors gracefully with user feedback

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit frequently
git add .
git commit -m "Add: new feature description"

# Push to remote
git push origin feature/my-feature

# Create pull request for review
```

**Commit message conventions:**
- `Add:` - New feature
- `Fix:` - Bug fix
- `Update:` - Enhancement to existing feature
- `Refactor:` - Code restructuring
- `Docs:` - Documentation changes
- `Test:` - Test additions/changes

## Troubleshooting

### Backend won't start

```bash
# Check for port conflicts
lsof -i :8080

# Check Rust version
rustc --version

# Clean build
cd backend-service-rust
cargo clean
cargo build
```

### Frontend build errors

```bash
# Clear node_modules and reinstall
cd carpaintr-front
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be v24+
```

### Integration tests fail

```bash
# Ensure backend is running
curl http://localhost:8080/api/v1/health

# Reset test environment
cd backend-integration-tests
rm -rf .venv
task setup
task test
```

### Hot reload not working

**Backend:**
```bash
# Reinstall cargo-watch
cargo install cargo-watch --force
```

**Frontend:**
```bash
# Check if Vite process is running
ps aux | grep vite

# Restart with clean slate
cd carpaintr-front
rm -rf node_modules/.vite
npm run dev
```

## Related Documentation

- [Deployment Guide](./deployment.md) - Kubernetes deployment
- [Backup Guide](./backup.md) - Backup & restore procedures
- [Main README](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - AI assistant instructions

## Getting Help

- **Integration tests:** See `backend-integration-tests/README.md`
- **Rust backend:** Check `backend-service-rust/README.md` (if exists)
- **Frontend:** Check `carpaintr-front/README.md` (if exists)
- **Issues:** https://github.com/AlexGrek/carpaintr/issues
