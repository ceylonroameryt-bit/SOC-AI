import { URL } from 'url';

/**
 * Strips tracking parameters, lowercases host, normalizes slashes.
 */
export function normalizeFeedUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    try {
        const parsed = new URL(trimmed);

        // Lowercase hostname
        parsed.hostname = parsed.hostname.toLowerCase();

        // Strip URL fragment
        parsed.hash = '';

        // Strip known tracking query parameters
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'msclkid', 'ref', 'source', 'mc_cid', 'mc_eid'
        ];
        for (const p of trackingParams) {
            parsed.searchParams.delete(p);
        }

        // Return normalized string
        return parsed.toString();
    } catch {
        return trimmed;
    }
}

/**
 * Extracts distinct publisher apex domain from a URL.
 */
export function extractPublisherDomain(rawUrl) {
    if (!rawUrl) return 'unknown';
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        // Remove 'www.' prefix
        const cleanHost = host.replace(/^www\./, '');
        return cleanHost;
    } catch {
        return 'unknown';
    }
}

/**
 * Validates destination URLs against private, loopback, and cloud metadata addresses (SSRF Protection).
 */
export function isPrivateOrInternalUrl(rawUrl) {
    if (!rawUrl) return true;
    try {
        const parsed = new URL(rawUrl);
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
            return true; // Disallow non-http/https protocols
        }

        const host = parsed.hostname.toLowerCase();

        // Loopback / Localhost
        if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
            return true;
        }

        // Internal hostnames
        if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
            return true;
        }

        // IPv4 regex checks for private IP ranges and Cloud Metadata
        const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipv4Match) {
            const octet1 = parseInt(ipv4Match[1], 10);
            const octet2 = parseInt(ipv4Match[2], 10);

            // 127.0.0.0/8 (Loopback)
            if (octet1 === 127) return true;

            // 10.0.0.0/8 (Private)
            if (octet1 === 10) return true;

            // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
            if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;

            // 192.168.0.0/16 (Private)
            if (octet1 === 192 && octet2 === 168) return true;

            // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata 169.254.169.254)
            if (octet1 === 169 && octet2 === 254) return true;

            // 0.0.0.0/8
            if (octet1 === 0) return true;
        }

        // Decimal integer IP check (e.g. 2130706433 = 127.0.0.1)
        if (/^\d+$/.test(host)) {
            const num = parseInt(host, 10);
            if (num >= 0 && num <= 4294967295) {
                const o1 = (num >>> 24) & 255;
                const o2 = (num >>> 16) & 255;
                if (o1 === 127 || o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168) || (o1 === 169 && o2 === 254) || o1 === 0) {
                    return true;
                }
            }
        }

        // IPv6 loopback, link-local (fe80::), and IPv4-mapped IPv6
        const cleanV6 = host.replace(/^\[|\]$/g, '');
        if (cleanV6 === '::1' || cleanV6.startsWith('fe80:') || cleanV6.startsWith('fc') || cleanV6.startsWith('fd') || cleanV6.includes('::ffff:127.')) {
            return true;
        }

        return false;
    } catch {
        return true; // Invalid URL is blocked
    }
}

/**
 * Validates a redirect location against SSRF boundaries before following it.
 */
export function validateRedirectUrl(currentUrl, locationHeader) {
    if (!locationHeader) return { safe: false, reason: 'Missing Location header' };
    try {
        const resolved = new URL(locationHeader, currentUrl).toString();
        if (isPrivateOrInternalUrl(resolved)) {
            return { safe: false, url: resolved, reason: 'Redirect target is a private, loopback, or cloud-metadata address' };
        }
        return { safe: true, url: resolved };
    } catch (e) {
        return { safe: false, reason: `Malformed redirect location: ${e.message}` };
    }
}

/**
 * Performs HTTP fetch while strictly enforcing SSRF checks on every redirect hop.
 */
export async function safeFetchWithRedirects(initialUrl, options = {}, maxRedirects = 5) {
    let currentUrl = initialUrl;
    let redirects = 0;

    while (redirects <= maxRedirects) {
        if (isPrivateOrInternalUrl(currentUrl)) {
            const err = new Error(`SSRF Blocked: URL resolved to private/internal network (${currentUrl})`);
            err.code = 'SSRF_BLOCKED';
            throw err;
        }

        const fetchOptions = {
            ...options,
            redirect: 'manual'
        };

        const response = await fetch(currentUrl, fetchOptions);

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            redirects++;
            if (redirects > maxRedirects) {
                const err = new Error(`Too many redirects (exceeded limit of ${maxRedirects})`);
                err.code = 'TOO_MANY_REDIRECTS';
                throw err;
            }
            const location = response.headers.get('location');
            const check = validateRedirectUrl(currentUrl, location);
            if (!check.safe) {
                const err = new Error(`SSRF Blocked on redirect: ${check.reason} (${check.url || location})`);
                err.code = 'SSRF_BLOCKED';
                throw err;
            }
            currentUrl = check.url;
            continue;
        }

        return response;
    }
}

