import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import type { AddressInfo } from "node:net";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { UpstreamManager } from "../src/upstream-manager.js";
import { createGatewayApp } from "../src/main.js";

// Helper to create an isolated mock upstream MCP server on dynamic port
function createMockUpstream(
    id: string,
    toolName: string,
    toolHandler: (args: any) => Promise<any> | any = () => ({
        content: [{ type: "text", text: `result_${id}` }],
    }),
) {
    const app = new Hono();

    app.get("/healthz", (c) => c.json({ status: "ok", id }));

    const mcpHandler = createMcpHandler(() => {
        const server = new McpServer({
            name: `mock-${id}`,
            version: "1.0.0",
        });

        server.registerTool(
            toolName,
            {
                description: `Test tool for ${id}`,
            },
            async (args) => {
                return await toolHandler(args);
            },
        );

        return server;
    });

    app.all("/mcp", (c) => mcpHandler.fetch(c.req.raw));

    let serverInstance: any = null;

    return {
        id,
        toolName,
        start(preferredPort: number = 0): Promise<{ url: string; port: number }> {
            return new Promise((resolve) => {
                serverInstance = serve({ fetch: app.fetch, port: preferredPort }, (info) => {
                    resolve({ url: `http://127.0.0.1:${info.port}/mcp`, port: info.port });
                });
            });
        },
        stop(): Promise<void> {
            return new Promise((resolve) => {
                if (serverInstance) {
                    serverInstance.close(() => resolve());
                    serverInstance = null;
                } else {
                    resolve();
                }
            });
        },
    };
}

