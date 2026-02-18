# Restore from Local Backup Files - Examples

This guide demonstrates how to restore from custom backup files (`.tar.gz`, `.tgz`, or `.zip`) that are not in the cluster's backup volume.

## Use Cases

### 1. Migration Between Environments
Copy production data to development:
```bash
# 1. Download from production
task db-download-backup ENV=prod BACKUP_FILE=autolab-backup-20260218_000000.tar.gz

# 2. Restore to development
task db-restore-from-local-dev LOCAL_FILE=./backups/autolab-backup-20260218_000000.tar.gz
```

### 2. External Backup Restore
Restore from a backup stored outside the cluster:
```bash
# Your external backup (from S3, local storage, etc.)
task db-restore-from-local-dev LOCAL_FILE=/path/to/external-backup.tar.gz
```

### 3. ZIP Archive Restore
Restore from a ZIP archive (useful for backups from other systems):
```bash
# Create a ZIP archive (example)
zip -r my-backup.zip sled_db/ application.log

# Restore from ZIP
task db-restore-from-local-dev LOCAL_FILE=./my-backup.zip
```

### 4. Quick Testing with Sample Data
```bash
# Create a test dataset
mkdir -p test-data/sled_db
echo "test" > test-data/application.log
tar -czf test-backup.tar.gz -C test-data .

# Restore to dev for testing
task db-restore-from-local-dev LOCAL_FILE=./test-backup.tar.gz
```

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| **Tarball (gzip)** | `.tar.gz`, `.tgz` | Native backup format, most efficient |
| **ZIP** | `.zip` | Compatible with external tools, Windows-friendly |

## Workflow Details

When you run `task db-restore-from-local-dev LOCAL_FILE=./my-backup.tar.gz`, the following happens:

### Step 1: Upload (Automatic)
```
1. Creates temporary pod with backup volume mounted
2. Copies local file to backup volume in cluster
3. Verifies upload succeeded
4. Removes temporary pod
```

### Step 2: Restore (Automatic)
```
1. Scales down application (0 replicas)
2. Creates safety backup of current data
3. Detects archive format (.tar.gz or .zip)
4. Clears existing data
5. Extracts backup archive
6. Scales up application (1 replica)
7. Verifies restoration
```

**Total time:** ~5-15 minutes depending on backup size

## Production Safety

For production restores, the `CONFIRM_PROD=yes` flag is required:

```bash
task db-restore-from-local-prod \
  LOCAL_FILE=./verified-backup.tar.gz \
  CONFIRM_PROD=yes
```

**Production checklist:**
- [ ] Verify backup file integrity
- [ ] Check backup timestamp and contents
- [ ] Notify team of upcoming downtime
- [ ] Verify current data is backed up
- [ ] Have rollback plan ready

## Creating Custom Backups

### Manual Backup (tar.gz)
```bash
# From local Sled database directory
cd /path/to/data
tar -czf custom-backup-$(date +%Y%m%d_%H%M%S).tar.gz .

# Verify archive
tar -tzf custom-backup-*.tar.gz | head -20
```

### Manual Backup (zip)
```bash
# From local Sled database directory
cd /path/to/data
zip -r custom-backup-$(date +%Y%m%d_%H%M%S).zip .

# Verify archive
unzip -l custom-backup-*.zip | head -20
```

### Download from Cluster and Archive
```bash
# Download current backup
task db-download-backup ENV=prod BACKUP_FILE=autolab-backup-20260218_000000.tar.gz

# It's already in tar.gz format and ready to use
```

## Archive Structure

Your backup archive should have this structure:

```
backup.tar.gz/
├── sled_db/              # Sled database files
│   ├── conf
│   ├── db
│   └── ...
├── application.log       # Application logs (optional)
└── other-files/          # Any other data files
```

**Root directory:** Archive contents should extract directly into `/data`, not into a subdirectory.

✅ **Correct:**
```bash
tar -czf backup.tar.gz -C /data .
# Extracts: sled_db/, application.log
```

❌ **Incorrect:**
```bash
tar -czf backup.tar.gz data/
# Extracts: data/sled_db/, data/application.log (wrong!)
```

## Troubleshooting

### Error: "File LOCAL_FILE does not exist"
```bash
# Check file path
ls -lh ./my-backup.tar.gz

# Use absolute path if needed
task db-restore-from-local-dev LOCAL_FILE=/full/path/to/backup.tar.gz
```

### Error: "Unsupported archive format"
```bash
# Check file extension
file ./my-backup.???

# Rename if needed (must be .tar.gz, .tgz, or .zip)
mv backup.tar backup.tar.gz
```

### Upload Fails
```bash
# Check file size
du -h ./my-backup.tar.gz

# For large files (>1GB), increase timeout or split the backup
```

### Restore Job Fails
```bash
# Check restore job logs
kubectl get jobs -n autolab-dev | grep restore
kubectl logs -n autolab-dev job/restore-<timestamp>

# Common issues:
# - Incorrect archive structure (see "Archive Structure" above)
# - Corrupted archive file
# - Insufficient disk space in cluster
```

## Advanced: Scripted Migration

Automate environment migrations:

```bash
#!/bin/bash
# migrate-prod-to-dev.sh

set -e

echo "Downloading production backup..."
task db-download-backup ENV=prod BACKUP_FILE=autolab-backup-20260218_000000.tar.gz

echo "Restoring to development..."
task db-restore-from-local-dev LOCAL_FILE=./backups/autolab-backup-20260218_000000.tar.gz

echo "Migration complete!"
```

## See Also

- [Backup & Restore Documentation](./backup.md) - Full backup system documentation
- [Disaster Recovery Plan](./backup.md#disaster-recovery-plan) - Emergency recovery procedures
- [CLAUDE.md](../CLAUDE.md) - Quick reference commands
