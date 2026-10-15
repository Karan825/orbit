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
            const principal = c.get("principal") || {
                userId: "bc3f0608-3722-498e-9ab6-a704cf16090c",
                email: "admin@urumi.local",
                role: "admin",
                apiKeyId: null,
                channel: "chat",
                chatSessionId: null,
                requestId: `chat-${Date.now()}`,
            };

            const body = await c.req.json<{ messages: ChatMessage[] }>();

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
