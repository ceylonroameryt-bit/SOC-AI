/**
 * permissionService.js — Source Permission & Legal Rights Management
 *
 * Implements:
 * - Granular permission recording for all catalogued threat intelligence feeds
 * - Validation of permitted operations (fetching, caching, storing, summarizing, AI processing, display, export)
 * - Enforcement of content scopes (snippet_only vs full text, images, logos)
 * - Mandatory attribution and canonical original-link enforcement
 * - Separation of technical approval from legal reuse permission
 * - Routing of ambiguous cases to pending review
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERMISSIONS_FILE = path.join(__dirname, '../data/source_permissions.json');
const REGISTRY_FILE = path.join(__dirname, '../data/sources_registry.json');

// In-memory permissions cache: sourceId -> PermissionRecord
let permissionsMap = new Map();

/**
 * Load all source permission records from persistent storage.
 * Returns array of permission records.
 */
export function loadPermissions() {
    if (fs.existsSync(PERMISSIONS_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
            permissionsMap.clear();
            for (const item of raw) {
                if (item && item.sourceId) {
                    permissionsMap.set(item.sourceId, item);
                }
            }
            return Array.from(permissionsMap.values());
        } catch (err) {
            console.error('[PERMISSION SERVICE] Error reading source_permissions.json:', err.message);
        }
    }
    return Array.from(permissionsMap.values());
}

// Initialise on load
loadPermissions();

/**
 * Persist permissions to disk atomically.
 */
