# Secrets Management

This document explains how Kubernetes secrets are managed to ensure stable JWT authentication and license validation across deployments.

## Overview

The Autolab API requires three types of secrets:

1. **JWT_SECRET** - Used to sign and validate user authentication tokens
2. **LICENSE_JWT_SECRET** - Used to sign and validate license tokens
3. **admins.txt** - File containing admin email addresses

These secrets are **critical** because:
- Users can't login if JWT_SECRET changes
- Licenses become invalid if LICENSE_JWT_SECRET changes
- Admin functionality breaks if admins.txt changes

## The Problem: Secret Regeneration

**Previous behavior (BROKEN)**: The Helm template would auto-generate random secrets on every `helm upgrade`, breaking authentication.

```yaml
# OLD - DON'T USE THIS
SECRET_KEY: {{ randAlphaNum 32 | b64enc | quote }}  # Changes on every deploy!
```

**New behavior (FIXED)**: Helm never touches secrets. They are created once and persist.

```yaml
# NEW - Helm skips secret creation
secret:
  create: false  # Secrets must be pre-created in the cluster
```

## Architecture

```
┌─────────────────────────────────────────┐
│ Kubernetes Cluster                      │
├─────────────────────────────────────────┤
│                                         │
│  Secret: autolab-api-secret             │
│  ├── SECRET_KEY (JWT_SECRET)            │
│  ├── SECRET_KEY_LICENSE                 │
│  └── admins.txt                         │
│                                         │
│  ↑ Created ONCE, never touched by Helm │
│                                         │
│  StatefulSet: autolab-<env>             │
│  └── mounts secret & reads values       │
│      (Helm does NOT create/modify it)   │
│                                         │
└─────────────────────────────────────────┘
```

## Setup Instructions

### First-Time Initialization

Initialize secrets for your environment **before** deploying Helm:

```bash
# For development
task secret-init-dev

# For staging
task secret-init-staging

# For production
task secret-init-prod
```

Or use the script directly:

```bash
./scripts/init-secrets.sh <namespace> <release> [admins-file]
```

**Examples**:
```bash
# Dev environment
./scripts/init-secrets.sh autolab-dev autolab-dev

# Staging environment
./scripts/init-secrets.sh autolab-staging autolab-staging

# Production environment (with custom admins file)
./scripts/init-secrets.sh autolab-prod0 autolab-prod backend-service-rust/admins.txt
```

### Environment-Specific Setup

#### Development (`autolab-dev`)

Dev environment uses **auto-generated secrets for convenience**:

```bash
# Initialize (or let Helm create automatically on first deploy)
task secret-init-dev

# Deploy
task deploy-dev

# Secrets will be created with stable values and persist across redeployments
```

**values-dev.yaml** has `create: true`, so Helm can create the secret automatically.

#### Staging (`autolab-staging`)

Staging secrets must be pre-created (no auto-generation):

```bash
# 1. Initialize secrets first
task secret-init-staging

# 2. Verify creation
kubectl get secret autolab-api-secret -n autolab-staging

# 3. Then deploy
task deploy-staging

# 4. Redeploy never touches the secret
task redeploy-staging
```

**values-staging.yaml** has `create: false`, so Helm skips secret creation.

#### Production (`autolab-prod0`)

Production requires careful secret initialization:

```bash
# 1. Initialize secrets first (one-time operation)
task secret-init-prod

# 2. Verify secret exists
kubectl get secret autolab-api-secret -n autolab-prod0

# 3. Deploy application
task deploy-prod

# 4. Redeploy and scaling events never touch the secret
task redeploy-prod
```

**values-prod.yaml** has `create: false`, so Helm skips secret creation.

## Secret Lifecycle

### Creation (One-Time)

```bash
task secret-init ENV=<env>
  ↓
init-secrets.sh generates random JWT_SECRET and LICENSE_JWT_SECRET
  ↓
Stores in Kubernetes Secret: autolab-api-secret
  ↓
Secret persists in etcd (survives pod restarts, redeployments, cluster upgrades)
```

### Deployment (Read-Only)

```bash
task deploy ENV=<env> or task redeploy ENV=<env>
  ↓
helm upgrade --install renders templates
  ↓
secret.yaml checks: if .Values.secret.create == false → SKIP (don't touch secret)
  ↓
StatefulSet mounts existing secret from etcd
  ↓
Application reads JWT_SECRET and LICENSE_JWT_SECRET from mounted secret
  ↓
Tokens remain valid because secrets unchanged
```

## Viewing Secrets

```bash
# View secret keys (not values - for security)
kubectl get secret autolab-api-secret -n <namespace> -o jsonpath='{.data}' | jq 'keys[]'

# View secret metadata
kubectl get secret autolab-api-secret -n <namespace> -o yaml

# Decode specific key (for troubleshooting only)
kubectl get secret autolab-api-secret -n <namespace> -o jsonpath='{.data.SECRET_KEY}' | base64 -d
```

## Backup & Restore

### What Gets Backed Up

✅ **Database data** (in PersistentVolume)
- User accounts and passwords (bcrypt hashed)
- Licenses and license data
- Calculations, attachments, logs
- Everything in `/data/sled_db`

