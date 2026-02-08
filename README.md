# Carpaintr (Autolab)

[![Build Status](https://drone.dcommunity.space/api/badges/AlexGrek/carpaintr/status.svg?ref=refs/heads/main)](https://drone.dcommunity.space/AlexGrek/carpaintr)

A car paint calculation and management system with automated backups, user authentication, and license management.

## Quick Start

```bash
# Install Task runner
go install github.com/go-task/task/v3/cmd/task@latest

# Start development environment (frontend + backend)
task dev
```

Access the application at http://localhost:3000

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
task frontend          # Vite dev server on :3000
task backend           # Rust API on :8080
```

**Frontend:** http://localhost:3000 (proxies API to :8080)
**Backend API:** http://localhost:8080

### Run Tests

```bash
# Integration tests (pytest)
task test              # All tests
task test:auth         # Authentication tests
task test:admin        # Admin functionality tests
task test:license      # License management tests
task test:cov          # With coverage report

# Frontend linting
cd carpaintr-front && npm run lint
cd carpaintr-front && npm run lint:fix
```

See [Development Guide](docs/development.md) for detailed testing documentation.

### Available Tasks

```bash
task --list            # Show all available tasks
```

| Category | Task | Description |
|----------|------|-------------|
| **Development** | `task dev` | Start frontend + backend |
| | `task frontend` | Start frontend dev server |
| | `task backend` | Start backend with hot reload |
| **Testing** | `task test` | Run integration tests |
| | `task test:cov` | Run tests with coverage |
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
1. **Frontend** (React/Vite) - User interface on :3000
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
- ✅ **Integration Tests** - Comprehensive pytest test suite

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
