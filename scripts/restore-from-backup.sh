#!/bin/bash
# Restore database from backup archive
# Usage: ./restore-from-backup.sh <backup-filename> <namespace> <release-name>
#
# Examples:
#   ./restore-from-backup.sh autolab-backup-20260209_120000.tar.gz autolab-dev autolab-dev
#   ./restore-from-backup.sh autolab-backup-20260209_120000.tar.gz autolab-prod0 autolab-prod

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
BACKUP_FILE="${1}"
NAMESPACE="${2:-autolab-dev}"
RELEASE="${3:-autolab-dev}"
STATEFULSET="${RELEASE}-autolab-api"
POD_NAME="${STATEFULSET}-0"
DATA_PVC="autolab-api-storage-${POD_NAME}"
BACKUP_PVC="${RELEASE}-autolab-api-backup"

# Validate arguments
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup filename is required${NC}"
    echo "Usage: $0 <backup-filename> [namespace] [release-name]"
    echo ""
    echo "Example: $0 autolab-backup-20260209_120000.tar.gz autolab-dev autolab-dev"
    exit 1
fi

echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║           Database Restore from Backup                         ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Namespace:     ${NAMESPACE}"
echo "  Release:       ${RELEASE}"
echo "  Backup file:   ${BACKUP_FILE}"
echo "  StatefulSet:   ${STATEFULSET}"
echo "  Data PVC:      ${DATA_PVC}"
echo "  Backup PVC:    ${BACKUP_PVC}"
echo ""

# Verify backup file exists
echo -e "${YELLOW}Step 1/6: Verifying backup file exists...${NC}"

# Try to access backup from main pod first, then fall back to temporary pod
BACKUP_EXISTS=$(kubectl exec -n "${NAMESPACE}" "${POD_NAME}" -- test -f "/backups/${BACKUP_FILE}" 2>/dev/null && echo "yes" || echo "no")

if [ "$BACKUP_EXISTS" != "yes" ]; then
    # Main pod doesn't have backup volume mounted (security by design)
    # Use temporary pod to verify backup exists in the backup PVC
    VERIFY_POD="backup-verify-$(date +%s)"
    kubectl run "${VERIFY_POD}" --image=busybox:1.36 -n "${NAMESPACE}" --restart=Never --overrides='{
      "spec": {
        "containers": [{
          "name": "verify",
          "image": "busybox:1.36",
          "command": ["sh", "-c", "test -f /backups/'${BACKUP_FILE}' && echo yes || echo no"],
          "volumeMounts": [{
            "name": "backup-volume",
            "mountPath": "/backups",
            "readOnly": true
          }]
        }],
        "volumes": [{
          "name": "backup-volume",
          "persistentVolumeClaim": {
            "claimName": "'${BACKUP_PVC}'"
          }
        }]
      }
    }' 2>/dev/null || true

    kubectl wait --for=condition=ready pod/"${VERIFY_POD}" -n "${NAMESPACE}" --timeout=30s 2>/dev/null || true
    sleep 1
    BACKUP_EXISTS=$(kubectl logs -n "${NAMESPACE}" "${VERIFY_POD}" 2>/dev/null | tr -d '\n')
    kubectl delete pod "${VERIFY_POD}" -n "${NAMESPACE}" --ignore-not-found=true 2>/dev/null || true
fi

if [ "$BACKUP_EXISTS" != "yes" ]; then
    echo -e "${RED}Error: Backup file /backups/${BACKUP_FILE} not found${NC}"
    echo ""
    echo "Available backups:"
    LISTER_POD="backup-lister-$(date +%s)"
    kubectl run "${LISTER_POD}" --image=busybox:1.36 -n "${NAMESPACE}" --restart=Never --overrides='{
      "spec": {
        "containers": [{
          "name": "lister",
          "image": "busybox:1.36",
          "command": ["ls", "-lh", "/backups"],
          "volumeMounts": [{
            "name": "backup-volume",
            "mountPath": "/backups",
            "readOnly": true
          }]
        }],
        "volumes": [{
          "name": "backup-volume",
          "persistentVolumeClaim": {
            "claimName": "'${BACKUP_PVC}'"
          }
        }]
      }
    }' 2>/dev/null || true

    kubectl wait --for=condition=ready pod/"${LISTER_POD}" -n "${NAMESPACE}" --timeout=30s 2>/dev/null || true
    kubectl logs -n "${NAMESPACE}" "${LISTER_POD}" 2>/dev/null || echo "Could not list backups"
    kubectl delete pod "${LISTER_POD}" -n "${NAMESPACE}" --ignore-not-found=true 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Backup file exists${NC}"
