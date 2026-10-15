import { Hono } from "hono";
import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditEvents } from "../db/schema.js";
import type { GatewayEnv } from "../main.js";

export const auditRouter = new Hono<GatewayEnv>();

/**
 * GET /api/audit
 * Returns paginated audit logs with optional filters:
 * ?user=...&server=...&channel=...&outcome=...&limit=50
 */
auditRouter.get("/", async (c) => {
    const user = c.req.query("user") || c.req.query("userEmail");
    const server = c.req.query("server") || c.req.query("serverSlug");
    const channel = c.req.query("channel");
    const outcome = c.req.query("outcome");
    const limit = Math.min(Number(c.req.query("limit")) || 50, 100);

    const conditions = [];

    if (user) {
        conditions.push(eq(auditEvents.userEmail, user));
    }
    if (server) {
        conditions.push(eq(auditEvents.serverSlug, server));
    }
    if (channel) {
        conditions.push(eq(auditEvents.channel, channel as any));
    }
    if (outcome) {
        conditions.push(eq(auditEvents.outcome, outcome as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
        .select({
            id: auditEvents.id,
            requestId: auditEvents.requestId,
            kind: auditEvents.kind,
            startedAt: auditEvents.startedAt,
            durationMs: auditEvents.durationMs,
            userEmail: auditEvents.userEmail,
            channel: auditEvents.channel,
            serverSlug: auditEvents.serverSlug,
            toolName: auditEvents.toolName,
            exposedName: auditEvents.exposedName,
            outcome: auditEvents.outcome,
            errorCode: auditEvents.errorCode,
            errorMessage: auditEvents.errorMessage,
            argsPreview: auditEvents.argsPreview,
            resultBytes: auditEvents.resultBytes,
        })
        .from(auditEvents)
        .where(whereClause)
        .orderBy(desc(auditEvents.startedAt))
        .limit(limit);

    return c.json({
        total: items.length,
        items,
    });
});
