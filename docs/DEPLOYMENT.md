# MCP Gateway Deployment and Production Architecture Guide

## 1. Architecture Overview

The MCP Gateway is an enterprise-governed Model Context Protocol (MCP) reverse gateway deployed on Kubernetes. It terminates client MCP connections, aggregates and sanitizes upstream tool catalogs, enforces role-based tool permissions, and provides write-ahead audit logging.

### Cluster Topology and Namespace Isolation

The deployment architecture enforces strict multi-tenant boundary separation across three dedicated namespaces:

```
+-----------------------------------------------------------------------------------+
|                                 KUBERNETES CLUSTER                                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Namespace: urumi-platform                                                   |  |
|  |                                                                             |  |
|  |  +------------------------+      +--------------------+                     |  |
|  |  | urumi-dashboard        | ---> | urumi-gateway      |                     |  |
|  |  | (Next.js 15, Port 3000)|      | (Node.js, Port 4000)                     |  |
|  |  +------------------------+      +---------+----------+                     |  |
|  |                                            |                                |  |
|  |                                  +---------v----------+                     |  |
|  |                                  | postgres-0         |                     |  |
|  |                                  | (PostgreSQL 16)    |                     |  |
|  |                                  +--------------------+                     |  |
|  +--------------------------------------------|--------------------------------+  |
|                                               | Cross-Namespace NetworkPolicy     |
|                      +------------------------+------------------------+          |
|                      |                                                 |          |
|  +-------------------v-------------------------+   +-------------------v-------+  |
|  | Namespace: mcp-upstreams                    |   | Namespace: urumi-store    |  |
|  |                                             |   |                           |  |
|  |  +-------------------+ +------------------+ |   |  +---------------------+  |  |
|  |  | fulfillment-mcp   | | supplier-mcp     | |   |  | woo-mcp             |  |  |
|  |  | (Port 3001)       | | (Port 3002)      | |   |  | (Port 3003)         |  |  |
|  |  +-------------------+ +------------------+ |   |  +----------+----------+  |  |
|  |                                             |   |             |             |  |
|  |                                             |   |  +----------v----------+  |  |
|  |                                             |   |  | WordPress + MariaDB |  |  |
|  |                                             |   |  +---------------------+  |  |
|  +---------------------------------------------+   +---------------------------+  |
+-----------------------------------------------------------------------------------+
```

1. **`urumi-platform`**: Core control-plane services, including `urumi-gateway`, `urumi-dashboard`, and persistent relational storage (`postgres-0`).
2. **`mcp-upstreams`**: Independent upstream MCP servers for fulfillment and supplier integrations.
3. **`urumi-store`**: E-commerce backend containing the WooCommerce store, MariaDB datastore, and `woo-mcp` adapter.

---

## 2. Helm Chart Architecture (`deploy/charts/mcp-gateway`)

The application deployment is parameterized using a unified Helm chart structured for continuous deployment across both local and production clusters.

### Chart File Hierarchy
```
deploy/charts/mcp-gateway/
├── Chart.yaml                  # Chart metadata and API specification
├── values.yaml                 # Base configuration values and defaults (image tag: dev-v8)
├── values-local.yaml           # Local k3d cluster overrides (localtest.me routing, relaxed limits)
├── values-prod.yaml            # Production VPS overrides (ingress hosts, strict resource boundaries)
└── templates/
    ├── _helpers.tpl            # Standardized labels, names, and selector templates
    ├── gateway-deployment.yaml # Gateway deployment with health probes and resource limits
    ├── gateway-service.yaml    # Internal ClusterIP service for the gateway
    ├── dashboard-deployment.yaml # Dashboard deployment with Next.js environment configuration
    ├── dashboard-service.yaml  # Internal ClusterIP service for the dashboard
    ├── upstreams-deployments.yaml # Deployments for fulfillment, supplier, and woo MCP servers
    ├── upstreams-services.yaml # Cross-namespace ClusterIP services for upstream servers
    ├── ingress.yaml            # Traefik ingress route definitions (dashboard and store)
    ├── networkpolicies.yaml    # Zero-trust network segmentation policies
    └── rbac.yaml               # ServiceAccounts, Roles, and RoleBindings
```