echo ""

# Validate backup file structure
echo -e "${YELLOW}Step 1.5/6: Validating backup file structure...${NC}"

VALIDATOR_POD="backup-validator-$(date +%s)"

# Create a Job (instead of Pod) for more reliable logging
kubectl apply -f - -n "${NAMESPACE}" <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${VALIDATOR_POD}
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: validator
        image: alpine:3.19
        command:
        - /bin/sh
        - -c
        - |
          set -e
          BACKUP_PATH="/backups/${BACKUP_FILE}"

          if [ ! -f "\$BACKUP_PATH" ]; then
            echo "ERROR: Backup file not found: \$BACKUP_PATH"
            exit 1
          fi

          # Detect format and validate
          if echo "\$BACKUP_PATH" | grep -qE '\.tar\.gz$|\.tgz$'; then
            if ! tar -tzf "\$BACKUP_PATH" | grep -q "^sled_db/"; then
              echo "ERROR: sled_db directory not found in tar.gz backup"
              exit 1
            fi
          elif echo "\$BACKUP_PATH" | grep -qE '\.zip$'; then
            if ! unzip -l "\$BACKUP_PATH" | grep -q "sled_db/"; then
              echo "ERROR: sled_db directory not found in zip backup"
              exit 1
            fi
          else
            echo "ERROR: Unsupported backup format"
            exit 1
          fi

          echo "VALID"
        volumeMounts:
        - name: backup-volume
          mountPath: /backups
          readOnly: true
      volumes:
      - name: backup-volume
        persistentVolumeClaim:
          claimName: ${BACKUP_PVC}
EOF

# Wait for job to complete
echo "Waiting for validation job..."
kubectl wait --for=condition=complete job/${VALIDATOR_POD} -n "${NAMESPACE}" --timeout=60s 2>/dev/null || true
sleep 1

# Get validation result
VALIDATION_OUTPUT=$(kubectl logs -n "${NAMESPACE}" job/${VALIDATOR_POD} 2>/dev/null || echo "ERROR: Could not get logs")
kubectl delete job ${VALIDATOR_POD} -n "${NAMESPACE}" --ignore-not-found=true 2>/dev/null || true

if echo "$VALIDATION_OUTPUT" | grep -q "^VALID$"; then
    echo -e "${GREEN}✓ Backup structure validated (contains sled_db)${NC}"
else
    echo -e "${RED}✗ Backup validation failed!${NC}"
    echo "Validation output:"
    echo "$VALIDATION_OUTPUT"
    echo ""
    echo -e "${RED}Error: Backup file does not contain expected directory structure${NC}"
    echo "Expected: sled_db/ directory in archive"
    echo "This backup may be corrupted or incomplete. Restore cancelled."
    exit 1
fi
echo ""

# Warning
echo -e "${RED}⚠️  WARNING: This will OVERWRITE ALL CURRENT DATA in ${NAMESPACE}!${NC}"
echo -e "${RED}⚠️  The application will experience downtime during restore.${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C within 10 seconds to cancel...${NC}"
sleep 10
echo ""

# Step 1: Scale down StatefulSet
echo -e "${YELLOW}Step 2/6: Scaling down StatefulSet to 0 replicas...${NC}"
kubectl scale statefulset/"${STATEFULSET}" --replicas=0 -n "${NAMESPACE}"
echo "Waiting for pod to terminate..."
kubectl wait --for=delete "pod/${POD_NAME}" -n "${NAMESPACE}" --timeout=120s 2>/dev/null || echo "Pod already terminated"
echo -e "${GREEN}✓ Application stopped${NC}"
echo ""

# Step 2: Create restore job
echo -e "${YELLOW}Step 3/6: Creating restore job...${NC}"
RESTORE_JOB_NAME="restore-$(date +%s)"

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${RESTORE_JOB_NAME}
  namespace: ${NAMESPACE}
  labels:
    app: autolab-api
    component: restore
