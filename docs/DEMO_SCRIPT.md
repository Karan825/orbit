# MCP Enterprise Gateway: Master Demo Video Teleprompter & Recording Guide

This document is your **screen-by-screen choreography guide and verbatim teleprompter**. 

It is written in natural, conversational spoken English—the way a senior platform engineer actually speaks during an architecture review or client demo. There are no robotic bullet points or stiff headings to read aloud. Every sentence flows naturally into the next, with precise instructions on what to show, where to click, and what commands to run at that exact second.

---

## Quick Reference Summary

* **Submission Link**: [Google Form](https://forms.gle/nftwgyNeenSDmiRb6)
* **GitHub Repository**: `https://github.com/Karan825/orbit.git`
* **Target Branch**: `feat/mcp-gateway-production`
* **Target Video Length**: 7 to 8.5 minutes
* **Resolution**: 1080p (Full Screen or clean 50/50 split between Browser and Terminal)

---

## Pre-Recording Screen Setup

Open these browser tabs in Google Chrome (left window) and your terminal (right window):

```
+------------------------------------------+------------------------------------------+
| GOOGLE CHROME (Tabs arranged in order)   | TERMINAL (WSL Ubuntu)                    |
|                                          |                                          |
| Tab 1: http://wordpress.local:8080/      | Current directory:                       |
| Tab 2: http://wordpress.local:8080/wp-admin/ /home/karan/mcp-gateway                |
| Tab 3: http://app.localtest.me:8080/login|                                          |
| Tab 4: MCP Inspector (localhost:5173     | Cluster running:                         |
|        or npx @modelcontextprotocol/...) | docker start k3d-urumi-server-0 ...      |
+------------------------------------------+------------------------------------------+
```

---

## The Video Recording Script (Synchronized Teleprompter)

---

### ACT 1: Architecture, Storage, and Security Boundaries
**Timecode: 0:00 – 1:30**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. Start with your **Terminal** taking up the full screen.
2. Type and run:
   ```bash
   kubectl get pods,pvc,ingress -A
   ```
3. Use your mouse cursor to gently circle the three namespace groupings:
   * Circle `urumi-platform` pods (`urumi-gateway`, `urumi-dashboard`, `postgres-0`).
   * Circle `urumi-store` pods (`wordpress`, `mariadb`, `woo-mcp`).
   * Circle `mcp-upstreams` pods (`fulfillment-mcp`, `supplier-mcp`).
4. Next, hover your cursor over the **PVC** lines to show persistent storage, then hover over the **Ingress** lines showing `app.localtest.me` and `wordpress.local`.
5. Now type and run:
   ```bash
   kubectl get networkpolicy -A
   ```
6. Hover over the policy names (`allow-gateway-to-postgres`, `allow-gateway-to-upstreams`).

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"Hi everyone! Welcome to the demo of our Model Context Protocol Enterprise Gateway and Control Plane running on Kubernetes.*
>
> *Before we dive into the live user journeys, I want to briefly walk you through how the platform is architected under the hood.*
>
> *As you can see here in the terminal, our cluster is strictly segregated across three distinct namespaces:*
>
> *First, we have `urumi-platform`, which hosts our core control plane. This includes our Gateway—built in TypeScript with Hono—which terminates downstream client MCP connections, aggregates upstream tool catalogs, and handles policy enforcement. Alongside it, we have our Next.js 15 administrative dashboard and a PostgreSQL 16 database backed by a PersistentVolumeClaim, storing user sessions, hashed API keys, and an immutable audit ledger.*
>
> *Second, we have `urumi-store`, which runs an independent e-commerce environment with WooCommerce, MariaDB, and our custom `woo-mcp` adapter that speaks to WordPress using OAuth 1.0a.*
>
> *And third, we have `mcp-upstreams`, where we host our synthetic partner services, like Fulfillment and Supplier logistics.*
>
> *If we look at networking and isolation, notice that only our Traefik Ingress is exposed to public traffic through `app.localtest.me`. Everything else—the databases, the upstream MCP servers—runs entirely as internal ClusterIP services. To enforce this boundary, we’ve applied zero-trust NetworkPolicies across the namespaces, meaning even if someone compromises an upstream pod, it physically cannot establish lateral connections to our WooCommerce database or other internal components.*
>
> *Finally, sensitive credentials like database passwords and Gemini LLM keys are injected natively via Kubernetes Secrets, and every container runs with strict CPU and memory limits, protected by dual `/healthz` readiness and liveness probes."*

---

### ACT 2: Baseline Storefront Checkout & Order Placement
**Timecode: 1:30 – 2:30**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. Switch to your browser, **Tab 1** (`http://wordpress.local:8080/`).
2. Click on any visible product (for example, the *Album* or *Hoodie*).
3. Click **Add to Cart**, then click **View Cart** or **Checkout**.
4. Fill in dummy checkout details (e.g., First Name: `John`, Last Name: `Doe`, Address: `123 Main St`).
5. Select the **Cash on Delivery** radio button.
6. Click **Place Order**. Wait 1 second for the order confirmation screen showing the Order Number (e.g., *Order #12*).
7. Switch to **Tab 2** (`http://wordpress.local:8080/wp-admin/` -> **WooCommerce > Orders**).
8. Refresh the page. Point your mouse to the newly created order in *Processing* status.

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"To establish our baseline, let's confirm that the e-commerce data plane is operational.*
>
> *I'll jump over to our storefront running at `wordpress.local:8080`. I'll pick a product, add it to the cart, and proceed to checkout.*
>
> *For testing convenience, we have Cash on Delivery enabled, so I'll select that and place the order right now.*
>
> *Now, switching tabs into the WordPress administrative panel under WooCommerce Orders, I'll refresh the table... and as you can see, our new order has arrived cleanly with a status of Processing. Our baseline store is healthy and ready to receive traffic from our gateway."*

---

### ACT 3: AI Chat Agent as User A (Admin Alice)
**Timecode: 2:30 – 4:00**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. Switch to **Tab 3** (`http://app.localtest.me:8080/login`).
2. Click the **Login as Admin (Alice)** button.
3. In the left navigation sidebar, click on **Chat** (`http://app.localtest.me:8080/chat`).
4. Click into the chat input box and type:
   ```text
   Create a new product named "Mechanical Keyboard" with regular price "99"
   ```
5. Hit Enter. Wait 2–3 seconds while Gemini processes the prompt and the gateway executes the tool.
6. The chat agent will respond with a confirmation message (e.g., *"Successfully created product Mechanical Keyboard with ID 15 and price $99"*).
7. Switch to **Tab 1** (`http://wordpress.local:8080/shop/` or the storefront home page) and press Refresh.
8. Point your cursor to the newly created **Mechanical Keyboard** listed for **$99**.
9. Click on it, click **Add to Cart**, proceed to checkout, select **Cash on Delivery**, and click **Place Order** (Name: `Alice Admin`).
10. Switch back to the **Dashboard Chat** tab and type:
    ```text
    What orders came in today?
    ```
11. Hit Enter. The agent will call `woocommerce__list_orders` and render the order details, showing the purchase of the Mechanical Keyboard.

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"Now let's see how our AI Chat Agent operates when authenticated as User A—our administrator, Alice.*
>
> *I'll log in as Alice with a single click and open our operations chat interface. The chat agent runs directly in-process with the gateway, using Gemini to introspect available tool schemas and execute them through the gateway pipeline as the logged-in user.*
>
> *Let's ask it to create inventory: 'Create a new product named Mechanical Keyboard with regular price 99'.*
>
> *Under the hood, the model planned the request, identified `woocommerce__create_product`, verified that Alice's session holds the admin role, and executed the call through our gateway. And there's our confirmation.*
>
> *Let's verify on the actual storefront: I'll switch back to the shop tab, hit refresh... and right there is our brand-new Mechanical Keyboard for $99.*
>
> *Now, let's place an order for this exact keyboard directly on the storefront by hand... order placed.*
>
> *Returning to the chat agent, I'll ask: 'What orders came in today?'*
>
> *The model invokes `woocommerce__list_orders`, parses the response, and displays the exact order we just placed with customer and line-item details. The chat agent is completely synchronized with the store."*

---

### ACT 4: External MCP Client as User B (Member Bob) & RBAC
**Timecode: 4:00 – 5:30**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. In the Dashboard sidebar, navigate to **API Keys** (`http://app.localtest.me:8080/api-keys`).
2. Show the API keys table. Copy the key for **Bob (Member)** (or click Create Key for Bob, and copy the `urk_...` token).
3. Switch to your **MCP Inspector tab** (`localhost:5173` or open terminal where `npx @modelcontextprotocol/inspector` is running).
4. In the Inspector connection configuration:
   * Transport: **SSE**
   * URL: `http://app.localtest.me:8080/mcp`
   * Header: `Authorization: Bearer <PASTE_BOBS_KEY>` (or use `?apiKey=<KEY>` in URL).
5. Click **Connect**.
6. Click on **List Tools**:
   * Slowly scroll through the tools list.
   * Point your mouse to the tools: you will see `woocommerce__list_orders`, `woocommerce__get_product`, `fulfillment__track_shipment`, `supplier__check_stock`.
   * **Crucial Moment (Differentiator 2)**: Highlight on screen that mutating tools (`create_product`, `update_order`, `update_shipment`, `create_restock_request`) are **completely absent** from Bob's tool catalog!
7. In the Inspector, select the tool `woocommerce__list_orders`, enter arguments `{ "limit": 5 }`, and click **Run Tool**.
8. Show the JSON response returning orders cleanly.
9. Now demonstrate a cross-server tool execution:
   * Select `fulfillment__track_shipment` from the tool dropdown.
   * Enter arguments `{ "order_id": 1 }` or `{ "tracking_number": "TRK-001" }`.
   * Click **Run Tool**. Show the tracking information returned from the synthetic Fulfillment service.

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"Now let's switch personas to User B—our team member, Bob—and connect through an external MCP client.*
>
> *In the dashboard, I'll copy Bob's API key and open the official MCP Inspector. I configure it to connect over Server-Sent Events to our single public gateway endpoint at `app.localtest.me:8080/mcp`, passing Bob's bearer token.*
>
> *Once connected, let's inspect the discovered tools list. Notice something very important here:*
>
> *Because Bob has the 'member' role, our gateway policy engine dynamically filtered out all mutating tools. Bob can see read-only tools like `list_orders` and `track_shipment`, but tools like `create_product` or `update_order` are completely hidden. If Bob attempted to craft a raw JSON-RPC request to invoke `create_product`, the gateway's policy validator would immediately reject it with HTTP 403 Forbidden.*
>
> *Let's run `woocommerce__list_orders`... and there are today's orders returned over SSE.*
>
> *Here is what happened under the hood: The client's JSON-RPC packet hit the Traefik Ingress and routed to our Hono gateway. The gateway authenticated Bob's token against PostgreSQL in constant time, injected the upstream WooCommerce OAuth credential in-memory, executed the call against `woo-mcp` with an explicit 15-second timeout, and logged the event before streaming the result back.*
>
> *Now, let's run a tool on a completely different upstream: I'll select `fulfillment__track_shipment` and execute it. In the same session, through the same endpoint, the client seamlessly communicates across two separate upstream services without needing to know anything about their individual endpoints or authentication requirements."*

---

### ACT 5: Team Governance, Upstream Resilience & Failure Isolation
**Timecode: 5:30 – 6:45**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. **Revoke User B's Key**:
   * Switch to the Dashboard **API Keys** page (`http://app.localtest.me:8080/api-keys`).
   * Find Bob's key and click the red **Revoke** button.
   * Switch back to the MCP Inspector and immediately click **Run Tool** again.
   * Show the error message on screen: **HTTP 401 Unauthorized** (API key has been revoked).
2. **Disable an Upstream Server**:
   * Switch to the Dashboard **Servers** page (`http://app.localtest.me:8080/servers`).
   * Find **Supplier MCP** and click the green toggle switch to turn it **Disabled (Inactive)**.
   * Switch to the Inspector, refresh or list tools -> point out that `supplier__...` tools have completely vanished from the catalog.
3. **Simulate a Dead Upstream (Kill Pod)**:
   * Bring up your Terminal and run:
     ```bash
     kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=0
     ```
   * Wait 10 seconds (giving the active background probe time to detect the drop).
   * In the browser, refresh the **Servers** page. Point your mouse to `fulfillment-mcp`: its status badge has turned red and displays **Unreachable (Connection Refused)**.
   * Point out that **WooCommerce is still green and Connected**!
   * In the Terminal, restore the pod:
     ```bash
     kubectl scale deployment fulfillment-mcp -n mcp-upstreams --replicas=1
     ```
   * Wait 5 seconds, refresh the Servers page -> `fulfillment-mcp` turns green and says **Connected** again.
4. **Audit Trail Inspection**:
   * In the Dashboard sidebar, click **Audit Logs** (`http://app.localtest.me:8080/audit`).
   * Scroll down the live table. Point out the columns:
     * User attribution: Show `Alice` (Admin) for product creation vs. `Bob` (Member) for order queries.
     * Latency measurements in milliseconds (e.g., `45ms`, `120ms`).
     * Status codes: Show `SUCCESS` records and the `BLOCKED` / `UNAUTHORIZED` records.

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"Now let's test administrative control, resilience, and blast-radius containment.*
>
> *First, token revocation: What happens if a team member's key is compromised? In the dashboard, I'll click Revoke on Bob's key. Returning to the MCP client, the very next call is instantly rejected with HTTP 401 Unauthorized. Key revocation is immediate and enforces zero caching.*
>
> *Second, dynamic server management: If an upstream needs maintenance, I can go to our Servers page and toggle Supplier MCP to Disabled. The gateway unloads its SSE connection, and its tools immediately disappear from client catalogs without requiring a gateway restart.*
>
> *What if an administrator accidentally connects an untrusted or compromised MCP server? The gateway protects the platform: tool descriptions are length-capped at 1,024 characters, control characters are stripped, tool outputs are wrapped in strict XML boundary tags to prevent LLM prompt injection, and NetworkPolicies block egress to cloud metadata endpoints like `169.254.169.254`.*
>
> *Third, dead upstream isolation: What happens if an upstream pod crashes in production? Let's simulate that by scaling our Fulfillment deployment down to zero replicas.*
>
> *Our gateway runs an active background health probe every 10 seconds. Within two probe intervals, the dashboard automatically flags Fulfillment as 'Unreachable'. But notice the critical architecture benefit: WooCommerce and Supplier tools remain completely unaffected and operational, and our gateway never drops client connections.*
>
> *When I scale Fulfillment back up, the probe detects recovery and restores the tools automatically.*
>
> *Finally, let's look at the Audit Log. Every single action we've executed today—Alice's product creation, Bob's order queries, and the blocked unauthorized attempts—is immutably recorded in PostgreSQL with exact user attribution, timestamps, latencies, and execution outcomes."*

---

### ACT 6: Production Story, Helm Upgrades & Zero-Downtime Rollback
**Timecode: 6:45 – 8:15**

#### [VISUAL CHOREOGRAPHY: WHAT TO SHOW ON SCREEN]
1. Bring your **Terminal** front and center.
2. Run:
   ```bash
   helm history mcp-gateway -n urumi-platform
   ```
   Show Revision 1 and Revision 2.
3. Now simulate a broken upgrade by deploying an invalid image tag:
   ```bash
   helm upgrade mcp-gateway deploy/charts/mcp-gateway      -f deploy/charts/mcp-gateway/values-local.yaml      --set gateway.image.tag="dev-broken-build"      -n urumi-platform
   ```
4. Immediately check the pods:
   ```bash
   kubectl get pods -n urumi-platform
   ```
   Point your mouse cursor to the terminal output:
   * The new pod shows `ImagePullBackOff` or `ErrImagePull`.
   * **Highlight the critical point**: The old working pod (`urumi-gateway-...`) is **still 1/1 Running and handling traffic**!
5. Switch to Chrome and refresh `http://app.localtest.me:8080/overview` to visually prove the dashboard is still 100% online.
6. Return to the Terminal and execute an instant rollback:
   ```bash
   helm rollback mcp-gateway 2 -n urumi-platform
   ```
7. Check the history and pods:
   ```bash
   helm history mcp-gateway -n urumi-platform
   kubectl get pods -n urumi-platform
   ```
   Show that a new Revision was deployed referencing Revision 2, the broken pod was terminated, and all pods are `1/1 Running`.

---

#### [VERBATIM VOICE-OVER: WHAT YOU SAY NATURALLY]
> *"To wrap up, let's look at our production deployment and upgrade strategy.*
>
> *The entire platform is packaged as a production-grade Helm chart. We maintain strict environment separation using `values-local.yaml` for local k3d clusters and `values-prod.yaml` for production cloud VPS environments.*
>
> *Between local and VPS, Helm parameterizes everything cleanly: domain routing switches from wildcard `localtest.me` to production FQDNs on `sslip.io` with Let's Encrypt TLS, resource limits are calibrated to 250m CPU and 256Mi RAM to run stably on micro-instances, and storage classes map to cloud block storage.*
>
> *Here on the terminal, `helm history` shows our deployed releases. Let's demonstrate how our system handles a bad deployment in production.*
>
> *I'll trigger an upgrade using a broken image tag: `dev-broken-build`.*
>
> *Looking at `kubectl get pods`, Kubernetes starts the new container, which immediately fails its pull check. Because our deployment uses a `RollingUpdate` strategy with `maxSurge` and dual `/healthz` readiness probes, Kubernetes refuses to kill our existing healthy pod. If I refresh our dashboard right now, the platform is still 100% online with zero customer downtime.*
>
> *To recover, we run a single command: `helm rollback mcp-gateway 2`.*
>
> *Helm automatically creates a new revision referencing our known-good state, cleans up the failed pod, and restores 100% cluster health in seconds.*
>
> *Everything we demonstrated today is documented in detail in our repository's `README.md`, `docs/DEPLOYMENT.md`, `docs/threat-model.md`, and `docs/system-design-and-tradeoffs.md`. Thank you very much!"*

---

## 4. Emergency Troubleshooting & Re-Run Commands

If you make a mistake while recording and want to reset quickly without restarting Docker:

* **Reset Alice's test product in WooCommerce**:
  Log into `http://wordpress.local:8080/wp-admin/`, go to **Products**, hover over *Mechanical Keyboard*, and click **Trash**.
* **Reset Bob's revoked API key**:
  In `http://app.localtest.me:8080/api-keys`, click **Create Key**, select **Bob**, copy the key.
* **Ensure all pods are running**:
  ```bash
  docker start k3d-urumi-server-0 k3d-urumi-agent-0 k3d-urumi-serverlb
  kubectl get pods -A
  ```
* **Restore Helm to clean Revision 2**:
  ```bash
  helm rollback mcp-gateway 2 -n urumi-platform
  ```
