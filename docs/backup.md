# Backup System Documentation

## Overview

The Carpaintr application includes an automated backup system that runs as a Kubernetes CronJob. It creates compressed archives of the application data and stores them in a separate persistent volume with automatic retention management.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     StatefulSet Pod                         │
│                   (autolab-api-0)                          │
│                                                             │
│  /app/data ← Main data volume (Sled DB, logs, files)      │
│  (Backup volume NOT mounted here for security)             │
└─────────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────────────────────┐
         │   Backup CronJob (daily)        │
         │   - Mounts BOTH volumes         │
         │   - Reads from /app/data        │
         │   - Writes to /backups          │
         └─────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backup PVC (separate)                    │
│                                                             │
│  /backups ← Backup storage (only accessible via jobs/pods) │
│    ├── autolab-backup-20260218_000000.tar.gz (latest)     │
│    ├── autolab-backup-20260217_000000.tar.gz              │
│    ├── autolab-backup-20260216_000000.tar.gz              │
│    └── ... (retention: last 10)                           │
└─────────────────────────────────────────────────────────────┘
```

**Security Design:**
- The backup volume is **intentionally NOT mounted** on the main application pod
- This prevents accidental deletion or modification of backups
- Backups are only accessible via:
  - Backup CronJob (read-only access to data, write to backups)
  - Restore jobs (read-only access to backups, write to data)
  - Temporary pods created by Taskfile commands
  - Manual kubectl operations

## Default Configuration

| Setting | Default Value | Description |
|---------|--------------|-------------|
| **Enabled** | `true` | Backups are enabled by default |
| **Schedule** | `0 0 * * *` | Daily at midnight UTC (2-3 AM Kyiv) |
| **Retention** | `10` | Keep last 10 backup archives |
| **Storage Size** | `5Gi` | Size of backup PVC |
| **Timezone** | `Europe/Kyiv` | Timezone for log timestamps |
| **Image** | `busybox:1.36` | Lightweight container for backup operations |

## How It Works

### Backup Process

1. **Scheduled Execution**: CronJob triggers at the configured schedule
2. **Data Archiving**: Creates a compressed tar.gz archive of `/app/data` directory
3. **Timestamping**: Names the archive with format `autolab-backup-YYYYMMDD_HHMMSS.tar.gz`
4. **Retention Management**: Automatically deletes old backups, keeping only the last N (default: 10)
5. **Logging**: Outputs progress, file size, and cleanup operations to stdout

### What Gets Backed Up

The backup includes everything in `/app/data`:
- **Sled Database** (`sled_db/`) - All application data (users, calculations, licenses, etc.)
- **Application Logs** (`application.log`) - Historical log data
- **User Files** - Any files stored by the application
- **Editor Commits** - User workspace data

### Backup Job Behavior

- **Concurrency Policy**: `Forbid` - Only one backup job runs at a time
- **Restart Policy**: `OnFailure` - Retries if backup fails
- **Read-Only Source**: Main data volume is mounted read-only for safety
- **Job History**: Keeps last 3 successful and 3 failed jobs for debugging

## Configuration

### Helm Values

All backup settings are configured in `autolab-chart/autolab-chart/autolab/values.yaml`:

```yaml
backup:
  enabled: true
  schedule: "0 0 * * *"
  timezone: "Europe/Kyiv"
  retention: 10
  storageSize: 5Gi
  storageClassName: ""
  image: "busybox:1.36"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  resources:
    limits:
      cpu: "200m"
      memory: "256Mi"
    requests:
      cpu: "50m"
      memory: "128Mi"
```

### Customization Examples

#### Change Backup Schedule

```bash
# Every 6 hours
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.schedule="0 */6 * * *"

# Every Sunday at 2 AM UTC
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.schedule="0 2 * * 0"

# Every hour
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.schedule="0 * * * *"
```

#### Adjust Retention Period

```bash
# Keep 30 backups
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.retention=30

# Keep only 3 most recent backups
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.retention=3
```

#### Increase Backup Storage

```bash
# Allocate 20Gi for backups
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.storageSize=20Gi
```

#### Disable Backups

```bash
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.enabled=false
```

#### Use Custom Storage Class

```bash
# Use SSD storage class for faster backups
helm upgrade autolab ./autolab-chart/autolab-chart/autolab \
  --set backup.storageClassName="fast-ssd"
