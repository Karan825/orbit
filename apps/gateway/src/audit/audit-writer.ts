import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditEvents } from "../db/schema.js";
import type { Principal } from "../auth/principal.js";

export interface PendingAuditParams {
    requestId: string;
    principal: Principal;
    exposedName: string;
    serverSlug: string;
    toolName: string;
    args?: Record<string, unknown>;
}

export interface AuditCompletionParams {
    outcome: "success" | "tool_error" | "timeout" | "upstream_error" | "denied";
    errorCode?: string;
    errorMessage?: string;
    resultBytes?: number;
}

export class AuditWriter {
    /**
     * 1. WRITE-AHEAD: Inserts a pending audit row before calling upstream.
     * Throws an error if insert fails, enforcing fail-closed security.
     */
    async startToolCall(params: PendingAuditParams): Promise<number> {
        // Redact potential sensitive fields in argument previews
        const sanitizedArgs = this.sanitizeArgs(params.args);

        const [row] = await db
            .insert(auditEvents)
            .values({
                requestId: params.requestId,
                kind: "tool_call",
                userId: params.principal.userId !== "anonymous" ? params.principal.userId : null,
                userEmail: params.principal.email,
                apiKeyId: params.principal.apiKeyId,
                channel: params.principal.channel,
                chatSessionId: params.principal.chatSessionId,
                serverSlug: params.serverSlug,
                toolName: params.toolName,
                exposedName: params.exposedName,
                outcome: "pending",
                argsPreview: sanitizedArgs,
            })
            .returning({ id: auditEvents.id });

        return row.id;
    }

    /**
     * 2. COMPLETION: Updates the audit row with the final outcome and duration.
     */
    async completeToolCall(
        auditId: number,
        startTimeMs: number,
        completion: AuditCompletionParams,
    ): Promise<void> {
        const durationMs = Math.max(0, Date.now() - startTimeMs);

        try {
            await db
                .update(auditEvents)
                .set({
                    durationMs,
                    outcome: completion.outcome,
                    errorCode: completion.errorCode ?? null,
                    errorMessage: completion.errorMessage ? completion.errorMessage.slice(0, 500) : null,
                    resultBytes: completion.resultBytes ?? 0,
                })
                .where(eq(auditEvents.id, auditId));
        } catch (err) {
            console.error(`[AuditWriter] Failed to update audit row ${auditId}:`, err);
        }
    }

    /**
     * 3. ACCESS DENIED: Directly records an unauthorized attempt.
     */
    async recordAccessDenied(params: {
        requestId: string;
        principal: Principal;
        exposedName: string;
        reason: string;
    }): Promise<void> {
        try {
            await db.insert(auditEvents).values({
                requestId: params.requestId,
                kind: "access_denied",
                userId: params.principal.userId !== "anonymous" ? params.principal.userId : null,
                userEmail: params.principal.email,
                apiKeyId: params.principal.apiKeyId,
                channel: params.principal.channel,
                chatSessionId: params.principal.chatSessionId,
                exposedName: params.exposedName,
                outcome: "denied",
                errorCode: "FORBIDDEN",
                errorMessage: params.reason,
            });
        } catch (err) {
            console.error("[AuditWriter] Failed to record access denial:", err);
        }
    }

    /**
     * Helper to mask password, key, or secret fields from previews
     */
    private sanitizeArgs(args?: Record<string, unknown>): Record<string, unknown> | undefined {
        if (!args) return undefined;
        const copy: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(args)) {
            const lower = k.toLowerCase();
            if (lower.includes("secret") || lower.includes("key") || lower.includes("password") || lower.includes("token")) {
                copy[k] = "[REDACTED]";
            } else {
                copy[k] = v;
            }
        }
        return copy;
    }
}

export const auditWriter = new AuditWriter();
