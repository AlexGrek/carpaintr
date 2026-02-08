# Carpaintr Documentation

Welcome to the Carpaintr (Autolab) documentation. This directory contains comprehensive guides for developers, operators, and administrators.

## Documentation Index

### Core Guides

- **[Development Guide](development.md)** 🔧
  - Local development setup
  - Project structure and code organization
  - Testing workflows (integration tests, linting)
  - Frontend & backend development
  - Common development tasks
  - Troubleshooting

- **[Deployment Guide](deployment.md)** 🚀
  - Docker build and registry management
  - Kubernetes deployment (kubectl + Helm)
  - Configuration and secrets management
  - CI/CD setup (Drone, GitHub Actions)
  - Production checklist
  - Monitoring and troubleshooting

- **[Backup & Restore Guide](backup.md)** 💾
  - Automated backup system overview
  - Configuration and scheduling
  - Monitoring backups
  - Full and partial restore procedures
  - External storage integration (S3)
  - Disaster recovery planning

## Quick Navigation

### I want to...

| Task | Documentation |
|------|---------------|
| Set up local development | [Development Guide → Quick Start](development.md#quick-start) |
| Run tests | [Development Guide → Testing](development.md#testing) |
| Add a new API endpoint | [Development Guide → Backend Development](development.md#backend-development) |
| Add a new frontend page | [Development Guide → Frontend Development](development.md#frontend-development) |
| Deploy to Kubernetes | [Deployment Guide → Kubernetes Deployment](deployment.md#kubernetes-deployment) |
| Configure Helm values | [Deployment Guide → Configuration](deployment.md#configuration) |
| Set up CI/CD pipeline | [Deployment Guide → CI/CD](deployment.md#cicd) |
| Configure backups | [Backup Guide → Configuration](backup.md#configuration) |
| Restore from backup | [Backup Guide → Restore Procedures](backup.md#restore-procedures) |
| Monitor backup status | [Backup Guide → Monitoring Backups](backup.md#monitoring-backups) |
| Troubleshoot deployment issues | [Deployment Guide → Troubleshooting](deployment.md#troubleshooting) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Stack                        │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   Frontend       │         │   Backend API    │         │
│  │   React + Vite   ├────────▶│   Axum + Rust    │         │
│  │   Port: 3000     │         │   Port: 8080     │         │
│  └──────────────────┘         └────────┬─────────┘         │
│                                         │                    │
│                                         ▼                    │
│                              ┌──────────────────┐           │
│                              │   PDF Service    │           │
│                              │   Flask + Python │           │
│                              │   Port: 5000     │           │
│                              └──────────────────┘           │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   Data Store     │         │   Backup Store   │         │
│  │   Sled DB        │         │   tar.gz files   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technologies |
|-----------|-------------|
| **Backend** | Rust, Axum 0.8, Tokio, Sled (embedded DB), JWT, bcrypt |
| **Frontend** | React 19, TypeScript, Vite 7, RSuite, TailwindCSS 4 |
| **PDF Service** | Python, Flask, WeasyPrint, Jinja2 |
| **Testing** | pytest, httpx (async), coverage |
| **Deployment** | Docker, Kubernetes, Helm, k3s, Traefik |
| **CI/CD** | Drone CI, GitHub Actions |

## Key Features

- **Authentication**: JWT-based with bcrypt password hashing
- **Authorization**: Admin system with file-based configuration
- **License Management**: Generate and validate user licenses
- **Calculation Engine**: Car paint calculations with T2 tables
- **File Management**: Editor with git-like commit system
- **PDF Generation**: HTML to PDF rendering for reports
- **Automated Backups**: Kubernetes CronJob with retention management
- **i18n**: Multi-language support (English, Ukrainian)
- **Integration Tests**: Comprehensive pytest test suite

## Getting Started

### For Developers

1. Read [Development Guide → Quick Start](development.md#quick-start)
2. Clone repository and install prerequisites
3. Run `task dev` to start development environment
4. Make changes and run `task test` to verify

### For Operators

1. Read [Deployment Guide → Prerequisites](deployment.md#prerequisites)
2. Build Docker images: `task docker-build`
3. Deploy with Helm: See [Helm Deployment](deployment.md#helm-deployment)
4. Configure backups: See [Backup Guide](backup.md)

### For Administrators

1. Configure secrets and admin users: [Deployment → Configuration](deployment.md#configuration)
2. Set up monitoring: [Deployment → Monitoring](deployment.md#monitoring)
3. Plan disaster recovery: [Backup → Disaster Recovery](backup.md#disaster-recovery-plan)

## Project Structure Reference

```
carpaintr/
├── backend-service-rust/       # Rust backend
│   ├── src/api/v1/            # API endpoints
│   ├── src/auth/              # Authentication
│   ├── src/middleware/        # Auth, admin, license middlewares
│   ├── src/db/                # Database operations
│   └── src/calc/              # Business logic
│
├── carpaintr-front/           # React frontend
│   ├── src/pages/             # Page components
│   ├── src/components/        # Reusable components
│   ├── src/localization/      # i18n
│   └── src/utils/             # API helpers
│
├── pdf_backend/               # PDF service
│   ├── app.py                 # Flask app
│   └── templates/             # Jinja2 templates
│
├── backend-integration-tests/ # Integration tests
│   ├── tests/
│   └── pyproject.toml
│
├── autolab-chart/             # Helm chart
│   └── autolab-chart/autolab/
│       ├── values.yaml
│       └── templates/
│
└── docs/                      # Documentation (you are here)
    ├── README.md              # This file
    ├── development.md
    ├── deployment.md
    └── backup.md
```

## Common Commands

### Development
```bash
task dev                # Start full development environment
task test               # Run integration tests
task backend            # Start backend only
task frontend           # Start frontend only
```

### Deployment
```bash
task docker-build       # Build Docker images
task docker-push        # Push to registry
task redeploy           # Build, push, restart k8s pods
helm install autolab ./autolab-chart/autolab-chart/autolab
helm upgrade autolab ./autolab-chart/autolab-chart/autolab
```

### Backup
```bash
kubectl get cronjob                                    # View backup schedule
kubectl logs job/<backup-job-name>                     # View backup logs
kubectl create job --from=cronjob/... manual-backup   # Manual backup
helm upgrade --set backup.retention=30                # Change retention
```

## Additional Resources

- **Main README**: [../README.md](../README.md)
- **CLAUDE.md**: [../CLAUDE.md](../CLAUDE.md) - AI assistant instructions
- **Integration Tests README**: [../backend-integration-tests/README.md](../backend-integration-tests/README.md)
- **Helm Chart**: [../autolab-chart/autolab-chart/autolab/](../autolab-chart/autolab-chart/autolab/)

## Contributing to Documentation

When adding new documentation:
1. Create a new `.md` file in this directory
2. Add it to the index above
3. Link to it from the main [README.md](../README.md)
4. Update [CLAUDE.md](../CLAUDE.md) if relevant for AI assistance
5. Use clear headings and navigation
6. Include code examples where helpful
7. Add troubleshooting sections for common issues

## Support

- **Issues**: [GitHub Issues](https://github.com/AlexGrek/carpaintr/issues)
- **Build Status**: [Drone CI](https://drone.dcommunity.space/AlexGrek/carpaintr)

---

*Documentation last updated: 2026-02-09*
