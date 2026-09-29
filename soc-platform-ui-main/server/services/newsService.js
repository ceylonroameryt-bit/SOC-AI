import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Parser from 'rss-parser';
import { fileURLToPath } from 'url';
import { insertThreat, insertIOCs, isDbConnected } from '../db/db.js';
import { extractIOCs } from './enrichmentService.js';
import { assessSeverity } from './severityEngine.js';
import { recordCollectionResult } from './feedHealthService.js';
import { classifyRecord, mapLegacyCategory, INTEL_CATEGORIES } from './classificationEngine.js';
import { enforceContentRestrictions } from './permissionService.js';
import { startCollectionRun, completeCollectionRun, failCollectionRun } from './collectionRunService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/news.json');

const parser = new Parser();

/**
 * Derive a stable, deterministic article ID from its canonical URL.
 * Uses first 16 hex chars of SHA-1 — sufficient for uniqueness at this scale.
 * @param {string} link - Canonical article URL
 * @returns {string} e.g. "art-3f2a0c8b4d1e9a72"
 */
export const deriveArticleId = (link) => {
    if (!link) return `art-${crypto.randomBytes(8).toString('hex')}`;
    return `art-${crypto.createHash('sha1').update(link).digest('hex').slice(0, 16)}`;
};

/**
 * P0 item 8: Validate a feed item link.
 * Returns the URL if it is an http(s) URL, null otherwise.
 * Prevents javascript:, data:, ftp: and relative paths from being stored.
 * @param {string|null|undefined} link
 * @returns {string|null}
 */
export const validateLink = (link) => {
    if (!link || typeof link !== 'string') return null;
    const trimmed = link.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    try {
        const url = new URL(trimmed);
        return (url.protocol === 'http:' || url.protocol === 'https:') ? trimmed : null;
    } catch {
        return null;
    }
};

/**
 * P0 item 8: Derive a dedupe key from an item.
 * Falls back to SHA-1 of title+source when link is null or '#' to prevent
 * all link-less items collapsing onto the same duplicate key.
 * @param {{ link?: string, title?: string, source?: string }} item
 * @returns {string}
 */
export const dedupeKey = (item) => {
    const safeLink = validateLink(item.link);
    if (safeLink) return safeLink;
    // No valid link — dedupe on title+source hash instead
    const fallback = `${(item.title || '').trim()}|${(item.source || '').trim()}`;
    return `no-link:${crypto.createHash('sha1').update(fallback).digest('hex').slice(0, 16)}`;
};