describe("MCP Gateway Reliability & Health Tests", () => {
    let mockA = createMockUpstream("mock_a", "tool_a");
    let mockB = createMockUpstream("mock_b", "tool_b");
    let mockC = createMockUpstream("mock_c", "tool_c");

    let portA: number;
    let portB: number;
    let portC: number;
    let gatewayPort: number;

    let gatewayManager: UpstreamManager;
    let gatewayServer: any;
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    before(async () => {
        const infoA = await mockA.start(0);
        portA = infoA.port;
        const infoB = await mockB.start(0);
        portB = infoB.port;
        const infoC = await mockC.start(0);
        portC = infoC.port;

        gatewayManager = new UpstreamManager(
            [
                { id: "mock_a", url: `http://127.0.0.1:${portA}/mcp` },
                { id: "mock_b", url: `http://127.0.0.1:${portB}/mcp` },
                { id: "mock_c", url: `http://127.0.0.1:${portC}/mcp` },
            ],
            {
                healthProbeTimeoutMs: 1000,
                defaultCallTimeoutMs: 1500,
            },
        );

        await gatewayManager.probeAll();

        const app = createGatewayApp(gatewayManager);
        await new Promise<void>((resolve) => {
            gatewayServer = serve({ fetch: app.fetch, port: 0 }, (info) => {
                gatewayPort = info.port;
                resolve();
            });
        });

        transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${gatewayPort}/mcp`));
        client = new Client({ name: "test-client", version: "1.0.0" });
        await client.connect(transport);
    });

    after(async () => {
        await client.close().catch(() => undefined);
        gatewayManager.stopBackgroundHealthChecks();
        await gatewayManager.close();
        if (gatewayServer) gatewayServer.close();
        await mockA.stop();
        await mockB.stop();
        await mockC.stop();
    });

    test("1. All three healthy upstreams are reported correctly on /healthz", async () => {
        const res = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();

        assert.strictEqual(data.status, "ok");
        assert.strictEqual(data.totalUpstreams, 3);
        assert.strictEqual(data.healthyUpstreams, 3);
        assert.strictEqual(data.upstreams.mock_a.status, "healthy");
        assert.strictEqual(data.upstreams.mock_b.status, "healthy");
        assert.strictEqual(data.upstreams.mock_c.status, "healthy");
        assert.strictEqual(data.discoveredTools, 3);
    });

    test("2. Stopping one upstream marks only that upstream unhealthy", async () => {
        // Stop mock_c
        await mockC.stop();

        const res = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
        const data = await res.json();

        assert.strictEqual(data.status, "degraded");
        assert.strictEqual(data.healthyUpstreams, 2);
        assert.strictEqual(data.upstreams.mock_a.status, "healthy");
        assert.strictEqual(data.upstreams.mock_b.status, "healthy");
        assert.strictEqual(data.upstreams.mock_c.status, "unhealthy");
        assert.ok(data.upstreams.mock_c.error, "Should have error message");
    });

    test("3. Healthy upstreams continue serving tools while another is unavailable", async () => {
        const callA = await client.callTool({
            name: "mock_a_tool_a",
            arguments: {},
        });
        assert.ok(!callA.isError, "Call A should succeed");
        assert.ok((callA.content[0] as any).text.includes("result_mock_a"));

        const callB = await client.callTool({
            name: "mock_b_tool_b",
            arguments: {},
        });
        assert.ok(!callB.isError, "Call B should succeed");
        assert.ok((callB.content[0] as any).text.includes("result_mock_b"));
    });

    test("4. Unhealthy upstream tools disappear from the gateway's advertised catalogue", async () => {
        const toolsList = await client.listTools();
        const names = toolsList.tools.map((t) => t.name);

        assert.ok(names.includes("mock_a_tool_a"), "mock_a tool should be present");
        assert.ok(names.includes("mock_b_tool_b"), "mock_b tool should be present");
        assert.strictEqual(names.includes("mock_c_tool_c"), false, "mock_c tool must disappear from catalogue");
        assert.strictEqual(toolsList.tools.length, 2);

        // Calling unavailable tool returns clear controlled error
        let errorCaught = false;
        try {
            const callC = await client.callTool({
                name: "mock_c_tool_c",
                arguments: {},
            });
            if (callC.isError) {
                errorCaught = true;
            }
        } catch (e: any) {
            errorCaught = true;
            assert.ok(e.message.includes("not found") || e.message.includes("unavailable"));
        }
        assert.ok(errorCaught, "Calling unavailable tool must fail with clear error");
    });

    test("5. Restarting an upstream restores its tools without restarting the gateway", async () => {
        // Restart mock_c on the original portC
        mockC = createMockUpstream("mock_c", "tool_c");
        await mockC.start(portC);

        // Healthz reflects recovery
        const res = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
        const data = await res.json();
        assert.strictEqual(data.status, "ok");
        assert.strictEqual(data.healthyUpstreams, 3);
        assert.strictEqual(data.upstreams.mock_c.status, "healthy");

        // Tools list now includes mock_c again
        const toolsList = await client.listTools();
        const names = toolsList.tools.map((t) => t.name);
        assert.ok(names.includes("mock_c_tool_c"), "mock_c tool should be restored");
        assert.strictEqual(toolsList.tools.length, 3);

        // Tool call works
        const callC = await client.callTool({
            name: "mock_c_tool_c",
            arguments: {},
        });
        assert.ok(!callC.isError, "Call C should succeed after recovery");
        assert.ok((callC.content[0] as any).text.includes("result_mock_c"));
    });

    test("6. A slow upstream triggers the configured timeout", async () => {
        const slowMock = createMockUpstream("slow_mock", "slow_tool", async () => {
            // Delay 600ms
            await new Promise((resolve) => setTimeout(resolve, 600));
            return { content: [{ type: "text", text: "too_late" }] };
        });

        const slowInfo = await slowMock.start(0);

        const customManager = new UpstreamManager(
            [{ id: "slow_mock", url: slowInfo.url }],
            {
                healthProbeTimeoutMs: 1000,
                defaultCallTimeoutMs: 200, // 200ms timeout
            },
        );

        await customManager.probeAll();

        const customApp = createGatewayApp(customManager);
        let customPort = 0;
        let customServer: any;
        await new Promise<void>((resolve) => {
            customServer = serve({ fetch: customApp.fetch, port: 0 }, (info) => {
                customPort = info.port;
                resolve();
            });
        });

        const customClient = new Client({ name: "timeout-tester", version: "1.0.0" });
        await customClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${customPort}/mcp`)));

        const result = await customClient.callTool({
            name: "slow_mock_slow_tool",
            arguments: {},
        });

        assert.strictEqual(result.isError, true);
        const text = (result.content[0] as any).text;
        assert.ok(
            text.includes("timed out after 200ms"),
            `Expected timeout message, got: ${text}`,
        );

        await customClient.close();
        customServer.close();
        await customManager.close();
        await slowMock.stop();
    });

    test("7. One timeout does not block calls to another healthy upstream", async () => {
        const slowMock = createMockUpstream("slow_server", "hanging_tool", async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return { content: [{ type: "text", text: "hanging_result" }] };
        });
        const slowInfo = await slowMock.start(0);

        const comboManager = new UpstreamManager(
            [
                { id: "mock_a", url: `http://127.0.0.1:${portA}/mcp` },
                { id: "slow_server", url: slowInfo.url },
            ],
            {
                healthProbeTimeoutMs: 1000,
                defaultCallTimeoutMs: 250,
            },
        );

        await comboManager.probeAll();

        const comboApp = createGatewayApp(comboManager);
        let comboPort = 0;
        let comboServer: any;
        await new Promise<void>((resolve) => {
            comboServer = serve({ fetch: comboApp.fetch, port: 0 }, (info) => {
                comboPort = info.port;
                resolve();
            });
        });

        const comboClient = new Client({ name: "combo-tester", version: "1.0.0" });
        await comboClient.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${comboPort}/mcp`)));

        // Run slow call in background
        const slowCallPromise = comboClient.callTool({
            name: "slow_server_hanging_tool",
            arguments: {},
        });

        // Fast call should complete promptly without waiting on slow call
        const fastStart = Date.now();
        const fastResult = await comboClient.callTool({
            name: "mock_a_tool_a",
            arguments: {},
        });
        const fastDuration = Date.now() - fastStart;

        assert.ok(!fastResult.isError, "Fast call should succeed");
        assert.ok(fastDuration < 200, `Fast call should complete quickly, took ${fastDuration}ms`);

        // Wait for slow call to time out
        const slowResult = await slowCallPromise;
        assert.strictEqual(slowResult.isError, true);
        assert.ok((slowResult.content[0] as any).text.includes("timed out after 250ms"));

        await comboClient.close();
        comboServer.close();
        await comboManager.close();
        await slowMock.stop();
    });

    test("8. Existing namespaced tools and normal forwarding still work", async () => {
        const toolsList = await client.listTools();
        for (const tool of toolsList.tools) {
            assert.ok(
                tool.name.startsWith("mock_a_") || tool.name.startsWith("mock_b_") || tool.name.startsWith("mock_c_"),
                `Tool name ${tool.name} must have valid namespace prefix`,
            );
        }

        const callA = await client.callTool({
            name: "mock_a_tool_a",
            arguments: {},
        });
        assert.ok(!callA.isError);
    });

    test("9. Live workspace upstreams (port 3001, 3002, 3003) expose all 11 tools when healthy", async () => {
        const liveManager = new UpstreamManager([
            { id: "woocommerce", url: "http://localhost:3001/mcp" },
            { id: "fulfillment", url: "http://localhost:3002/mcp" },
            { id: "supplier", url: "http://localhost:3003/mcp" },
        ]);

        await liveManager.probeAll();
        const report = liveManager.getHealthReport();

        assert.strictEqual(report.totalUpstreams, 3);
        assert.strictEqual(report.healthyUpstreams, 3, "All 3 workspace upstreams must be healthy");
        assert.strictEqual(report.discoveredTools, 11, "Must discover all 11 tools");

        const tools = liveManager.getActiveTools().map((t) => t.gatewayName);
        assert.ok(tools.includes("woocommerce_list_products"));
        assert.ok(tools.includes("fulfillment_list_shipments"));
        assert.ok(tools.includes("supplier_list_suppliers"));

        await liveManager.close();
    });
});