### Local vs. Production Values Comparison

| Configuration Field | `values-local.yaml` (Local Development) | `values-prod.yaml` (Production VPS) | Rationale |
| :--- | :--- | :--- | :--- |
| **Ingress Dashboard Host** | `app.localtest.me` | `dashboard.<IP>.sslip.io` | Zero-configuration local DNS wildcard vs. public cloud FQDN. |
| **Ingress Store Host** | `store.localtest.me` | `store.<IP>.sslip.io` | Separate ingress endpoints for admin portal and e-commerce store. |
| **Gateway CPU Limits** | `500m` | `250m` | Conservative caps suited for constrained micro VPS instances. |
| **Gateway Memory Limits** | `512Mi` | `256Mi` | Enforces lean memory footprints across Node.js runtimes. |
| **Replication Count** | `1` | `1` (or scalable to `2+`) | Single pod local footprint; scaled behind horizontal ingress in prod. |
| **Image Pull Policy** | `IfNotPresent` | `IfNotPresent` | Leverages preloaded container images to avoid external registry latency. |

---

## 3. Kubernetes Primitives and Reliability Controls

### Probes and Health Lifecycle
Both `urumi-gateway` and `urumi-dashboard` implement dual-stage health checks:
* **Liveness Probes**: Periodic HTTP requests to `/health` (initial delay: 15s, period: 10s). Failure triggers automatic pod restarts if the Node.js event loop deadlocks.
* **Readiness Probes**: Checks downstream dependencies (e.g. database connectivity and upstream MCP socket readiness) before registering the pod in the Kubernetes Service endpoints.

### Resource Boundaries
Every pod specifies explicit `requests` and `limits`:
* **Gateway**: `requests: { cpu: 100m, memory: 128Mi }`, `limits: { cpu: 250m, memory: 256Mi }`.
* **Dashboard**: `requests: { cpu: 100m, memory: 128Mi }`, `limits: { cpu: 250m, memory: 256Mi }`.
* **Upstreams**: `requests: { cpu: 50m, memory: 64Mi }`, `limits: { cpu: 150m, memory: 128Mi }`.

### Network Security Policies
Default-deny ingress isolation is enforced via `deploy/charts/mcp-gateway/templates/networkpolicies.yaml`:
* **`allow-gateway-to-postgres`**: Restricts PostgreSQL port 5432 ingress exclusively to pods carrying `app.kubernetes.io/name: urumi-gateway`.
* **`allow-gateway-to-upstreams`**: Permits egress from `urumi-platform` to `mcp-upstreams` and `urumi-store` only for gateway pods.
* **Direct pod-to-pod isolation**: Upstream MCP pods are blocked from directly communicating with one another.

### Role-Based Access Control (RBAC)
Pod service accounts are isolated through Kubernetes RBAC:
* Dedicated `ServiceAccount` resources configured for `urumi-gateway` and `urumi-dashboard`.
* Minimalist `Role` and `RoleBinding` limiting API access solely to non-sensitive namespace status checks.

---

## 4. Differentiator 1: Cloud VPS Deployment and Hardware Sizing Analysis

### Cloud Target Architecture
The production configuration was targeted to an Oracle Cloud Infrastructure (OCI) Always Free Ubuntu 22.04 LTS instance.

### Hardware Constraints and Sizing Requirements
* **Production Recommended Sizing**: A minimum of **2 vCPUs and 4 GB RAM** is required for production Kubernetes environments.
* **Micro Instance Constraints (1 vCPU / 1 GB RAM)**:
  * When deploying a full single-node cluster (k3s control plane, containerd, SQLite/kine datastore, CoreDNS, PostgreSQL, and 5 distinct Node.js runtimes) on an entry-level micro shape (`VM.Standard.E2.1.Micro`), simultaneous cold starts push CPU demand over 140%.
  * On hypervisor-throttled burstable instances (12.5% CPU baseline), sustained 100% CPU causes hypervisor steal time (`st > 50%`) and disk swap thrashing (`wa > 40%`).
  * The embedded k3s SQLite datastore locks during rapid parallel transactions, resulting in client-side timeouts (`net/http: TLS handshake timeout`) during concurrent Helm operations.