/**
 * Parse a pubDate string to a validated ISO-8601 UTC string.
 * Returns null (never the current time) when the date is missing or unparseable.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export const parsePubDate = (raw) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
};

const REGISTRY_FILE = path.join(__dirname, '../data/sources_registry.json');
const SOURCES_FILE = path.join(__dirname, '../data/sources.json');

export const getFeeds = () => {
    try {
        if (fs.existsSync(REGISTRY_FILE)) {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf8');
            const registry = JSON.parse(data);
            return registry
                .filter(s => s.enabled && s.reviewState === 'approved')
                .map(s => ({
                    id: s.id,
                    name: s.name,
                    url: s.canonicalUrl || s.feedUrl,
                    canonicalUrl: s.canonicalUrl || s.feedUrl,
                    category: s.category,
                    language: s.language || 'en',
                    publisherDomain: s.publisherDomain,
                    provenance: s.provenance,
                    etag: s.etag,
                    lastModified: s.lastModified
                }));
        }
        if (fs.existsSync(SOURCES_FILE)) {
            const data = fs.readFileSync(SOURCES_FILE, 'utf8');
            const sources = JSON.parse(data);
            return sources.filter(s => s.url).map((s, idx) => ({
                id: s.id || `feed-${idx}`,
                name: s.name,
                url: s.url,
                canonicalUrl: s.url,
                category: s.category
            }));
        }
    } catch (err) {
        console.error('Error reading feeds registry in newsService:', err);
    }
    return [];
};

// Keywords for severity tagging
const SEVERITY_KEYWORDS = {
    CRITICAL: ['zero-day', 'rce', 'remote code execution', 'critical', 'exploit', 'unpatched', 'active exploitation'],
    HIGH: ['ransomware', 'breach', 'leak', 'vulnerability', 'attack', 'malware', 'backdoor', 'trojan', 'apt'],
    MEDIUM: ['patch', 'update', 'warning', 'advisory', 'phishing', 'scam', 'botnet', 'ddos']
};

const CATEGORY_KEYWORDS = {
    'Ransomware': ['ransomware', 'encrypt', 'extortion', 'lockbit', 'clop', 'blackcat', 'royal'],
    'Data Breach': ['breach', 'leak', 'database', 'exposed', 'records', 'dump', 'stolen'],
    'Vulnerability': ['vulnerability', 'cve', 'zero-day', 'exploit', 'bug', 'patch', 'rce'],
    'Malware': ['malware', 'trojan', 'virus', 'spyware', 'backdoor', 'loader', 'botnet'],
    'Phishing': ['phishing', 'scam', 'credential', 'harvesting', 'social engineering'],
    'Government': ['cisa', 'fbi', 'nsa', 'nist', 'directive', 'act', 'regulation'],
    'Dark Web': ['dark web', 'onion', 'tor', 'market', 'underground', 'forum']
};

const determineSeverity = (title, snippet, source = '') => {
    const assessment = assessSeverity({ title, contentSnippet: snippet, source });
    if (assessment.severity === 'critical') return 'Critical';
    if (assessment.severity === 'high') return 'High';
    if (assessment.severity === 'medium') return 'Medium';
    if (assessment.severity === 'informational') return 'Informational';
    return 'Low';
};

const determineCategory = (title, snippet) => {
    const text = `${title} ${snippet}`.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) return category;
    }
    return 'General Info';
};

// IN-MEMORY CACHE WITH DISK MTIME SYNCHRONIZATION
let NEWS_CACHE = [];
let lastMtimeMs = 0;

export const invalidateNewsCache = () => {
    NEWS_CACHE = [];
    lastMtimeMs = 0;
};

const SEED_FILE = path.join(__dirname, '../data/news_seed.json');

export const loadNewsData = () => {
    const targetFile = fs.existsSync(DATA_FILE) ? DATA_FILE : (fs.existsSync(SEED_FILE) ? SEED_FILE : null);
    if (!targetFile) {
        return [];
    }
    try {
        const stat = fs.statSync(targetFile);
        // Return in-memory cache only if disk file has not been modified since last read
        if (NEWS_CACHE && NEWS_CACHE.length > 0 && stat.mtimeMs <= lastMtimeMs) {
            return NEWS_CACHE;
        }
        const data = fs.readFileSync(targetFile, 'utf8');
        if (!data || !data.trim()) return NEWS_CACHE || [];
        NEWS_CACHE = JSON.parse(data);
        lastMtimeMs = stat.mtimeMs;
        return NEWS_CACHE;
    } catch (err) {
        console.error('Error reading news data:', err.message);
        return NEWS_CACHE || [];
    }
};

const saveNewsData = (data) => {
    // Update Cache Immediately
    NEWS_CACHE = data;

    // Atomic write via temp file prevents concurrent reads from hitting partial JSON
    const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
        fs.renameSync(tmpFile, DATA_FILE);
        try { lastMtimeMs = fs.statSync(DATA_FILE).mtimeMs; } catch {}
    } catch (err) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            try { lastMtimeMs = fs.statSync(DATA_FILE).mtimeMs; } catch {}
        } catch (writeErr) {
            console.error('Error saving news data to disk:', writeErr.message);
        }
        if (fs.existsSync(tmpFile)) {
            try { fs.unlinkSync(tmpFile); } catch {}
        }
    }
};

// Initialize Cache on Module Load
loadNewsData();

export const fetchAndProcessNews = async (trigger = 'scheduled') => {
    // Use Cache directly
    let existingNews = NEWS_CACHE.length > 0 ? NEWS_CACHE : loadNewsData();
    let newItemsCount = 0;
    const runRecord = startCollectionRun(trigger, { concurrency: 10 });
    let totalParsed = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let successfulFeeds = 0;
    let failedFeeds = 0;
    const rejectionReasons = {
        duplicate_link: 0,
        missing_required_fields: 0,
        content_policy_filtered: 0
    };
    let lastSuccessfulFetch = null;
    let lastSuccessfulArticleWrite = null;

    try {
        const feeds = getFeeds();
        console.log(`Fetching from ${feeds.length} sources... | Run ID: ${runRecord.runId}`);

        // Process in chunks to avoid overwhelming the network
        const CHUNK_SIZE = 10;

        for (let i = 0; i < feeds.length; i += CHUNK_SIZE) {
            const chunk = feeds.slice(i, i + CHUNK_SIZE);
            console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(feeds.length / CHUNK_SIZE)}...`);
            const chunkPromises = chunk.map(async (sourceObj) => {
                const start = Date.now();
                const sourceId = sourceObj.id || (sourceObj.name || 'feed').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                try {
                    const parsed = await parser.parseURL(sourceObj.url);
                    const latencyMs = Date.now() - start;
                    const items = parsed?.items || [];
                    const latestPub = items[0]?.pubDate || null;
                    return {
                        feed: parsed,
                        sourceObj,
                        sourceId,
                        latencyMs,
                        itemsCount: items.length,
                        latestPub
                    };
                } catch (err) {
                    const latencyMs = Date.now() - start;
                    recordCollectionResult(sourceId, {
                        success: false,
                        httpStatus: null,
                        latencyMs,
                        itemsCount: 0,
                        itemsAccepted: 0,
                        itemsRejected: 0,
                        error: err.message,
                        errorCategory: 'FETCH_ERROR'
                    });
                    return null;
                }
            });
            const chunkResults = await Promise.all(chunkPromises);

            // Process and save chunk immediately
            const validChunk = chunkResults.filter(res => res !== null);
            let chunkNewItems = 0;
            successfulFeeds += validChunk.length;
            failedFeeds += (chunk.length - validChunk.length);

            validChunk.forEach(({ feed, sourceObj, sourceId, latencyMs, itemsCount, latestPub }) => {
                let acceptedForFeed = 0;
                let rejectedForFeed = 0;
                lastSuccessfulFetch = new Date().toISOString();
                const feedItems = feed.items || [];
                totalParsed += feedItems.length;

                feedItems.forEach(item => {
                    if (!item || !item.title) {
                        // P0 item 8: items without a title are rejected (can't dedupe or display)
                        rejectedForFeed++;
                        totalRejected++;
                        rejectionReasons.missing_required_fields++;
                        return;
                    }

                    // P0 item 8: validate link — null if not http(s)
                    const safeLink = validateLink(item.link);

                    // P0 item 8: use robust dedupe key that does not collapse all link-less items
                    const key = dedupeKey({ link: safeLink, title: item.title, source: sourceObj.name || feed.title || '' });
                    const exists = existingNews.some(n => dedupeKey({ link: validateLink(n.link), title: n.title, source: n.source }) === key);

                    if (exists) {
                        rejectedForFeed++;
                        totalRejected++;
                        rejectionReasons.duplicate_link++;
                        return;
                    }

                    acceptedForFeed++;
                    totalAccepted++;
                    const severity = determineSeverity(item.title, item.contentSnippet || '', sourceObj.name || feed.title || '');
                    const category = determineCategory(item.title, item.contentSnippet || '');
                    // Classify with the new taxonomy engine
                    const classification = classifyRecord({
                        title: item.title,
                        contentSnippet: item.contentSnippet || '',
                        source: sourceObj.name || feed.title || '',
                        category: sourceObj.category
                    });

                    const ingestedAt = new Date().toISOString();
                    const resolvedPubDate = parsePubDate(item.pubDate); // null when missing — never fabricated
                    const newItem = {
                        id: deriveArticleId(safeLink || `${item.title}|${sourceObj.name || ''}`.trim()),
                        title: item.title,
                        link: safeLink, // P0 item 8: null if not http(s), never '#'
                        // pubDate is the publisher-reported date; null means unknown — do NOT substitute current time
                        pubDate: resolvedPubDate,
                        // pubDateMissing flag allows UI to display an honest "publication date unknown" label
                        pubDateMissing: resolvedPubDate === null,
                        // ingestedAt is when the collector fetched this article — always set
                        ingestedAt,
                        // fetchedAt preserved as alias for backward compatibility
                        fetchedAt: ingestedAt,
                        contentSnippet: item.contentSnippet || '',
                        source: sourceObj.name || feed.title || 'Unknown Source',
                        severity: severity,
                        // Legacy category field (raw value) - preserved for reversibility
                        sourceCategory: category,
                        category: category,
                        // New taxonomy fields
                        intelCategory: classification.intelCategory,
                        intelCategoryDisplay: classification.displayName,
                        secondaryTopics: classification.secondaryTopics,
                        contentType: classification.contentType,
                        classificationMethod: classification.method,
                        classificationConfidence: classification.confidence,
                        classificationReason: classification.reason,
                        taxonomyVersion: classification.taxonomyVersion,
                        evidenceStatus: deriveEvidenceStatus(item.title, item.contentSnippet || '', classification),
                    };
                    const restrictedItem = enforceContentRestrictions(newItem, sourceId);
                    existingNews.push(restrictedItem);
                    chunkNewItems++;
                    newItemsCount++;

                    // Asynchronously persist to PostgreSQL if connected
                    if (isDbConnected()) {
                        insertThreat(newItem).then(threatId => {
                            if (threatId) {
                                const text = `${newItem.title} ${newItem.contentSnippet || ''}`;
                                const extracted = extractIOCs(text);
                                insertIOCs(threatId, extracted);
                            }
                        }).catch(() => {});
                    }
                });

                recordCollectionResult(sourceId, {
                    success: true,
                    httpStatus: 200,
                    latencyMs,
                    itemsCount,
                    itemsAccepted: acceptedForFeed,
                    itemsRejected: rejectedForFeed,
                    latestPubDate: latestPub
                });
            });

            if (chunkNewItems > 0) {
                // Note: final sort + save happens once after all chunks complete
                console.log(`Processed ${chunkNewItems} new items from chunk ${i / CHUNK_SIZE + 1}.`);
            }
        }

        if (newItemsCount > 0) {
            // P1 item 21: Sort safely — null/invalid pubDate treated as oldest (epoch 0)
            existingNews.sort((a, b) => {
                const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
                const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
                return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
            });
            saveNewsData(existingNews);
            lastSuccessfulArticleWrite = new Date().toISOString();
            console.log(`Added ${newItemsCount} new news items.`);
        }

        completeCollectionRun(runRecord.runId, {
            sources: {
                attempted: feeds.length,
                succeeded: successfulFeeds,
                notModified304: 0,
                failed: failedFeeds,
                skipped: 0
            },
            entries: {
                parsed: totalParsed,
                accepted: totalAccepted,
                rejected: totalRejected,
                rejectionReasons,
                inserted: newItemsCount,
                updated: 0,
                deduplicated: rejectionReasons.duplicate_link
            },
            lastSuccessfulFetch,
            lastSuccessfulArticleWrite: newItemsCount > 0 ? lastSuccessfulArticleWrite : null
        });

        return existingNews;
    } catch (error) {
        console.error('Error in fetchAndProcessNews:', error);
        try { failCollectionRun(runRecord.runId, error); } catch {}
        return existingNews;
    }
};

export const getNews = () => {
    return NEWS_CACHE.length > 0 ? NEWS_CACHE : loadNewsData();
};

/**
 * queryArchive — server-side date-range + keyword + category + MITRE filter.
 *
 * Date semantics:
 *   - dateFrom: inclusive start (UTC ISO-8601 or epoch ms)
 *   - dateTo:   exclusive end   (UTC ISO-8601 or epoch ms)
 *   Articles with pubDate === null are excluded from date-bounded windows.
 *
 * @param {Object} opts
 * @param {string}  [opts.dateFrom]    - Inclusive start timestamp (UTC ISO-8601)
 * @param {string}  [opts.dateTo]      - Exclusive end timestamp  (UTC ISO-8601)
 * @param {string}  [opts.q]           - Keyword search across title, snippet, source
 * @param {string}  [opts.source]      - Exact source name filter
 * @param {string}  [opts.category]    - intelCategory or legacy category filter
 * @param {string}  [opts.severity]    - Severity filter
 * @param {string}  [opts.tacticId]    - MITRE tactic ID filter  (applied after caller enriches)
 * @param {string}  [opts.techniqueId] - MITRE technique ID filter
 * @param {string}  [opts.mappedOnly]  - 'true'|'false' to filter mapped/unmapped
 * @param {string}  [opts.sort]        - 'pub_desc' (default) | 'pub_asc' | 'ingested_desc'
 * @param {number}  [opts.page]        - 1-indexed page number (default 1)
 * @param {number}  [opts.limit]       - Page size 1–200 (default 50)
 * @returns {{ records: object[], total: number, page: number, totalPages: number, archiveCoverage: {oldest: string|null, newest: string|null, total: number} }}
 */
