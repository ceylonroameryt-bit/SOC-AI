/**
 * server/utils/auth.js
 * Shared authentication utilities for Express and Vercel handler.
 * Uses crypto.timingSafeEqual to prevent timing-based token guessing.
 */

import crypto from 'crypto';

/**
 * Constant-time comparison of two strings.
 * Returns false (not throwing) when either value is missing.
 * @param {string} a - Expected value
 * @param {string} b - Provided value
 * @returns {boolean}
 */
export function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length === 0 || b.length === 0) return false;
    try {
        const aBuf = Buffer.from(a, 'utf8');
        const bBuf = Buffer.from(b, 'utf8');
        // Buffers must be the same length for timingSafeEqual
        if (aBuf.length !== bBuf.length) {
            // Still do a dummy comparison to avoid timing leak on length
            crypto.timingSafeEqual(aBuf, aBuf);
            return false;
        }
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
        return false;
    }
}

/**
 * Extract bearer token from an Authorization header.
 * Returns null if header is absent or malformed.
 * @param {string|undefined} authHeader
 * @returns {string|null}
 */
export function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return null;
    const prefix = 'Bearer ';
    if (!authHeader.startsWith(prefix)) return null;
    const token = authHeader.slice(prefix.length).trim();
    return token.length > 0 ? token : null;
}

/**
 * Verify API key from X-API-Key header or Authorization: Bearer <key>.
 * Returns an object: { ok: boolean, status: number, error?: string }
 *
 * If no key is configured on the server, always returns 503.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {object} req - Express/Node request object
 * @param {string} envKeyName - Name of the env var holding the expected key (default: INGEST_API_KEY)
 * @returns {{ ok: boolean, status?: number, error?: string }}
 */
export function requireApiKey(req, envKeyName = 'INGEST_API_KEY') {
    const expectedKey = process.env[envKeyName];

    // If server has no key configured, refuse all requests (fail closed).
    if (!expectedKey || expectedKey.trim() === '') {
        return {
            ok: false,
            status: 503,
            error: `Service unavailable: ${envKeyName} is not configured on this server.`
        };
    }

    const headerKey = req.headers['x-api-key'];
    const bearerToken = extractBearerToken(req.headers['authorization']);

    const providedKey = headerKey || bearerToken;

    if (!providedKey) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized. Provide a valid X-API-Key header or Bearer token.'
        };
    }

    if (!safeEqual(expectedKey, providedKey)) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized. Invalid API key.'
        };
    }

    return { ok: true };
}

/**
 * Express middleware factory: require a specific API key, returning JSON errors.
 * Usage: router.post('/protected', requireApiKeyMiddleware('NOTIFICATION_API_KEY'), handler)
 *
 * @param {string} [envKeyName='INGEST_API_KEY']
 * @returns {import('express').RequestHandler}
 */
export function requireApiKeyMiddleware(envKeyName = 'INGEST_API_KEY') {
    return (req, res, next) => {
        const result = requireApiKey(req, envKeyName);
        if (!result.ok) {
            return res.status(result.status).json({ error: result.error });
        }
        next();
    };
}
