# Architectural Departures and Implementation Deviations

This document logs intentional architectural choices and deviations made during implementation relative to the original blueprint.

---

## 1. LLM Provider Integration

* **Original Blueprint Design**: Defaulted to Anthropic Claude (via `@anthropic-ai/sdk`) using `claude-haiku-4-5` with a configurable model adapter.
* **Actual Implementation**: Integrated Google Gemini (`gemini-2.5-flash`) via the official `@google/genai` REST integration.
* **Technical Rationale**: Provides high throughput tool-calling capabilities with zero setup friction and reliable structured schema declaration. The gateway enforces the exact same bounded tool loop, 5-iteration limit, strict system instructions, tool result framing, and write-ahead auditing regardless of the underlying LLM provider.

---

## 2. Manifest-Driven Workload Deployment

* **Original Blueprint Design**: Four isolated Helm releases (`cluster-base`, `platform`, `store`, `mcp-upstream`) deployed through an umbrella Makefile.
* **Actual Implementation**: Modular Kubernetes manifests under `deploy/manifests/` (`01-upstreams.yaml`, `02-network-policies.yaml`, `03-platform.yaml`, `04-ingress.yaml`), supplemented by the Bitnami WordPress release under `deploy/wordpress/`.
* **Technical Rationale**: Declarative Kubernetes manifests eliminate Helm state lock contention during rapid iteration while preserving identical Kubernetes API objects (Deployments, StatefulSets, Services, NetworkPolicies, Ingress resources). The manifest structure maps 1:1 to production-ready Helm chart templates for Day 12 VPS deployment.

---

## 3. Tool Discovery and URL Query Authentication

* **Original Blueprint Design**: External clients strictly supply credentials via the `Authorization: Bearer <key>` header on `POST /mcp`.
* **Actual Implementation**: Supported both the standard `Authorization: Bearer <key>` header and an optional URL query parameter (`/mcp?apiKey=urk_...`).
* **Technical Rationale**: Standardizes connectivity across a wider range of MCP desktop tools (including direct browser-based MCP Inspectors and IDE plugins) that restrict custom HTTP header configuration while preserving the same constant-time HMAC validation and user principal resolution on the server.
