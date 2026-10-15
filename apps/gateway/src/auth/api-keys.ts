import crypto from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys, users } from "../db/schema.js";
import type { Principal, userRole } from "./principal.js";

// Pepper secret should come from environment or secret, with a secure fallback for dev
const API_KEY_PEPPER = process.env.API_KEY_PEPPER || "urumi-default-dev-pepper-2026-secret";

export interface GeneratedKey {
    id: string;
    rawKey: string;
    prefix: string;
    lastFour: string;
}

export class ApiKeyStore {
    /**
     * Hashes the raw secret part of the key using HMAC-SHA256 with the server pepper.
     */
    private hashSecret(secret: string): string {
        return crypto
            .createHmac("sha256", API_KEY_PEPPER)
            .update(secret)
            .digest("hex");
    }

    /**
     * Creates and stores a new API key for a user in PostgreSQL.
     * Returns the rawKey ONCE so the user can copy it.
     */
    async createKey(params: {
        userId: string;
        name?: string;
        expiresInDays?: number;
    }): Promise<GeneratedKey> {
        // Generate random 8-character ID and 32-byte (43 char) random base64url secret
        const keyId = crypto.randomBytes(4).toString("hex"); // 8 hex chars
        const secret = crypto.randomBytes(32).toString("base64url");
        const rawKey = `urk_${keyId}_${secret}`;
        const prefix = `urk_${keyId}`;
        const lastFour = secret.slice(-4);
        const keyHash = this.hashSecret(secret);

        const expiresAt = params.expiresInDays
            ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const [record] = await db
            .insert(apiKeys)
            .values({
                userId: params.userId,
                name: params.name || "Default API Key",
                keyPrefix: prefix,
                keyHash,
                lastFour,
                expiresAt,
            })
            .returning();

        return {
            id: record.id,
            rawKey,
            prefix,
            lastFour,
        };
    }

    /**
     * Validates a raw API key directly against PostgreSQL:
     * 1. Extracts key prefix.
     * 2. Finds active, unrevoked key joined with user in PostgreSQL.
     * 3. Verifies HMAC-SHA256 in constant time.
     * 4. Updates last_used_at.
     */
    async validateKey(rawKey: string, requestId = "req-default"): Promise<Principal | null> {
        if (!rawKey || !rawKey.startsWith("urk_")) {
            return null;
        }

        const parts = rawKey.split("_");
        if (parts.length < 3) {
            return null;
        }

        const prefix = `urk_${parts[1]}`;
        const secret = parts.slice(2).join("_");
        const computedHash = this.hashSecret(secret);

        // Fetch key directly from database (zero cache for instant revocation)
        const rows = await db
            .select({
                keyId: apiKeys.id,
                userId: apiKeys.userId,
                keyHash: apiKeys.keyHash,
                expiresAt: apiKeys.expiresAt,
                revokedAt: apiKeys.revokedAt,
                userEmail: users.email,
                userRole: users.role,
                userStatus: users.status,
            })
            .from(apiKeys)
            .leftJoin(users, eq(apiKeys.userId, users.id))
            .where(
                and(
                    eq(apiKeys.keyPrefix, prefix),
                    isNull(apiKeys.revokedAt), // Must not be revoked
                ),
            )
            .limit(1);

        if (rows.length === 0) {
            return null;
        }

        const keyRecord = rows[0];

        // Check expiration
        if (keyRecord.expiresAt && keyRecord.expiresAt.getTime() < Date.now()) {
            return null;
        }

        // Check if user is disabled
        if (keyRecord.userStatus && keyRecord.userStatus !== "active") {
            return null;
        }

        // Constant-time comparison to prevent timing attacks
        const computedBuf = Buffer.from(computedHash);
        const storedBuf = Buffer.from(keyRecord.keyHash);

        if (
            computedBuf.length !== storedBuf.length ||
            !crypto.timingSafeEqual(computedBuf, storedBuf)
        ) {
            return null;
        }

        // Asynchronously update last_used_at timestamp without blocking request
        db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, keyRecord.keyId))
            .catch(() => { });

        return {
            userId: keyRecord.userId ?? "anonymous",
            email: keyRecord.userEmail ?? "unknown@urumi.local",
            role: (keyRecord.userRole as userRole) ?? "member",
            apiKeyId: keyRecord.keyId,
            channel: "mcp",
            chatSessionId: null,
            requestId,
        };
    }

    /**
     * Instantly revokes an API key in PostgreSQL.
     */
    async revokeKey(keyId: string, revokedByUserId?: string): Promise<boolean> {
        const result = await db
            .update(apiKeys)
            .set({
                revokedAt: new Date(),
                revokedBy: revokedByUserId ?? null,
            })
            .where(eq(apiKeys.id, keyId))
            .returning();

        return result.length > 0;
    }
}
