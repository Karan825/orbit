import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { UpstreamManager } from "../src/upstream-manager.js";
import { createGatewayApp } from "../src/main.js";
import { ApiKeyStore } from "../src/auth/api-keys.js";
import { db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

describe("Gateway Authentication & Revocation Suite", () => {
    let mockServer: any;
    let mockPort: number;
    let gatewayServer: any;
    let gatewayPort: number;
    let apiKeyStore: ApiKeyStore;
    let manager: UpstreamManager;
    let aliceUserId: string;
    let bobUserId: string;

    before(async () => {
        // 1. Create a simple mock upstream
        const mockApp = new Hono();
        mockApp.get("/healthz", (c) => c.json({ status: "ok" }));
        const mcpHandler = createMcpHandler(() => {
            const server = new McpServer({ name: "mock-auth-upstream", version: "1.0.0" });
            server.registerTool("echo", { description: "Echo tool" }, async () => ({
                content: [{ type: "text", text: "authenticated_success" }],
            }));
            return server;
        });
        mockApp.all("/mcp", (c) => mcpHandler.fetch(c.req.raw));

        await new Promise<void>((resolve) => {
            mockServer = serve({ fetch: mockApp.fetch, port: 0 }, (info) => {
                mockPort = info.port;
                resolve();
            });
        });

        // 2. Set up UpstreamManager and ApiKeyStore
        manager = new UpstreamManager([{ id: "mock", url: `http://127.0.0.1:${mockPort}/mcp` }]);
        await manager.probeAll();

        apiKeyStore = new ApiKeyStore();

        // 3. Ensure test users exist in PostgreSQL with valid UUIDs
        const [alice] = await db
            .insert(users)
            .values({
                email: `alice_${Date.now()}@urumi.local`,
                displayName: "Alice Member",
                passwordHash: "test_hash",
                role: "member",
                status: "active",
            })
            .returning();
        aliceUserId = alice.id;

        const [bob] = await db
            .insert(users)
            .values({
                email: `bob_${Date.now()}@urumi.local`,
                displayName: "Bob Member",
                passwordHash: "test_hash",
                role: "member",
                status: "active",
            })
            .returning();
        bobUserId = bob.id;

        // 4. Create Gateway with Auth ENABLED
        const gatewayApp = createGatewayApp(manager, { apiKeyStore });
        await new Promise<void>((resolve) => {
            gatewayServer = serve({ fetch: gatewayApp.fetch, port: 0 }, (info) => {
                gatewayPort = info.port;
                resolve();
            });
        });
    });

    after(async () => {
        gatewayServer?.close();
        mockServer?.close();
        await manager?.close();
    });

    test("1. /healthz is publicly accessible without Authorization header", async () => {
        const res = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, "ok");
    });

    test("2. /mcp rejects request with 401 when Authorization header is missing", async () => {
        const res = await fetch(`http://127.0.0.1:${gatewayPort}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {},
            }),
        });

        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.strictEqual(data.error.code, "UNAUTHORIZED");
        assert.ok(data.error.message.includes("Missing or malformed"));
    });

    test("3. /mcp rejects invalid or tampered API key with 401", async () => {
        const res = await fetch(`http://127.0.0.1:${gatewayPort}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer urk_fake1234_invalidsecretpartthatdoesnotmatchhash123",
                Accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {},
            }),
        });

        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.strictEqual(data.error.code, "UNAUTHORIZED");
        assert.ok(data.error.message.includes("Invalid, expired, or revoked"));
    });

    test("4. /mcp accepts valid API key and forwards MCP request successfully", async () => {
        // Generate valid key for Alice from database
        const keyRecord = await apiKeyStore.createKey({
            userId: aliceUserId,
            name: "Alice Test Key",
        });

        // Connect MCP client with Bearer token
        const transport = new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${gatewayPort}/mcp`),
            {
                requestInit: {
                    headers: {
                        Authorization: `Bearer ${keyRecord.rawKey}`,
                    },
                },
            },
        );

        const client = new Client({ name: "auth-test-client", version: "1.0.0" });
        await client.connect(transport);

        const tools = await client.listTools();
        assert.strictEqual(tools.tools.length, 1);
        assert.strictEqual(tools.tools[0].name, "mock_echo");

        const callRes = await client.callTool({
            name: "mock_echo",
            arguments: {},
        });
        assert.strictEqual(callRes.isError, undefined);
        assert.ok((callRes.content[0] as any).text.includes("authenticated_success"));

        await client.close();
    });

    test("5. Revoked key immediately fails on the very next request (zero caching)", async () => {
        // Generate valid key for Bob
        const keyRecord = await apiKeyStore.createKey({
            userId: bobUserId,
            name: "Bob Revocation Key",
        });

        // 1. Verify it works first
        const res1 = await fetch(`http://127.0.0.1:${gatewayPort}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${keyRecord.rawKey}`,
                Accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/list",
                params: {},
            }),
        });
        // Non-401 status indicates authentication passed
        assert.notStrictEqual(res1.status, 401);

        // 2. Revoke the key instantly in PostgreSQL
        const revoked = await apiKeyStore.revokeKey(keyRecord.id);
        assert.strictEqual(revoked, true);

        // 3. Immediately retry: MUST fail with 401
        const res2 = await fetch(`http://127.0.0.1:${gatewayPort}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${keyRecord.rawKey}`,
                Accept: "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
                params: {},
            }),
        });
        assert.strictEqual(res2.status, 401);
        const data = await res2.json();
        assert.strictEqual(data.error.code, "UNAUTHORIZED");
    });
});
