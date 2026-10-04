/**
 * server/services/ingestion/articlePipeline.js
 * Deterministic article processing pipeline:
 * Validation -> Normalization -> Deduplication -> Severity -> Classification -> DB Persistence -> IOC Batching -> MITRE Tagging.
 */

import { assessSeverity } from '../severityEngine.js';
import { classifyRecord } from '../classificationEngine.js';
import { extractIOCs } from '../enrichmentService.js';
import { mapTextToTechniques } from '../mitreService.js';
import { normalizeUrl } from './urlNormalizer.js';
import { insertArticle, insertIocsBatch, isDbConnected } from '../../db/db.js';

/**
 * Validates basic required fields of a raw article.
 * @param {object} raw 
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateArticle(raw) {
    if (!raw) return { valid: false, reason: 'Null or undefined article' };
    if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
        return { valid: false, reason: 'Missing or empty title' };
    }
    if (!raw.link || typeof raw.link !== 'string' || !raw.link.trim()) {
        return { valid: false, reason: 'Missing or empty link' };
    }
    return { valid: true };
}

/**
 * Parses and sanitizes article publication date.
 * Enforces: missing date -> null; future date (>24h) -> dateAnomaly: true.
 * @param {string|Date} rawDate 
 * @returns {{ publishedAt: string|null, dateAnomaly: boolean }}
 */
export function sanitizePublicationDate(rawDate) {
    if (!rawDate) {
        return { publishedAt: null, dateAnomaly: false };
    }

    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) {
        return { publishedAt: null, dateAnomaly: false };
    }

    const now = Date.now();
    // Tolerance: 24 hours in the future
    if (parsed.getTime() > now + 24 * 60 * 60 * 1000) {
        return {
            publishedAt: new Date(now).toISOString(),
            dateAnomaly: true
        };
    }

    return {
        publishedAt: parsed.toISOString(),
        dateAnomaly: false
    };
}

/**
 * Derives evidence status from text and classification.
 */
export function deriveEvidenceStatus(title, snippet, classification) {
    if (classification.evidenceStatus && classification.evidenceStatus !== 'unassessed') {
        return classification.evidenceStatus;
    }
    const text = `${title} ${snippet}`.toLowerCase();
    if (text.includes('claim') || text.includes('alleged') || text.includes('leak site')) {
        return 'unverified-claim';
    }
    if (text.includes('advisory') || text.includes('cisa') || text.includes('bulletin')) {
        return 'advisory';
    }
    if (text.includes('confirmed') || text.includes('patch available') || text.includes('cve-')) {
        return 'verified';
    }
    return 'unassessed';
}

/**
 * Processes a single feed article through the full ingestion pipeline.
 * @param {object} item Raw parsed feed item
 * @param {object} source Source metadata
 * @param {object} deduplicator IngestionDeduplicator instance
 * @param {boolean} isDryRun
 * @returns {Promise<{ status: 'inserted'|'duplicate'|'updated'|'rejected', articleId?: string, reason?: string }>}
 */
export async function processArticle(item, source, deduplicator, isDryRun = false) {
    // 1. Validation
    const validation = validateArticle(item);
    if (!validation.valid) {
        return { status: 'rejected', reason: validation.reason };
    }

    const title = item.title.trim();
    const rawLink = item.link.trim();
    const normalizedLink = normalizeUrl(rawLink);

    // 2. Pre-deduplication check in current run
    if (deduplicator) {
        const dedupCheck = deduplicator.checkAndRegister(rawLink, title);
        if (dedupCheck.isDuplicate) {
            return { status: 'duplicate', reason: `Deduplicated by ${dedupCheck.matchLayer}` };
        }
    }

    // 3. Date Sanitization
    const { publishedAt, dateAnomaly } = sanitizePublicationDate(item.pubDate);

    // 4. Severity Assessment
    const sevAssessment = assessSeverity({
        title,
        contentSnippet: item.contentSnippet || '',
        source: source.name || ''
    });
    const severity = sevAssessment.severity === 'critical' ? 'Critical'
        : (sevAssessment.severity === 'high' ? 'High'
        : (sevAssessment.severity === 'medium' ? 'Medium'
        : (sevAssessment.severity === 'informational' ? 'Informational' : 'Low')));

    // 5. Taxonomy Classification
    const classification = classifyRecord({
        title,
        contentSnippet: item.contentSnippet || '',
        source: source.name || '',
        category: source.category
    });

    // 6. MITRE ATT&CK Mapping (decoupled: failure here never drops the article)
    let mitreTechniques = [];
    try {
        const textToAnalyze = `${title} ${item.contentSnippet || ''}`;
        mitreTechniques = mapTextToTechniques(textToAnalyze, null, false);
    } catch {
        mitreTechniques = [];
    }

    const evidenceStatus = deriveEvidenceStatus(title, item.contentSnippet || '', classification);

    const articleRecord = {
        title,
        link: rawLink,
        canonicalUrl: normalizedLink,
        pubDate: publishedAt,
        contentSnippet: item.contentSnippet || '',
        content: item.content || item.contentSnippet || '',
        source: source.name || 'Threat Intel Feed',
        sourceId: source.id,
        sourceCategory: source.category || 'General',
        category: source.category || 'General',
        severity,
        intelCategory: classification.intelCategory,
        intelCategoryDisplay: classification.displayName,
        secondaryTopics: classification.secondaryTopics,
        contentType: classification.contentType,
        evidenceStatus,
        classificationMethod: classification.method,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
        taxonomyVersion: classification.taxonomyVersion,
        mitreTechniques,
        dateAnomaly,
        isSimulated: false,
        environment: 'production'
    };

    if (isDryRun) {
        return { status: 'inserted', articleId: 'dry-run-id' };
    }

    // 7. Database Persistence
    const insertResult = await insertArticle(articleRecord);
    if (!insertResult) {
        return { status: 'rejected', reason: 'Database insertion failed' };
    }

    const articleId = typeof insertResult === 'object' ? insertResult.id : insertResult;
    const isInserted = typeof insertResult === 'object' ? insertResult.isInserted : true;
    const isDuplicate = typeof insertResult === 'object' ? insertResult.isDuplicate : false;

    // 8. IOC Extraction & Batch Insertion
    if (articleId && isInserted) {
        try {
            const text = `${articleRecord.title} ${articleRecord.contentSnippet}`;
            const extracted = extractIOCs(text);
            await insertIocsBatch(articleId, extracted);
        } catch (e) {
            console.debug('Failed to batch insert IOCs:', e.message);
        }
    }

    if (isDuplicate) {
        return { status: 'duplicate', articleId, reason: 'Existing canonical URL in database' };
    }

    return { status: 'inserted', articleId };
}
