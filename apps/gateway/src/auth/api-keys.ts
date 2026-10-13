import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { Principal, userRole } from './principal.js';

export interface ApiKeyRecord {
    id: string;
    userId: string;
    email: string;
    role: userRole;
    keyPrefix: string;     // e.g. "urk_a1b2c3d4" used for O(1) lookup
    keyHash: Buffer;        // HMAC-SHA256 digest of secret
    createdAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
    userStatus: 'active' | 'suspended';
}

export class ApiKeyStore {
    // Map keyed by keyPrefix for fast O(1) lookup
    private keysByPrefix = new Map<string, ApiKeyRecord>();
    private pepper: string;

    constructor(pepper?: string) {
        this.pepper = pepper || process.env.GATEWAY_KEY_PEPPER || 'urumi-dev-pepper-must-be-changed-in-prod';
    }

    /**
     * Hashes a secret using HMAC-SHA-256 with the pepper
     */
    private hashSecret(secret: string): Buffer {
        return createHmac('sha256', this.pepper).update(secret).digest();
    }


    createKey(params: {
        userId: string;
        email: string;
        role: userRole;
        expiresInDays?: number;
    }): { rawKey: string; record: ApiKeyRecord } {
        const keyId = randomBytes(4).toString('hex'); // 8 hex characters
        const prefix = `urk_${keyId}`;
        const rawSecret = randomBytes(32).toString('base64url'); // 32 bytes = 43 base64url chars
        const rawKey = `${prefix}_${rawSecret}`;

        const keyHash = this.hashSecret(rawSecret);
        const now = new Date();

        const record: ApiKeyRecord = {
            id: `key_${keyId}`,
            userId: params.userId,
            email: params.email,
            role: params.role,
            keyPrefix: prefix,
            keyHash,
            createdAt: now,
            expiresAt: params.expiresInDays
                ? new Date(now.getTime() + params.expiresInDays * 24 * 60 * 60 * 1000)
                : null,
            revokedAt: null,
            userStatus: 'active',
        };

        this.keysByPrefix.set(prefix, record);

        return { rawKey, record };
    }

    /**
     * Constant-time verification of raw key string.
     * Returns authenticated Principal or null.
     */
    verifyKey(rawKey: string, requestId: string): Principal | null {
        if (!rawKey || typeof rawKey !== 'string') return null;

        // Validate format: urk_<8 chars>_<secret>
        const parts = rawKey.split('_');
        if (parts.length !== 3 || parts[0] !== 'urk') {
            return null;
        }

        const prefix = `urk_${parts[1]}`;
        const secret = parts[2];

        const record = this.keysByPrefix.get(prefix);
        if (!record) {
            return null;
        }

        // Check if user is suspended
        if (record.userStatus !== 'active') {
            return null;
        }

        // Check if revoked
        if (record.revokedAt !== null) {
            return null;
        }

        // Check expiry
        if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
            return null;
        }

        // Constant-time HMAC comparison
        const incomingHash = this.hashSecret(secret);
        if (incomingHash.length !== record.keyHash.length) {
            return null;
        }

        const matches = timingSafeEqual(incomingHash, record.keyHash);
        if (!matches) {
            return null;
        }

        // Build the authenticated Principal
        return {
            userId: record.userId,
            email: record.email,
            role: record.role,
            apiKeyId: record.id,
            channel: 'mcp',
            chatSessionId: null,
            requestId,
        };
    }

    /**
     * Revokes a key immediately.
     */
    revokeKey(prefixOrId: string): boolean {
        for (const record of this.keysByPrefix.values()) {
            if (record.keyPrefix === prefixOrId || record.id === prefixOrId) {
                record.revokedAt = new Date();
                return true;
            }
        }
        return false;
    }
}
