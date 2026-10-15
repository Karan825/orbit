#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-latest}"
CLUSTER_NAME="${2:-urumi}"

echo "=============================================="
echo " Building Docker Images for tag: ${TAG}"
echo "=============================================="

docker build -f apps/gateway/Dockerfile -t "urumi/gateway:${TAG}" .
docker build -f apps/dashboard/Dockerfile -t "urumi/dashboard:${TAG}" .
docker build -f mcp-servers/woocommerce/Dockerfile -t "urumi/woo-mcp:${TAG}" .
docker build -f mcp-servers/fulfillment/Dockerfile -t "urumi/fulfillment-mcp:${TAG}" .
docker build -f mcp-servers/supplier/Dockerfile -t "urumi/supplier-mcp:${TAG}" .

echo "=============================================="
echo " Importing images into k3d cluster '${CLUSTER_NAME}'..."
echo "=============================================="

k3d image import -c "${CLUSTER_NAME}" \
  "urumi/gateway:${TAG}" \
  "urumi/dashboard:${TAG}" \
  "urumi/woo-mcp:${TAG}" \
  "urumi/fulfillment-mcp:${TAG}" \
  "urumi/supplier-mcp:${TAG}"

echo "Done! All images loaded into k3d cluster."
