/**
 * server/services/ingestion/ssrfGuard.js
 * Validates URLs against Server-Side Request Forgery (SSRF).
 * Blocks loopback, private networks, cloud metadata services, and non-HTTP protocols.
 */

import net from 'net';

const BLOCKED_HOSTS = new Set([
    'localhost',
    'metadata.google.internal',
    '169.254.169.254', // AWS / GCP / Azure metadata
    'instance-data',
    '0.0.0.0',
    '::1',
    '127.0.0.1'
]);

/**
 * Checks if an IP is in a private, loopback, or link-local range.
 * @param {string} ip 
 * @returns {boolean} True if private/restricted
 */
export function isPrivateIp(ip) {
    if (!net.isIP(ip)) return false;

    // IPv4 checks
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;

        // Loopback: 127.0.0.0/8
        if (a === 127) return true;

        // Link-local / Cloud metadata: 169.254.0.0/16
        if (a === 169 && b === 254) return true;

        // Private RFC1918:
        // 10.0.0.0/8
        if (a === 10) return true;
        // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
        if (a === 172 && b >= 16 && b <= 31) return true;
        // 192.168.0.0/16
        if (a === 192 && b === 168) return true;

        // Broadcast / Zero: 0.0.0.0, 255.255.255.255
        if (a === 0 || (a === 255 && b === 255)) return true;

        return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
            return true;
        }
    }

    return false;
}

/**
 * Validates a feed URL against SSRF rules.
 * @param {string} rawUrl 
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateFeedUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return { valid: false, reason: 'Empty or invalid URL' };
    }

    try {
        const parsed = new URL(rawUrl.trim());

        // Protocol restriction: strictly http or https
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
        }

        const hostname = parsed.hostname.toLowerCase();

        // Direct blocked hostnames
        if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
            return { valid: false, reason: `Forbidden destination host: ${hostname}` };
        }

        // Direct IP checks
        if (net.isIP(hostname) && isPrivateIp(hostname)) {
            return { valid: false, reason: `Private or loopback IP range disallowed: ${hostname}` };
        }

        return { valid: true };
    } catch (err) {
        return { valid: false, reason: `Malformed URL: ${err.message}` };
    }
}
