import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { isPrivateOrInternalUrl, extractPublisherDomain } from '../utils/urlUtils.js';
import { recordCollectionResult } from './feedHealthService.js';
import { assessSeverity } from './severityEngine.js';
import { classifyRecord } from './classificationEngine.js';
import { insertThreat, insertIOCs, isDbConnected } from '../db/db.js';
import { extractIOCs } from './enrichmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_FILE = path.join(__dirname, '../data/sources_registry.json');
const DATA_FILE = path.join(__dirname, '../data/news.json');

const REQUEST_TIMEOUT_MS = 10 * 1000; // 10 second timeout per request
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB max response size limit (permits large XML archives)
const MAX_RETRIES = 2;
const MAX_ARTICLES_RETENTION = 10000;

const parser = new Parser({
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Collector/2.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    }
});

// Per-host request queue to prevent hammering any single domain
const hostLocks = new Map();

async function withHostLock(host, task) {
    while (hostLocks.get(host)) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    }
    hostLocks.set(host, true);
    try {
        return await task();
    } finally {
        hostLocks.delete(host);
    }
}

/**
 * Parses HTTP Retry-After header (seconds or HTTP date) safely.
 */
export function parseRetryAfter(retryHeader) {
    if (!retryHeader) return null;
    const parsedSec = parseInt(retryHeader, 10);
    if (!isNaN(parsedSec)) {
        return Math.max(5000, parsedSec * 1000);
    }
    const retryDate = new Date(retryHeader).getTime();
    if (!isNaN(retryDate)) {
        return Math.max(5000, retryDate - Date.now());
    }
    return null;
}

/**
 * Robust, safe fetch for a single feed endpoint.
 */