```

## Operations

### Monitoring Backups

#### View CronJob Status

```bash
kubectl get cronjob
```

Example output:
```
NAME                    SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
autolab-api-backup      0 0 * * *     False     0        12h             30d
```

#### Check Recent Backup Jobs

```bash
kubectl get jobs | grep backup
```

Example output:
```
NAME                               COMPLETIONS   DURATION   AGE
autolab-api-backup-28501200        1/1           45s        12h
autolab-api-backup-28500000        1/1           43s        36h
autolab-api-backup-28498800        1/1           47s        60h
```

#### View Backup Logs

```bash
# Get the most recent job name
LATEST_JOB=$(kubectl get jobs --sort-by=.metadata.creationTimestamp | grep backup | tail -1 | awk '{print $1}')

# View logs
kubectl logs job/$LATEST_JOB
```

Example log output:
```
Starting backup at Sat Feb  9 00:00:05 EET 2026
Creating backup: /backups/autolab-backup-20260209_000005.tar.gz
Backup completed: /backups/autolab-backup-20260209_000005.tar.gz (234M)
Cleaning up old backups (keeping last 10 backups)...
removed '/backups/autolab-backup-20260130_000003.tar.gz'
Backup process completed successfully at Sat Feb  9 00:00:52 EET 2026
```

#### List Backup Files

**Using Taskfile (Recommended):**
```bash
# Development
task db-list-backups ENV=dev

# Staging
task db-list-backups ENV=staging

# Production
task db-list-backups ENV=prod
```

**Manual method:**
```bash
# Create a temporary pod to access backup volume
kubectl run backup-viewer --rm -i --restart=Never \
  --image=busybox:1.36 \
  -n autolab-dev \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "backup-viewer",
      "image": "busybox:1.36",
      "command": ["ls", "-lh", "/backups"],
      "volumeMounts": [{
        "name": "backup-volume",
        "mountPath": "/backups"
      }]
    }],
    "volumes": [{
      "name": "backup-volume",
      "persistentVolumeClaim": {
        "claimName": "autolab-dev-autolab-api-backup"
      }
    }]
  }
}'
```

> **Note**: The backup volume is **not mounted** on the main application pod for security reasons. It's only accessible via the backup CronJob and temporary pods. This prevents accidental modifications or deletions of backups.

### Manual Backup Trigger

To create an immediate backup without waiting for the schedule:

```bash
# Create a one-time job from the CronJob
kubectl create job --from=cronjob/autolab-api-backup manual-backup-$(date +%s)
```

### Verify Backup Integrity

```bash
# Access the backup volume
kubectl run backup-test --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "backup-test",
      "image": "busybox:1.36",
      "command": ["sh"],
      "stdin": true,
      "tty": true,
      "volumeMounts": [{
        "name": "backup-volume",
        "mountPath": "/backups"
      }]
    }],
    "volumes": [{
      "name": "backup-volume",
      "persistentVolumeClaim": {
        "claimName": "autolab-api-backup"
      }
    }]
  }
}'

# Inside the pod, test archive integrity
cd /backups
tar -tzf autolab-backup-20260209_000005.tar.gz | head -20
```

## Restore Procedures

### Quick Restore (Recommended)

The easiest way to restore from a backup is using the automated restore script via Taskfile commands.

#### Using Taskfile Commands

**List available backups:**
```bash
# Development
task db-list-backups ENV=dev

# Staging
task db-list-backups ENV=staging

# Production
task db-list-backups ENV=prod
```

**Restore from backup (already in cluster):**
```bash
# Development
task db-restore-dev BACKUP_FILE=autolab-backup-20260209_120000.tar.gz

# Staging
task db-restore-staging BACKUP_FILE=autolab-backup-20260209_120000.tar.gz

# Production (requires CONFIRM_PROD=yes)
task db-restore-prod BACKUP_FILE=autolab-backup-20260209_120000.tar.gz CONFIRM_PROD=yes
```

**Restore from local file (upload + restore in one step):**
```bash
# Development
task db-restore-from-local-dev LOCAL_FILE=./my-backup.tar.gz
task db-restore-from-local-dev LOCAL_FILE=./external-backup.zip

# Staging
task db-restore-from-local-staging LOCAL_FILE=./my-backup.tar.gz