export function savePermissions() {
    try {
        const list = Array.from(permissionsMap.values());
        const tmp = `${PERMISSIONS_FILE}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
        fs.renameSync(tmp, PERMISSIONS_FILE);
    } catch (err) {
        console.error('[PERMISSION SERVICE] Error saving source_permissions.json:', err.message);
        try {
            fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(Array.from(permissionsMap.values()), null, 2), 'utf8');
        } catch (e) {
            console.error('[PERMISSION SERVICE] Fallback save failed:', e.message);
        }
    }
}

/**
 * Retrieve permission record for a specific source ID.
 * Returns normalized canonical schema: permissionOutcome, permissionStatus, rules, requirements.
 */
export function getSourcePermission(sourceId) {
    if (permissionsMap.size === 0) loadPermissions();
    const raw = permissionsMap.get(sourceId);
    if (!raw) return null;

    let outcome = raw.permissionOutcome || raw.permissionStatus || 'pending';
    // Do not call something Permitted when fetching or displaying is prohibited
    if (outcome === 'permitted_for_intended_use' || outcome === 'permitted_intended_use') {
        if (raw.rules?.fetchingPermitted === false || raw.rules?.displayingPermitted === false) {
            outcome = 'restricted';
        }
    }

    const rules = {
        fetchingPermitted: raw.rules?.fetchingPermitted !== false,
        cachingPermitted: raw.rules?.cachingPermitted !== false,
        storingPermitted: raw.rules?.storingPermitted !== false,
        summarizingPermitted: raw.rules?.summarizingPermitted !== false,
        aiProcessingPermitted: raw.rules?.aiProcessingPermitted === true,
        displayingPermitted: raw.rules?.displayingPermitted !== false,
        exportingPermitted: raw.rules?.exportingPermitted === true,
        commercialUsePermitted: raw.rules?.commercialUsePermitted === true,
        ...(raw.rules || {})
    };

    const requirements = {
        attributionRequired: raw.requirements?.attributionRequired !== false,
        originalLinkRequired: raw.requirements?.originalLinkRequired !== false,
        retentionDaysLimit: raw.requirements?.retentionDaysLimit || 365,
        rateLimitPerMinute: raw.requirements?.rateLimitPerMinute || 60,
        maxSummaryLength: raw.requirements?.maxSummaryLength || 500,
        ...(raw.requirements || {})
    };

    return {
        ...raw,
        permissionOutcome: outcome,
        permissionStatus: outcome === 'permitted_for_intended_use' ? 'permitted_intended_use' : outcome,
        rules,
        requirements,
        attributionRequired: requirements.attributionRequired
    };
}

/**
 * Check if a source is permitted for the documented intended platform use.
 * Strictly verifies fetchingPermitted and displayingPermitted.
 */
export function isPermittedForIntendedUse(sourceId) {
    const perm = getSourcePermission(sourceId);
    if (!perm) return false;
    return (perm.permissionOutcome === 'permitted_for_intended_use' || perm.permissionOutcome === 'permitted_intended_use') &&
        perm.rules?.fetchingPermitted === true &&
        perm.rules?.displayingPermitted === true;
}

/**
 * Check whether AI processing / summarization is permitted for this source.
 */
export function isAiProcessingPermitted(sourceId) {
    const perm = getSourcePermission(sourceId);
    if (!perm) return false;
    return perm.rules?.aiProcessingPermitted === true;
}

/**
 * Check whether external redistribution or export is permitted.
 */
export function isExportPermitted(sourceId) {
    const perm = getSourcePermission(sourceId);
    if (!perm) return false;
    return perm.rules?.exportingPermitted === true;
}

/**
 * Sanitize and enforce content restrictions on an ingested article.
 * Enforces snippet-only truncation, attribution backlink, and image/logo suppression.
 */
export function enforceContentRestrictions(article, sourceId) {
    const perm = getSourcePermission(sourceId);
    const scope = perm?.contentScopes?.text || 'snippet_only';

    const safeArticle = { ...article };

    // 1. Mandatory Canonical Attribution
    safeArticle.attributionRequired = perm?.requirements?.attributionRequired !== false;
    safeArticle.canonicalUrl = safeArticle.link || perm?.publisherDomain || null;
    safeArticle.attribution = {
        source: safeArticle.source || perm?.publisherName || 'Threat Intelligence Publisher',
        originalUrl: safeArticle.link,
        domain: perm?.publisherDomain || null,
        requiredAttributionText: `Source: ${safeArticle.source || perm?.publisherName || 'Publisher'}. Read the full report at ${safeArticle.link}`,
        license: perm?.licenseType || 'Standard Publisher Web Syndication',
    };

    // 2. Enforce text scope and snippet limits
    const maxLen = perm?.requirements?.maxSummaryLength || (scope === 'headline_only' ? 0 : 500);

    if (scope === 'headline_only') {
        safeArticle.contentSnippet = '';
        safeArticle.snippet = '';
        safeArticle.content = '';
    } else {
        if (safeArticle.snippet && safeArticle.snippet.length > maxLen) {
            safeArticle.snippet = `${safeArticle.snippet.slice(0, maxLen - 3)}...`;
        }
        if (safeArticle.contentSnippet && safeArticle.contentSnippet.length > maxLen) {
            safeArticle.contentSnippet = `${safeArticle.contentSnippet.slice(0, maxLen - 3)}...`;
        }
        if (safeArticle.content && safeArticle.content.length > maxLen) {
            safeArticle.content = `${safeArticle.content.slice(0, maxLen - 3)}...`;
        }
    }

    // 3. Suppress images and logos if not explicitly licensed
    if (!perm?.contentScopes?.images) {
        safeArticle.imageUrl = null;
        safeArticle.enclosure = null;
    }
    if (!perm?.contentScopes?.logos) {
        safeArticle.sourceLogoUrl = null;
    }

    return safeArticle;
}

/**
 * Returns comprehensive statistics on the permissions registry.
 */
export function getPermissionStats() {
    if (permissionsMap.size === 0) loadPermissions();
    const records = Array.from(permissionsMap.values());

    const stats = {
        total: records.length,
        totalEvaluated: records.length,
        permitted: 0,
        permitted_intended_use: 0,
        restricted: 0,
        denied: 0,
        pending: 0,
        byBasis: {
            applicable_license: 0,
            explicit_terms: 0,
            written_permission: 0,
            documented_legal_assessment: 0,
            pending_evaluation: 0
        },
        byLicenseType: {},
        commercialUsePermitted: 0,
        nonCommercialOnly: 0,
        snippetOnlyEnforced: 0,
        attributionMandated: 0,
    };

    for (const r of records) {
        if (r.permissionOutcome === 'permitted_for_intended_use') stats.permitted++;
        else if (r.permissionOutcome === 'restricted') stats.restricted++;
        else if (r.permissionOutcome === 'denied') stats.denied++;
        else stats.pending++;

        if (r.permissionBasis && r.permissionBasis in stats.byBasis) {
            stats.byBasis[r.permissionBasis]++;
        } else {
            stats.byBasis.pending_evaluation++;
        }

        const lic = r.licenseType || 'Unspecified';
        stats.byLicenseType[lic] = (stats.byLicenseType[lic] || 0) + 1;

        if (r.rules?.commercialUsePermitted) stats.commercialUsePermitted++;
        else stats.nonCommercialOnly++;

        if (r.contentScopes?.text === 'snippet_only') stats.snippetOnlyEnforced++;
        if (r.requirements?.attributionRequired) stats.attributionMandated++;
    }

    stats.permitted_intended_use = stats.permitted;
    return stats;
}
