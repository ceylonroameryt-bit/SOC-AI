/**
 * server/services/ingestion/feedFetcher.js
 * Robust HTTP client for external threat intelligence feeds with SSRF protection,
 * configurable timeout, response size limits, and accurate error classification.
 */

import { validateFeedUrl } from './ssrfGuard.js';
import { executeWithRetry } from './retryEngine.js';
import { ERROR_CATEGORIES, DEFAULT_CONFIG } from './types.js';

/**
 * Classifies an error or response into a standard error category.
 */
export function classifyFetchError(err, status = null) {
    if (status) {
        if (status === 401) return ERROR_CATEGORIES.HTTP_401;
        if (status === 403) return ERROR_CATEGORIES.HTTP_403;
        if (status === 404) return ERROR_CATEGORIES.HTTP_404;
        if (status === 429) return ERROR_CATEGORIES.HTTP_429;
        if (status >= 500) return ERROR_CATEGORIES.HTTP_5XX;
    }

    if (err) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError' || String(err.message).toLowerCase().includes('timeout')) {
            return ERROR_CATEGORIES.TIMEOUT;
        }
        if (err.code === 'ENOTFOUND' || String(err.message).toLowerCase().includes('getaddrinfo')) {
            return ERROR_CATEGORIES.DNS_ERROR;
        }
        if (err.message && err.message.includes('SSRF')) {
            return ERROR_CATEGORIES.SSRF_BLOCKED;
        }
        if (err.message && err.message.includes('exceeded maximum size')) {
            return ERROR_CATEGORIES.PAYLOAD_TOO_LARGE;
        }
    }

    return ERROR_CATEGORIES.NETWORK_ERROR;
}

/**
 * Fetches an external feed URL with full safety guardrails.
 * @param {string} url 
 * @param {object} options 
 * @returns {Promise<{ xml: string, status: number, latencyMs: number }>}
 */
export async function fetchFeedContent(url, options = {}) {
    const timeoutMs = options.timeoutMs || DEFAULT_CONFIG.TIMEOUT_MS;
    const maxBytes = options.maxBytes || DEFAULT_CONFIG.MAX_BYTES;
    const userAgent = options.userAgent || DEFAULT_CONFIG.USER_AGENT;
    const maxRetries = options.maxRetries ?? DEFAULT_CONFIG.MAX_RETRIES;

    // 1. SSRF Pre-flight validation
    const ssrfCheck = validateFeedUrl(url);
    if (!ssrfCheck.valid) {
        const error = new Error(`SSRF Block: ${ssrfCheck.reason}`);
        error.errorCategory = ERROR_CATEGORIES.SSRF_BLOCKED;
        error.httpStatus = 400;
        throw error;
    }

    return await executeWithRetry(async (attempt) => {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        const startTime = Date.now();

        try {
            const resp = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': userAgent,
                    'Accept': DEFAULT_CONFIG.ACCEPT_HEADER,
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                redirect: 'follow'
            });

            clearTimeout(timeoutHandle);
            const latencyMs = Date.now() - startTime;
            const status = resp.status;

            if (!resp.ok) {
                const err = new Error(`HTTP ${status} ${resp.statusText}`);
                err.httpStatus = status;
                err.errorCategory = classifyFetchError(err, status);

                // Parse Retry-After if present
                const retryAfter = resp.headers.get('retry-after');
                if (retryAfter) {
                    const parsedSeconds = parseInt(retryAfter, 10);
                    if (!isNaN(parsedSeconds)) {
                        err.retryAfterSeconds = parsedSeconds;
                    }
                }
                throw err;
            }

            // Stream response and verify byte size limit
            const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
            if (contentLength > maxBytes) {
                const err = new Error(`Feed response exceeded maximum size limit (${maxBytes} bytes)`);
                err.errorCategory = ERROR_CATEGORIES.PAYLOAD_TOO_LARGE;
                err.httpStatus = 413;
                throw err;
            }

            const text = await resp.text();
            if (text.length > maxBytes) {
                const err = new Error(`Feed response text exceeded maximum size limit (${maxBytes} bytes)`);
                err.errorCategory = ERROR_CATEGORIES.PAYLOAD_TOO_LARGE;
                err.httpStatus = 413;
                throw err;
            }

            return {
                xml: text,
                status,
                latencyMs,
                attempt
            };
        } catch (err) {
            clearTimeout(timeoutHandle);
            if (!err.errorCategory) {
                err.errorCategory = classifyFetchError(err, err.httpStatus);
            }
            throw err;
        }
    }, { maxRetries });
}
