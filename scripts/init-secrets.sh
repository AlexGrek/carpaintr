#!/bin/bash
# init-secrets.sh - Initialize Kubernetes secrets for Autolab API
#
# This script creates stable, persistent JWT and license secrets in a Kubernetes namespace.
# Secrets are created ONCE and never regenerated, preventing authentication breakage on redeploy.
#
# Usage:
#   ./scripts/init-secrets.sh <namespace> <release> [admins-file]
#
# Examples:
#   ./scripts/init-secrets.sh autolab-dev autolab-dev
#   ./scripts/init-secrets.sh autolab-staging autolab-staging
#   ./scripts/init-secrets.sh autolab-prod0 autolab-prod backend-service-rust/admins.txt

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Arguments
NAMESPACE="${1:-}"
RELEASE="${2:-}"
ADMINS_FILE="${3:-backend-service-rust/admins.txt}"

# Validation
if [[ -z "$NAMESPACE" ]]; then
  echo -e "${RED}Error: namespace argument is required${NC}"
  echo "Usage: $0 <namespace> <release> [admins-file]"
  exit 1
fi

if [[ -z "$RELEASE" ]]; then
  echo -e "${RED}Error: release argument is required${NC}"
  echo "Usage: $0 <namespace> <release> [admins-file]"
  exit 1
fi

SECRET_NAME="autolab-api-secret"

# Check if namespace exists
echo -e "${YELLOW}[*] Checking namespace...${NC}"
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
  echo -e "${YELLOW}[*] Creating namespace $NAMESPACE...${NC}"
  kubectl create namespace "$NAMESPACE"
fi

# Check if secret already exists
echo -e "${YELLOW}[*] Checking for existing secret...${NC}"
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
  echo -e "${YELLOW}[!] Secret '$SECRET_NAME' already exists in namespace '$NAMESPACE'${NC}"
  echo -e "${YELLOW}[!] To regenerate, delete it first:${NC}"
  echo -e "    kubectl delete secret $SECRET_NAME -n $NAMESPACE"
  echo -e "${YELLOW}[!] Then run this script again.${NC}"
  exit 0
fi

# Generate stable secrets
echo -e "${YELLOW}[*] Generating stable secrets...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
LICENSE_SECRET=$(openssl rand -base64 32)

echo -e "${GREEN}[✓] Generated JWT_SECRET${NC}"
echo -e "${GREEN}[✓] Generated LICENSE_SECRET${NC}"

# Validate admins file
if [[ ! -f "$ADMINS_FILE" ]]; then
  echo -e "${YELLOW}[!] Admins file not found: $ADMINS_FILE${NC}"
  echo -e "${YELLOW}[!] Creating with default admin@example.com${NC}"
  ADMINS="admin@example.com"
else
  ADMINS=$(cat "$ADMINS_FILE")
  echo -e "${GREEN}[✓] Loaded admins from $ADMINS_FILE${NC}"
fi

# Create the secret
echo -e "${YELLOW}[*] Creating secret in namespace '$NAMESPACE'...${NC}"
kubectl create secret generic "$SECRET_NAME" \
  --namespace "$NAMESPACE" \
  --from-literal="SECRET_KEY=$JWT_SECRET" \
  --from-literal="SECRET_KEY_LICENSE=$LICENSE_SECRET" \
  --from-literal="admins.txt=$ADMINS" \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}[✓] Secret created successfully${NC}"

# Verification
echo -e "${YELLOW}[*] Verifying secret...${NC}"
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
  echo -e "${GREEN}[✓] Secret verified in namespace '$NAMESPACE'${NC}"

  # Show secret metadata (not actual values for security)
  echo -e "${YELLOW}[*] Secret keys:${NC}"
  kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" -o jsonpath='{.data}' | jq 'keys[]'
else
  echo -e "${RED}[✗] Secret verification failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✓ Initialization complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Deploy using Helm with create: false"
echo "     task deploy ENV=$(echo $NAMESPACE | sed 's/autolab-//; s/-[0-9]*$//')"
echo ""
echo "  2. Verify deployment"
echo "     kubectl get pods -n $NAMESPACE"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "  • These secrets are now stable and will NOT be regenerated on redeploy"
echo "  • JWT and license validation will continue to work across deployments"
echo "  • Backups contain database data, NOT secrets (secrets must be pre-created)"
echo "  • To view secrets: kubectl get secret $SECRET_NAME -n $NAMESPACE -o yaml"
echo "  • To delete secrets: kubectl delete secret $SECRET_NAME -n $NAMESPACE"
echo ""
