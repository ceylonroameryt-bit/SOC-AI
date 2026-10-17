/**
 * server/utils/auth.js
 * Shared authentication utilities for Express and API routes.
 * Uses crypto.timingSafeEqual to prevent timing-based token attacks.
 */

import crypto from 'crypto';

/**
 * Constant-time comparison of two strings.
 * Returns false when either value is missing, empty, or non-string.
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
        if (aBuf.length !== bBuf.length) {
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
 * Ingestion authentication middleware:
 * Validates CRON_SECRET (or fallback INGEST_API_KEY / ADMIN_API_KEY).
 * Fail closed: If CRON_SECRET is empty/missing, immediately returns 401 UNAUTHORIZED.
 */
export function requireCronAuth(req, res, next) {
    const cronSecret = process.env.CRON_SECRET || process.env.INGEST_API_KEY || process.env.ADMIN_API_KEY;

    if (!cronSecret || cronSecret.trim() === '') {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            error: 'Authentication failed: Ingestion secret (CRON_SECRET) is unconfigured. Ingestion endpoints fail closed.'
        });
    }

    const authHeader = req.headers['authorization'];
    const bearer = extractBearerToken(authHeader);
    const provided = req.headers['x-cron-secret'] || req.headers['x-api-key'] || bearer;

    if (!provided || !safeEqual(cronSecret, provided)) {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            error: 'Authentication required. Valid CRON_SECRET or API key required to trigger external source collection.'
        });
    }

    next();
}

/**
 * Express middleware factory: require a specific API key from env variable.
 * Fails closed with 401 if key is missing or mismatched.
 * @param {string} [envKeyName='ADMIN_API_KEY']
 * @returns {import('express').RequestHandler}
 */
export function requireApiKeyMiddleware(envKeyName = 'ADMIN_API_KEY') {
    return (req, res, next) => {
        const expectedKey = process.env[envKeyName] || process.env.CRON_SECRET;

        if (!expectedKey || expectedKey.trim() === '') {
            return res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                error: `Authentication failed: ${envKeyName} is unconfigured. Requests fail closed.`
            });
        }

        const authHeader = req.headers['authorization'];
        const bearer = extractBearerToken(authHeader);
        const provided = req.headers['x-api-key'] || req.headers['x-cron-secret'] || bearer;

        if (!provided || !safeEqual(expectedKey, provided)) {
            return res.status(401).json({
                success: false,
                code: 'UNAUTHORIZED',
                error: `Unauthorized. Valid ${envKeyName} required.`
            });
        }

        next();
    };
}
