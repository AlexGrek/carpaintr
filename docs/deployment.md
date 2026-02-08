# Deployment Guide

This guide covers deploying Carpaintr (Autolab) to Kubernetes using Docker and Helm.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Docker Build](#docker-build)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Helm Deployment](#helm-deployment)
- [Configuration](#configuration)
- [CI/CD](#cicd)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** - For building container images
- **kubectl** - Kubernetes CLI tool
- **Helm** (v3+) - Package manager for Kubernetes
- **Task** - Task runner (optional, for convenience commands)
- **Git** - For version control and CI/CD

### Kubernetes Cluster

- **k3s** (recommended) or any Kubernetes cluster (1.24+)
- **Traefik** ingress controller (or configure for your ingress)
- **cert-manager** (optional, for TLS certificates)
- Storage provisioner for PersistentVolumes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                       │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Ingress    │         │   Ingress    │                 │
│  │  (Traefik)   │────────▶│  Controller  │                 │
│  └──────────────┘         └──────────────┘                 │
│         │                         │                         │
│         │                         │                         │
│  ┌──────▼──────────┐     ┌───────▼────────┐               │
│  │  StatefulSet    │     │   Deployment   │               │
│  │  autolab-api    │────▶│  pdfgen        │               │
│  │  (Rust/Axum)    │     │  (Flask)       │               │
│  └─────────────────┘     └────────────────┘               │
│         │                                                   │
│  ┌──────▼──────────┐                                       │
│  │ PVC: Data       │                                       │
│  │ (Sled DB)       │                                       │
│  └─────────────────┘                                       │
│         │                                                   │
│  ┌──────▼──────────┐                                       │
│  │ PVC: Backups    │                                       │
│  │ (tar.gz)        │                                       │
│  └─────────────────┘                                       │
│                                                              │
│  ┌──────────────────┐                                      │
│  │   CronJob        │                                      │
│  │   Backup         │                                      │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

## Docker Build

### Multi-Stage Build Process

The application uses a multi-stage Dockerfile:

1. **Frontend Stage** - Builds React app with Node.js
2. **Backend Stage** - Compiles Rust binary
3. **Runtime Stage** - Minimal Debian image with binary and static files

### Build Commands

```bash
# Build all images (backend + pdfgen in parallel)
task docker-build

# Build individually
task docker-build-backend
task docker-build-pdfgen

# Build with custom tags
docker build -t grekodocker/autolab-api:$(git rev-parse --short HEAD) .
docker build -t grekodocker/autolab-pdf:$(git rev-parse --short HEAD) ./pdf_backend
```

### Push to Registry

```bash
# Push all images
task docker-push

# Push to custom registry
docker tag grekodocker/autolab-api:latest myregistry.com/autolab-api:v1.0.0
docker push myregistry.com/autolab-api:v1.0.0
```

## Kubernetes Deployment

### Option 1: Using Task Commands (Quick)

```bash
# Build, push, and restart pods
task redeploy

# Deploy services individually
task deploy-service
task deploy-pdfgen
```

### Option 2: Manual kubectl (Raw Manifests)

```bash
# Create namespace
kubectl create namespace autolab

# Apply secrets (configure first!)
kubectl apply -f k8s-deploy/secret.yaml -n autolab

# Deploy backend
kubectl apply -f k8s-deploy/k3s-deployment.yaml -n autolab

# Deploy PDF generator
kubectl apply -f k8s-deploy/pdfgen-k3s-deployment.yaml -n autolab

# Configure ingress
kubectl apply -f k8s-deploy/traefik-ingressroute.yaml -n autolab
```

### Raw Manifests Structure

```
k8s-deploy/
├── secret.yaml                    # JWT secrets, admin list
├── k3s-deployment.yaml            # Backend StatefulSet + Services
├── pdfgen-k3s-deployment.yaml     # PDF generator Deployment + Service
└── traefik-ingressroute.yaml     # Traefik ingress configuration
```

## Helm Deployment

**Recommended for production** - Provides better configuration management and upgrades.

### Chart Location

```
autolab-chart/
└── autolab-chart/
    └── autolab/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
            ├── statefulset.yaml
            ├── pdfgen-deployment.yaml
            ├── backup-cronjob.yaml
            ├── ingress.yaml
            ├── secret.yaml
            └── services...
```

### Initial Installation

```bash
# Install with default values
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --create-namespace \
  --set image.tag=$(git rev-parse --short HEAD) \
  --set pdfgen.image.tag=$(git rev-parse --short HEAD)

# Install with custom values
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --create-namespace \
  --values my-values.yaml
```

### Upgrading Deployment

```bash
# Upgrade to new version
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --set image.tag=abc1234 \
  --set pdfgen.image.tag=abc1234

# Upgrade with new configuration
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --values production-values.yaml
```

### Rollback

```bash
# List releases
helm list -n autolab

# View history
helm history autolab -n autolab

# Rollback to previous version
helm rollback autolab -n autolab

# Rollback to specific revision
helm rollback autolab 3 -n autolab
```

## Configuration

### Environment Variables

Configured via Helm values or Kubernetes secrets:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing | Auto-generated |
| `LICENSE_JWT_SECRET` | Secret key for license tokens | Auto-generated |
| `DATABASE_URL` | Path to Sled database | `/app/data/sled_db` |
| `DATA_DIR_PATH` | Application data directory | `/app/data` |
| `ADMIN_FILE_PATH` | Path to admin users file | `/var/secrets/admins.txt` |
| `PDF_GEN_URL_POST` | PDF service endpoint | `http://autolab-pdfgen/generate` |
| `LOG_FILE_PATH` | Application log file | `/app/data/application.log` |
| `LICENSE_CACHE_SIZE` | License cache size | `100` |
| `ENVIRONMENT` | Environment identifier | `production` |

### Helm Values Configuration

**Key values.yaml sections:**

```yaml
# Image configuration
image:
  repository: grekodocker/autolab-api
  tag: ""  # REQUIRED: Set via --set image.tag=xxx
  pullPolicy: IfNotPresent

# Secrets (auto-generated if empty)
secret:
  create: true
  secretKey: ""
  secretKeyLicense: ""
  admins: ""

# Resource limits
resources:
  limits:
    cpu: "500m"
    memory: "512Mi"
  requests:
    cpu: "100m"
    memory: "256Mi"

# Persistence
persistence:
  size: 1Gi
  storageClassName: ""  # Use cluster default

# Ingress
ingress:
  enabled: true
  className: "traefik"
  host: autolab.dcommunity.space
  tls:
    enabled: true
    secretName: autolab-cert

# Backup (see backup.md for details)
backup:
  enabled: true
  schedule: "0 0 * * *"
  retention: 10
  storageSize: 5Gi
```

### Secrets Management

**Option 1: Auto-generated (default)**

Helm will generate random secrets on first install:

```bash
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --set image.tag=abc1234
```

**Option 2: Provide custom secrets**

```bash
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --set secret.secretKey="your-jwt-secret-here" \
  --set secret.secretKeyLicense="your-license-secret-here" \
  --set secret.admins="admin@example.com\nuser@example.com"
```

**Option 3: External secret management**

```bash
# Create secret manually
kubectl create secret generic autolab-api-secret \
  --from-literal=SECRET_KEY="..." \
  --from-literal=SECRET_KEY_LICENSE="..." \
  --from-file=admins.txt=./admins.txt \
  -n autolab

# Install with external secret
helm install autolab ./autolab-chart/autolab-chart/autolab \
  --set secret.create=false \
  --set secretName=autolab-api-secret
```

### Admin Users

Admin users are defined in `admins.txt` file. Format: one email per line.

**Via Helm:**
```bash
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set secret.admins="admin@example.com\nadmin2@example.com"
```

**Direct file:**
```bash
# backend-service-rust/admins.txt (for local dev)
admin@example.com
superuser@company.com
```

### Storage Configuration

**Default storage (cluster default StorageClass):**
```yaml
persistence:
  size: 1Gi
  storageClassName: ""
```

**Custom StorageClass:**
```yaml
persistence:
  size: 10Gi
  storageClassName: "fast-ssd"

backup:
  storageSize: 50Gi
  storageClassName: "standard"
```

### Ingress Configuration

**Traefik (default):**
```yaml
ingress:
  enabled: true
  className: "traefik"
  host: autolab.example.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  tls:
    enabled: true
    secretName: autolab-cert
```

**Nginx:**
```yaml
ingress:
  enabled: true
  className: "nginx"
  host: autolab.example.com
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

## CI/CD

### Drone CI

The project uses Drone CI (`.drone.yml`) for automated builds.

**Pipeline stages:**
1. **Build** - Compiles backend, builds frontend
2. **Docker** - Builds and pushes container images
3. **Deploy** - Updates Kubernetes deployment (optional)

**Configuration:**
```yaml
# .drone.yml
kind: pipeline
name: default

steps:
  - name: build
    image: rust:latest
    commands:
      - cargo build --release

  - name: docker-backend
    image: plugins/docker
    settings:
      repo: grekodocker/autolab-api
      tags: ${DRONE_COMMIT_SHA:0:8}

  - name: docker-pdfgen
    image: plugins/docker
    settings:
      repo: grekodocker/autolab-pdf
      tags: ${DRONE_COMMIT_SHA:0:8}
```

### GitHub Actions (Alternative)

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker images
        run: |
          docker build -t autolab-api:${{ github.sha }} .
          docker build -t autolab-pdf:${{ github.sha }} ./pdf_backend

      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push autolab-api:${{ github.sha }}
          docker push autolab-pdf:${{ github.sha }}

      - name: Deploy to Kubernetes
        run: |
          helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
            --set image.tag=${{ github.sha }} \
            --set pdfgen.image.tag=${{ github.sha }}
```

## Monitoring

### Health Checks

```bash
# Check pod status
kubectl get pods -n autolab

# Check pod health
kubectl describe pod autolab-api-0 -n autolab

# View logs
kubectl logs -f autolab-api-0 -n autolab
kubectl logs -f deployment/autolab-pdfgen -n autolab
```

### Application Logs

```bash
# Backend logs
kubectl exec -it autolab-api-0 -n autolab -- tail -f /app/data/application.log

# PDF generator logs
kubectl logs -f deployment/autolab-pdfgen -n autolab
```

### Metrics & Monitoring

**Prometheus & Grafana (optional):**

```bash
# Add Prometheus annotations to services
kubectl annotate service autolab-api prometheus.io/scrape="true"
kubectl annotate service autolab-api prometheus.io/port="8080"
kubectl annotate service autolab-api prometheus.io/path="/metrics"
```

## Troubleshooting

### Common Issues

#### Pod CrashLoopBackOff

```bash
# Check logs
kubectl logs autolab-api-0 -n autolab --previous

# Check events
kubectl describe pod autolab-api-0 -n autolab

# Common causes:
# - Missing secrets
# - Database mount issues
# - Configuration errors
```

#### Image Pull Errors

```bash
# Check image pull policy
kubectl describe pod autolab-api-0 -n autolab | grep -A 5 "Image"

# Verify image exists
docker pull grekodocker/autolab-api:abc1234

# Check imagePullSecrets if using private registry
kubectl get secrets -n autolab
```

#### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n autolab
kubectl describe ingress autolab-api -n autolab

# Check ingress controller
kubectl get pods -n kube-system | grep traefik
kubectl logs -n kube-system deployment/traefik

# Test internal service
kubectl run curl --rm -it --restart=Never --image=curlimages/curl -- \
  curl http://autolab-api:8080/api/v1/health
```

#### Database Issues

```bash
# Check PVC
kubectl get pvc -n autolab
kubectl describe pvc autolab-api-storage-autolab-api-0 -n autolab

# Check volume mount
kubectl exec -it autolab-api-0 -n autolab -- ls -la /app/data

# Restore from backup (see backup.md)
```

#### Performance Issues

```bash
# Check resource usage
kubectl top pod autolab-api-0 -n autolab

# Adjust resource limits
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set resources.limits.cpu="1000m" \
  --set resources.limits.memory="1Gi"
```

### Debug Mode

```bash
# Enable debug logging
kubectl set env statefulset/autolab-api RUST_LOG=debug -n autolab

# Access pod shell
kubectl exec -it autolab-api-0 -n autolab -- /bin/bash

# Check environment
kubectl exec autolab-api-0 -n autolab -- env | grep -E "(JWT|DATABASE|DATA_DIR)"
```

### Rolling Back

```bash
# Helm rollback
helm rollback autolab -n autolab

# Manual rollback (update image tag)
kubectl set image statefulset/autolab-api autolab-api=grekodocker/autolab-api:previous-tag -n autolab
```

## Maintenance

### Scaling

**Note**: Backend uses Sled (embedded DB) and should run as a single replica.

```yaml
# values.yaml
replicaCount: 1  # DO NOT increase for backend

# PDF generator can scale
pdfgen:
  replicaCount: 3  # Scale PDF generation
```

### Upgrades

**Before upgrading:**
1. Create backup (see [backup.md](./backup.md))
2. Test in staging environment
3. Review changelog and breaking changes
4. Plan maintenance window

**Upgrade process:**
```bash
# 1. Backup current state
kubectl create job --from=cronjob/autolab-api-backup pre-upgrade-backup

# 2. Upgrade Helm release
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --namespace autolab \
  --set image.tag=new-version

# 3. Monitor rollout
kubectl rollout status statefulset/autolab-api -n autolab

# 4. Verify functionality
curl https://autolab.example.com/api/v1/health

# 5. If issues, rollback
helm rollback autolab -n autolab
```

### Cleanup

```bash
# Uninstall Helm release
helm uninstall autolab -n autolab

# Delete namespace (removes all resources)
kubectl delete namespace autolab

# Manually delete PVCs if needed
kubectl delete pvc -n autolab --all
```

## Production Checklist

- [ ] Secrets configured securely (not auto-generated)
- [ ] TLS certificates configured (cert-manager or manual)
- [ ] Resource limits set appropriately
- [ ] Persistent storage configured with appropriate StorageClass
- [ ] Backup system enabled and tested (see [backup.md](./backup.md))
- [ ] Admin users configured
- [ ] Ingress configured with correct hostname
- [ ] Monitoring and logging set up
- [ ] CI/CD pipeline configured
- [ ] Disaster recovery plan documented
- [ ] Staging environment tested
- [ ] Health check endpoints verified

## Related Documentation

- [Backup & Restore Guide](./backup.md)
- [Development Setup](./development.md)
- [Main README](../README.md)

## Support

For deployment issues:
1. Check logs: `kubectl logs -f autolab-api-0 -n autolab`
2. Check events: `kubectl get events -n autolab --sort-by='.lastTimestamp'`
3. Review troubleshooting section above
4. Check [GitHub issues](https://github.com/AlexGrek/carpaintr/issues)
