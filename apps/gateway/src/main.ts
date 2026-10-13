import {
    createMcpHandler,
    fromJsonSchema,
    McpServer,
} from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
    UpstreamManager,
    type UpstreamConfig,
} from "./upstream-manager.js";

export const PORT = Number(process.env.PORT) || 4000;

export const defaultUpstreamConfigs: UpstreamConfig[] = [
    {
        id: "woocommerce",
        url: process.env.WOOCOMMERCE_MCP_URL ?? "http://localhost:3001/mcp",
    },
    {
        id: "fulfillment",
        url: process.env.FULFILLMENT_MCP_URL ?? "http://localhost:3002/mcp",
    },
    {
        id: "supplier",
        url: process.env.SUPPLIER_MCP_URL ?? "http://localhost:3003/mcp",
    },
];

export function createGatewayApp(
    manager: UpstreamManager,
    options: { serverName?: string } = {},
): Hono {
    const app = new Hono();

    // Accurate real-time health check endpoint
    app.get("/healthz", async (c) => {
        await manager.probeAll();
        const report = manager.getHealthReport();
        return c.json(report);
    });

    // Dynamic MCP endpoint with catalogue fresh on every session/request
    const mcpHandler = createMcpHandler(async () => {
        const server = new McpServer({
            name: options.serverName ?? "urumi-team-gateway",
            version: "0.1.0",
        });

        // Only register tools belonging to currently HEALTHY upstreams!
        const activeTools = manager.getActiveTools();

        for (const tool of activeTools) {
            server.registerTool(
                tool.gatewayName,
                {
                    description:
                        tool.description ??
                        `Forward this tool call to the ${tool.upstreamId} MCP server.`,
                    inputSchema: fromJsonSchema(
                        tool.inputSchema ?? {
                            type: "object",
                            properties: {},
                        },
                    ),
                },
                async (args) => {
                    return await manager.callTool(
                        tool.gatewayName,
                        args as Record<string, unknown>,
                    );
                },
            );
        }

        return server;
    });

    app.all("/mcp", (c) => mcpHandler.fetch(c.req.raw));

    return app;
}

export async function startGateway(
    configs: UpstreamConfig[] = defaultUpstreamConfigs,
    port: number = PORT,
) {
    const manager = new UpstreamManager(configs);

    // Initial probe to discover upstreams and tools at startup
    console.log("Connecting to upstreams...");
    await manager.probeAll();

    // Start background health polling every 10 seconds
    manager.startBackgroundHealthChecks(10000);

    const app = createGatewayApp(manager);

    const serverInstance = serve({ fetch: app.fetch, port }, (info) => {
        const report = manager.getHealthReport();
        console.log(`MCP gateway listening on http://localhost:${info.port}/mcp`);
        console.log(
            `Healthy upstreams: ${report.healthyUpstreams}/${report.totalUpstreams}`,
        );
        console.log(`Discovered tools: ${report.discoveredTools}`);
    });

    const shutdown = async () => {
        console.log("\nShutting down gateway...");
        manager.stopBackgroundHealthChecks();
        await manager.close();
        serverInstance.close();
        process.exit(0);
    };

    process.on("SIGINT", () => {
        void shutdown();
    });
    process.on("SIGTERM", () => {
        void shutdown();
    });

    return { app, manager, server: serverInstance };
}

// Automatically start gateway unless running in an automated test environment
const isRunningInTest =
    process.env.NODE_ENV === "test" ||
    process.argv.some((arg) => arg.includes("--test") || arg.includes(".test."));

if (!isRunningInTest) {
    startGateway().catch((error) => {
        console.error("Gateway startup failed:", error);
        process.exitCode = 1;
    });
}
