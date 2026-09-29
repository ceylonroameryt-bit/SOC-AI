/**
 * feedHealthService.js
 * Tracks measured operational telemetry and health status for threat intelligence feeds.
 * Strictly separates:
 * A. Registry / Review State (candidate, approved, quarantined, retired)
 * B. Collection Health (unknown, healthy, delayed, degraded, failed, disabled)
 * C. Publication Freshness (fresh, inactive, dormant)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSourcePermission, getPermissionStats } from './permissionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_FILE = path.join(__dirname, '../data/sources_registry.json');
const LEGACY_SOURCES_FILE = path.join(__dirname, '../data/sources.json');
const HEALTH_FILE = path.join(__dirname, '../data/feed_health.json');

// In-memory health map: sourceId -> FeedHealth
const healthMap = new Map();

/**
 * Loads canonical source registry.
 */
export function getSourcesRegistry() {
    if (fs.existsSync(REGISTRY_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        } catch (err) {
            console.error('[FEED HEALTH] Error reading sources_registry.json:', err.message);
        }
    }
    // Fallback to legacy sources if registry not yet generated
    if (fs.existsSync(LEGACY_SOURCES_FILE)) {
        try {
            const legacy = JSON.parse(fs.readFileSync(LEGACY_SOURCES_FILE, 'utf8'));
            return legacy.map((s, idx) => ({
                id: s.id || `src-${(s.name || `feed-${idx}`).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`,
                name: s.name,
                feedUrl: s.url,
                canonicalUrl: s.url,
                websiteUrl: null,
                category: s.category || 'Threat Intelligence',
                language: 'en',
                publisherDomain: 'unknown',
                provenance: 'Legacy Curated',
                reviewState: s.reviewState || 'approved',
                enabled: s.enabled !== undefined ? s.enabled : true,
                expectedIntervalMinutes: 60,
                timeoutMs: 10000,
                maxRetries: 2,
                etag: null,
                lastModified: null,
                lastValidationAt: null,
                lastAttemptAt: null,
                lastSuccessAt: null,
                latestPublicationAt: null,
                consecutiveFailures: 0,
                nextRetryAt: null,
                replacementNotes: null,
                retirementReason: null
            }));
        } catch (err) {
            console.error('[FEED HEALTH] Error reading sources.json:', err.message);
        }
    }
    return [];
}

/**
 * Return all unique sources in canonical registry for accounting and enumeration.
 */
export function getUniqueSources() {
    return getSourcesRegistry();
}

/**
 * Initialize health states from persistent storage.
 * Strictly avoids labeling unmeasured feeds as 'healthy'.
 */
function initHealth() {
    if (fs.existsSync(HEALTH_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
            for (const item of raw) {
                if (item && item.sourceId) {
                    healthMap.set(item.sourceId, item);
                }
            }
        } catch (err) {
            console.warn('[FEED HEALTH] Warning reading health file:', err.message);
        }
    }

    const registry = getSourcesRegistry();
    for (const s of registry) {
        const existing = healthMap.get(s.id);
        if (!existing) {
            // New or untested feed is strictly UNKNOWN (never fabricated as healthy!)
            healthMap.set(s.id, {
                sourceId: s.id,
                name: s.name,
                feedUrl: s.canonicalUrl || s.feedUrl,
                category: s.category,
                publisherDomain: s.publisherDomain,
                reviewState: s.reviewState,
                enabled: s.enabled,
                status: !s.enabled ? 'disabled' : (s.lastSuccessAt ? 'healthy' : 'unknown'),
                expectedIntervalMinutes: s.expectedIntervalMinutes || 60,
                lastAttemptAt: s.lastAttemptAt || null,
                lastSuccessAt: s.lastSuccessAt || null,
                lastHttpStatus: s.lastHttpStatus !== undefined ? s.lastHttpStatus : null,
                consecutiveFailures: s.consecutiveFailures || 0,
                itemsLast24Hours: 0,
                itemsTotal: 0,
                averageLatencyMs: null,
                latestPublicationAt: s.latestPublicationAt || null,
                lastError: s.retirementReason || s.rejectionReason || null,
                errorCategory: s.errorCategory || null,
                nextRetryAt: null
            });
        } else {
            // Synchronize canonical configuration fields from registry
            existing.enabled = s.enabled;
            existing.reviewState = s.reviewState;
            existing.name = s.name;
            existing.category = s.category;
            existing.publisherDomain = s.publisherDomain;
            if (s.lastSuccessAt && (!existing.lastSuccessAt || new Date(s.lastSuccessAt) > new Date(existing.lastSuccessAt))) {
                existing.lastSuccessAt = s.lastSuccessAt;
            }
            if (s.lastAttemptAt && (!existing.lastAttemptAt || new Date(s.lastAttemptAt) > new Date(existing.lastAttemptAt))) {
                existing.lastAttemptAt = s.lastAttemptAt;
            }
            if (s.latestPublicationAt && !existing.latestPublicationAt) {
                existing.latestPublicationAt = s.latestPublicationAt;
            }
            if (s.errorCategory && !existing.errorCategory) {
                existing.errorCategory = s.errorCategory;
            }
            if (s.rejectionReason && !existing.lastError) {
                existing.lastError = s.rejectionReason;
            }
            if (!existing.enabled) {
                existing.status = 'disabled';
            } else if (existing.status === 'disabled' || existing.status === 'unknown') {
                existing.status = existing.lastSuccessAt ? 'healthy' : 'unknown';
            }
        }
    }
}