# Production (requires CONFIRM_PROD=yes)
task db-restore-from-local-prod LOCAL_FILE=./my-backup.tar.gz CONFIRM_PROD=yes
```

**Supported formats:**
- `.tar.gz` / `.tgz` - Compressed tarballs (native format)
- `.zip` - ZIP archives (for external backups)

The restore process automatically:
1. ✓ Uploads local file to cluster (if using `db-restore-from-local-*`)
2. ✓ Verifies backup file exists
3. ✓ Scales down application (0 replicas)
4. ✓ Creates safety backup of current data
5. ✓ Clears existing data
6. ✓ Detects format and extracts backup archive (supports .tar.gz, .tgz, .zip)
7. ✓ Scales up application (1 replica)
8. ✓ Verifies restoration

#### Direct Script Usage

For more control or CI/CD integration:

```bash
# Make script executable (first time only)
chmod +x scripts/restore-from-backup.sh

# Run restore
./scripts/restore-from-backup.sh \
  <backup-filename> \
  <namespace> \
  <release-name>

# Examples:
./scripts/restore-from-backup.sh \
  autolab-backup-20260209_120000.tar.gz \
  autolab-dev \
  autolab-dev

./scripts/restore-from-backup.sh \
  autolab-backup-20260209_120000.tar.gz \
  autolab-prod0 \
  autolab-prod
```

### Manual Restore (Advanced)

For troubleshooting or custom restore scenarios:

#### Step 1: Stop the Application

```bash
# Development
kubectl scale statefulset autolab-dev-autolab-api --replicas=0 -n autolab-dev

# Production
kubectl scale statefulset autolab-prod-autolab-api --replicas=0 -n autolab-prod0
```

#### Step 2: Create Restore Job

Create a file `restore-job.yaml`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: autolab-restore-20260209
  namespace: autolab-dev  # Change to your namespace
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: restore
        image: busybox:1.36
        command:
        - /bin/sh
        - -c
        - |
          set -e
          BACKUP_FILE="/backups/autolab-backup-20260209_000005.tar.gz"

          echo "Starting restore from ${BACKUP_FILE}"

          # Verify backup exists
          if [ ! -f "${BACKUP_FILE}" ]; then
            echo "ERROR: Backup file not found!"
            exit 1
          fi

          # Create safety backup (optional)
          if [ -d /data/sled_db ]; then
            tar -czf /backups/pre-restore-backup-$(date +%Y%m%d_%H%M%S).tar.gz -C /data . || true
          fi

          # Clear existing data
          rm -rf /data/*
          rm -rf /data/.[!.]*

          # Extract backup
          tar -xzf "${BACKUP_FILE}" -C /data

          echo "Restore completed successfully"
          ls -la /data
        env:
        - name: TZ
          value: "Europe/Kyiv"
        volumeMounts:
        - name: data-volume
          mountPath: /data
        - name: backup-volume
          mountPath: /backups
          readOnly: true
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: autolab-api-storage-autolab-dev-autolab-api-0  # Update for your env
      - name: backup-volume
        persistentVolumeClaim:
          claimName: autolab-dev-autolab-api-backup  # Update for your env
```

Apply the restore job:

```bash
kubectl apply -f restore-job.yaml -n autolab-dev
kubectl logs -f job/autolab-restore-20260209 -n autolab-dev
```

#### Step 3: Clean Up Job

```bash
kubectl delete job autolab-restore-20260209 -n autolab-dev
```

#### Step 4: Restart Application

```bash
# Development
kubectl scale statefulset autolab-dev-autolab-api --replicas=1 -n autolab-dev

# Production
kubectl scale statefulset autolab-prod-autolab-api --replicas=1 -n autolab-prod0
```

#### Step 5: Verify Restoration

```bash
# Check pod status
kubectl get pods -n autolab-dev

# Check application logs
kubectl logs -f autolab-dev-autolab-api-0 -n autolab-dev

# Test API health endpoint
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- wget -O- http://localhost:8080/api/v1/health
```

### Partial Restore (Extract Specific Files)

