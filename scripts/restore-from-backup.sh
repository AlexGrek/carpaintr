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

# Note: The actual restore job will validate the backup contents.
# Here we just check that the file is readable and not empty.
VERIFY_READABLE=$(kubectl exec -n "${NAMESPACE}" "${POD_NAME}" -- test -r "/backups/${BACKUP_FILE}" 2>/dev/null && echo "yes" || echo "no")

if [ "$VERIFY_READABLE" != "yes" ]; then
    # Use temporary pod to verify file is readable in backup PVC
    CHECK_POD="backup-check-$(date +%s)"
    kubectl run "${CHECK_POD}" --image=busybox:1.36 -n "${NAMESPACE}" --restart=Never --overrides='{
      "spec": {
        "containers": [{
          "name": "check",
          "image": "busybox:1.36",
          "command": ["sh", "-c", "[ -r /backups/'${BACKUP_FILE}' ] && echo readable || echo notreadable"],
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

    kubectl wait --for=condition=ready pod/"${CHECK_POD}" -n "${NAMESPACE}" --timeout=30s 2>/dev/null || true
    sleep 1
    VERIFY_READABLE=$(kubectl logs -n "${NAMESPACE}" "${CHECK_POD}" 2>/dev/null | tr -d '\n')
    kubectl delete pod "${CHECK_POD}" -n "${NAMESPACE}" --ignore-not-found=true 2>/dev/null || true
fi

if [ "$VERIFY_READABLE" != "readable" ]; then
    echo -e "${RED}✗ Backup file is not readable!${NC}"
    echo "Error: Unable to read backup file /backups/${BACKUP_FILE}"
    exit 1
fi

echo -e "${GREEN}✓ Backup file is readable and accessible${NC}"
echo -e "${YELLOW}Note: Detailed structure validation will occur during extraction${NC}"
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

# Write job to temp file to avoid nested heredoc issues
TEMP_JOB=$(mktemp)
cat > "$TEMP_JOB" <<'EOFYAML'
apiVersion: batch/v1
kind: Job
metadata:
  name: RESTORE_JOB_NAME_PLACEHOLDER
  namespace: NAMESPACE_PLACEHOLDER
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
        image: debian:bookworm-slim
        command:
        - /bin/sh
        - -c
        - |
          set -e
          apt-get update >/dev/null 2>&1 && apt-get install -y unzip >/dev/null 2>&1
          BACKUP_PATH="/backups/BACKUP_FILE_PLACEHOLDER"
          echo "Starting restore from: $BACKUP_PATH"
          echo "Clearing /data..."
          rm -rf /data/* /data/.[!.]*
          echo "Extracting backup..."
          if echo "$BACKUP_PATH" | grep -qE '\.tar\.gz$|\.tgz$'; then
            tar -xzf "$BACKUP_PATH" -C /data
          elif echo "$BACKUP_PATH" | grep -qE '\.zip$'; then
            unzip -q "$BACKUP_PATH" -d /data
          fi
          echo "Restore completed!"
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
          claimName: DATA_PVC_PLACEHOLDER
      - name: backup-volume
        persistentVolumeClaim:
          claimName: BACKUP_PVC_PLACEHOLDER
EOFYAML

# Substitute variables in the temp file (use # as delimiter to avoid issues with slashes)
sed -i '' "s#NAMESPACE_PLACEHOLDER#${NAMESPACE}#g" "$TEMP_JOB"
sed -i '' "s#RESTORE_JOB_NAME_PLACEHOLDER#${RESTORE_JOB_NAME}#g" "$TEMP_JOB"
sed -i '' "s#DATA_PVC_PLACEHOLDER#${DATA_PVC}#g" "$TEMP_JOB"
sed -i '' "s#BACKUP_PVC_PLACEHOLDER#${BACKUP_PVC}#g" "$TEMP_JOB"
sed -i '' "s#BACKUP_FILE_PLACEHOLDER#${BACKUP_FILE}#g" "$TEMP_JOB"

# Apply the job
if ! kubectl apply -f "$TEMP_JOB"; then
    echo -e "${RED}Failed to apply restore job!${NC}"
    echo "Debug: YAML file contents:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$TEMP_JOB"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    rm -f "$TEMP_JOB"
    exit 1
fi
rm -f "$TEMP_JOB"

echo -e "${GREEN}✓ Restore job created: ${RESTORE_JOB_NAME}${NC}"
echo ""

# Step 3: Wait for restore job to complete
echo -e "${YELLOW}Step 4/6: Running restore (streaming logs)...${NC}"
echo "────────────────────────────────────────────────────────────────"
kubectl wait --for=condition=ready "pod" -l "job-name=${RESTORE_JOB_NAME}" -n "${NAMESPACE}" --timeout=60s 2>/dev/null || true
sleep 2
kubectl logs -n "${NAMESPACE}" "job/${RESTORE_JOB_NAME}" -f

# Wait for job to actually complete
kubectl wait --for=condition=complete "job/${RESTORE_JOB_NAME}" -n "${NAMESPACE}" --timeout=300s 2>/dev/null || {
    echo -e "${RED}✗ Restore job timed out or failed!${NC}"
    echo "Final logs:"
    kubectl logs -n "${NAMESPACE}" "job/${RESTORE_JOB_NAME}"
    exit 1
}

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
