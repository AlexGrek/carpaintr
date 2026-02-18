# Scripts

Utility scripts for database management and operations.

## restore-from-backup.sh

Automated restore workflow that safely restores the database from a backup archive.

### Usage

```bash
./restore-from-backup.sh <backup-filename> <namespace> <release-name>
```

### Examples

```bash
# Restore dev environment
./restore-from-backup.sh \
  autolab-backup-20260209_120000.tar.gz \
  autolab-dev \
  autolab-dev

# Restore staging environment
./restore-from-backup.sh \
  autolab-backup-20260209_120000.tar.gz \
  autolab-staging \
  autolab-staging

# Restore production environment
./restore-from-backup.sh \
  autolab-backup-20260209_120000.tar.gz \
  autolab-prod0 \
  autolab-prod
```

### Recommended Usage via Taskfile

For safety and convenience, use the Taskfile commands instead:

```bash
# List available backups
task db-list-backups ENV=dev

# Restore from backup
task db-restore-dev BACKUP_FILE=autolab-backup-20260209_120000.tar.gz
task db-restore-staging BACKUP_FILE=autolab-backup-20260209_120000.tar.gz
task db-restore-prod BACKUP_FILE=autolab-backup-20260209_120000.tar.gz CONFIRM_PROD=yes
```

### What It Does

The script performs a fully automated restore workflow:

1. **Verification** - Validates that the backup file exists in the cluster
2. **Safety Warning** - 10-second countdown before destructive operations
3. **Scale Down** - Stops the application (0 replicas)
4. **Restore Job** - Creates Kubernetes job that:
   - Creates safety backup of current data
   - Clears existing data directory
   - Extracts backup archive
   - Verifies restoration
5. **Scale Up** - Restarts the application (1 replica)
6. **Status Report** - Displays completion summary

### Safety Features

- **Pre-restore Safety Backup**: Creates automatic backup of current data before overwriting
- **Verification Checks**: Validates backup file exists before starting
- **Countdown Warnings**: 10-second cancellation window before destructive operations
- **Detailed Logging**: Full visibility into each step with colored output
- **Error Handling**: Stops on errors and provides clear error messages
- **Status Verification**: Confirms successful completion of each step

### Output

The script provides color-coded output:
- 🟡 **Yellow**: Informational messages and step headers
- 🟢 **Green**: Success messages and completion confirmations
- 🔴 **Red**: Errors and critical warnings

Example output:
```
╔════════════════════════════════════════════════════════════════╗
║           Database Restore from Backup                         ║
╚════════════════════════════════════════════════════════════════╝

Configuration:
  Namespace:     autolab-dev
  Release:       autolab-dev
  Backup file:   autolab-backup-20260209_120000.tar.gz
  StatefulSet:   autolab-dev-autolab-api
  Data PVC:      autolab-api-storage-autolab-dev-autolab-api-0
  Backup PVC:    autolab-dev-autolab-api-backup

Step 1/6: Verifying backup file exists...
✓ Backup file exists

⚠️  WARNING: This will OVERWRITE ALL CURRENT DATA in autolab-dev!
⚠️  The application will experience downtime during restore.

Press Ctrl+C within 10 seconds to cancel...

Step 2/6: Scaling down StatefulSet to 0 replicas...
✓ Application stopped

Step 3/6: Creating restore job...
✓ Restore job created: restore-1739012345

Step 4/6: Running restore (streaming logs)...
────────────────────────────────────────────────────────────────
[Restore job logs...]
────────────────────────────────────────────────────────────────
✓ Restore completed successfully

Step 5/6: Cleaning up restore job...
✓ Restore job cleaned up

Step 6/6: Scaling up StatefulSet to 1 replica...
✓ Application restarted

╔════════════════════════════════════════════════════════════════╗
║                 Restore Completed Successfully!                ║
╚════════════════════════════════════════════════════════════════╝

Summary:
  ✓ Backup restored: autolab-backup-20260209_120000.tar.gz
  ✓ Namespace: autolab-dev
  ✓ Application: Running
```

### Requirements

- kubectl configured with access to target cluster
- Backup file must exist in the cluster's backup PVC
- Appropriate permissions to scale StatefulSets and create Jobs

### Environment Support

Works with all environments:
- Development (`autolab-dev` namespace)
- Staging (`autolab-staging` namespace)
- Production (`autolab-prod0` namespace)

### Troubleshooting

**Backup file not found:**
```bash
# List available backups
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- ls -lh /backups/
```

**Restore job failed:**
```bash
# Check restore job logs
kubectl logs -n autolab-dev job/restore-<timestamp>

# Check for events
kubectl get events -n autolab-dev --sort-by='.lastTimestamp'
```

**Application won't start after restore:**
```bash
# Check pod logs
kubectl logs -n autolab-dev autolab-dev-autolab-api-0

# Check pod status
kubectl describe pod autolab-dev-autolab-api-0 -n autolab-dev
```

### Related Documentation

- [Backup & Restore Documentation](../docs/backup.md)
- [Taskfile Commands](../Taskfile.yml)