### Engineering Mitigations for Micro-Scale Deployments
1. **Control-Plane Streamlining**: Disabling non-essential controllers (`servicelb`, `metrics-server`) in `/etc/rancher/k3s/config.yaml` to minimize background I/O.
2. **Datastore Acceleration**: Moving the SQLite WAL journal to a high-speed memory-backed `tmpfs` mount to eliminate block storage `fsync()` queuing.
3. **Phased Rollout**: Applying manifests sequentially rather than concurrently, preventing initial JS compilation storms.
4. **Declarative Rendering**: Rendering charts with `helm template` and applying via `kubectl apply` to reduce API release transaction overhead.

---

## 5. Differentiator 2: Role-Based Tool Governance (RBAC)

The gateway implements a dual-layer tool governance model differentiating `admin` (Alice) from `member` (Bob):

```
Client Request (Bob / Member)
            |
            v
+-------------------------------+
|       MCP Gateway (/mcp)       |
+-------------------------------+
            |
    [1. Tool Discovery] --------> Filters mutating tools from 'tools/list' response
            |                     (Only exposes: get_product, list_products, get_order, track_shipment)
            |
    [2. Execution Attempt] -----> Direct execution of 'create_product', 'update_order', etc.
            |
            v
+-------------------------------+
|  Role-Based Policy Validator  |
+-------------------------------+
            |
            |-- If role == 'member' and tool.isMutating == true:
            |     1. Rejects execution with 403 Forbidden.
            |     2. Writes security violation record to 'audit_events'.
            v
   Rejected: 403 Forbidden
```

### Governance Rules
* **Read-Only Tools (`member` & `admin`)**: `get_product`, `list_products`, `get_order`, `track_shipment`.
* **Mutating Tools (`admin` only)**: `create_product`, `update_order`, `update_shipment`, `create_restock_request`.

---

## 6. Dynamic Upstream Management (Server CRUD)

The Gateway and Dashboard support dynamic runtime management of upstream MCP servers without pod restarts:
* **Add Server**: Dynamically register new upstream endpoints with static headers / bearer tokens.
* **Edit Server**: Update base URLs, timeout configurations, and authentication credentials.
* **Toggle Server**: Enable or disable an upstream with immediate catalog synchronization.
* **Hot-Reloading**: The `UpstreamManager` class terminates existing Server-Sent Events (SSE) connections and establishes new authenticated sessions on state change.

---

## 7. Verification and Local Cluster Inspection

### Inspect Pod Rollout
```bash
docker exec k3d-urumi-server-0 kubectl get pods -A
```

Expected output:
```text
NAMESPACE        NAME                                      READY   STATUS    RESTARTS   AGE
mcp-upstreams    fulfillment-mcp-7cf4fc4dcb-rx6t2          1/1     Running   0          5h
mcp-upstreams    supplier-mcp-5f54f9598d-w94vk             1/1     Running   0          5h
urumi-platform   postgres-0                                1/1     Running   0          46h
urumi-platform   urumi-dashboard-7d6678fd4c-h95l2          1/1     Running   0          4h
urumi-platform   urumi-gateway-744785c866-zg9d6            1/1     Running   0          4h
urumi-store      urumi-store-mariadb-0                     1/1     Running   0          3d
urumi-store      urumi-store-wordpress-64ffbc7886-2hdfd    1/1     Running   0          3d
urumi-store      woo-mcp-788ff6cdf-shkds                   1/1     Running   0          5h
```

### Inspect Ingress Routes
```bash
docker exec k3d-urumi-server-0 kubectl get ingress -A
```

### Verify Dashboard Connectivity
```bash
curl -I -H "Host: app.localtest.me" http://localhost:8080/login
# Returns: HTTP/1.1 200 OK
```