export function queryArchive(opts = {}) {
    const {
        dateFrom,
        dateTo,
        q,
        source,
        category,
        severity,
        tacticId,
        techniqueId,
        mappedOnly,
        sort = 'pub_desc',
        page = 1,
        limit = 50,
    } = opts;

    const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const safePage  = Math.max(1, parseInt(page, 10) || 1);

    let records = getNews();

    // ── Date filter ─────────────────────────────────────────────────────────
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs   = dateTo   ? new Date(dateTo).getTime()   : null;
    const hasDateFilter = fromMs !== null || toMs !== null;

    if (hasDateFilter) {
        records = records.filter(item => {
            // Articles with no pubDate are excluded from date-bounded windows
            if (!item.pubDate) return false;
            const ms = new Date(item.pubDate).getTime();
            if (isNaN(ms)) return false;
            if (fromMs !== null && ms < fromMs) return false; // before start
            if (toMs   !== null && ms >= toMs)  return false; // at or after exclusive end
            return true;
        });
    }

    // ── Keyword filter ──────────────────────────────────────────────────────
    if (q && q.trim()) {
        const lower = q.toLowerCase();
        records = records.filter(item =>
            (item.title  || '').toLowerCase().includes(lower) ||
            (item.contentSnippet || '').toLowerCase().includes(lower) ||
            (item.source || '').toLowerCase().includes(lower)
        );
    }

    // ── Source filter ───────────────────────────────────────────────────────
    if (source && source !== 'all') {
        const srcLower = source.toLowerCase();
        records = records.filter(item => (item.source || '').toLowerCase().includes(srcLower));
    }

    // ── Category filter (intelCategory preferred, legacy fallback) ───────────
    if (category && category !== 'all') {
        const catLower = category.toLowerCase();
        records = records.filter(item =>
            (item.intelCategory || item.category || '').toLowerCase() === catLower
        );
    }

    // ── Severity filter ─────────────────────────────────────────────────────
    if (severity && severity !== 'all') {
        records = records.filter(item => (item.severity || '').toLowerCase() === severity.toLowerCase());
    }

    // ── MITRE tactic/technique filters (applied after caller enriches mitreTechniques) ──
    if (tacticId && tacticId !== 'all') {
        const tid = tacticId.toLowerCase();
        records = records.filter(item =>
            Array.isArray(item.mitreTactics) &&
            item.mitreTactics.some(t => (t.id || '').toLowerCase() === tid)
        );
    }
    if (techniqueId && techniqueId !== 'all') {
        const techId = techniqueId.toLowerCase();
        records = records.filter(item =>
            Array.isArray(item.mitreTechniques) &&
            item.mitreTechniques.some(t => (t.id || '').toLowerCase() === techId)
        );
    }

    // ── Mapped / unmapped filter ─────────────────────────────────────────────
    if (mappedOnly === 'true') {
        records = records.filter(item => Array.isArray(item.mitreTechniques) && item.mitreTechniques.length > 0);
    } else if (mappedOnly === 'false') {
        records = records.filter(item => !Array.isArray(item.mitreTechniques) || item.mitreTechniques.length === 0);
    }

    // ── Sort ─────────────────────────────────────────────────────────────────
    records = [...records]; // avoid mutating shared cache
    if (sort === 'pub_asc') {
        records.sort((a, b) => {
            if (!a.pubDate && !b.pubDate) return 0;
            if (!a.pubDate) return 1;
            if (!b.pubDate) return -1;
            return new Date(a.pubDate) - new Date(b.pubDate);
        });
    } else if (sort === 'ingested_desc') {
        records.sort((a, b) => new Date(b.ingestedAt || b.fetchedAt || 0) - new Date(a.ingestedAt || a.fetchedAt || 0));
    } else {
        // pub_desc (default)
        records.sort((a, b) => {
            if (!a.pubDate && !b.pubDate) return 0;
            if (!a.pubDate) return 1;
            if (!b.pubDate) return -1;
            return new Date(b.pubDate) - new Date(a.pubDate);
        });
    }

    const total = records.length;
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const paged = records.slice((safePage - 1) * safeLimit, safePage * safeLimit);

    // Archive coverage (across entire unfiltered cache)
    const all = getNews();
    const datedAll = all.filter(n => n.pubDate).map(n => new Date(n.pubDate).getTime()).filter(ms => !isNaN(ms));
    const archiveCoverage = {
        oldest: datedAll.length ? new Date(Math.min(...datedAll)).toISOString() : null,
        newest: datedAll.length ? new Date(Math.max(...datedAll)).toISOString() : null,
        total: all.length,
    };

    return { records: paged, total, page: safePage, totalPages, archiveCoverage };
}

