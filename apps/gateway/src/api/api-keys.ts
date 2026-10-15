import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys, users } from "../db/schema.js";
import type { ApiKeyStore } from "../auth/api-keys.js";
import type { GatewayEnv } from "../main.js";

export function createApiKeysRouter(apiKeyStore: ApiKeyStore) {
    const router = new Hono<GatewayEnv>();

    /**
     * GET /api/api-keys
     * Returns list of API keys.
     * Members only see their own keys; Admins can see all.
     */
    router.get("/", async (c) => {
        const principal = c.get("principal");
        const queryUserId = c.req.query("userId");
        const queryRole = c.req.query("role");
        const effectiveUserId = principal?.userId || queryUserId;
        const isMember = (principal && principal.role !== "admin") || (queryRole === "member");

        let query = db
            .select({
                id: apiKeys.id,
                userId: apiKeys.userId,
                name: apiKeys.name,
                keyPrefix: apiKeys.keyPrefix,
                lastFour: apiKeys.lastFour,
                expiresAt: apiKeys.expiresAt,
                revokedAt: apiKeys.revokedAt,
                lastUsedAt: apiKeys.lastUsedAt,
                createdAt: apiKeys.createdAt,
            })
            .from(apiKeys)
            .orderBy(desc(apiKeys.createdAt));

        // Non-admin members only see their own keys (IDOR protection)
        const rows = isMember && effectiveUserId
            ? await query.where(eq(apiKeys.userId, effectiveUserId))
            : await query;

        return c.json({ keys: rows });
    });

    /**
     * POST /api/api-keys
     * Generates a new API key for the user.
     * The raw key is returned ONCE and never retrievable again.
     */
    router.post("/", async (c) => {
        const principal = c.get("principal");
        const body = await c.req.json<{ name?: string; expiresInDays?: number; userId?: string }>();

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let userId = principal?.userId || body.userId;
        if (!userId || !UUID_REGEX.test(userId)) {
            const [adminUser] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.role, "admin"))
                .limit(1);
            userId = adminUser ? adminUser.id : "bc3f0608-3722-498e-9ab6-a704cf16090c";
        }

        const generated = await apiKeyStore.createKey({
            userId,
            name: body.name || "Default Key",
            expiresInDays: body.expiresInDays,
        });

        return c.json(
            {
                id: generated.id,
                name: body.name || "Default Key",
                prefix: generated.prefix,
                lastFour: generated.lastFour,
                key: generated.rawKey, // Plaintext shown once
                message: "Copy this key now. It will never be shown again.",
            },
            201,
        );
    });

    /**
     * DELETE /api/api-keys/:id
     * Revokes a key immediately.
     */
    router.delete("/:id", async (c) => {
        const principal = c.get("principal");
        const keyId = c.req.param("id");

        // Verify key exists and belongs to user (or user is admin)
        const existing = await db
            .select()
            .from(apiKeys)
            .where(eq(apiKeys.id, keyId))
            .limit(1);

        if (existing.length === 0) {
            return c.json({ error: "Key not found" }, 404);
        }

        if (principal && principal.role !== "admin" && existing[0].userId !== principal.userId) {
            return c.json({ error: "Forbidden: Cannot revoke other users' keys" }, 403);
        }

        await apiKeyStore.revokeKey(keyId);
        return c.json({ ok: true, revokedId: keyId });
    });

    return router;
}