spec:
  backoffLimit: 2
  template:
    metadata:
      labels:
        app: autolab-api
        component: restore
    spec:
      restartPolicy: Never
      containers:
      - name: restore
        image: alpine:3.19
        command:
        - /bin/sh
        - -c
        - |
          set -e
          BACKUP_PATH="/backups/${BACKUP_FILE}"

          echo "════════════════════════════════════════════════════════"
          echo "Starting restore from: \${BACKUP_PATH}"
          echo "Target directory: /data"
          echo "════════════════════════════════════════════════════════"
          echo ""

          # Verify backup file exists
          if [ ! -f "\${BACKUP_PATH}" ]; then
            echo "ERROR: Backup file not found: \${BACKUP_PATH}"
            exit 1
          fi

          # Show backup info
          echo "Backup file size: \$(du -h "\${BACKUP_PATH}" | cut -f1)"
          echo ""

          # Backup current data (optional safety measure)
          echo "Creating safety backup of current data..."
          if [ -d /data/sled_db ]; then
            tar -czf /backups/pre-restore-backup-\$(date +%Y%m%d_%H%M%S).tar.gz -C /data . 2>/dev/null || echo "Warning: Could not create safety backup"
          fi
          echo ""

          # Clear existing data
          echo "Clearing existing data in /data..."
          rm -rf /data/*
          rm -rf /data/.[!.]*
          echo "✓ Data directory cleared"
          echo ""

          # Detect archive format and extract
          echo "Detecting archive format..."
          if echo "\${BACKUP_PATH}" | grep -qE '\.tar\.gz$|\.tgz$'; then
            echo "Format: tar.gz (compressed tarball)"
            echo "Extracting backup archive..."
            tar -xzf "\${BACKUP_PATH}" -C /data
          elif echo "\${BACKUP_PATH}" | grep -qE '\.zip$'; then
            echo "Format: zip (compressed archive)"
            echo "Extracting backup archive..."
            unzip -q "\${BACKUP_PATH}" -d /data
          else
            echo "ERROR: Unsupported archive format"
            echo "Supported formats: .tar.gz, .tgz, .zip"
            exit 1
          fi
          echo "✓ Backup extracted"
          echo ""

          # Verify restoration
          echo "Verifying restored data..."
          echo "Directory structure:"
          ls -la /data | head -20
          echo ""

          if [ -d /data/sled_db ]; then
            echo "✓ Sled database directory found"
            echo "  Database size: \$(du -sh /data/sled_db | cut -f1)"
          else
            echo "⚠️  Warning: sled_db directory not found"
          fi

          echo ""
          echo "════════════════════════════════════════════════════════"
          echo "Restore completed successfully!"
          echo "Restored from: ${BACKUP_FILE}"
          echo "Time: \$(date)"
          echo "════════════════════════════════════════════════════════"
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
          claimName: ${DATA_PVC}
      - name: backup-volume
        persistentVolumeClaim:
          claimName: ${BACKUP_PVC}
EOF

echo -e "${GREEN}✓ Restore job created: ${RESTORE_JOB_NAME}${NC}"
echo ""

# Step 3: Wait for restore job to complete
echo -e "${YELLOW}Step 4/6: Running restore (streaming logs)...${NC}"
echo "────────────────────────────────────────────────────────────────"
kubectl wait --for=condition=ready "pod" -l "job-name=${RESTORE_JOB_NAME}" -n "${NAMESPACE}" --timeout=60s
kubectl logs -n "${NAMESPACE}" "job/${RESTORE_JOB_NAME}" -f

# Check job status
JOB_STATUS=$(kubectl get job "${RESTORE_JOB_NAME}" -n "${NAMESPACE}" -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}')
if [ "$JOB_STATUS" != "True" ]; then
    echo -e "${RED}✗ Restore job failed!${NC}"
    echo "Check logs: kubectl logs -n ${NAMESPACE} job/${RESTORE_JOB_NAME}"
    exit 1
fi
echo "────────────────────────────────────────────────────────────────"
echo -e "${GREEN}✓ Restore completed successfully${NC}"
echo ""

# Step 4: Clean up restore job
echo -e "${YELLOW}Step 5/6: Cleaning up restore job...${NC}"
kubectl delete job "${RESTORE_JOB_NAME}" -n "${NAMESPACE}"
echo -e "${GREEN}✓ Restore job cleaned up${NC}"
echo ""

# Step 5: Scale up StatefulSet
echo -e "${YELLOW}Step 6/6: Scaling up StatefulSet to 1 replica...${NC}"
kubectl scale statefulset/"${STATEFULSET}" --replicas=1 -n "${NAMESPACE}"
echo "Waiting for pod to be ready..."
kubectl wait --for=condition=ready "pod/${POD_NAME}" -n "${NAMESPACE}" --timeout=180s
echo -e "${GREEN}✓ Application restarted${NC}"
echo ""

# Final status
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Restore Completed Successfully!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Summary:"
echo "  ✓ Backup restored: ${BACKUP_FILE}"
echo "  ✓ Namespace: ${NAMESPACE}"
echo "  ✓ Application: Running"
echo ""
echo "Next steps:"
echo "  1. Verify application health: kubectl logs -n ${NAMESPACE} ${POD_NAME}"
echo "  2. Test critical endpoints"
echo "  3. Check application logs for any errors"
echo ""
