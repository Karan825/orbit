# MCP Gateway — Dashboard & Frontend

This frontend is the lightweight, trimmed dashboard built specifically for the **MCP Gateway on Kubernetes** platform blueprint.

It provides a complete management interface for upstream tool servers, client API keys, the in-dashboard chat agent, and write-ahead audit logs.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
```
*(By default `NEXT_PUBLIC_MOCK_DATA="true"` is enabled so all views load with realistic WooCommerce, Fulfillment, and Supplier data even before the gateway is running).*

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧭 Dashboard Views (As per Specification)

| Route | View Description |
|---|---|
| `/overview` | **Gateway Overview**: Live upstream health (Active vs Total), 24h invocations, error rate, p95 latency, and recent audit activity. |
| `/servers` | **Upstream Registry**: Monitor upstream servers (`woocommerce`, `fulfillment`, `supplier`), status chips (`Connected`, `Unreachable`, `Disabled`, `Connecting`), test connections, and inspect discovered tools & JSON schemas. |
| `/chat` | **In-Dashboard Chat Agent**: LLM chat loop with session management and **expandable tool call cards** displaying server, tool, latency, input args, and structured output. |
| `/api-keys` | **Client API Keys**: Generate per-user 256-bit credentials with one-time reveal and ready-to-paste snippets for **Claude Code**, **Cursor**, and **MCP Inspector**. |
| `/audit` | **Write-Ahead Audit Trail**: Searchable, filterable audit log (by user, server, tool, channel, outcome) with auto-refresh every 5s and record inspection modals. |
| `/team` | **Team & Permissions**: Member list, role badges (`Admin` / `Member`), and 72-hour one-time invitation link generator. |
| `/login` | **Authentication**: Simple login screen with prefilled demo credentials. |

---

## 🔌 Connecting to the Live Gateway Backend

When running against the live Hono gateway (`apps/gateway` running on port 8080 or in Kubernetes):

1. In `.env.local`:
   ```bash
   GATEWAY_API_URL="http://localhost:8080"
   NEXT_PUBLIC_MOCK_DATA="false"
   ```
2. The Next.js dev server will transparently proxy all `/api/*` and `/mcp` calls directly to your Hono gateway.
