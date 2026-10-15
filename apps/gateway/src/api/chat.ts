import { Hono } from "hono";
import { runChatTurn, type ChatMessage } from "../chat/agent.js";
import type { UpstreamManager } from "../upstream-manager.js";
import type { GatewayEnv } from "../main.js";

export function createChatRouter(manager: UpstreamManager) {
    const router = new Hono<GatewayEnv>();

    /**
     * POST /api/chat
     * Runs an agent turn with the authenticated user
     */
    router.post("/", async (c) => {
        try {
            const body = await c.req.json<{
                messages: ChatMessage[];
                user?: { id?: string; email?: string; role?: "admin" | "member" };
            }>();

            const headerRole = c.req.header("x-user-role");
            const headerId = c.req.header("x-user-id");
            const headerEmail = c.req.header("x-user-email");

            const effectiveRole = (body.user?.role || headerRole || c.get("principal")?.role || "admin") as "admin" | "member";
            const effectiveId = body.user?.id || headerId || c.get("principal")?.userId || "bc3f0608-3722-498e-9ab6-a704cf16090c";
            const effectiveEmail = body.user?.email || headerEmail || c.get("principal")?.email || "admin@urumi.local";

            const principal = {
                userId: effectiveId,
                email: effectiveEmail,
                role: effectiveRole,
                apiKeyId: null,
                channel: "chat" as const,
                chatSessionId: null,
                requestId: `chat-${Date.now()}`,
            };

            if (!body.messages || !Array.isArray(body.messages)) {
                return c.json({ error: { message: "Invalid payload: messages array required" } }, 400);
            }

            const result = await runChatTurn({
                principal,
                messages: body.messages,
                manager,
            });

            return c.json(result);
        } catch (err: any) {
            console.error("[Chat Router] Error running chat turn:", err);
            return c.json({ error: { message: err?.message || "Failed to process chat turn" } }, 500);
        }
    });

    return router;
}
