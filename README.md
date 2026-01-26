# Autolab

[![Build Status](https://drone.dcommunity.space/api/badges/AlexGrek/carpaintr/status.svg?ref=refs/heads/main)](https://drone.dcommunity.space/AlexGrek/carpaintr)

## Project Structure

```
carpaintr/
├── backend-service-rust/   # Rust backend API (Axum)
├── carpaintr-front/        # React frontend (Vite + TypeScript)
├── pdf_backend/            # PDF generation service (Python/Flask + WeasyPrint)
├── k8s-deploy/             # Kubernetes deployment manifests
├── autolab-chart/          # Helm chart
├── data/                   # Initial data for deployment
└── Taskfile.yml            # Task runner configuration
```

## Prerequisites

- [Task](https://taskfile.dev/) - Task runner (install: `go install github.com/go-task/task/v3/cmd/task@latest`)
- [Rust](https://rustup.rs/) with `cargo-watch` (`cargo install cargo-watch`)
- [Node.js](https://nodejs.org/) (v24+ recommended)
- [Docker](https://www.docker.com/) (for building/deploying)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (for Kubernetes deployment)

## Development

Start both frontend and backend in development mode:

```sh
task dev
```

This will:
1. Install frontend dependencies if needed
2. Start the Vite dev server (frontend)
3. Start the Rust backend with hot reload

### Backend only

```sh
task backend
```

Or manually:

```sh
cd backend-service-rust
cargo run
```

The backend listens on port `8080`.

### Frontend only

```sh
task frontend
```

Or manually:

```sh
cd carpaintr-front
npm run dev
```

The frontend dev server proxies API requests to the backend on port `8080`.

## Available Tasks

Run `task` or `task --list` to see all available tasks:

| Task | Description |
|------|-------------|
| `task dev` | Start frontend and backend in development mode |
| `task frontend` | Start frontend development server |
| `task backend` | Start backend with hot reload |
| `task docker-build` | Build all Docker images |
| `task docker-build-backend` | Build backend Docker image |
| `task docker-build-pdfgen` | Build PDF generator Docker image |
| `task docker-push` | Push all Docker images to registry |
| `task all` | Build and push all Docker images |
| `task redeploy` | Build, push, and restart pods |
| `task deploy-pdfgen` | Deploy PDF generator to Kubernetes |
| `task deploy-service` | Deploy all services to Kubernetes |

### Configuration Variables

Override default values using `--var`:

```sh
task docker-build --var NAME=my-api --var NAMESPACE=production
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NAME` | `autolab-api` | Backend image name |
| `PDFGEN_NAME` | `autolab-pdfgen` | PDF generator image name |
| `NAMESPACE` | `autolab` | Kubernetes namespace |

## Tech Stack

### Backend (`backend-service-rust/`)
- **Framework**: Axum 0.8
- **Runtime**: Tokio
- **Database**: Sled (embedded)
- **Auth**: JWT + bcrypt

### Frontend (`carpaintr-front/`)
- **Framework**: React 19 + TypeScript
- **Build tool**: Vite 7
- **UI**: RSuite + TailwindCSS 4
- **State/Routing**: React Router DOM

### PDF Generator (`pdf_backend/`)
- **Framework**: Flask
- **PDF Engine**: WeasyPrint

## Docker Build

The main Dockerfile uses a multi-stage build:
1. **Frontend stage**: Builds React app with Node.js
2. **Backend stage**: Compiles Rust binary
3. **Runtime stage**: Minimal Debian image with the binary and static files

Build all images:

```sh
task docker-build
```

## Kubernetes Deployment

Deploy to Kubernetes (k3s):

```sh
task deploy-service
```

This applies:
- `k8s-deploy/secret.yaml` - Application secrets
- `k8s-deploy/k3s-deployment.yaml` - Main API deployment
- `k8s-deploy/pdfgen-k3s-deployment.yaml` - PDF generator deployment
- `k8s-deploy/traefik-ingressroute.yaml` - Traefik ingress configuration

## CI/CD

The project uses Drone CI (`.drone.yml`) for automated builds.
