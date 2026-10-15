import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import type { ApiKeyStore } from './api-keys.js';
import type { Principal } from './principal.js';

export interface AuthVariables {
    principal: Principal;
    requestId: string;
}

/**
 * Creates a Hono middleware that verifies Bearer API keys or query param tokens.
 * Attaches the authenticated Principal and requestId to the Hono context.
 */
export function createAuthMiddleware(
    apiKeyStore: ApiKeyStore,
): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (c, next) => {
        // 1. Establish request ID for tracing
        const requestId = c.req.header('x-request-id') || randomUUID();
        c.set('requestId', requestId);

        // 2. Check Authorization header or query params (?apiKey= / ?token= / ?key=)
        let rawKey: string | null = null;
        const authHeader = c.req.header('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            rawKey = authHeader.substring(7).trim();
        } else {
            rawKey = c.req.query('apiKey') || c.req.query('token') || c.req.query('key') || null;
        }

        if (!rawKey) {
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or malformed Authorization header. Expected Bearer token or ?apiKey= query parameter.',
                    },
                },
                401,
            );
        }

        // 3. Verify against ApiKeyStore (HMAC comparison & revocation check)
        const principal = await apiKeyStore.validateKey(rawKey, requestId);

        if (!principal) {
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Invalid, expired, or revoked API key.',
                    },
                },
                401,
            );
        }

        // 4. Store authenticated Principal in context and proceed
        c.set('principal', principal);
        await next();
    };
}
