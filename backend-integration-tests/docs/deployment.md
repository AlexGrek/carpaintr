# Docker Deployment & Data Sync

This document explains how the backend handles initial data copying in Docker containers.

## Overview

The backend Docker image includes:
- Compiled Rust binary (`/app/backend`)
- Static frontend files (`/app/static`)
- Initial data templates (`/var/initialdata/`)
- Entrypoint script that syncs data on startup

## Data Directory Structure

### In Docker Image
```
/var/initialdata/
└── common/
    ├── cars/
    ├── doc_templates/
    ├── global/
    ├── procs/
    ├── samples/
    └── tables/
        ├── t1.csv
        ├── t2.csv           ← Template data
        └── ...
```

### At Runtime (Persisted Volume)
```
${DATA_DIR_PATH}/
└── common/
    └── ... (synced from /var/initialdata/common/)
```

## Entrypoint Script Behavior

The `entrypoint.sh` script runs on container startup and syncs initial data.

### Sync Command

```bash
rsync -avu /var/initialdata/common/ ${DATA_DIR_PATH}/common/
```

### rsync Flags Explained

| Flag | Purpose | Behavior |
|------|---------|----------|
| `-a` | Archive mode | Recursive + preserve permissions, timestamps, symlinks |
| `-v` | Verbose | Show which files are being synced in logs |
| `-u` | Update only | Skip files that are **newer** in destination |

### Sync Behavior Matrix

| Scenario | Action | Explanation |
|----------|--------|-------------|
| **File doesn't exist in volume** | ✅ **Copy** | New file from image is copied |
| **File exists, same timestamp** | ❌ Skip | No change needed |
| **Image has newer file** | ✅ **Update** | Source is newer, update destination |
| **Volume has newer file** | ❌ **Skip** | Manual changes preserved |
| **User modified file** | ❌ **Preserved** | If modification is newer |

## Use Cases

### Case 1: First Container Start (Fresh Volume)

**Scenario:** New deployment, empty data volume

**Behavior:**
```
rsync: /var/initialdata/common/tables/t2.csv -> ${DATA_DIR_PATH}/common/tables/t2.csv
✅ All files copied
```

### Case 2: Updated Docker Image

**Scenario:** Rebuilt image with updated t2.csv (Sep 29), running container has old version (Aug 1)

**Behavior:**
```
rsync: updating t2.csv (source newer)
✅ Updated files only
❌ Other files unchanged
```

### Case 3: Manual Data Changes

**Scenario:** User edited t2.csv manually on Nov 16, new image deployed with Sep 29 version

**Behavior:**
```
rsync: skipping t2.csv (destination is newer)
✅ User changes preserved
❌ Image version NOT applied
```

**Solution:** If you want to force update:
```bash
# Inside container or via kubectl exec
rm ${DATA_DIR_PATH}/common/tables/t2.csv
# Restart container - rsync will copy fresh file
```

### Case 4: Recovering from Corruption

**Scenario:** Data file is corrupted or deleted

**Behavior:**
- **Deleted file:** ✅ rsync copies from image on next restart
- **Corrupted file:** ❌ rsync preserves (if timestamp is newer)

**Solution:** Delete corrupted file and restart container.

## Deployment Scenarios

### Kubernetes StatefulSet

```yaml
spec:
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi

  containers:
  - name: backend
    env:
    - name: DATA_DIR_PATH
      value: /data
    volumeMounts:
    - name: data
      mountPath: /data
```

**First pod start:** All data synced from `/var/initialdata/`
**Pod restart:** Only newer files synced
**Pod replacement:** Same PVC, data persists, only updates newer files

### Docker Compose

```yaml
services:
  backend:
    image: carpaintr-backend:latest
    volumes:
      - data-volume:/data
    environment:
      - DATA_DIR_PATH=/data

volumes:
  data-volume:
```

**First `docker-compose up`:** Data synced
**Subsequent starts:** Only updates if image changed
**`docker-compose down && up`:** Data persists, selective updates

## Debugging Data Sync Issues

### Check Sync Logs

```bash
# Kubernetes
kubectl logs <pod-name> | grep -A 20 "Initiating sync"

# Docker
docker logs <container-id> | grep -A 20 "Initiating sync"
```

### Expected Output

```
Initiating sync of initial data from '/var/initialdata/common' to '/data/common'.
This operation will sync directories and their contents recursively.
Files will be updated only if the source is newer (preserves manual changes).
tables/t2.csv
tables/t1.csv
global/colors.json
...
Initial data sync operation completed successfully.
```

### Common Issues

#### No files synced
**Symptom:** Log shows sync completed but no files listed
**Cause:** All files already exist and are up-to-date
**Solution:** This is normal! Files only sync if missing or outdated

#### Permission denied
**Symptom:** `rsync: send_files failed to open ... Permission denied`
**Cause:** Container user lacks permissions
**Solution:** Check volume permissions and container user

#### Out of space
**Symptom:** `rsync: write failed ... No space left on device`
**Cause:** Volume is full
**Solution:** Increase volume size or clean up old data

## Forcing Full Resync

If you need to reset all data to image defaults:

### Kubernetes
```bash
# Delete PVC (warning: deletes all data!)
kubectl delete pvc data-<pod-name> -n <namespace>
# Pod will recreate PVC and sync fresh
```

### Docker
```bash
# Remove volume (warning: deletes all data!)
docker-compose down -v
# Recreates volume on next up
```

### Selective Reset
```bash
# Delete specific files
kubectl exec <pod> -- rm ${DATA_DIR_PATH}/common/tables/t2.csv
# Restart pod
kubectl delete pod <pod-name>
# Rsync will copy fresh file
```

## File Timestamps & Conflicts

### Understanding Timestamps

rsync compares **modification times** to determine which file is newer.

### Potential Issues

**Clock skew:** If Docker host and image builder have different clocks, timestamps may be incorrect.

**Solution:** Ensure NTP is configured on build and runtime hosts.

### Manual Override

To force image version regardless of timestamp:

```bash
# Option 1: Delete and resync
rm -rf ${DATA_DIR_PATH}/common/tables/
# Restart container

# Option 2: Use rsync without -u flag (requires shell access)
rsync -av /var/initialdata/common/ ${DATA_DIR_PATH}/common/
```

## Best Practices

1. **Don't edit image data files directly** in production
   - Use user-specific overrides in `${DATA_DIR_PATH}/users/<email>/`
   - Common data should be updated via new image deployments

2. **Version your data files** with the image
   - Include data updates in CI/CD pipeline
   - Tag images when data changes

3. **Monitor sync logs** after deployments
   - Verify expected files are synced
   - Check for permission or space issues

4. **Backup before major updates**
   - Back up data volumes before deploying new images with data changes
   - Test data migrations in staging first

5. **Document data schema changes**
   - If CSV structure changes, document in release notes
   - Consider migration scripts for breaking changes

## Related Files

- [Dockerfile](../../Dockerfile) - Image build with data copy
- [entrypoint.sh](../../entrypoint.sh) - Runtime sync script
- `/data/common/` - Source data directory (copied to image)