/**
 * Derive evidence status for a news record.
 * Kept separate from severity to avoid conflating the two dimensions.
 * @returns {'verified' | 'unverified-claim' | 'advisory' | 'unassessed'}
 */
function deriveEvidenceStatus(title, snippet, classification) {
    const text = `${title} ${snippet}`.toLowerCase();
    if (
        text.includes('security advisory') ||
        text.includes('patch advisory') ||
        text.includes('cisa advisory') ||
        text.includes('cert advisory') ||
        classification.intelCategory === 'vuln-disclosure'
    ) return 'advisory';
    if (
        text.includes('leak site') ||
        text.includes('victim published') ||
        text.includes('allegedly') ||
        text.includes('claims to have') ||
        text.includes('unverified') ||
        text.includes('dark web post')
    ) return 'unverified-claim';
    if (
        text.includes('confirmed') ||
        text.includes('verified') ||
        text.includes('official statement') ||
        text.includes('breach notification')
    ) return 'verified';
    return 'unassessed';
}

/**
 * backfillClassification — runs a classification pass over all existing news records
 * that lack an `intelCategory` field or have category='undefined'.
 *
 * Preserves `sourceCategory` (original raw value).
 * Does NOT delete or overwrite records that already have `analystCategory` set.
 * Called once on server startup after initial news load.
 */
