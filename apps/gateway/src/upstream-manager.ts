import {
    Client,
    StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { CallToolResult } from "@modelcontextprotocol/client";

export type UpstreamStatus = "healthy" | "unhealthy" | "recovering";

export interface UpstreamConfig {
    id: string;
    url: string;
    healthUrl?: string;
    timeoutMs?: number;
    auth?: { type?: string; header?: string; headerName?: string; token?: string; configured?: boolean };
}

export interface DiscoveredTool {
    gatewayName: string;
    upstreamId: string;
    originalName: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

export interface UpstreamState {
    config: UpstreamConfig;
    status: UpstreamStatus;
    client: Client | null;
    transport: StreamableHTTPClientTransport | null;
    tools: Map<string, DiscoveredTool>;
    latencyMs?: number;
    lastError?: string;
    lastChecked?: string;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
}

export interface HealthReport {
    status: "ok" | "degraded" | "unhealthy";
    totalUpstreams: number;
    healthyUpstreams: number;
    connectedUpstreams: string[];
    upstreams: Record<
        string,
        {
            status: UpstreamStatus;
            url: string;
            latencyMs?: number;
            error?: string;
            discoveredTools: number;
            lastChecked?: string;
        }
    >;
    discoveredTools: number;
}

export function makeGatewayToolName(upstreamId: string, toolName: string): string {
    return `${upstreamId}_${toolName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class UpstreamManager {
    private upstreams = new Map<string, UpstreamState>();
    private healthProbeTimeoutMs: number;
    private defaultCallTimeoutMs: number;
    private backgroundInterval: NodeJS.Timeout | null = null;

    constructor(
        configs: UpstreamConfig[],
        options: {
            healthProbeTimeoutMs?: number;
            defaultCallTimeoutMs?: number;
        } = {},
    ) {
        this.healthProbeTimeoutMs =
            options.healthProbeTimeoutMs ??
            (Number(process.env.HEALTH_TIMEOUT_MS) || 1500);
        this.defaultCallTimeoutMs =
            options.defaultCallTimeoutMs ??
            (Number(process.env.UPSTREAM_TIMEOUT_MS) || 8000);

        for (const config of configs) {
            this.upstreams.set(config.id, {
                config,
                status: "unhealthy",
                client: null,
                transport: null,
                tools: new Map(),
                consecutiveFailures: 0,
                consecutiveSuccesses: 0,
            });
        }
    }

    public getUpstream(id: string): UpstreamState | undefined {
        return this.upstreams.get(id);
    }

    public getAllUpstreams(): UpstreamState[] {
        return Array.from(this.upstreams.values());
    }

    public addUpstream(config: UpstreamConfig): void {
        this.upstreams.set(config.id, {
            config,
            status: "unhealthy",
            client: null,
            transport: null,
            tools: new Map(),
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
        });
        void this.probeUpstream(config.id);
    }

    public async removeUpstream(id: string): Promise<void> {
        const state = this.upstreams.get(id);
        if (state?.client) {
            await state.client.close().catch(() => undefined);
        }
        this.upstreams.delete(id);
    }

    /**
     * Probes an individual upstream with a bounded timeout.
     * Updates health state, manages client connection, and refreshes tools.
     */
    public async probeUpstream(id: string): Promise<UpstreamState> {
        const state = this.upstreams.get(id);
        if (!state) {
            throw new Error(`Unknown upstream: ${id}`);
        }

        const healthUrl =
            state.config.healthUrl ??
            new URL("/healthz", state.config.url).toString();

        const startTime = Date.now();
        state.lastChecked = new Date().toISOString();

        try {
            const response = await fetch(healthUrl, {
                signal: AbortSignal.timeout(this.healthProbeTimeoutMs),
            });

            if (!response.ok) {
                throw new Error(`Health check returned HTTP ${response.status}`);
            }

            state.latencyMs = Date.now() - startTime;
            const wasUnhealthy = state.status === "unhealthy";
            if (wasUnhealthy) {
                state.status = "recovering";
            }

            // Ensure MCP client is connected
            await this.ensureClientConnected(state);

            // Fetch and update tools
            await this.refreshTools(state);

            state.status = "healthy";
            state.consecutiveSuccesses++;
            state.consecutiveFailures = 0;
            state.lastError = undefined;
        } catch (error) {
            state.latencyMs = undefined;
            state.consecutiveFailures++;
            state.consecutiveSuccesses = 0;
            state.status = "unhealthy";
            state.lastError =
                error instanceof Error ? error.message : String(error);

            // Do not discard cached tool schemas if client was previously connected,
            // but they will not be returned in getActiveTools() while status === "unhealthy".
        }

        return state;
    }

    /**
     * Probes all upstreams concurrently using a bounded timeout.
     */
    public async probeAll(): Promise<void> {
        await Promise.allSettled(
            Array.from(this.upstreams.keys()).map((id) => this.probeUpstream(id)),
        );
    }

    /**
     * Ensures an MCP client connection exists and is ready for the upstream.
     */
    private async ensureClientConnected(state: UpstreamState): Promise<void> {
        if (!state.client) {
            const client = new Client({
                name: "urumi-gateway",
                version: "0.1.0",
            });
            const transport = new StreamableHTTPClientTransport(
                new URL(state.config.url),
            );

            await client.connect(transport);
            state.client = client;
            state.transport = transport;
        }
    }

    /**
     * Refreshes the tools for a connected upstream.
     */
    private async refreshTools(state: UpstreamState): Promise<void> {
        if (!state.client) return;

        try {
            const result = await state.client.listTools();
            const newTools = new Map<string, DiscoveredTool>();

            for (const tool of result.tools) {
                const gatewayName = makeGatewayToolName(
                    state.config.id,
                    tool.name,
                );

                newTools.set(gatewayName, {
                    gatewayName,
                    upstreamId: state.config.id,
                    originalName: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
                });
            }

            state.tools = newTools;
        } catch (error) {
            // If listTools fails on an existing client, reset the client so next probe reconnects
            await state.client.close().catch(() => undefined);
            state.client = null;
            state.transport = null;
            throw error;
        }
    }

    /**
     * Returns only the tools belonging to currently HEALTHY upstreams.
     * Prevents name collisions across upstreams.
     */
    public getActiveTools(): DiscoveredTool[] {
        const activeTools: DiscoveredTool[] = [];
        const seenNames = new Set<string>();

        for (const state of this.upstreams.values()) {
            if (state.status !== "healthy") {
                continue;
            }

            for (const [name, tool] of state.tools) {
                if (seenNames.has(name)) {
                    console.warn(`Skipping duplicate gateway tool: ${name}`);
                    continue;
                }
                seenNames.add(name);
                activeTools.push(tool);
            }
        }

        return activeTools;
    }

    /**
     * Finds a tool definition by its gateway name across all upstreams.
     */
    public findTool(gatewayToolName: string): DiscoveredTool | undefined {
        for (const state of this.upstreams.values()) {
            const tool = state.tools.get(gatewayToolName);
            if (tool) return tool;
        }
        return undefined;
    }

    /**
     * Executes a tool call against the target upstream with enforced timeout and cancellation.
     */
    public async callTool(
        gatewayToolName: string,
        args: Record<string, unknown>,
        options: { timeoutMs?: number } = {},
    ): Promise<CallToolResult> {
        const tool = this.findTool(gatewayToolName);
        if (!tool) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Tool '${gatewayToolName}' not found on any registered upstream`,
                    },
                ],
            };
        }

        const state = this.upstreams.get(tool.upstreamId);
        if (!state || state.status !== "healthy" || !state.client) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Upstream '${tool.upstreamId}' is currently unavailable (${state?.status ?? "not registered"}): ${state?.lastError ?? "service offline"}`,
                    },
                ],
            };
        }

        const timeoutMs =
            options.timeoutMs ??
            state.config.timeoutMs ??
            this.defaultCallTimeoutMs;

        const abortController = new AbortController();
        let timeoutTimer: NodeJS.Timeout | null = null;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutTimer = setTimeout(() => {
                abortController.abort(new Error(`Timed out after ${timeoutMs}ms`));
                const err = new Error(
                    `Upstream ${tool.upstreamId} timed out after ${timeoutMs}ms while executing tool '${tool.originalName}'`,
                );
                err.name = "TimeoutError";
                reject(err);
            }, timeoutMs);
        });

        try {
            const callPromise = state.client.callTool(
                {
                    name: tool.originalName,
                    arguments: args,
                },
                {
                    signal: abortController.signal,
                    timeout: timeoutMs,
                },
            );

            return await Promise.race([callPromise, timeoutPromise]);
        } catch (error) {
            const isTimeout =
                (error instanceof Error &&
                    (error.name === "TimeoutError" ||
                        error.name === "AbortError" ||
                        error.message.includes("timed out") ||
                        error.message.includes("Timed out"))) ||
                (error &&
                    typeof error === "object" &&
                    "code" in error &&
                    (error as { code: string }).code === "REQUEST_TIMEOUT");

            const message = isTimeout
                ? `Upstream ${tool.upstreamId} timed out after ${timeoutMs}ms while executing tool '${tool.originalName}'`
                : `Upstream ${tool.upstreamId} failed: ${error instanceof Error ? error.message : String(error)}`;

            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: message,
                    },
                ],
            };
        } finally {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
            }
        }
    }

    /**
     * Produces an accurate, real-time health report for /healthz.
     */
    public getHealthReport(): HealthReport {
        const totalUpstreams = this.upstreams.size;
        let healthyUpstreams = 0;
        const connectedUpstreams: string[] = [];
        const upstreamDetails: HealthReport["upstreams"] = {};

        for (const [id, state] of this.upstreams) {
            if (state.status === "healthy") {
                healthyUpstreams++;
                connectedUpstreams.push(id);
            }

            upstreamDetails[id] = {
                status: state.status,
                url: state.config.url,
                latencyMs: state.latencyMs,
                error: state.lastError,
                discoveredTools: state.status === "healthy" ? state.tools.size : 0,
                lastChecked: state.lastChecked,
            };
        }

        const activeTools = this.getActiveTools();

        let status: HealthReport["status"] = "unhealthy";
        if (healthyUpstreams === totalUpstreams) {
            status = "ok";
        } else if (healthyUpstreams > 0) {
            status = "degraded";
        }

        return {
            status,
            totalUpstreams,
            healthyUpstreams,
            connectedUpstreams,
            upstreams: upstreamDetails,
            discoveredTools: activeTools.length,
        };
    }

    /**
     * Starts background health probing at a given interval.
     */
    public startBackgroundHealthChecks(intervalMs = 10000): void {
        this.stopBackgroundHealthChecks();
        this.backgroundInterval = setInterval(() => {
            void this.probeAll();
        }, intervalMs);
    }

    /**
     * Stops the background probe interval.
     */
    public stopBackgroundHealthChecks(): void {
        if (this.backgroundInterval) {
            clearInterval(this.backgroundInterval);
            this.backgroundInterval = null;
        }
    }

    /**
     * Cleanly closes all upstream MCP clients and timers.
     */
    public async close(): Promise<void> {
        this.stopBackgroundHealthChecks();
        for (const state of this.upstreams.values()) {
            if (state.client) {
                await state.client.close().catch(() => undefined);
                state.client = null;
                state.transport = null;
            }
        }
    }
}
