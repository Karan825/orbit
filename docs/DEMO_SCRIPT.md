# MCP Gateway Demo Video & Submission Guide

This document contains the complete, end-to-end recording runbook, spoken script, terminal commands, and technical reference for the submission demo video.

**Submission Form**: [Google Form](https://forms.gle/nftwgyNeenSDmiRb6)  
**Repository**: `https://github.com/Karan825/orbit.git`  
**Branch**: `feat/mcp-gateway-production`  
**Target Duration**: 7 to 9 minutes  

---

## 1. Pre-Flight Checklist

Before pressing **Record**, prepare the following browser tabs and terminal windows:

### Browser Windows / Tabs
1. **Storefront**: `http://wordpress.local:8080/`
2. **WooCommerce Admin**: `http://wordpress.local:8080/wp-admin/` (Logged in as `user` / `SaPFz70oIT` on the **WooCommerce > Orders** page).
3. **Control Plane Login**: `http://app.localtest.me:8080/login`
4. **Dashboard Chat**: (Opened upon login as Alice: `http://app.localtest.me:8080/chat`).
5. **Dashboard Management Pages**:
   * Upstream Servers: `http://app.localtest.me:8080/servers`
   * API Keys: `http://app.localtest.me:8080/api-keys`
   * Audit Logs: `http://app.localtest.me:8080/audit`
6. **External Client (MCP Inspector)**:
   * Start in a secondary terminal:
     ```bash
     npx @modelcontextprotocol/inspector
     ```
   * Or connect via Claude Code / Cursor.

### Primary Terminal
* Working directory: `/home/karan/mcp-gateway`
* Ensure the local cluster is running:
  ```bash
  docker start k3d-urumi-server-0 k3d-urumi-agent-0 k3d-urumi-serverlb
  ```
* Verify pod status:
  ```bash
  kubectl get pods -A
  ```

---

## 2. Comprehensive Demonstration Timeline & Verbatim Script

```
+-------------------------------------------------------------------------------------------------------+
| TIMELINE OVERVIEW                                                                                     |
| Act 1 (0:00 - 1:15) : System Architecture, Topology & Security Boundaries                             |
| Act 2 (1:15 - 2:15) : DoD 1 — Storefront Checkout & Order Verification                               |
| Act 3 (2:15 - 3:45) : DoD 2 — Chat Agent as User A (Admin Alice): Product Creation & Order Query     |
| Act 4 (3:45 - 5:15) : DoD 3 — External Client as User B (Member Bob): RBAC & Cross-Server Tool Calls  |
| Act 5 (5:15 - 6:45) : DoD 4 — Team Control, Failure Isolation & Audit Logging                         |
| Act 6 (6:45 - 8:15) : Production Story, Helm Upgrades & Zero-Downtime Rollback                         |
+-------------------------------------------------------------------------------------------------------+
```

---

### Act 1: System Design, Kubernetes Topology & Network Isolation
* **Time**: `0:00 - 1:30`
* **On Screen**: 
  1. Terminal running:
     ```bash
     kubectl get pods,pvc,ingress -A
     ```
  2. Then run:
     ```bash
     kubectl get networkpolicy -A
     ```
  Show the clean multi-namespace segregation, PVCs, Ingress routes, and zero-trust NetworkPolicies.

#### Verbatim Voiceover:
> *"Hello! In this demo, I will walk you through the Model Context Protocol (MCP) Enterprise Gateway and Control Plane that I built on Kubernetes.
>
> *Before jumping into the live user flows, let's look at the system architecture and Kubernetes topology. Everything is containerized and strictly isolated across three namespaces:
>
> 1. *`urumi-platform`: Hosts our core control plane. It includes:
>    - The **Gateway**: Built in TypeScript with **Hono**, responsible for terminating MCP connections over Server-Sent Events, dynamic tool catalog aggregation, role-based tool authorization, and write-ahead audit logging.
>    - The **Dashboard**: Built in **Next.js 15**, providing administrative controls, API key management, live audit log viewing, and dynamic upstream server lifecycle management.
>    - **PostgreSQL 16**: Backed by a PersistentVolumeClaim, storing user records, hashed API keys, encrypted upstream credentials, and an immutable audit ledger.
>
> 2. *`urumi-store`: Runs an independent WooCommerce e-commerce stack with a dedicated MariaDB database, persistent storage for WordPress uploads, and our custom **`woo-mcp`** adapter, which translates MCP tool calls into WooCommerce REST API calls authenticated via OAuth 1.0a HMAC-SHA256.
>
> 3. *`mcp-upstreams`: Contains our mock third-party partner services, including Fulfillment MCP and Supplier MCP.
>
> *From a security and networking standpoint:
> - **Public vs. Internal**: Only the Traefik Ingress is public (`app.localtest.me` for the control plane and `wordpress.local` for the store). Upstream MCP servers and databases run strictly as internal ClusterIP services and cannot be addressed from outside the cluster.
> - **Zero-Trust NetworkPolicies**: As you see here, cross-namespace `NetworkPolicy` objects block direct pod-to-pod lateral communication. Upstreams cannot reach each other or touch the store database directly.
> - **Credentials & Secrets**: Client API keys are stored as SHA-256 cryptographic digests with server-side pepper. Upstream credentials are encrypted at rest in PostgreSQL and only decrypted in-memory during active sessions. Sensitive environment variables are injected natively via Kubernetes Secrets.
> - **Resource Hardening**: Every container specifies strict CPU and memory requests and limits, with dual `/healthz` readiness and liveness probes guaranteeing zero-downtime rolling updates."*

---

### Act 2: Definition of Done — Baseline Storefront Order
* **Time**: `1:15 - 2:15`
* **On Screen**: 
  1. Open storefront at `http://wordpress.local:8080/`.
  2. Select an existing product, add to cart, proceed to checkout.
  3. Select **Cash on Delivery** and place order.
  4. Switch to WooCommerce Admin (`http://wordpress.local:8080/wp-admin/` -> **WooCommerce > Orders**). Refresh to show the order.

#### Verbatim Voiceover:
> *"To begin our Definition-of-Done validation, let's verify the underlying WooCommerce storefront.*
>
> *Here on the store front at `wordpress.local:8080`, I'll add an item to the shopping cart, proceed to checkout, select Cash on Delivery, and place the order.*
>
> *Now, switching to the WooCommerce administrative panel, we refresh the Orders page, and we can see our fresh order registered in the database. The store data plane is operating normally."*

---

### Act 3: Definition of Done — Chat Agent as User A (Admin Alice)
* **Time**: `2:15 - 3:45`
* **On Screen**:
  1. Open Dashboard Login (`http://app.localtest.me:8080/login`).
  2. Click **Login as Admin (Alice)**.
  3. Open **Chat** (`http://app.localtest.me:8080/chat`).
  4. Prompt 1:
     ```text
     Create a new product named "Mechanical Keyboard" with regular price "99"
     ```
  5. Show agent executing `woocommerce__create_product` and returning product details.
  6. Switch to storefront (`http://wordpress.local:8080/`). Refresh and show *Mechanical Keyboard* ($99).
  7. Add *Mechanical Keyboard* to cart and place an order on the storefront.
  8. Return to Dashboard Chat. Prompt 2:
     ```text
     What orders came in today?
     ```
  9. Show agent calling `woocommerce__list_orders` and returning the order containing the Mechanical Keyboard.

#### Verbatim Voiceover:
> *"Now let's test our AI Chat Agent acting as User A—our administrator, Alice.*
>
> *I log in as Alice with one click and open the Chat Agent. The agent runs in-process with the gateway using Gemini, dynamically executing MCP tools through the gateway pipeline as the authenticated user.*
>
> *I'll ask: 'Create a new product named Mechanical Keyboard with regular price 99'.*
>
> *Notice what happened under the hood: The agent reasoned over the available schema, recognized the mutating tool `woocommerce__create_product`, verified Alice's admin permissions, and executed the call.*
>
> *Let's verify on the storefront: I refresh the catalog, and here is our brand-new 'Mechanical Keyboard' for $99!*
>
> *I'll quickly place an order for this keyboard directly on the storefront... Order placed.*
>
> *Now back in the chat agent, I ask: 'What orders came in today?'*
>
> *The agent invokes `woocommerce__list_orders`, parses the JSON response, and displays our order details cleanly."*

---

### Act 4: Definition of Done — External MCP Client as User B (Member Bob)
* **Time**: `3:45 - 5:15`
* **On Screen**:
  1. Open **API Keys** page (`http://app.localtest.me:8080/api-keys`). Copy Bob's API key.
  2. Open MCP Inspector (`npx @modelcontextprotocol/inspector`).
  3. Connect to URL: `http://app.localtest.me:8080/mcp` with header `Authorization: Bearer <BOB_KEY>`.
  4. Click **List Tools**:
     * Point out that Bob only sees read tools (`woocommerce__list_orders`, `fulfillment__track_shipment`).
     * **Highlight Differentiator 2 (RBAC)**: Mutating tools (`create_product`, `update_order`, etc.) are hidden from Bob!
  5. In MCP Inspector, invoke `woocommerce__list_orders` with `{ "limit": 5 }`. Show orders returned.
  6. Demonstrate cross-server tool execution:
     * Execute `fulfillment__track_shipment` with `{ "order_id": 1 }` or `{ "tracking_number": "TRK-001" }`.
     * Show that the client invokes tools across **two distinct upstream MCP servers** (`woocommerce` and `fulfillment`) through a single unified gateway endpoint.

#### Verbatim Voiceover:
> *"Next, we test connecting an external MCP client as User B—our team member, Bob.*
>
> *I copy Bob's API key from the dashboard and connect via the official Model Context Protocol Inspector to our single endpoint: `http://app.localtest.me:8080/mcp`.*
>
> *Notice this critical security differentiator: When Bob requests the tool catalog, our gateway policy engine filters out all mutating tools. Bob can only see read tools like `list_orders` and `track_shipment`. If Bob attempts to execute `create_product` directly via JSON-RPC, the gateway rejects it with HTTP 403 Forbidden.*
>
> *Bob invokes `woocommerce__list_orders`, and the orders are returned instantly.

> *Here is how a tool call travels under the hood: The client's JSON-RPC packet hits the Traefik Ingress, routes to the gateway where Bob's bearer token is authenticated against PostgreSQL in constant time. The gateway resolves the deterministic `woocommerce__` prefix to prevent tool namespace collisions, attaches the upstream credential in-memory, and executes the call against `woo-mcp` with an explicit 15-second AbortSignal timeout. The result is written to our audit table and streamed back to Bob via SSE.*
>
> *Now, we run an operation spanning two distinct upstream servers: we query an order from WooCommerce, and then pass its details to `fulfillment__track_shipment` on our Fulfillment server. The client communicates with only one gateway, while the gateway transparently routes between independent upstream pods."*

---

### Act 5: Team Governance, Resilience & Failure Isolation
* **Time**: `5:15 - 6:45`
* **On Screen**:
  1. **Revoke User B's Key**:
     * In Dashboard **API Keys**, click **Revoke** on Bob's key.
     * In MCP Inspector, re-run any tool call. Show **HTTP 401 Unauthorized** error.
  2. **Disable an Upstream Server**:
     * In Dashboard **Servers** (`http://app.localtest.me:8080/servers`), toggle **Supplier MCP** to Disabled.
     * In MCP Inspector / Chat -> refresh tools -> `supplier__...` tools disappear immediately.
  3. **Kill an Upstream Pod (Simulate Failure)**:
     * In terminal, run:
       ```bash
       kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=0
       ```
     * Wait 10 seconds. Refresh **Servers** page -> show `fulfillment-mcp` is marked **Unreachable (Connection Refused)**.
     * Show that **WooCommerce is still 100% online and healthy** (fault containment).
     * In terminal, restore the pod:
       ```bash
       kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=1
       ```
     * Refresh **Servers** page -> status returns to **Connected**.
  4. **Audit Log Inspection**:
     * Open **Audit Logs** (`http://app.localtest.me:8080/audit`).
     * Show that every call (Alice's product creation, Bob's order queries, and blocked calls) appears with timestamp, latency, status, and correct user attribution.

#### Verbatim Voiceover:
> *"Now let's examine team governance, active health probing, and blast-radius containment.*
>
> *First, key revocation: In the dashboard, I revoke Bob's API key. Returning to the MCP client, the very next call is instantly rejected with HTTP 401 Unauthorized.*
>
> *Second, dynamic server management: I navigate to our Servers page and toggle Supplier MCP to Disabled. The gateway unloads its SSE connection, and its tools instantly disappear from external clients without requiring a gateway restart.

> *What if an admin registers a malicious or compromised MCP server? The gateway hardens against prompt injection: tool descriptions are length-capped at 1,024 characters, control characters are stripped, tool outputs are wrapped in strict `<tool_output>` XML boundary tags, and NetworkPolicies block egress to cloud metadata endpoints like `169.254.169.254`.*
>
> *Third, dead upstream isolation: What happens if an upstream crashes in production? Let's simulate a crash by scaling `fulfillment-mcp` down to zero replicas.*
>
> *Our gateway runs an active background health probe every 10 seconds. Within two probe intervals, the dashboard flags Fulfillment as 'Unreachable'. Most importantly, this failure is completely contained: WooCommerce and Supplier tools remain 100% operational, and the gateway does not drop client connections.*
>
> *When we restore the pod, the probe detects recovery and automatically re-registers the tools.*
>
> *Finally, let's look at the Audit Log. Every single action we just performed—the product creation by Alice, the order lookups by Bob, and the blocked unauthorized attempts—is recorded with precise latencies, parameter payloads, and immutable user attribution."*

---

### Act 6: Production Story, Helm Upgrades & Rollback
* **Time**: `6:45 - 8:15`
* **On Screen**:
  1. Open terminal running:
     ```bash
     helm history mcp-gateway -n urumi-platform
     ```
     Show Revision 1 and Revision 2.
  2. Execute a broken upgrade:
     ```bash
     helm upgrade mcp-gateway deploy/charts/mcp-gateway \
       -f deploy/charts/mcp-gateway/values-local.yaml \
       --set gateway.image.tag="dev-broken-build" \
       -n urumi-platform
     ```
  3. Show pod status:
     ```bash
     kubectl get pods -n urumi-platform
     ```
     Show new pod in `ImagePullBackOff`, while **old pod stays 1/1 Running**.
  4. In browser, refresh `http://app.localtest.me:8080/overview` to prove zero downtime.
  5. Roll back cleanly:
     ```bash
     helm rollback mcp-gateway 2 -n urumi-platform
     ```
  6. Verify clean recovery:
     ```bash
     helm history mcp-gateway -n urumi-platform
     kubectl get pods -n urumi-platform
     ```
     Show Revision 3/4 created and all pods healthy.

#### Verbatim Voiceover:
> *"To conclude, let's look at our production deployment and upgrade story.*
>
> *The entire system is packaged as a unified Helm chart with environment separation via `values-local.yaml` for local development and `values-prod.yaml` for production cloud VPS deployment.

> *Between local and VPS, Helm parameterizes everything: domain routing switches from wildcard `localtest.me` to production FQDNs on `sslip.io` with Let's Encrypt TLS, resource limits are hardened to 250m CPU and 256Mi RAM to prevent OOM on micro-instances, and storage classes map to cloud block volumes.*
>
> *Here on the terminal, `helm history` shows our deployed revisions. Let's demonstrate zero-downtime rolling upgrades and automated failure defense.*
>
> *I execute an upgrade with a broken image tag: `dev-broken-build`.*
>
> *Watch Kubernetes: it spins up a new pod, which immediately fails its pull check. Because our deployment uses `RollingUpdate` with `maxSurge` and dual `/healthz` readiness probes, Kubernetes refuses to kill the existing working pod. Our dashboard and gateway on `app.localtest.me` remain 100% online with zero customer downtime.*
>
> *Now, we execute a one-command rollback: `helm rollback mcp-gateway 2`.*
>
> *Helm creates a new revision referencing our known-good state, cleans up the failed pod, and restores 100% cluster health in seconds.*
>
> *Everything shown today is documented in detail in `README.md`, `docs/DEPLOYMENT.md`, `docs/threat-model.md`, and `docs/system-design-and-tradeoffs.md`. Thank you!"*

---

## 3. Mandatory Architectural Answers Reference

Use these talking points if asked about specific design details in the interview:

### MCP Internals
* **Tool Name Collision Handling**: All exposed tools use deterministic `<server-slug>__<original_name>` namespacing with double underscore invariants.
* **Timeouts**: Every tool execution is bounded by an explicit `AbortSignal.timeout(15000)` (15 seconds) to prevent hanging upstreams from leaking sockets.
* **Dead Upstream Detection**: 10-second active health probes mark failing upstreams as `Unreachable`, evicting their tools from discovery while keeping the gateway online.

### Security Posture
* **Credential Storage**: Raw API keys are never stored; only HMAC-SHA256 digests with server pepper. Upstream credentials (OAuth 1.0a keys) are stored encrypted in PostgreSQL and decrypted in memory only at call time.
* **Malicious Upstream Mitigation**: Tool descriptions are sanitized, stripped of control characters, and capped at 1,024 characters. Outputs are enclosed in `<tool_output>` tags to prevent LLM prompt injection.
* **Role Permissions**: Mutating tools require the `admin` role. Members receive HTTP 403 on direct execution attempts, with every violation written to the immutable audit log.

### Production vs. Local
* **Ingress**: Wildcard `app.localtest.me` locally vs. FQDN / `sslip.io` with Let's Encrypt TLS in production.
* **Resources**: Conservative 250m CPU / 256Mi RAM limits in production to operate stably on constrained VPS instances.
* **Storage**: Local path provisioners locally vs. cloud block storage with automated database dump CronJobs in production.