export function backfillClassification() {
    const news = NEWS_CACHE.length > 0 ? NEWS_CACHE : loadNewsData();
    if (!news || news.length === 0) return;

    let updatedCount = 0;
    const updated = news.map(item => {
        // Skip records already classified by the engine or an analyst
        if (item.intelCategory && item.classificationMethod) return item;

        // Try reversible legacy category mapping first
        const legacyMapped = mapLegacyCategory(item.category);

        let classification;
        if (legacyMapped) {
            // Direct mapping available — use it but still derive secondary topics
            classification = {
                intelCategory: legacyMapped,
                displayName: INTEL_CATEGORIES[legacyMapped],
                secondaryTopics: [],
                method: 'legacy-mapping',
                confidence: 70,
                reason: `Mapped from legacy category: "${item.category}".`,
                taxonomyVersion: 'v1.0',
            };
        } else {
            // Need full classification engine
            classification = classifyRecord({
                title: item.title,
                contentSnippet: item.contentSnippet || '',
                source: item.source || '',
                analystCategory: item.analystCategory,
            });
        }

        updatedCount++;
        return {
            ...item,
            // Preserve original source category
            sourceCategory: item.sourceCategory || item.category || undefined,
            // Apply new taxonomy
            intelCategory: classification.intelCategory,
            intelCategoryDisplay: classification.displayName,
            secondaryTopics: item.secondaryTopics || classification.secondaryTopics,
            classificationMethod: classification.method,
            classificationConfidence: classification.confidence,
            classificationReason: classification.reason,
            taxonomyVersion: classification.taxonomyVersion,
            evidenceStatus: item.evidenceStatus || deriveEvidenceStatus(
                item.title || '',
                item.contentSnippet || '',
                classification
            ),
        };
    });

    if (updatedCount > 0) {
        console.log(`[CLASSIFICATION] Backfilled ${updatedCount} records with new taxonomy.`);
        saveNewsData(updated);
    }
}

export const getSeverityStats = () => {
    const news = loadNewsData();
    const now = new Date();
    // Fix: avoid mutating `now` with setDate(); compute 30 days ago safely
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
    };

    news.forEach(item => {
        const itemDate = new Date(item.pubDate);
        if (itemDate >= thirtyDaysAgo) {
            if (stats[item.severity] !== undefined) {
                stats[item.severity]++;
            } else {
                stats['Low']++; // Default fallback
            }
        }
    });

    // Format for Recharts
    return Object.keys(stats).map(key => ({
        name: key,
        count: stats[key]
    }));
};
