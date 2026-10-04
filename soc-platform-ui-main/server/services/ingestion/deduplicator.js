/**
 * server/services/ingestion/deduplicator.js
 * Multi-layered deduplication engine for threat intelligence articles.
 * Layer 1: Exact URL match
 * Layer 2: Normalized URL match (stripped tracking parameters, trailing slashes)
 * Layer 3: Title fingerprint match
 */

import { normalizeUrl, createTitleFingerprint } from './urlNormalizer.js';

export class IngestionDeduplicator {
    constructor() {
        this.seenCanonicalUrls = new Set();
        this.seenNormalizedUrls = new Set();
        this.seenTitleFingerprints = new Map(); // fingerprint -> originalUrl
    }

    /**
     * Pre-seeds deduplicator with existing URLs/fingerprints if provided.
     * @param {Array<{ canonical_url?: string, title?: string }>} existingArticles 
     */
    seed(existingArticles = []) {
        for (const art of existingArticles) {
            if (art.canonical_url) {
                this.seenCanonicalUrls.add(art.canonical_url);
                this.seenNormalizedUrls.add(normalizeUrl(art.canonical_url));
            }
            if (art.title) {
                const fp = createTitleFingerprint(art.title);
                if (fp) this.seenTitleFingerprints.set(fp, art.canonical_url || '');
            }
        }
    }

    /**
     * Checks if an incoming article is a duplicate and registers it if new.
     * @param {string} rawLink 
     * @param {string} title 
     * @returns {{ isDuplicate: boolean, matchLayer?: string, normalizedUrl: string }}
     */
    checkAndRegister(rawLink, title) {
        const canonical = (rawLink || '').trim();
        const normalized = normalizeUrl(canonical);
        const fingerprint = createTitleFingerprint(title);

        // Layer 1: Exact Canonical URL match
        if (this.seenCanonicalUrls.has(canonical)) {
            return { isDuplicate: true, matchLayer: 'exact_url', normalizedUrl: normalized };
        }

        // Layer 2: Normalized URL match (catches differing tracking params)
        if (this.seenNormalizedUrls.has(normalized)) {
            return { isDuplicate: true, matchLayer: 'normalized_url', normalizedUrl: normalized };
        }

        // Layer 3: Exact title fingerprint within the active deduplication window
        if (fingerprint && fingerprint.length > 20 && this.seenTitleFingerprints.has(fingerprint)) {
            return { isDuplicate: true, matchLayer: 'title_fingerprint', normalizedUrl: normalized };
        }

        // Register as seen for subsequent items in this run
        this.seenCanonicalUrls.add(canonical);
        this.seenNormalizedUrls.add(normalized);
        if (fingerprint) {
            this.seenTitleFingerprints.set(fingerprint, canonical);
        }

        return { isDuplicate: false, normalizedUrl: normalized };
    }
}
