/**
 * server/services/ingestion/urlNormalizer.js
 * Comprehensive URL normalization and title fingerprinting for threat intelligence deduplication.
 */

const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'gclsrc',
    'dclid',
    'msclkid',
    'mc_cid',
    'mc_eid',
    'ref',
    'source',
    'sr_share',
    '_hsenc',
    '_hsmi',
    'mkt_tok',
    'ncid'
]);

/**
 * Normalizes a URL for deduplication while preserving essential content query parameters.
 * @param {string} rawUrl 
 * @returns {string} Normalized URL
 */
export function normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';

    try {
        const trimmed = rawUrl.trim();
        const parsed = new URL(trimmed);

        // Normalize protocol & hostname
        parsed.protocol = parsed.protocol.toLowerCase();
        parsed.hostname = parsed.hostname.toLowerCase();

        // Strip default ports
        if ((parsed.protocol === 'http:' && parsed.port === '80') ||
            (parsed.protocol === 'https:' && parsed.port === '443')) {
            parsed.port = '';
        }

        // Remove tracking query parameters
        const searchParams = new URLSearchParams(parsed.search);
        for (const key of Array.from(searchParams.keys())) {
            if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
                searchParams.delete(key);
            }
        }
        parsed.search = searchParams.toString();

        // Remove URL hash fragment
        parsed.hash = '';

        // Normalize trailing slash (remove unless it's just root path '/')
        let pathname = parsed.pathname;
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }
        parsed.pathname = pathname;

        return parsed.toString();
    } catch {
        // Fallback for non-standard URLs
        return rawUrl.trim().split('#')[0].replace(/\/+$/, '');
    }
}

/**
 * Creates a normalized title fingerprint for cross-feed title similarity matching.
 * @param {string} title 
 * @returns {string} Fingerprint
 */
export function createTitleFingerprint(title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // replace punctuation with space so zero-day becomes zero day
        .replace(/\s+/g, ' ')    // collapse whitespace
        .trim();
}