❌ **NOT backed up** (in Kubernetes Secrets)
- JWT_SECRET
- LICENSE_JWT_SECRET
- admins.txt

### Restore Process

When restoring from backup:

```bash
# 1. Secrets already exist in cluster (from initial setup)
#    → Skip secret initialization

# 2. Restore database
task db-restore ENV=prod BACKUP_FILE=autolab-backup-20260218_120000.tar.gz

# 3. Secrets are unchanged, so JWT and licenses continue to work
#    → Users can login immediately
#    → Licenses remain valid
```

**Important**: If cluster/namespace was deleted:

```bash
# 1. Recreate namespace
kubectl create namespace autolab-prod0

# 2. RESTORE SECRETS FIRST (or init if lost)
#    ⚠️  Use the SAME secrets as before!
#    This is why you should store backups of:
#    - SECRET_KEY value
#    - LICENSE_JWT_SECRET value
task secret-init-prod

# 3. Restore database
task db-restore ENV=prod BACKUP_FILE=autolab-backup-20260218_120000.tar.gz

# 4. Deploy
task deploy-prod
```

## Troubleshooting

### Problem: "Secret not found" error after deployment

**Cause**: Deployed without initializing secrets first.

**Solution**:
```bash
# Initialize secrets
task secret-init ENV=<env>

# Restart pods to pick up secret
task restart ENV=<env>
```

### Problem: "JWT validation failed" after redeploy

**Cause**: Secrets were regenerated (old configuration).

**Solution**:
```bash
# Check secret creation setting
kubectl get secret autolab-api-secret -n <namespace> -o yaml | grep -i secret

# If using `create: true` in values file, fix it:
# 1. Remove helm release
task undeploy ENV=<env>

# 2. Delete old secret
kubectl delete secret autolab-api-secret -n <namespace>

# 3. Initialize with new stable secrets
task secret-init ENV=<env>

# 4. Redeploy
task deploy ENV=<env>
```

### Problem: "admins.txt not found" in logs

**Cause**: admins.txt was not properly mounted or is empty.

**Solution**:
```bash
# Check if admins.txt key exists in secret
kubectl get secret autolab-api-secret -n <namespace> -o jsonpath='{.data.admins\.txt}' | base64 -d

# If missing, reinitialize with correct admins file
task secret-init ENV=<env>

# Restart pod
task restart ENV=<env>
```

## Security Best Practices

1. **Store secret backups securely** (encrypted password manager, sealed secrets, etc.)
   - Keep records of: JWT_SECRET and LICENSE_JWT_SECRET values
   - Keep admins.txt file

2. **Never commit secrets to git**
   - Use `.gitignore` for any local secret files
   - Store actual secret values outside the repo

3. **Rotate secrets periodically**
   - Create new secrets manually
   - Update Helm values
   - Perform controlled redeploy

4. **Audit secret access**
   - Log who accessed secrets
   - Review kubectl logs for secret operations

## Configuration Reference

### values.yaml (Default - NEVER CHANGE FOR PROD)

```yaml
secret:
  create: false  # Default: don't auto-create (safer)
  secretKey: ""  # Not used if create: false
  secretKeyLicense: ""  # Not used if create: false
  admins: ""  # Not used if create: false
```

### values-dev.yaml (Development - Safe to Auto-Create)

```yaml
secret:
  create: true  # Auto-create for dev convenience
  secretKey: "dev-jwt-secret-change-in-production"
  secretKeyLicense: "dev-license-secret-change-in-production"
  admins: |
    admin@example.com
    admin@admin.com
```

### values-staging.yaml (Staging - Must Pre-Create)

```yaml
secret:
  create: false  # Must be pre-created before deploy
  # (no secretKey, secretKeyLicense, admins - not used)
```

### values-prod.yaml (Production - Must Pre-Create)

```yaml
secret:
  create: false  # Must be pre-created before deploy
  # (no secretKey, secretKeyLicense, admins - not used)
```

## Commands Reference

### Secret Initialization

```bash
# Initialize for specific environment
task secret-init ENV=dev
task secret-init ENV=staging
task secret-init ENV=prod

# Or use script directly
./scripts/init-secrets.sh autolab-prod0 autolab-prod
```

### Deployment (After Secrets Are Created)

```bash
# Deploy (uses existing secret)
task deploy ENV=<env>

# Redeploy (uses existing secret, never touches it)
task redeploy ENV=<env>

# View secret status
task secret-show ENV=<env>
```

### Secret Inspection

```bash
# List all secrets in namespace
kubectl get secrets -n <namespace>

# View secret keys
kubectl get secret autolab-api-secret -n <namespace> -o jsonpath='{.data}' | jq

# View full secret (YAML)
kubectl get secret autolab-api-secret -n <namespace> -o yaml

# Delete secret (careful!)
kubectl delete secret autolab-api-secret -n <namespace>
```

## Related Documentation

- [Deployment Guide](./deployment.md) - How to deploy the application
- [Backup & Restore](./backup.md) - How to backup and restore data
- [Development Guide](./development.md) - Local development setup
