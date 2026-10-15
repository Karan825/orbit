# System Architecture, Design Decisions, and Engineering Trade-offs

## 1. Core Architecture Overview

The MCP Gateway acts as a centralized governance layer positioned between AI client interfaces (MCP Inspector, Claude Code, Cursor, and the web dashboard chat) and upstream enterprise systems (WooCommerce, fulfillment APIs, supplier systems).

### Why the Gateway Terminates the MCP Protocol
Rather than acting as a transparent TCP or HTTP reverse proxy, the gateway explicitly terminates the Model Context Protocol (MCP) in both directions:
1. **Downstream (as an MCP Server)**: Exposes a single `/mcp` endpoint accepting Streamable HTTP connections from AI clients.
2. **Upstream (as an MCP Client)**: Maintains independent SDK client sessions to each registered upstream tool server within the cluster.

A generic HTTP reverse proxy cannot aggregate tool schemas from multiple distinct servers, cannot dynamically namespace tool names to prevent identifier collisions, cannot enforce per-tool role permissions, and cannot record fine-grained audit records of JSON-RPC tool parameters and execution outcomes. Terminating MCP at the gateway enables full control over tool discovery, schema sanitization, and execution safety.

---

## 2. Tool Aggregation and Collision Management

### Naming Convention
Upstream tools are exposed downstream following a deterministic namespacing standard:
```
<server-slug>__<original-tool-name>
```
* **Separation**: The double underscore (`__`) serves as an unambiguous boundary between the upstream server slug and the tool identifier.
* **Slug Invariance**: Upstream slugs are restricted to lowercase alphanumeric characters and hyphens (`^[a-z0-9-]+$`). Underscores are disallowed within slugs, ensuring the first occurrence of `__` is reliably deterministic.
* **Header Safety**: Exposed tool identifiers conform to the MCP protocol specification (`Mcp-Name` header requirements: maximum 64 characters, `[A-Za-z0-9_-]`). If an upstream tool name exceeds length restrictions, the identifier is truncated to 57 characters and appended with a 6-character cryptographic hash prefix.

### Routing Mechanism
The gateway never dynamically parses string names at call time. Tool resolution is backed by an in-memory registry and database schema indexed on `exposed_name`. Each incoming tool call is mapped directly to its target upstream client connection and original upstream method name.

---

## 3. Failure Handling and Upstream Isolation

### Fault Containment Principles
A failure, timeout, or crash in one upstream service must never cascade to other connected upstreams or degrade control-plane availability.

1. **Per-Upstream Bulkheads**:
   - Each upstream client connection enforces a strict concurrency ceiling (maximum 16 in-flight calls).
   - If an upstream becomes saturated or begins to hang, subsequent calls are rejected immediately with an error rather than exhausting gateway thread pools or socket descriptors.

2. **Strict Per-Call Timeouts**:
   - Every tool execution uses an explicit timeout deadline (default: 15 seconds) composed via `AbortSignal.timeout()`.
   - If an upstream fails to return within its allocated deadline, the client request is aborted cleanly, the audit event is marked as `timeout`, and a structured error is returned to the client.

3. **Active Health Probing State Machine**:
   - The gateway executes an active health probe against all registered upstreams every 10 seconds.
   - Two consecutive probe failures transition an upstream from `Connected` to `Unreachable` with an explicit reason code (`CONNECTION_REFUSED`, `TIMEOUT`, `HTTP_5XX`).
   - Tools originating from an `Unreachable` server are evicted from subsequent tool listings, preventing the LLM from attempting to call broken upstreams.
   - Probes retry with backoff. Once a healthy response is observed, the upstream automatically transitions back to `Connected` and its tools are restored.

4. **Readiness Probe Independence**:
   - The gateway's Kubernetes readiness probe (`/healthz/ready`) verifies internal database connectivity and schema migrations only. Upstream server statuses are intentionally excluded.
   - Binding gateway readiness to upstream health would allow a single failing partner service to pull all gateway pods out of the Kubernetes Service load balancer.

---

## 4. Data Layer and Storage Strategy

### Separation of Databases
* **PostgreSQL (Platform Control Plane)**: Stores users, hashed credentials, active sessions, upstream configurations, tool permission mappings, and the write-ahead audit log.
* **MariaDB (WooCommerce Storefront)**: Dedicated exclusively to WordPress and WooCommerce operational data (orders, catalog, customers).

*Rationale*: Separating the gateway control plane from the e-commerce data plane reduces the blast radius of database upgrades, enables independent backup/recovery cadences, and isolates application performance during high-volume store transactions.

### Write-Ahead Auditing
Audit events are inserted into PostgreSQL with status `pending` *before* the network request is dispatched to the upstream tool server. If the database insert fails, the request is immediately rejected. Upon upstream response or failure, the record is updated with final status, latency in milliseconds, outcome, and payload size. This guarantees that unrecorded executions cannot occur.

---

## 5. Architectural Trade-offs

| Decision | Selected Approach | Alternative Considered | Technical Trade-off / Rationale |
| :--- | :--- | :--- | :--- |
| **Downstream Serving** | Stateless Streamable HTTP per request | Sessionful HTTP with sticky routing | Stateless serving eliminates affinity requirements, enabling seamless horizontal pod scaling and zero-downtime rolling deployments. |
| **API Key Hashing** | HMAC-SHA256 with server-side pepper | bcrypt / argon2id | Client API keys carry 256 bits of cryptographic entropy. Slow hashing algorithms (designed to protect low-entropy user passwords) introduce unnecessary per-request latency without enhancing brute-force security for 256-bit random secrets. |
| **Chat Agent Architecture** | In-process module within gateway | Separate standalone microservice | Co-locating the chat agent within the gateway allows both external MCP clients and internal chat users to share the exact same authorization, auditing, and bulkhead execution pipeline. |
| **WordPress Deployment** | Containerized with persistent upload PVC | Dynamic runtime plugin installation | Bakes WooCommerce and core configuration directly into container manifests, ensuring reproducibility and predictable rollback without runtime plugin drift. |
| **Upstream Tool Call Retries** | Zero automatic retries | Exponential backoff retries | Tool executions frequently have side effects (e.g., placing an order, creating a product). Automatic retries on unknown transport disconnects risk duplicate transactions. |

---

## 6. Local vs. Production VPS Topology

| Dimension | Local Development (`k3d`) | Production VPS (`k3s`) |
| :--- | :--- | :--- |
| **Ingress Hostnames** | `app.localtest.me:8080`, `wordpress.local:8080` | `app.<DOMAIN>`, `store.<DOMAIN>` (or `<IP>.sslip.io`) |
| **TLS Automation** | Plain HTTP over host port mappings | `cert-manager` with Let's Encrypt HTTP-01 challenge |
| **Image Distribution** | Local image import (`k3d image import`) | Immutable Git-SHA tagged images on GitHub Container Registry (GHCR) |
| **Secrets Management** | In-cluster Secrets initialized via setup scripts | Secrets encryption at rest enabled in `k3s`, external secrets provider |
| **Disaster Recovery** | Ephemeral local volumes | Automated scheduled `pg_dump` and `mariadb-dump` CronJobs |