export async function collectFeed(source) {
    const start = Date.now();
    const sourceId = source.id;
    const targetUrl = source.canonicalUrl || source.feedUrl;
    const host = extractPublisherDomain(targetUrl);

    // SSRF Check
    if (isPrivateOrInternalUrl(targetUrl)) {
        const latencyMs = Date.now() - start;
        return {
            source,
            sourceId,
            success: false,
            httpStatus: null,
            latencyMs,
            error: 'Blocked internal or private IP address (SSRF Protection)',
            errorCategory: 'SECURITY_BLOCKED',
            feed: null
        };
    }

    // Circuit Breaker: Skip if nextRetryAt is in the future
    if (source.nextRetryAt && new Date(source.nextRetryAt).getTime() > Date.now()) {
        return {
            source,
            sourceId,
            success: false,
            skipped: true,
            error: `Skipped by circuit breaker until ${source.nextRetryAt}`,
            errorCategory: 'CIRCUIT_BREAKER',
            feed: null
        };
    }

    return await withHostLock(host, async () => {
        let attempts = 0;
        let lastError = null;
        let lastHttpStatus = null;
        let lastCategory = null;
        let retryAfterMs = null;

        while (attempts <= MAX_RETRIES) {
            attempts++;
            const attemptStart = Date.now();

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Collector/2.0 (+https://soc-ai-six.vercel.app/)',
                    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
                };

                // Conditional Request Headers
                if (source.etag) {
                    headers['If-None-Match'] = source.etag;
                }
                if (source.lastModified) {
                    headers['If-Modified-Since'] = source.lastModified;
                }

                const response = await fetch(targetUrl, {
                    method: 'GET',
                    headers,
                    redirect: 'follow',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const latencyMs = Date.now() - attemptStart;
                lastHttpStatus = response.status;

                // Handle HTTP 304 Not Modified
                if (response.status === 304) {
                    return {
                        source,
                        sourceId,
                        success: true,
                        notModified: true,
                        httpStatus: 304,
                        latencyMs,
                        feed: { items: [] },
                        etag: source.etag,
                        lastModified: source.lastModified,
                        error: null
                    };
                }

                // Handle HTTP Rate Limit / Server Busy (Respect Retry-After)
                if (response.status === 429 || response.status === 503) {
                    const retryHeader = response.headers.get('retry-after');
                    retryAfterMs = parseRetryAfter(retryHeader);
                    lastError = `HTTP ${response.status} (${response.statusText})`;
                    lastCategory = response.status === 429 ? 'RATE_LIMITED' : 'HTTP_SERVER_ERROR';
                    break; // Do not immediately retry on 429/503; respect publisher
                }

                // Handle non-2xx status codes
                if (!response.ok) {
                    lastError = `HTTP ${response.status} (${response.statusText})`;
                    lastCategory = response.status >= 500 ? 'HTTP_SERVER_ERROR' : 'HTTP_CLIENT_ERROR';
                    // Retry only 5xx errors with jittered backoff
                    if (response.status >= 500 && attempts <= MAX_RETRIES) {
                        const backoff = (Math.pow(2, attempts) * 500) + Math.random() * 500;
                        await new Promise(r => setTimeout(r, backoff));
                        continue;
                    }
                    break;
                }

                // Check Response Size
                const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                if (contentLength > MAX_BODY_BYTES) {
                    return {
                        source,
                        sourceId,
                        success: false,
                        httpStatus: response.status,
                        latencyMs,
                        error: `Payload exceeds max limit (${(contentLength / 1024 / 1024).toFixed(1)}MB > 5MB)`,
                        errorCategory: 'OVERSIZED_PAYLOAD',
                        feed: null
                    };
                }

                const rawBody = await response.text();
                if (rawBody.length > MAX_BODY_BYTES) {
                    return {
                        source,
                        sourceId,
                        success: false,
                        httpStatus: response.status,
                        latencyMs,
                        error: `Response body exceeds 5MB size limit`,
                        errorCategory: 'OVERSIZED_PAYLOAD',
                        feed: null
                    };
                }

                const trimmed = rawBody.trim();
                const contentType = response.headers.get('content-type') || '';

                // Detect HTML returned instead of XML
                if ((trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html') || contentType.includes('text/html')) &&
                    !trimmed.includes('<rss') && !trimmed.includes('<feed') && !trimmed.includes('<channel')) {
                    return {
                        source,
                        sourceId,
                        success: false,
                        httpStatus: response.status,
                        latencyMs,
                        error: 'HTML page returned instead of XML RSS/Atom feed',
                        errorCategory: 'HTML_RETURNED',
                        feed: null
                    };
                }

                // Parse XML Feed
                const cleanXml = rawBody.replace(/^\uFEFF/, '').trim();
                const feed = await parser.parseString(cleanXml);

                const etag = response.headers.get('etag') || null;
                const lastModified = response.headers.get('last-modified') || null;

                return {
                    source,
                    sourceId,
                    success: true,
                    notModified: false,
                    httpStatus: response.status,
                    latencyMs,
                    feed,
                    etag,
                    lastModified,
                    error: null
                };

            } catch (err) {
                const latencyMs = Date.now() - attemptStart;
                const isTimeout = err.name === 'AbortError' || err.message?.includes('timeout');
                lastError = err.message;
                lastHttpStatus = null; // NEVER fabricate HTTP status code on network/timeout!
                lastCategory = isTimeout ? 'TIMEOUT' : (err.message?.includes('ENOTFOUND') ? 'DNS_TLS_ERROR' : 'NETWORK_ERROR');

                if (attempts <= MAX_RETRIES && !isTimeout) {
                    const backoff = (Math.pow(2, attempts) * 500) + Math.random() * 500;
                    await new Promise(r => setTimeout(r, backoff));
                    continue;
                }
                break;
            }
        }

        const totalLatency = Date.now() - start;
        return {
            source,
            sourceId,
            success: false,
            httpStatus: lastHttpStatus,
            latencyMs: totalLatency,
            error: lastError,
            errorCategory: lastCategory,
            retryAfterMs,
            feed: null
        };
    });
}

/**
 * Bounded Concurrency Pool with Progress Telemetry.
 */
export async function executeCollectionPool(sources, concurrency = 5, onProgress = null) {
    const results = [];
    let currentIndex = 0;

    async function worker() {
        while (currentIndex < sources.length) {
            const index = currentIndex++;
            const source = sources[index];
            const res = await collectFeed(source);
            results.push(res);
            if (onProgress) {
                onProgress(results.length, sources.length, res);
            }
        }
    }

    const workerPromises = Array.from(
        { length: Math.min(concurrency, sources.length) },
        () => worker()
    );

    await Promise.all(workerPromises);
    return results;
}
