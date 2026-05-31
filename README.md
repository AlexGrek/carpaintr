# Carpaintr (Autolab)

[![Build Status](https://drone.dcommunity.space/api/badges/AlexGrek/carpaintr/status.svg?ref=refs/heads/main)](https://drone.dcommunity.space/AlexGrek/carpaintr)

A car paint calculation and management system with automated backups, user authentication, and license management.

## Quick Start

```bash
# Install Task runner
go install github.com/go-task/task/v3/cmd/task@latest

# First time (or after updating repo data/): sync bundled tables & catalog data
task dev-data

# Start development environment (frontend + backend)
task dev
```

Access the application at http://localhost:5173 (Vite default; API proxied to :8080)

**Fresh local database:** `task reset` wipes Sled + user files and re-syncs `data/common`. Use `task reset POPULATE=1` to also create 30 seed logins (`user1@example.com` / `test1`, …).

## Documentation

📚 **Comprehensive documentation available in [docs/](docs/):**

- **[Development Guide](docs/development.md)** - Setup, workflow, testing, code organization
- **[Deployment Guide](docs/deployment.md)** - Docker, Kubernetes, Helm, CI/CD
- **[Backup & Restore](docs/backup.md)** - Automated backups, restore procedures, disaster recovery

## Project Structure

```
carpaintr/
├── backend-service-rust/       # Rust backend API (Axum + Sled)
├── carpaintr-front/            # React frontend (Vite + TypeScript)
├── pdf_backend/                # PDF generation service (Flask + WeasyPrint)
├── backend-integration-tests/  # pytest integration test suite
├── autolab-chart/              # Helm chart for Kubernetes deployment
├── docs/                       # Documentation
│   ├── backup.md
│   ├── deployment.md
│   └── development.md
├── data/                       # Initial data for deployment
├── Taskfile.yml                # Task runner configuration
├── CLAUDE.md                   # AI assistant project instructions
└── README.md                   # This file
```

## Tech Stack

### Backend (`backend-service-rust/`)
- **Framework**: Axum 0.8 (Rust async web framework)
- **Runtime**: Tokio (async runtime)
- **Database**: Sled (embedded key-value store)
- **Auth**: JWT + bcrypt password hashing
- **Features**: User management, license system, calculation engine

### Frontend (`carpaintr-front/`)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **UI Libraries**: RSuite + TailwindCSS 4
- **Routing**: React Router DOM
- **i18n**: English & Ukrainian

### PDF Service (`pdf_backend/`)
- **Framework**: Flask (Python)
- **PDF Engine**: WeasyPrint (HTML to PDF)
- **Templates**: Jinja2

## Prerequisites

**For Development:**
- [Task](https://taskfile.dev/) - Task runner
- [Rust](https://rustup.rs/) with `cargo-watch`
- [Node.js](https://nodejs.org/) v24+
- [Python](https://www.python.org/) 3.11+
- [uv](https://astral.sh/uv) - Python package manager (for tests)

**For Deployment:**
- [Docker](https://www.docker.com/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/) v3+
- Kubernetes cluster (k3s recommended)

## Development

### Start Development Environment

```bash
# Full stack (frontend + backend with hot reload)
task dev

# Individual services
task frontend          # Vite dev server on :5173 (see carpaintr-front vite config)
task backend           # Rust API on :8080

# Sync bundled app data into backend-service-rust/data/common
task dev-data
```

**Frontend:** http://localhost:5173 (proxies API to :8080)  
**Backend API:** http://localhost:8080

### Local Dev Data & Seed Users

```bash
task reset               # Stop dev servers; wipe Sled DB + data/users; re-sync data/common
task reset POPULATE=1    # Same, then register 30 seed users (backend started briefly)
task populate            # Register seed users (starts backend if needed); license bootstrap admin + **new** seed users
task populate:licenses # Force licenses for bootstrap admin + all 30 seed users (including existing)
task kill-dev            # Kill stale processes on :8080 / :5173
```

**Accounts** (via `task populate`, uses `POST /admin/users/bulk`):
- Bootstrap admin: `admin@admin.com` / `admin123` (must be in `admins.txt`)
- Seed users: `user1@example.com` … `user30@example.com` / `test1` … `test30`
- New seed users automatically receive a license; users that already exist are not modified

### Run Tests

```bash
# Full integration test run (recommended): PDF mock + backend if needed
task itests

# Pytest only (backend must already be on :8080)
task test              # All tests (~40+, parallel via pytest-xdist)
task test:auth         # Authentication tests
task test:admin        # Admin tests
task test:license      # License management tests
task test:pdf          # PDF/HTML generation (needs backend started via task itests)
task test:cov          # With coverage report
task test:check        # Verify backend is reachable

# Frontend linting
cd carpaintr-front && npm run lint
cd carpaintr-front && npm run lint:fix
```

Integration tests live in `backend-integration-tests/` (pytest + httpx + **uv**). See [backend-integration-tests/README.md](backend-integration-tests/README.md) and [Development Guide](docs/development.md#integration-testing).

### Available Tasks

```bash
task --list            # Show all available tasks
```

| Category | Task | Description |
|----------|------|-------------|
| **Development** | `task dev` | Start frontend + backend |
| | `task frontend` | Start frontend dev server |
| | `task backend` | Start backend with hot reload |
| | `task dev-data` | Sync `data/common` → `backend-service-rust/data/common` |
| | `task reset` | Wipe local Sled DB + user files; re-sync common data |
| | `task reset POPULATE=1` | Reset + register seed users `user1`…`user30` |
| | `task populate` | Register seed users; license bootstrap admin + new seed users |
| | `task populate:licenses` | Force licenses for bootstrap admin + all 30 seed users |
| | `task kill-dev` | Kill processes on :8080 / :5173 |
| **Testing** | `task itests` | Full itest flow: PDF mock, backend, pytest, teardown |
| | `task test` | Run integration tests (backend must be up) |
| | `task test:auth` / `test:admin` / `test:license` / `test:pdf` | Filter by marker |
| | `task test:cov` | Run tests with coverage |
| | `task test:check` | Check backend health |
| **Docker** | `task docker-build` | Build all Docker images |
| | `task docker-push` | Push images to registry |
| | `task redeploy` | Build, push, restart k8s pods |
| **Deployment** | `task deploy-service` | Deploy to Kubernetes |

## Deployment

### Quick Deploy (Helm)

```bash
# Build and push images
task docker-build
task docker-push

# Deploy with Helm
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --create-namespace \
  --set image.tag=$(git rev-parse --short HEAD) \
  --set pdfgen.image.tag=$(git rev-parse --short HEAD)
```

### Configuration

Key Helm values (see [values.yaml](autolab-chart/autolab-chart/autolab/values.yaml)):

```yaml
# Image configuration
image:
  repository: grekodocker/autolab-api
  tag: ""  # Required: Set via --set image.tag=xxx

# Ingress
ingress:
  enabled: true
  host: autolab.example.com
  tls:
    enabled: true

# Persistence
persistence:
  size: 1Gi
  storageClassName: ""

# Backup
backup:
  enabled: true
  schedule: "0 0 * * *"  # Daily at midnight UTC
  retention: 10           # Keep last 10 backups
  storageSize: 5Gi
```

**Full deployment documentation:** [docs/deployment.md](docs/deployment.md)

## Backup System

Automated Kubernetes CronJob for data backups:

- **Schedule:** Daily at midnight UTC (configurable)
- **Retention:** Last 10 backups (configurable)
- **Storage:** Separate 5Gi PVC (configurable)
- **Format:** Timestamped tar.gz archives

```bash
# View backup status
kubectl get cronjob
kubectl get jobs | grep backup

# Manual backup
kubectl create job --from=cronjob/autolab-api-backup manual-backup-$(date +%s)

# Configure retention
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.retention=30
```

**Full backup documentation:** [docs/backup.md](docs/backup.md)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                  │
│                                                      │
│  ┌────────────┐          ┌──────────────┐          │
│  │  Ingress   │          │ StatefulSet  │          │
│  │  (Traefik) ├─────────▶│  autolab-api │          │
│  └────────────┘          │  (Rust)      │          │
│                          └──────┬───────┘          │
│                                 │                   │
│                          ┌──────▼───────┐          │
│                          │ Deployment   │          │
│                          │ pdfgen       │          │
│                          │ (Flask)      │          │
│                          └──────────────┘          │
│                                                      │
│  ┌──────────────┐        ┌──────────────┐          │
│  │ PVC: Data    │        │ PVC: Backups │          │
│  │ (Sled DB)    │        │ (tar.gz)     │          │
│  └──────────────┘        └──────────────┘          │
│                                                      │
│  ┌──────────────────────────────────────┐          │
│  │    CronJob: Automated Backups        │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

**Three-service architecture:**
1. **Frontend** (React/Vite) - User interface on :5173
2. **Backend API** (Axum/Rust) - REST API on :8080
3. **PDF Service** (Flask/Python) - PDF generation on :5000

## Key Features

- ✅ **User Authentication** - JWT-based with bcrypt password hashing
- ✅ **Admin System** - Configurable admin users with elevated permissions
- ✅ **License Management** - Generate and validate user licenses
- ✅ **Calculation Engine** - Car paint calculation with T2 tables
- ✅ **File Management** - Editor with git-like commit system
- ✅ **PDF Generation** - HTML to PDF rendering
- ✅ **Automated Backups** - Kubernetes CronJob with configurable retention
- ✅ **i18n Support** - English and Ukrainian localization
- ✅ **Integration Tests** - pytest + uv suite (`task itests`), PDF mock, 30 seed users

## Environment Variables

Backend configuration (see [deployment.md](docs/deployment.md) for details):

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT token signing key | Auto-generated |
| `LICENSE_JWT_SECRET` | License token signing key | Auto-generated |
| `DATABASE_URL` | Sled database path | `/app/data/sled_db` |
| `DATA_DIR_PATH` | Application data directory | `/app/data` |
| `ADMIN_FILE_PATH` | Admin users file | `/var/secrets/admins.txt` |
| `PDF_GEN_URL_POST` | PDF service endpoint | `http://autolab-pdfgen/generate` |
| `LOG_FILE_PATH` | Application log file | `/app/data/application.log` |

## CI/CD

The project uses **Drone CI** (`.drone.yml`) for automated builds and deployments.

**Pipeline stages:**
1. Build Rust backend + React frontend
2. Build and push Docker images
3. Deploy to Kubernetes (optional)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes and test thoroughly
4. Commit with descriptive messages (`Add: feature description`)
5. Push to your fork and create a pull request

**Code style:**
- Rust: `cargo fmt` and `cargo clippy`
- Frontend: `npm run lint` (ESLint)
- Follow existing code patterns

## Troubleshooting

### Development Issues

```bash
# Backend won't start
lsof -i :8080                    # Check port conflicts
cargo clean && cargo build       # Clean rebuild

# Frontend issues
cd carpaintr-front
rm -rf node_modules package-lock.json
npm install

# Tests failing
task test:check                  # Verify backend is running
task itests                      # Starts backend + PDF mock automatically

# Stale or corrupt local data
task reset POPULATE=1            # Clean Sled + user dirs + seed accounts
```

### Deployment Issues

```bash
# Check pod status
kubectl get pods -n autolab
kubectl logs -f autolab-api-0 -n autolab

# Check ingress
kubectl get ingress -n autolab
kubectl describe ingress autolab-api -n autolab

# Rollback deployment
helm rollback autolab -n autolab
```

**Full troubleshooting guides:**
- [Development Troubleshooting](docs/development.md#troubleshooting)
- [Deployment Troubleshooting](docs/deployment.md#troubleshooting)

## License

[Specify your license here]

## Links

- **Build Status:** [Drone CI](https://drone.dcommunity.space/AlexGrek/carpaintr)
- **Issues:** [GitHub Issues](https://github.com/AlexGrek/carpaintr/issues)
- **Documentation:** [docs/](docs/)

## Support

For questions or issues:
1. Check the [documentation](docs/)
2. Search [existing issues](https://github.com/AlexGrek/carpaintr/issues)
3. Create a new issue with details

---

**Made with ❤️ using Rust, React, and Kubernetes**
