# Backup System Documentation

## Overview

The Carpaintr application includes an automated backup system that runs as a Kubernetes CronJob. It creates compressed archives of the application data and stores them in a separate persistent volume with automatic retention management.

## Architecture

```
┌─────────────────────┐
│  StatefulSet Pod    │
│  (autolab-api-0)    │
│                     │
│  /app/data          │ ← Main data volume (Sled DB, logs, files)
└─────────────────────┘
         ↓
    (backup job)
         ↓
┌─────────────────────┐
│  Backup PVC         │
│                     │
│  /backups           │ ← Backup storage
│    ├── autolab-backup-20260209_120000.tar.gz
│    ├── autolab-backup-20260208_120000.tar.gz
│    ├── autolab-backup-20260207_120000.tar.gz
│    └── ... (last 10)
└─────────────────────┘
```

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

```bash
# Create a temporary pod to access backup volume
kubectl run backup-viewer --rm -it --restart=Never \
  --image=busybox:1.36 \
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
        "claimName": "autolab-api-backup"
      }
    }]
  }
}'
```

Or if you have shell access to the main pod:
```bash
kubectl exec -it autolab-api-0 -- ls -lh /backups
```

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

### Full Restore from Backup

**⚠️ WARNING**: This will overwrite all current application data. Ensure the application is stopped before restoring.

#### Step 1: Stop the Application

```bash
kubectl scale statefulset autolab-api --replicas=0
```

#### Step 2: Create Restore Job

Create a file `restore-job.yaml`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: autolab-restore-20260209
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

          # Clear existing data (optional, comment out to merge)
          rm -rf /data/*

          # Extract backup
          tar -xzf "${BACKUP_FILE}" -C /data

          echo "Restore completed successfully"
          ls -la /data
        volumeMounts:
        - name: data-volume
          mountPath: /data
        - name: backup-volume
          mountPath: /backups
          readOnly: true
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: autolab-api-storage-autolab-api-0
      - name: backup-volume
        persistentVolumeClaim:
          claimName: autolab-api-backup
```

Apply the restore job:

```bash
kubectl apply -f restore-job.yaml
kubectl logs -f job/autolab-restore-20260209
```

#### Step 3: Restart Application

```bash
kubectl scale statefulset autolab-api --replicas=1
```

#### Step 4: Verify Restoration

```bash
# Check application logs
kubectl logs -f autolab-api-0

# Test API endpoints
curl -k https://your-domain/api/v1/health
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

### Copy Backups to External Location

```bash
# Port-forward to access backup volume
kubectl port-forward pod/autolab-api-0 8888:8080 &

# Or create a dedicated pod
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
      "persistentVolumeClaim": {"claimName": "autolab-api-backup"}
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

## Disaster Recovery Plan

### Quick Recovery Steps

1. **Identify Issue**: Determine data corruption/loss scope
2. **Stop Application**: `kubectl scale statefulset autolab-api --replicas=0`
3. **List Backups**: Identify correct backup to restore
4. **Restore Data**: Use restore job procedure
5. **Verify Integrity**: Check Sled DB and critical data
6. **Restart Application**: `kubectl scale statefulset autolab-api --replicas=1`
7. **Test Functionality**: Verify all critical endpoints
8. **Document Incident**: Record what happened and resolution

### Recovery Time Objective (RTO)

- **Backup Frequency**: Daily (24h max data loss)
- **Estimated Restore Time**: 10-30 minutes (depends on data size)
- **Verification Time**: 5-10 minutes

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
