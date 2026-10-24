# Model Context Protocol (MCP) Enterprise Gateway and Control Plane

An enterprise-grade reverse proxy, governance gateway, and operational control plane for Model Context Protocol (MCP) tool servers. The platform aggregates disparate upstream tool providers into a single authenticated endpoint, enforces role-based tool authorization, isolates upstream failures via active health probing and circuit breaking, and provides a real-time administrative dashboard.

## Table of Contents

- [1. System Architecture](#1-system-architecture)
- [2. Gateway Core Capabilities](#2-gateway-core-capabilities)
- [3. Repository Structure](#3-repository-structure)
- [4. Local Deployment Runbook (k3d)](#4-local-deployment-runbook-k3d)
- [5. Verification and Operational Journeys](#5-verification-and-operational-journeys)
- [6. External Client Integration Guide](#6-external-client-integration-guide)
- [7. Oracle Cloud Infrastructure (OCI) Deployment Guide](#7-oracle-cloud-infrastructure-oci-deployment-guide)
- [8. Security Architecture and Governance](#8-security-architecture-and-governance)
- [9. Technical Documentation Index](#9-technical-documentation-index)
- [10. Implemented Stand-Out Items and Differentiators](#10-implemented-stand-out-items-and-differentiators)

---

## 1. System Architecture

The platform runs as a multi-tier containerized system orchestrated on Kubernetes, segregated across three namespaces:

```
[ External MCP Clients ]    [ Operators / Browser ]
  (Claude, Cursor, CLI)       (Dashboard Web UI)
           |                           |
           +-------------+-------------+
                         |
                         v
             [ Ingress Controller (Traefik) ]
               app.localtest.me:8080 (HTTP / SSE)
                         |
      +------------------+------------------+
      |                                     |
      v                                     v
[ Urumi Gateway ]                  [ Urumi Dashboard ]
(Hono + SSE + Proxy Engine)     (Next.js 15 App Router)
Namespace: urumi-platform          Namespace: urumi-platform
      |                                     |
      +------------------+------------------+
                         |
                         v
              [ PostgreSQL 16 Database ]
              (Drizzle ORM, Keys, Audit, Upstreams)
              Namespace: urumi-platform
                         |
    +--------------------+--------------------+
    |                    |                    |
    v                    v                    v
[ WooCommerce MCP ]   [ Fulfillment MCP ]  [ Supplier MCP ]
(Port 3001)           (Port 3002)          (Port 3003)
Namespace:            Namespace:           Namespace:
urumi-store           mcp-upstreams        mcp-upstreams
    |
    v
[ WooCommerce Store ]
(WordPress + MariaDB)
Namespace: urumi-store
```

### Namespace Segregation

1. **`urumi-platform`**: Houses the central routing gateway, administrative Next.js dashboard, and PostgreSQL operational datastore.
2. **`urumi-store`**: Contains the local e-commerce store instance (WordPress 6.x and MariaDB 11.x) along with the dedicated WooCommerce MCP tool adapter.
3. **`mcp-upstreams`**: Isolates external mock services (Logistics / 3PL Fulfillment and Supplier Inventory) within separate pod boundaries to enforce network policy boundaries.

---

## 2. Gateway Core Capabilities

### 2.1 Aggregated Tool Routing and Collision Avoidance
- Merges tool catalogs from arbitrary upstream MCP servers into a single downstream endpoint (`/mcp`).
- Automatically namespaces tools using the upstream slug (`<slug>_<tool_name>`), preventing schema collisions when multiple upstreams expose identically named tools (such as `list_orders` or `get_inventory`).

### 2.2 Dual Authentication Mechanisms
- **Authorization Header**: Accepts standard `Authorization: Bearer urk_<key>` headers for modern programmatic clients (Claude Code, Cursor).
- **URL Query Parameter**: Accepts `?apiKey=urk_<key>` for clients and testing suites that do not support arbitrary HTTP headers on initial SSE connection handshakes (such as standard MCP Inspector).

### 2.3 Resilient Upstream Health State Machine
- Executes active HTTP health probes against all registered upstreams every 10 seconds.
- Automatically marks unresponsive upstreams as `unreachable` after 3 consecutive failures.
- Implements bulkhead isolation: an offline upstream never blocks or degrades requests directed to healthy upstreams.

### 2.4 Synchronous Audit Logging
- Records every tool invocation in PostgreSQL with timestamp, API key ID, team membership, tool identifier, latency, execution status, and payload metadata.
- Implements fail-closed logging: if the audit transaction fails, the downstream client receives an error.

### 2.5 In-Dashboard Operational Agent
- Built-in administrative assistant powered by Google Gemini with native tool-calling capabilities.
- Allows administrators to query orders, check inventory, and trigger fulfillment actions directly from the dashboard interface without an external terminal client.

---

## 3. Repository Structure

```
├── apps/
│   ├── dashboard/            # Next.js 15 administrative control plane
│   │   ├── app/              # App Router routes (overview, servers, api-keys, audit, chat, login)
│   │   ├── components/       # UI component library
│   │   └── Dockerfile        # Multi-stage production container build
│   └── gateway/              # Hono MCP gateway server
│       ├── src/
│       │   ├── auth/         # API key validation, hashing, and RBAC middleware
│       │   ├── audit/        # Database audit log writer
│       │   ├── chat/         # In-dashboard Gemini tool execution agent
│       │   ├── db/           # Drizzle ORM schema and database client
│       │   ├── gateway/      # SSE transport and JSON-RPC dispatch engine
│       │   └── upstream-manager.ts # Discovery, namespacing, and health probes
│       ├── Dockerfile        # Container image definition
│       └── tests/            # Automated test suite
├── deploy/
│   ├── manifests/            # Kubernetes resource definitions
│   │   ├── 01-namespaces.yaml
│   │   ├── 02-postgres.yaml
│   │   ├── 03-platform.yaml  # Gateway and Dashboard deployments and services
│   │   ├── 04-upstreams.yaml # Upstream MCP servers and services
│   │   ├── 05-store.yaml     # WordPress, MariaDB, and Woo MCP
│   │   └── 06-ingress.yaml   # Traefik Ingress routes
│   └── postgres/             # Database initialization and migration scripts
├── docs/
│   ├── DEVIATIONS.md         # Architecture deviations and rationale
│   ├── system-design-and-tradeoffs.md # In-depth design tradeoffs and component analysis
│   └── threat-model.md       # Comprehensive security threat model
├── mcp-servers/
│   ├── fulfillment/          # 3PL Logistics mock MCP server (port 3002)
│   ├── supplier/             # Wholesale supplier mock MCP server (port 3003)
│   └── woocommerce/          # WooCommerce REST API tool adapter (port 3001)
├── scripts/
│   ├── build-images.sh       # Automated multi-container build script
│   ├── test-journey.mjs      # Programmatic verification of Bearer authentication
│   └── test-query.mjs        # Programmatic verification of query-param authentication
├── pnpm-workspace.yaml
└── README.md
```

---

## 4. Local Deployment Runbook (k3d)

### Prerequisites

- Docker Desktop or Docker Engine 24.x+
- `k3d` CLI 5.x+
- `kubectl` 1.28+
- Node.js 20.x+ and `pnpm` 9.x+

### 4.1 Cluster Provisioning

Initialize a local k3d Kubernetes cluster exposing port 8080 for HTTP ingress:

```bash
k3d cluster create urumi \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer" \
  --k3s-arg "--disable=servicelb@server:0"
```

### 4.2 Building and Importing Container Images

Execute the image build script to construct all application artifacts and import them directly into the k3d cluster:

```bash
chmod +x scripts/build-images.sh
./scripts/build-images.sh

# Tag and import the platform images
docker build -t urumi-gateway:dev-v4 apps/gateway
docker build -t urumi-dashboard:dev-v4 apps/dashboard

k3d image import -c urumi \
  urumi-gateway:dev-v4 \
  urumi-dashboard:dev-v4 \
  fulfillment-mcp:dev \
  supplier-mcp:dev \
  woo-mcp:dev
```

### 4.3 Deploying via Helm (Mandatory)

The platform is packaged as a production Helm chart (`deploy/charts/mcp-gateway`). Local and production environment differences are strictly separated via `values-local.yaml` and `values-prod.yaml`.

First, ensure the core storage and namespaces are initialized:
```bash
kubectl apply -f deploy/manifests/01-namespaces.yaml
kubectl apply -f deploy/manifests/02-postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n urumi-platform --timeout=60s
```

Deploy all platform services, upstreams, network policies, and ingresses via Helm:
```bash
# Verify chart linting
helm lint deploy/charts/mcp-gateway -f deploy/charts/mcp-gateway/values-local.yaml

# Install or upgrade the release
helm upgrade --install mcp-gateway deploy/charts/mcp-gateway   -f deploy/charts/mcp-gateway/values-local.yaml
```

### 4.4 Ingress and Hostname Resolution

The Traefik ingress is mapped to `app.localtest.me:8080`. The `.localtest.me` public domain wildcard automatically resolves to `127.0.0.1` without requiring modifications to `/etc/hosts`.

Endpoints:
- **Control Plane Dashboard**: `http://app.localtest.me:8080`
- **Gateway MCP Endpoint**: `http://app.localtest.me:8080/mcp`
- **Gateway Health Check**: `http://app.localtest.me:8080/health`
- **WooCommerce Store**: `http://wordpress.local:8080` (requires `127.0.0.1 wordpress.local` in `/etc/hosts` if accessing WordPress UI directly).

---

## 5. Verification and Operational Journeys

### 5.1 One-Click Dashboard Access

Navigate to `http://app.localtest.me:8080/login`. The login page provides one-click administrative authentication:
- Click **Login as Admin (Alice)** to access the full control plane.
- Click **Login as Member (Bob)** to verify role-based restrictions.

### 5.2 Upstream Probe Health Verification

To verify that the health probe state machine correctly isolates upstream outages without impacting other services:

```bash
# 1. Check current healthy state
curl -s http://app.localtest.me:8080/api/servers | jq .

# 2. Simulate failure by scaling down an upstream server
kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=0

# 3. Observe the server transition to unreachable within 10-15 seconds
# In the dashboard at http://app.localtest.me:8080/servers, fulfillment will display as Unreachable.
# WooCommerce and Supplier tools remain fully operational.

# 4. Restore the upstream server
kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=1
```

### 5.3 Automated Client Journey Verification

Verify that external clients can authenticate and discover aggregated tools using both authentication patterns:

```bash
# Test Bearer header authentication and tool execution
node scripts/test-journey.mjs

# Test URL query parameter authentication (?apiKey=...)
node scripts/test-query.mjs
```

### 5.4 Unit and Integration Test Suite

Run the Hono gateway test suite inside the workspace:

```bash
cd apps/gateway
pnpm test
```

### 5.5 End-to-End Operational Journey: Placing Orders, External Clients, and Chat Agent

#### 1. Placing an Order in WooCommerce
1. Open the storefront at `http://wordpress.local:8080/`.
2. Browse products, add an item to the shopping cart, and proceed to checkout.
3. Complete the checkout form (cash on delivery or test gateway).
4. Verify the order appears in the WordPress Admin portal at `http://wordpress.local:8080/wp-admin/` (Login: `user` / `SaPFz70oIT`) under **WooCommerce > Orders**.

#### 2. Using the Dashboard Chat Agent
1. Navigate to the dashboard chat interface at `http://app.localtest.me:8080/chat`.
2. As **Alice (Admin)**, test operational commands:
   - *"List our latest orders from WooCommerce"* -> The agent executes `woocommerce__list_orders` through the gateway.
   - *"Check stock for our products"* -> The agent executes `woocommerce__list_products`.
   - *"Track shipment for order #1"* -> The agent calls `fulfillment__track_shipment`.
3. As **Bob (Member)**, test role permissions:
   - Asking to read products or orders works normally.
   - Asking to *"Create a new product named Test Item for $99"* attempts `woocommerce__create_product`, which the gateway immediately rejects with **HTTP 403 Forbidden**.
4. Inspect the audit log at `http://app.localtest.me:8080/audit` to view execution records, latencies, and blocked attempts.

#### 3. Connecting External MCP Clients
External clients connect to the single authenticated gateway endpoint at `http://app.localtest.me:8080/mcp`:
- **Claude Code**: See [Section 6.1](#61-claude-code-configuration).
- **Cursor**: See [Section 6.2](#62-cursor-configuration).
- **MCP Inspector**: See [Section 6.3](#63-official-mcp-inspector).

---

## 6. External Client Integration Guide

### 6.1 Claude Code Configuration

To register the aggregated MCP gateway with Claude Code:

```bash
claude mcp add urumi-gateway http://app.localtest.me:8080/mcp \
  --header "Authorization: Bearer urk_901b0dc7_b0T6oHNAEDY3rkcUpJBgJs6r84aZWFg2MllUUBsAu8k"
```

### 6.2 Cursor Configuration

Add the following block to your Cursor `settings.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "urumi-gateway": {
      "url": "http://app.localtest.me:8080/mcp",
      "headers": {
        "Authorization": "Bearer urk_901b0dc7_b0T6oHNAEDY3rkcUpJBgJs6r84aZWFg2MllUUBsAu8k"
      }
    }
  }
}
```

### 6.3 Official MCP Inspector

Launch the MCP Inspector using the query parameter authentication format:

```bash
npx @modelcontextprotocol/inspector http://app.localtest.me:8080/mcp?apiKey=urk_901b0dc7_b0T6oHNAEDY3rkcUpJBgJs6r84aZWFg2MllUUBsAu8k
```

Select transport type **SSE** and click **Connect**. All aggregated tools across WooCommerce, Fulfillment, and Supplier will be enumerated.

---

## 7. Oracle Cloud Infrastructure (OCI) Deployment Guide

This runbook details deploying the platform onto an Oracle Cloud Always Free compute instance.

### 7.1 Compute Instance Specification
- **Shape**: `VM.Standard.A1.Flex` (4 OCPU, 24 GB RAM, Ampere AArch64) or `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM, AMD x86_64).
- **Operating System**: Ubuntu 24.04 LTS.
- **Boot Volume**: 50 GB minimum.

### 7.2 VCN Security List Rules
Ensure your Virtual Cloud Network (VCN) Ingress Rules permit the following incoming traffic:
- **TCP Port 22**: SSH administration.
- **TCP Port 80**: HTTP ingress (Traefik).
- **TCP Port 443**: HTTPS ingress (Traefik / TLS).
- **TCP Port 6443**: Kubernetes API server (restricted to admin CIDR).

### 7.3 Host Initialization and k3s Installation

Connect via SSH to your OCI instance:

```bash
# Update base packages and configure iptables forwarding
sudo apt update && sudo apt upgrade -y
sudo iptables -F
sudo netfilter-persistent save

# Install k3s with Traefik enabled
curl -sfL https://get.k3s.io | sh -s - \
  --write-kubeconfig-mode 644 \
  --node-name oci-mcp-gateway

# Verify cluster status
kubectl get nodes
```

### 7.4 DNS Configuration with Wildcard Routing

For immediate external routing without purchasing a dedicated domain, utilize `sslip.io` mapped to your OCI instance public IP:

```bash
export VPS_IP="<YOUR_OCI_PUBLIC_IP>"
export BASE_DOMAIN="${VPS_IP}.sslip.io"
```

Update the Traefik Ingress resource (`deploy/manifests/06-ingress.yaml`):

```yaml
spec:
  rules:
    - host: app.<YOUR_OCI_PUBLIC_IP>.sslip.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: urumi-dashboard
                port:
                  number: 3000
```

### 7.5 Production Secrets and Database Initialization

Generate production-grade secrets:

```bash
kubectl create secret generic gateway-secrets \
  --namespace=urumi-platform \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=GEMINI_API_KEY="<YOUR_GEMINI_API_KEY>"
```

Deploy the platform onto your VPS using the production Helm values:

```bash
helm upgrade --install mcp-gateway deploy/charts/mcp-gateway   -f deploy/charts/mcp-gateway/values-prod.yaml   --set ingress.dashboardHost="app.${VPS_IP}.sslip.io"   --set ingress.storeHost="store.${VPS_IP}.sslip.io"
```

---

## 8. Security Architecture and Governance

### 8.1 API Key Hashing and Nonce Storage
- API keys use the format `urk_<8-char-prefix>_<48-char-secret>`.
- Only the SHA-256 cryptographic digest is stored in the database. Raw keys are displayed exactly once at creation time.
- Key lookups execute in constant time against indexed key prefixes.

### 8.2 Defense-in-Depth Bulkheading
- In-cluster communication between the gateway and upstream services occurs over cluster-private DNS (`*.svc.cluster.local`).
- Upstream network segmentation prevents external callers from bypassing the gateway to invoke upstream servers directly.

### 8.3 Tamper-Evident Audit Ledger
- Every tool execution, whether initiated via external MCP clients or the internal assistant, records user metadata, execution latency, input parameters, and return status.
- Audit records cannot be modified through the API plane.

---

## 9. Technical Documentation Index

For in-depth architectural analysis, refer to the accompanying engineering documentation:

1. **Threat Model and Security Analysis**: [`docs/threat-model.md`](docs/threat-model.md)
   - Evaluates token theft, unauthorized tool invocations, denial-of-service vectors, and upstream poisoning.
2. **System Design and Trade-Offs**: [`docs/system-design-and-tradeoffs.md`](docs/system-design-and-tradeoffs.md)
   - In-depth rationale for SSE transport, namespace collision resolution, probe intervals, and database architecture.
3. **Architecture Deviations Log**: [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md)
   - Formal record of intentional implementation decisions, including LLM provider selection and authentication extensions.
4. **Demo Video Script & Operational Runbook**: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
   - Complete recording script, verbatim narration, and step-by-step DoD verification flow.

---

## 10. Implemented Stand-Out Items and Differentiators

This submission implements two primary stand-out items with complete end-to-end depth, plus cloud sizing analysis:

| Stand-Out Item | Status | Primary Files & Implementation | Verification Method |
| :--- | :--- | :--- | :--- |
| **#2: Tool Permissions** | **Fully Complete** | `apps/gateway/src/auth/permissions.ts`<br>`apps/gateway/src/upstream-manager.ts`<br>`apps/dashboard/app/(with-layout)/servers/page.tsx` | Log in as Bob (Member). Mutating tools (`create_product`, `update_order`, etc.) are hidden from `tools/list`. Direct execution returns HTTP 403 and writes to `audit_events`. Admins (Alice) have full execution privileges. |
| **#9: Upgrades and Rollback** | **Fully Complete** | `deploy/charts/mcp-gateway/templates/gateway.yaml`<br>`deploy/charts/mcp-gateway/values-local.yaml`<br>`docs/DEPLOYMENT.md` | Rolling updates configured with `maxSurge: 25%`, `maxUnavailable: 25%`, and `/healthz` readiness probes. Verified with `helm upgrade --install`, simulated broken release (`dev-broken`), and `helm rollback mcp-gateway 2`. |
| **#1: Production VPS Deployment** | **Documented & Configured** | `deploy/charts/mcp-gateway/values-prod.yaml`<br>`docs/DEPLOYMENT.md` | Targeted for Oracle Cloud Always Free VPS (Ubuntu 22.04 LTS). Parameterized values for public ingress (`sslip.io`), hardened resource bounds, and comprehensive hardware sizing/kernel bottleneck analysis. |
| **Dynamic Upstream CRUD** | **Fully Complete** | `apps/gateway/src/api/servers.ts`<br>`apps/dashboard/app/(with-layout)/servers/page.tsx` | UI modal and backend API allowing operators to Add, Edit, Toggle, and Remove upstream MCP servers dynamically at runtime without pod restarts. |

---

## License

This software is released under the MIT License.