```bash
# Create a temporary pod
kubectl run restore-viewer --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "restore-viewer",
      "image": "busybox:1.36",
      "command": ["sh"],
      "stdin": true,
      "tty": true,
      "volumeMounts": [
        {
          "name": "backup-volume",
          "mountPath": "/backups"
        },
        {
          "name": "data-volume",
          "mountPath": "/data"
        }
      ]
    }],
    "volumes": [
      {
        "name": "backup-volume",
        "persistentVolumeClaim": {"claimName": "autolab-api-backup"}
      },
      {
        "name": "data-volume",
        "persistentVolumeClaim": {"claimName": "autolab-api-storage-autolab-api-0"}
      }
    ]
  }
}'

# Inside the pod:
# List files in backup
tar -tzf /backups/autolab-backup-20260209_000005.tar.gz | grep specific-file

# Extract specific file
tar -xzf /backups/autolab-backup-20260209_000005.tar.gz -C /tmp specific-file

# Copy to data volume if needed
cp /tmp/specific-file /data/
```

## Backup to External Storage

### Download Backups to Local Machine

The easiest way to download backups is using Taskfile commands:

```bash
# List available backups first
task db-list-backups ENV=dev

# Download specific backup
task db-download-backup \
  ENV=dev \
  BACKUP_FILE=autolab-backup-20260209_120000.tar.gz

# The backup will be saved to ./backups/ directory
```

**Manual download:**
```bash
# Development
kubectl cp autolab-dev/autolab-dev-autolab-api-0:/backups/autolab-backup-20260209_120000.tar.gz \
  ./backups/autolab-backup-20260209_120000.tar.gz

# Production
kubectl cp autolab-prod0/autolab-prod-autolab-api-0:/backups/autolab-backup-20260209_120000.tar.gz \
  ./backups/autolab-backup-20260209_120000.tar.gz
```

### Upload Backups to Cluster

Upload a local backup file to the cluster (useful for migrations or restoring from external backups):

```bash
# Upload backup file
task db-upload-backup \
  ENV=dev \
  LOCAL_FILE=./backups/autolab-backup-20260209_120000.tar.gz

# Then restore it
task db-restore-dev BACKUP_FILE=autolab-backup-20260209_120000.tar.gz
```

**Manual upload:**
```bash
# Development
kubectl cp ./backups/autolab-backup-20260209_120000.tar.gz \
  autolab-dev/autolab-dev-autolab-api-0:/backups/

# Verify upload
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- ls -lh /backups/
```

### Copy All Backups (Legacy Method)

```bash
# Create a dedicated pod
kubectl run backup-copier --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='
{
  "spec": {
    "containers": [{
      "name": "copier",
      "image": "busybox:1.36",
      "command": ["sh", "-c", "while true; do sleep 3600; done"],
      "volumeMounts": [{
        "name": "backup-volume",
        "mountPath": "/backups"
      }]
    }],
    "volumes": [{
      "name": "backup-volume",
      "persistentVolumeClaim": {"claimName": "autolab-dev-autolab-api-backup"}
    }]
  }
}'

# In another terminal, copy files out
kubectl cp backup-copier:/backups ./local-backups/
```

### S3/Cloud Storage Integration

For production environments, consider extending the backup job to sync to S3/cloud storage:

```yaml
# Example modification to backup-cronjob.yaml
- name: backup
  image: amazon/aws-cli:latest
  command:
  - /bin/bash
  - -c
  - |
    # ... existing backup script ...

    # Upload to S3
    aws s3 cp "${BACKUP_FILE}" s3://my-bucket/carpaintr-backups/
    aws s3 cp "${BACKUP_FILE}" s3://my-bucket/carpaintr-backups/latest.tar.gz
  env:
  - name: AWS_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: aws-credentials
        key: access-key-id
  - name: AWS_SECRET_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: aws-credentials
        key: secret-access-key
```

## Troubleshooting

### Backup Job Fails

```bash
# Check job status
kubectl describe job <job-name>

# View logs
kubectl logs job/<job-name>

# Common issues:
# 1. Insufficient storage - increase backup.storageSize
# 2. Permission errors - check PVC access modes
# 3. Pod scheduling issues - check resource limits
```

### Backup Volume Full

```bash
# Check backup volume usage
kubectl run storage-check --rm -it --restart=Never --image=busybox:1.36 \
  --overrides='...' # (see listing backups section)

# Solutions:
# 1. Reduce retention count
# 2. Increase storageSize
# 3. Manually delete old backups
```

### Restore Fails

```bash
# Verify backup file integrity
tar -tzf /backups/backup-file.tar.gz

# Check permissions
ls -la /data

# Ensure application is stopped
kubectl get pods | grep autolab-api
```

### Missing Backups

```bash
# Check CronJob is not suspended
kubectl get cronjob autolab-api-backup -o yaml | grep suspend

# Check recent job history
kubectl get jobs --sort-by=.metadata.creationTimestamp | grep backup

# Check for job failures
kubectl get jobs | grep backup | grep -v "1/1"
```