initHealth();

function persistHealth() {
    try {
        const list = Array.from(healthMap.values());
        const tmp = `${HEALTH_FILE}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
        fs.renameSync(tmp, HEALTH_FILE);
    } catch (err) {
        try {
            fs.writeFileSync(HEALTH_FILE, JSON.stringify(Array.from(healthMap.values()), null, 2));
        } catch (e) {
            console.error('[FEED HEALTH] Error saving feed health:', e.message);
        }
    }
}

/**
 * Records real, measured collection telemetry.
 * NEVER fabricates HTTP status codes for network/timeout errors.
 */
export function recordCollectionResult(sourceId, {
    success,
    httpStatus = null,
    latencyMs = null,
    itemsCount = 0,
    itemsAccepted = 0,
    itemsRejected = 0,
    error = null,
    errorCategory = null,
    latestPubDate = null,
    retryAfterMs = null,
    etag = null,
    lastModified = null
}) {
    let entry = healthMap.get(sourceId);
    const now = new Date().toISOString();

    if (!entry) {
        const registry = getSourcesRegistry();
        const source = registry.find(s => s.id === sourceId);
        entry = {
            sourceId,
            name: source?.name || sourceId,
            feedUrl: source?.canonicalUrl || source?.feedUrl || '',
            category: source?.category || 'General',
            publisherDomain: source?.publisherDomain || 'unknown',
            reviewState: source?.reviewState || 'approved',
            enabled: source?.enabled !== undefined ? source.enabled : true,
            status: 'unknown',
            expectedIntervalMinutes: source?.expectedIntervalMinutes || 60,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastHttpStatus: null,
            consecutiveFailures: 0,
            itemsLast24Hours: 0,
            itemsTotal: 0,
            averageLatencyMs: null,
            latestPublicationAt: null,
            lastError: null,
            errorCategory: null,
            nextRetryAt: null
        };
        healthMap.set(sourceId, entry);
    }

    entry.lastAttemptAt = now;
    // Real status code: do not invent 500/502 on network errors
    entry.lastHttpStatus = httpStatus !== undefined ? httpStatus : null;

    if (latencyMs !== null && latencyMs !== undefined) {
        entry.averageLatencyMs = Math.round(
            entry.averageLatencyMs ? (entry.averageLatencyMs * 0.7 + latencyMs * 0.3) : latencyMs
        );
    }

    if (success) {
        entry.lastSuccessAt = now;
        entry.consecutiveFailures = 0;
        entry.lastError = null;
        entry.errorCategory = null;
        entry.status = 'healthy';
        entry.itemsTotal = (entry.itemsTotal || 0) + itemsAccepted;
        entry.itemsLast24Hours = (entry.itemsLast24Hours || 0) + itemsAccepted;
        if (latestPubDate) {
            entry.latestPublicationAt = latestPubDate;
        }
        if (etag) entry.etag = etag;
        if (lastModified) entry.lastModified = lastModified;
        entry.nextRetryAt = null;
    } else {
        entry.consecutiveFailures = (entry.consecutiveFailures || 0) + 1;
        entry.lastError = error ? String(error).slice(0, 300) : 'Transport error';
        entry.errorCategory = errorCategory || (httpStatus >= 500 ? 'HTTP_SERVER_ERROR' : (httpStatus >= 400 ? 'HTTP_CLIENT_ERROR' : 'NETWORK_ERROR'));

        // Thresholds: >= 3 consecutive failures = failed, 1-2 = degraded
        if (entry.consecutiveFailures >= 3) {
            entry.status = 'failed';
        } else {
            entry.status = 'degraded';
        }

        // Compute nextRetryAt with exponential backoff & jitter or Retry-After
        if (retryAfterMs) {
            entry.nextRetryAt = new Date(Date.now() + retryAfterMs).toISOString();
        } else {
            const backoffMinutes = Math.min(1440, Math.pow(2, entry.consecutiveFailures) * 15);
            const jitterMs = Math.floor(Math.random() * 60000);
            entry.nextRetryAt = new Date(Date.now() + (backoffMinutes * 60 * 1000) + jitterMs).toISOString();
        }
    }

    // Delayed evaluation: if status is healthy but exceeded interval * 3
    if (entry.status === 'healthy' && entry.lastSuccessAt) {
        const elapsedMin = (Date.now() - new Date(entry.lastSuccessAt).getTime()) / (1000 * 60);
        if (elapsedMin > (entry.expectedIntervalMinutes || 60) * 3) {
            entry.status = 'delayed';
        }
    }

    persistHealth();
    return entry;
}

/**
 * Returns dynamic, authentic collection health status for a record.
 */
export function resolveDynamicHealth(health, registryEntry) {
    if (!registryEntry.enabled) {
        return 'disabled';
    }
    if (!health || (!health.lastAttemptAt && !health.lastSuccessAt)) {
        return 'unknown';
    }
    if (health.consecutiveFailures >= 3) {
        return 'failed';
    }
    if (health.consecutiveFailures > 0) {
        return 'degraded';
    }
    if (health.lastSuccessAt) {
        const elapsedMin = (Date.now() - new Date(health.lastSuccessAt).getTime()) / (1000 * 60);
        const interval = health.expectedIntervalMinutes || registryEntry.expectedIntervalMinutes || 60;
        if (elapsedMin > interval * 3) {
            return 'delayed';
        }
        return 'healthy';
    }
    return health.status || 'unknown';
}

/**
 * Evaluates publication freshness separately from collection health.
 */
export function resolvePublicationFreshness(latestPublicationAt) {
    if (!latestPublicationAt) return 'unknown';
    const pubTime = new Date(latestPublicationAt).getTime();
    if (isNaN(pubTime)) return 'unknown';
    const daysOld = (Date.now() - pubTime) / (1000 * 60 * 60 * 24);
    if (daysOld <= 7) return 'fresh';
    if (daysOld <= 60) return 'active';
    if (daysOld <= 180) return 'inactive';
    return 'dormant';
}

/**
 * Returns combined source records with authentic health.
 */
export function getFeedHealthRecords({
    category = null,
    health = null,
    reviewState = null,
    permissionStatus = null,
    search = null,
    language = null,
    page = 1,
    limit = 50
} = {}) {
    const registry = getSourcesRegistry();
    let records = registry.map(s => {
        const h = healthMap.get(s.id);
        const dynamicStatus = resolveDynamicHealth(h, s);
        const freshness = resolvePublicationFreshness(h?.latestPublicationAt || s.latestPublicationAt);

        return {
            id: s.id,
            name: s.name,
            feedUrl: s.feedUrl,
            canonicalUrl: s.canonicalUrl,
            websiteUrl: s.websiteUrl,
            category: s.category,
            language: s.language || 'en',
            publisherDomain: s.publisherDomain,
            provenance: s.provenance,
            reviewState: s.reviewState,
            enabled: s.enabled,
            status: dynamicStatus,
            publicationFreshness: freshness,
            replacementNotes: s.replacementNotes || null,
            retirementReason: s.retirementReason || null,
            rejectionReason: s.rejectionReason || null,
            errorCategory: s.errorCategory || h?.errorCategory || null,
            health: {
                sourceId: s.id,
                status: dynamicStatus,
                lastAttemptAt: h?.lastAttemptAt || s.lastAttemptAt || null,
                lastSuccessAt: h?.lastSuccessAt || s.lastSuccessAt || null,
                lastHttpStatus: h?.lastHttpStatus !== undefined ? h.lastHttpStatus : (s.lastHttpStatus !== undefined ? s.lastHttpStatus : null),
                consecutiveFailures: h?.consecutiveFailures || s.consecutiveFailures || 0,
                averageLatencyMs: h?.averageLatencyMs || null,
                itemsLast24Hours: h?.itemsLast24Hours || 0,
                itemsTotal: h?.itemsTotal || 0,
                latestPublicationAt: h?.latestPublicationAt || s.latestPublicationAt || null,
                lastError: h?.lastError || s.retirementReason || s.rejectionReason || null,
                errorCategory: h?.errorCategory || s.errorCategory || null,
                nextRetryAt: h?.nextRetryAt || null
            },
            permission: getSourcePermission(s.id) || null
        };
    });

    // Apply Filters
    if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        records = records.filter(r =>
            r.name.toLowerCase().includes(q) ||
            r.publisherDomain.toLowerCase().includes(q) ||
            r.feedUrl.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)
        );
    }

    if (category && category !== 'all') {
        records = records.filter(r => r.category.toLowerCase() === category.toLowerCase());
    }

    if (health && health !== 'all') {
        records = records.filter(r => r.status.toLowerCase() === health.toLowerCase());
    }

    if (reviewState && reviewState !== 'all') {
        records = records.filter(r => r.reviewState.toLowerCase() === reviewState.toLowerCase());
    }

    if (permissionStatus && permissionStatus !== 'all') {
        records = records.filter(r => {
            const pStatus = r.permission?.permissionStatus?.toLowerCase();
            return pStatus === permissionStatus.toLowerCase();
        });
    }

    if (language && language !== 'all') {
        records = records.filter(r => r.language.toLowerCase() === language.toLowerCase());
    }

    const totalCount = records.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginated = records.slice((page - 1) * limit, page * limit);

    return {
        records: paginated,
        total: totalCount,
        page,
        limit,
        totalPages
    };
}

/**
 * Returns comprehensive system-wide health and catalog statistics with explicit,
 * mutually exclusive lifecycle, scheduling, operational health, and target progress.
 */
export function getFeedHealthStats() {
    const registry = getSourcesRegistry();
    const stats = {
        registered: registry.length,
        enabled: 0,
        disabled: 0,

        // Lifecycle / Review states (Mutually exclusive: sum === registered)
        approved: 0,
        candidate: 0,
        quarantined: 0,
        retired: 0,
        rejected: 0,

        // Overall health buckets (Legacy backward-compatible)
        healthy: 0,
        delayed: 0,
        degraded: 0,
        failed: 0,
        unknown: 0,
        attentionRequired: 0,

        // Operational health for actively enabled/scheduled sources
        activeHealthy: 0,
        activeDelayed: 0,
        activeDegraded: 0,
        activeFailed: 0,
        activeUnknown: 0,

        // Attribution
        distinctDomains: 0,
        distinctPublishers: 0,

        // Target progress (1,000 Verified Operational Endpoints)
        targetSources: 1000,
        verifiedSources: 0,
        targetProgressPercent: 0,
        remainingGap: 0,

        // Backward compatibility
        configured: registry.length
    };

    const domains = new Set();
    const publishers = new Set();
    const categories = {};

    for (const s of registry) {
        if (s.publisherDomain) domains.add(s.publisherDomain.toLowerCase());
        publishers.add((s.name || s.publisherDomain || 'unknown').toLowerCase().trim());
        categories[s.category] = (categories[s.category] || 0) + 1;

        // 1. Scheduling State
        if (s.enabled) {
            stats.enabled++;
        } else {
            stats.disabled++;
        }

        // 2. Lifecycle / Review State
        if (s.reviewState === 'approved') stats.approved++;
        else if (s.reviewState === 'candidate') stats.candidate++;
        else if (s.reviewState === 'quarantined') stats.quarantined++;
        else if (s.reviewState === 'retired') stats.retired++;
        else if (s.reviewState === 'rejected') stats.rejected++;
        else stats.candidate++; // safe fallback

        // 3. Operational Health
        const h = healthMap.get(s.id);
        const dynamicStatus = resolveDynamicHealth(h, s);

        if (dynamicStatus !== 'disabled') {
            if (dynamicStatus in stats) {
                stats[dynamicStatus]++;
            } else {
                stats.unknown++;
            }
        }

        // Operational health specific to enabled feeds
        if (s.enabled) {
            if (dynamicStatus === 'healthy') stats.activeHealthy++;
            else if (dynamicStatus === 'delayed') stats.activeDelayed++;
            else if (dynamicStatus === 'degraded') stats.activeDegraded++;
            else if (dynamicStatus === 'failed') stats.activeFailed++;
            else stats.activeUnknown++;
        }
    }

    stats.configured = stats.registered;
    stats.attentionRequired = stats.degraded + stats.failed;
    stats.distinctDomains = domains.size;
    stats.distinctPublishers = publishers.size;

    // Strict Qualification toward 1,000 Target:
    // Requires: approved, enabled, valid permission, passed technical validation, no sustained failures
    let qualifiedCount = 0;
    for (const s of registry) {
        if (s.reviewState === 'approved' && s.enabled) {
            const h = healthMap.get(s.id);
            const perm = getSourcePermission(s.id);
            const isPermitted = perm?.permissionOutcome === 'permitted_for_intended_use';
            const isTechnicallySound = h && (h.status === 'healthy' || h.status === 'delayed' || h.lastSuccessAt) && (h.consecutiveFailures < 3);
            if (isPermitted && isTechnicallySound) {
                qualifiedCount++;
            }
        }
    }

    stats.qualifiedSources = qualifiedCount;
    stats.verifiedSources = qualifiedCount;
    stats.targetProgressPercent = stats.targetSources > 0
        ? Number(((stats.qualifiedSources / stats.targetSources) * 100).toFixed(1))
        : 0;
    stats.remainingGap = Math.max(0, stats.targetSources - stats.qualifiedSources);

    const activeHealthRatePercent = stats.enabled > 0
        ? Number(((stats.activeHealthy / stats.enabled) * 100).toFixed(1))
        : 0;

    return {
        ...stats,
        categories,
        lifecycle: {
            total: stats.registered,
            registered: stats.registered,
            approved: stats.approved,
            candidate: stats.candidate,
            quarantined: stats.quarantined,
            retired: stats.retired,
            rejected: stats.rejected,
            isReconciled: stats.registered === (stats.approved + stats.candidate + stats.quarantined + stats.retired + stats.rejected),
            unaccounted: stats.registered - (stats.approved + stats.candidate + stats.quarantined + stats.retired + stats.rejected)
        },
        scheduling: {
            total: stats.registered,
            enabled: stats.enabled,
            disabled: stats.disabled,
            isReconciled: stats.registered === (stats.enabled + stats.disabled),
            unaccounted: stats.registered - (stats.enabled + stats.disabled)
        },
        activeHealth: {
            totalActive: stats.enabled,
            denominator: stats.enabled,
            numerator: stats.activeHealthy,
            healthy: stats.activeHealthy,
            delayed: stats.activeDelayed,
            degraded: stats.activeDegraded,
            failed: stats.activeFailed,
            unknown: stats.activeUnknown,
            ratePercent: activeHealthRatePercent,
            healthyRatePercent: activeHealthRatePercent,
            formattedLabel: `${stats.activeHealthy} / ${stats.enabled} (${activeHealthRatePercent}%)`,
            label: `${stats.activeHealthy} / ${stats.enabled} active feeds healthy (${activeHealthRatePercent}%)`
        },
        targetProgress: {
            target: stats.targetSources,
            verified: stats.verifiedSources,
            qualified: stats.qualifiedSources,
            percent: stats.targetProgressPercent,
            remainingGap: stats.remainingGap,
            label: `${stats.qualifiedSources} / ${stats.targetSources} qualified operational endpoints (${stats.targetProgressPercent}%)`
        },
        permissions: getPermissionStats(),
        snapshotGeneratedAt: new Date().toISOString()
    };
}
