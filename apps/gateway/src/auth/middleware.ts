import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';
import type { ApiKeyStore } from './api-keys.js';
import type { Principal } from './principal.js';

export interface AuthVariables {
    principal: Principal;
    requestId: string;
}

/**
 * Creates a Hono middleware that verifies Bearer API keys.
 * Attaches the authenticated Principal and requestId to the Hono context.
 */
export function createAuthMiddleware(
    apiKeyStore: ApiKeyStore,
): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (c, next) => {
        // 1. Establish request ID for tracing
        const requestId = c.req.header('x-request-id') || randomUUID();
        c.set('requestId', requestId);

        // 2. Check Authorization header
        const authHeader = c.req.header('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or malformed Authorization header. Expected Bearer token.',
                    },
                },
                401,
            );
        }

        // 3. Extract the token after 'Bearer '
        const rawKey = authHeader.substring(7).trim();

        // 4. Verify against ApiKeyStore (HMAC comparison & revocation check)
        const principal = apiKeyStore.verifyKey(rawKey, requestId);

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

        // 5. Store authenticated Principal in context and proceed
        c.set('principal', principal);
        await next();
    };
}
