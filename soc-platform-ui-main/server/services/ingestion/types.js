/**
 * server/services/ingestion/types.js
 * Standardized types, constants, and error categories for the SOC-AI ingestion system.
 */

export const ERROR_CATEGORIES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    DNS_ERROR: 'DNS_ERROR',
    HTTP_401: 'HTTP_401',
    HTTP_403: 'HTTP_403',
    HTTP_404: 'HTTP_404',
    HTTP_429: 'HTTP_429',
    HTTP_5XX: 'HTTP_5XX',
    INVALID_XML: 'INVALID_XML',
    INVALID_JSON: 'INVALID_JSON',
    EMPTY_FEED: 'EMPTY_FEED',
    DATABASE_ERROR: 'DATABASE_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SSRF_BLOCKED: 'SSRF_BLOCKED',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export const SOURCE_HEALTH_STATES = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    FAILED: 'failed',
    STALE: 'stale',
    UNKNOWN: 'unknown',
    DISABLED: 'disabled'
};

export const DEFAULT_CONFIG = {
    CONCURRENCY: parseInt(process.env.FETCH_CONCURRENCY || '10', 10),
    TIMEOUT_MS: parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10),
    MAX_RETRIES: parseInt(process.env.FETCH_MAX_RETRIES || '2', 10),
    MAX_BYTES: parseInt(process.env.FETCH_MAX_BYTES || `${5 * 1024 * 1024}`, 10), // 5MB
    USER_AGENT: process.env.FETCH_USER_AGENT || 'NO-ENTRY-ThreatIntel-Collector/1.0 (+https://github.com/ceylonroameryt-bit/SOC-AI)',
    ACCEPT_HEADER: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.7'
};
