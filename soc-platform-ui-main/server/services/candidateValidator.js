import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { isPrivateOrInternalUrl, normalizeFeedUrl, extractPublisherDomain, safeFetchWithRedirects } from '../utils/urlUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, '../data/candidate_validation_state.json');
const REGISTRY_FILE = path.join(__dirname, '../data/sources_registry.json');
const HEALTH_FILE = path.join(__dirname, '../data/feed_health.json');

const REQUEST_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB limit

const parser = new Parser({
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 NoEntrySOC-CandidateValidator/2.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    }
});

// Comprehensive cybersecurity relevance keyword dictionary
const CYBER_KEYWORDS = [
    'vulnerability', 'vulnerabilities', 'cve-', 'exploit', 'exploits', 'malware', 'ransomware',
    'phishing', 'threat', 'threats', 'cyber', 'security', 'infosec', 'zero-day', '0-day',
    'breach', 'breaches', 'incident', 'forensics', 'attack', 'attacker', 'attackers', 'mitre',
    'advisory', 'advisories', 'cert', 'cisa', 'apt', 'hacker', 'hacking', 'soc', 'edr', 'siem',
    'payload', 'trojan', 'backdoor', 'botnet', 'spyware', 'injection', 'xss', 'rce', 'ddos',
    'credential', 'firmware', 'reverse engineering', 'patch tuesday', 'active exploitation'
];

/**
 * Checks cybersecurity domain relevance from feed title, description, and item content.
 */
export function evaluateCyberRelevance(feed, candidateCategory) {
    // If categorized under high-fidelity security category, baseline relevance is high
    const textCorpus = [
        feed.title || '',
        feed.description || '',
        candidateCategory || '',
        ...(feed.items || []).slice(0, 10).map(i => `${i.title || ''} ${i.contentSnippet || i.summary || ''}`)
    ].join(' ').toLowerCase();

    let score = 0;
    for (const kw of CYBER_KEYWORDS) {
        if (textCorpus.includes(kw)) {
            score++;
            if (score >= 2) return { isRelevant: true, score };
        }
    }

    return { isRelevant: score >= 1, score };
}

/**
 * Loads persistent validation state for resumable candidate processing.
 */
export function loadValidationState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch {
            // fallback
        }
    }
    return {
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        attempted: 0,
        approved: 0,
        rejected: 0,
        rejectionBreakdown: {
            not_found: 0,
            access_restricted: 0,
            timeout: 0,
            parser_error: 0,
            empty_feed: 0,
            not_a_feed: 0,
            irrelevant: 0,
            other: 0
        },
        processedIds: {}
    };
}

/**
 * Persists validation state.
 */
export function saveValidationState(state) {
    state.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Validates a single candidate feed endpoint with bounded network requests and parsing.
 */
export async function validateCandidate(candidate) {
    const start = Date.now();
    const candidateId = candidate.id;
    const rawUrl = candidate.canonicalUrl || candidate.feedUrl;
    const targetUrl = normalizeFeedUrl(rawUrl);

    // SSRF Check
    if (isPrivateOrInternalUrl(targetUrl)) {
        return {
            candidateId,
            approved: false,
            httpStatus: null,
            latencyMs: Date.now() - start,
            errorCategory: 'SSRF_BLOCKED',
            rejectionReason: 'Target resolves to private, loopback, or cloud-metadata address'
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await safeFetchWithRedirects(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 NoEntrySOC-CandidateValidator/2.0 (+https://soc-ai-six.vercel.app/)',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
            },
            signal: controller.signal
        }, 5);

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - start;
        const httpStatus = response.status;

        // Check HTTP response code
        if (httpStatus === 404 || httpStatus === 410) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'NOT_FOUND',
                rejectionReason: `HTTP ${httpStatus} Not Found / Resource Discontinued`
            };
        }

        if (httpStatus === 403) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'ACCESS_RESTRICTED',
                rejectionReason: 'HTTP 403 Forbidden / Publisher WAF Restriction'
            };
        }

        if (!response.ok) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: httpStatus >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR',
                rejectionReason: `HTTP ${httpStatus} (${response.statusText})`
            };
        }

        // Response Size Check
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_BODY_BYTES) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'OVERSIZED_PAYLOAD',
                rejectionReason: `Payload exceeds 10MB limit (${(contentLength / 1024 / 1024).toFixed(1)}MB)`
            };
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const xmlText = await response.text();

        // Check if returned document is plain HTML without XML prologue or RSS/Atom tags
        if (contentType.includes('text/html') && !xmlText.includes('<rss') && !xmlText.includes('<feed') && !xmlText.includes('<?xml')) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'NOT_A_FEED',
                rejectionReason: 'HTML document returned instead of RSS/Atom XML feed'
            };
        }

        // Parse XML feed
        let parsedFeed;
        try {
            parsedFeed = await parser.parseString(xmlText);
        } catch (parseErr) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'PARSER_ERROR',
                rejectionReason: `XML Parse Failed: ${parseErr.message.slice(0, 120)}`
            };
        }

        // Check empty feed
        const items = parsedFeed.items || [];
        if (items.length === 0) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'EMPTY_FEED',
                rejectionReason: 'Valid XML but 0 articles observed in feed'
            };
        }

        // Evaluate Cybersecurity Relevance
        const relevance = evaluateCyberRelevance(parsedFeed, candidate.category);
        if (!relevance.isRelevant) {
            return {
                candidateId,
                approved: false,
                httpStatus,
                latencyMs,
                errorCategory: 'IRRELEVANT_CONTENT',
                rejectionReason: 'Content does not demonstrate cybersecurity domain relevance'
            };
        }

        // Extract latest publication date
        let latestPublicationAt = null;
        for (const item of items) {
            const rawDate = item.pubDate || item.isoDate || item.date;
            if (rawDate) {
                const parsedTime = new Date(rawDate).getTime();
                if (!isNaN(parsedTime) && parsedTime <= Date.now() + 86400000) {
                    if (!latestPublicationAt || parsedTime > new Date(latestPublicationAt).getTime()) {
                        latestPublicationAt = new Date(parsedTime).toISOString();
                    }
                }
            }
        }

        // Validated & Approved!
        return {
            candidateId,
            approved: true,
            httpStatus: 200,
            latencyMs,
            itemCount: items.length,
            title: parsedFeed.title || candidate.name,
            latestPublicationAt,
            etag: response.headers.get('etag') || null,
            lastModified: response.headers.get('last-modified') || null,
            errorCategory: null,
            rejectionReason: null
        };

    } catch (err) {
        if (err.code === 'SSRF_BLOCKED') {
            return {
                candidateId,
                approved: false,
                httpStatus: null,
                latencyMs: Date.now() - start,
                errorCategory: 'SSRF_BLOCKED',
                rejectionReason: err.message
            };
        }
        const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT' || err.message.includes('timeout');
        return {
            candidateId,
            approved: false,
            httpStatus: null,
            latencyMs: Date.now() - start,
            errorCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
            rejectionReason: isTimeout ? 'Connection timed out (8s limit)' : `Network transport error: ${err.message.slice(0, 100)}`
        };
    }
}
