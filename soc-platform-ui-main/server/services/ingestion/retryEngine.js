/**
 * server/services/ingestion/retryEngine.js
 * Intelligent retry engine with exponential backoff, jitter, and Retry-After support.
 */

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);

/**
 * Checks if an error or status code is transient and eligible for retry.
 * @param {Error|any} err 
 * @param {number|null} httpStatus 
 * @returns {boolean}
 */
export function isRetryable(err, httpStatus = null) {
    if (httpStatus && RETRYABLE_HTTP_STATUSES.has(httpStatus)) {
        return true;
    }
    if (err) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
        if (err.code && RETRYABLE_ERROR_CODES.has(err.code)) return true;
        if (typeof err.message === 'string') {
            const lower = err.message.toLowerCase();
            if (lower.includes('timeout') || lower.includes('reset') || lower.includes('econnreset') || lower.includes('socket')) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Calculates backoff delay with exponential scaling and random jitter.
 * @param {number} attempt (0-indexed)
 * @param {number|null} retryAfterSeconds 
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffMs(attempt, retryAfterSeconds = null) {
    if (retryAfterSeconds && !isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        return Math.min(retryAfterSeconds * 1000, 10000); // Cap Retry-After to 10s
    }
    const baseMs = 1000 * Math.pow(2, attempt); // 1000ms, 2000ms, 4000ms...
    const jitter = Math.floor(Math.random() * 500); // 0-500ms jitter
    return Math.min(baseMs + jitter, 8000);
}

/**
 * Executes an async task with automatic retries for transient failures.
 * @param {Function} taskFn 
 * @param {object} options 
 * @returns {Promise<any>}
 */
export async function executeWithRetry(taskFn, options = {}) {
    const maxRetries = options.maxRetries ?? 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            return await taskFn(attempt);
        } catch (err) {
            const httpStatus = err.httpStatus || err.status || null;
            const canRetry = attempt < maxRetries && isRetryable(err, httpStatus);

            if (!canRetry) {
                throw err;
            }

            const delayMs = calculateBackoffMs(attempt, err.retryAfterSeconds);
            attempt++;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}