## Best Practices

1. **Test Restores Regularly**: Periodically test restore procedures in a dev/staging environment
2. **Monitor Disk Usage**: Set up alerts for backup volume usage
3. **Off-site Backups**: For production, sync backups to external storage (S3, etc.)
4. **Retention Planning**: Balance retention count with storage costs and recovery needs
5. **Schedule Coordination**: Run backups during low-traffic periods
6. **Document Changes**: Keep this document updated with any customizations
7. **Backup Verification**: Implement automated backup integrity checks
8. **Security**: Ensure backup volumes have appropriate access controls

## Quick Reference

### Common Tasks

```bash
# List available backups
task db-list-backups ENV=dev

# Create manual backup
task db-backup ENV=dev

# Restore from backup (already in cluster)
task db-restore-dev BACKUP_FILE=autolab-backup-20260209_120000.tar.gz

# Restore from local file (auto-upload + restore)
task db-restore-from-local-dev LOCAL_FILE=./my-backup.tar.gz
task db-restore-from-local-dev LOCAL_FILE=./external-backup.zip

# Download backup to local machine
task db-download-backup ENV=dev BACKUP_FILE=autolab-backup-20260209_120000.tar.gz

# Upload backup to cluster (without restoring)
task db-upload-backup ENV=dev LOCAL_FILE=./backups/autolab-backup-20260209_120000.tar.gz
```

### Environment-Specific Commands

| Task | Development | Staging | Production |
|------|-------------|---------|------------|
| **List backups** | `task db-list-backups ENV=dev` | `task db-list-backups ENV=staging` | `task db-list-backups ENV=prod` |
| **Manual backup** | `task db-backup-dev` | `task db-backup ENV=staging` | `task db-backup ENV=prod` |
| **Restore (cluster)** | `task db-restore-dev BACKUP_FILE=...` | `task db-restore-staging BACKUP_FILE=...` | `task db-restore-prod BACKUP_FILE=... CONFIRM_PROD=yes` |
| **Restore (local)** | `task db-restore-from-local-dev LOCAL_FILE=...` | `task db-restore-from-local-staging LOCAL_FILE=...` | `task db-restore-from-local-prod LOCAL_FILE=... CONFIRM_PROD=yes` |
| **Download** | `task db-download-backup ENV=dev BACKUP_FILE=...` | `task db-download-backup ENV=staging BACKUP_FILE=...` | `task db-download-backup ENV=prod BACKUP_FILE=...` |

## Disaster Recovery Plan

### Quick Recovery Steps

1. **Identify Issue**: Determine data corruption/loss scope
2. **List Available Backups**: `task db-list-backups ENV=<env>`
3. **Restore Data**: `task db-restore-<env> BACKUP_FILE=<filename>`
4. **Verify Integrity**: Check logs and test critical endpoints
5. **Document Incident**: Record what happened and resolution

**Example recovery:**
```bash
# 1. List backups to find the right one
task db-list-backups ENV=prod

# 2. Restore from backup (automated: scale down → restore → scale up)
task db-restore-prod \
  BACKUP_FILE=autolab-backup-20260209_120000.tar.gz \
  CONFIRM_PROD=yes

# 3. Verify application health
kubectl logs -f autolab-prod-autolab-api-0 -n autolab-prod0

# 4. Test critical endpoints
curl -k https://autolab.dcommunity.space/api/v1/health
```

### Recovery Time Objective (RTO)

- **Backup Frequency**: Daily (24h max data loss)
- **Estimated Restore Time**: 5-15 minutes (automated restore script)
- **Verification Time**: 5-10 minutes
- **Total RTO**: ~15-25 minutes

## Related Documentation

- [Deployment Guide](./deployment.md) *(if exists)*
- [Kubernetes StatefulSet](../autolab-chart/autolab-chart/autolab/templates/statefulset.yaml)
- [Backup CronJob](../autolab-chart/autolab-chart/autolab/templates/backup-cronjob.yaml)
- [Helm Values](../autolab-chart/autolab-chart/autolab/values.yaml)

## Support

For issues or questions:
- Check logs: `kubectl logs -f job/<backup-job-name>`
- Review this documentation
- Check Kubernetes events: `kubectl get events --sort-by='.lastTimestamp'`
