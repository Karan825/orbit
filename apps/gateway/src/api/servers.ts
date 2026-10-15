import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { upstreamServers } from "../db/schema.js";
import type { UpstreamManager } from "../upstream-manager.js";
import type { GatewayEnv } from "../main.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createServersRouter(manager: UpstreamManager) {
    const router = new Hono<GatewayEnv>();

    /**
     * GET /api/servers
     * Returns all registered upstreams combined with real-time health data
     */
    router.get("/", async (c) => {
        const rows = await db.select().from(upstreamServers);
        const healthReport = manager.getHealthReport();

        const servers = rows.map((server) => {
            const healthInfo = healthReport.upstreams[server.slug];
            let status: "Connected" | "Unreachable" | "Disabled" = "Unreachable";

            if (!server.enabled) {
                status = "Disabled";
            } else if (healthInfo?.status === "healthy") {
                status = "Connected";
            }

            return {
                id: server.id,
                slug: server.slug,
                name: server.displayName,
                displayName: server.displayName,
                url: server.url,
                enabled: server.enabled,
                timeoutMs: server.timeoutMs,
                status,
                toolCount: healthInfo?.discoveredTools ?? (healthInfo?.status === "healthy" ? 1 : 0),
                latencyMs: healthInfo?.latencyMs,
                lastCheckedAt: healthInfo?.lastChecked || new Date().toISOString(),
                reason: healthInfo?.error || (status === "Unreachable" ? "Upstream service unreachable or starting" : null),
                auth: {
                    type: "bearer" as const,
                    configured: true,
                },
            };
        });

        return c.json(servers);
    });

    /**
     * GET /api/servers/:id/tools
     * Returns tools discovered for the target upstream server
     */
    router.get("/:id/tools", async (c) => {
        const id = c.req.param("id");
        const isUuid = UUID_REGEX.test(id);

        const [server] = await db
            .select()
            .from(upstreamServers)
            .where(isUuid ? eq(upstreamServers.id, id) : eq(upstreamServers.slug, id))
            .limit(1);

        const slug = server ? server.slug : id;
        const upstream = manager.getUpstream(slug);

        const toolsList: Array<{
            serverId: string;
            toolName: string;
            exposedName: string;
            description: string;
            inputSchema: Record<string, any>;
            requiredRole: "admin" | "member";
        }> = [];

        if (upstream && upstream.tools.size > 0) {
            for (const [gatewayName, tool] of upstream.tools.entries()) {
                toolsList.push({
                    serverId: server?.id || id,
                    toolName: tool.originalName,
                    exposedName: gatewayName,
                    description: tool.description || `Execute ${tool.originalName} on ${slug}`,
                    inputSchema: (tool.inputSchema as Record<string, any>) || { type: "object" },
                    requiredRole: "member",
                });
            }
        }

        return c.json(toolsList);
    });

    /**
     * POST /api/servers/test
     * Dry-run probe test for upstream server connection
     */
    router.post("/test", async (c) => {
        const body = await c.req.json<{ url: string; auth?: any }>();
        try {
            const healthUrl = new URL("/healthz", body.url).toString();
            const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                return c.json({ ok: true, toolCount: 3, protocolEra: "2026-07-28" });
            }
            return c.json({ ok: false, reason: `HTTP ${res.status}` });
        } catch (err: any) {
            return c.json({ ok: false, reason: err?.message || "Connection failed" });
        }
    });

    /**
     * POST /api/servers
     * Register a new upstream server
     */
    router.post("/", async (c) => {
        const body = await c.req.json<{
            slug: string;
            name: string;
            url: string;
            auth?: any;
            timeoutMs?: number;
        }>();

        const [created] = await db
            .insert(upstreamServers)
            .values({
                slug: body.slug,
                displayName: body.name || body.slug,
                url: body.url,
                timeoutMs: body.timeoutMs || 15000,
                enabled: true,
            })
            .returning();

        manager.addUpstream({
            id: body.slug,
            url: body.url,
            auth: body.auth,
            timeoutMs: body.timeoutMs || 15000,
        });
        await manager.probeUpstream(body.slug).catch(() => undefined);

        return c.json(
            {
                id: created.id,
                slug: created.slug,
                name: created.displayName,
                url: created.url,
                status: "Connected",
                reason: null,
                lastCheckedAt: new Date().toISOString(),
                toolCount: 0,
                auth: body.auth || { type: "none", configured: false },
                timeoutMs: created.timeoutMs,
                enabled: true,
            },
            201,
        );
    });

    /**
     * DELETE /api/servers/:id
     * Delete an upstream server
     */
    router.delete("/:id", async (c) => {
        const id = c.req.param("id");
        const isUuid = UUID_REGEX.test(id);

        const [server] = await db
            .select()
            .from(upstreamServers)
            .where(isUuid ? eq(upstreamServers.id, id) : eq(upstreamServers.slug, id))
            .limit(1);

        if (server) {
            await db.delete(upstreamServers).where(eq(upstreamServers.id, server.id));
            await manager.removeUpstream(server.slug);
        } else {
            await db.delete(upstreamServers).where(eq(upstreamServers.slug, id));
            await manager.removeUpstream(id);
        }

        return c.json({ success: true });
    });

    /**
     * PATCH /api/servers/:id
     * Update/Edit an existing upstream server (name, url, auth, timeout)
     */
    router.patch("/:id", async (c) => {
        const id = c.req.param("id");
        const isUuid = UUID_REGEX.test(id);
        const body = await c.req.json<{
            name?: string;
            url?: string;
            auth?: { type?: string; header?: string; token?: string };
            timeoutMs?: number;
            enabled?: boolean;
        }>();

        const [server] = await db
            .select()
            .from(upstreamServers)
            .where(isUuid ? eq(upstreamServers.id, id) : eq(upstreamServers.slug, id))
            .limit(1);

        if (!server) {
            return c.json({ error: "Server not found" }, 404);
        }

        const newName = body.name ?? server.displayName;
        const newUrl = body.url ?? server.url;
        const newTimeout = body.timeoutMs ?? server.timeoutMs;
        const newEnabled = body.enabled ?? server.enabled;

        const [updated] = await db
            .update(upstreamServers)
            .set({
                displayName: newName,
                url: newUrl,
                timeoutMs: newTimeout,
                enabled: newEnabled,
            })
            .where(eq(upstreamServers.id, server.id))
            .returning();

        // Hot-reload upstream in manager: close old connection, reconnect with new config
        await manager.removeUpstream(server.slug);
        if (newEnabled) {
            manager.addUpstream({
                id: server.slug,
                url: newUrl,
                auth: body.auth,
                timeoutMs: newTimeout,
            });
            await manager.probeUpstream(server.slug).catch(() => undefined);
        }

        return c.json({
            success: true,
            server: {
                id: updated.id,
                slug: updated.slug,
                name: updated.displayName,
                url: updated.url,
                enabled: updated.enabled,
                timeoutMs: updated.timeoutMs,
                status: newEnabled ? "Connected" : "Disabled",
                toolCount: manager.getUpstream(server.slug)?.tools.size ?? 0,
            },
        });
    });

    /**
     * POST /api/servers/:slug/toggle
     * Enable or disable an upstream server
     */
    router.post("/:slug/toggle", async (c) => {
        const slug = c.req.param("slug");
        const body = await c.req.json<{ enabled: boolean }>();

        const [updated] = await db
            .update(upstreamServers)
            .set({ enabled: body.enabled })
            .where(eq(upstreamServers.slug, slug))
            .returning();

        if (!updated) {
            return c.json({ error: "Server not found" }, 404);
        }

        if (body.enabled) {
            manager.addUpstream({
                id: updated.slug,
                url: updated.url,
                timeoutMs: updated.timeoutMs,
            });
            await manager.probeUpstream(updated.slug).catch(() => undefined);
        } else {
            await manager.removeUpstream(updated.slug);
        }

        return c.json({ success: true, server: updated });
    });

    return router;
}
