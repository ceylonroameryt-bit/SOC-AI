/**
 * newsService.js
 * Ingestion and classification pipeline for multi-source threat intelligence.
 * Backed authoritatively by PostgreSQL (with seamless in-memory DAO fallback).
 * Never writes runtime operational state to local JSON files in production.
 */

import Parser from 'rss-parser';
import { getUniqueSources, recordCollectionResult } from './feedHealthService.js';
import { assessSeverity } from './severityEngine.js';
import { classifyRecord, mapLegacyCategory } from './classificationEngine.js';
import { extractIOCs } from './enrichmentService.js';
import {
    insertArticle,
    getArticles,
    getArticleStats,
    isDbConnected,
    query
} from '../db/db.js';

const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'NO-ENTRY-ThreatIntel-Collector/1.0 (+https://github.com/ceylonroameryt-bit/SOC-AI)' }
});

const getFeeds = () => {
    return getUniqueSources().filter(s => s.isEnabled !== false && s.url);
};

const determineSeverity = (title, snippet, source = '') => {
    const assessment = assessSeverity({ title, contentSnippet: snippet, source });
    if (assessment.severity === 'critical') return 'Critical';
    if (assessment.severity === 'high') return 'High';
    if (assessment.severity === 'medium') return 'Medium';
    if (assessment.severity === 'informational') return 'Informational';
    return 'Low';
};

const deriveEvidenceStatus = (title, snippet, classification) => {
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
};

/**
 * Fetch and process external threat intelligence feeds.
 * Persists all accepted intelligence to the authoritative database.
 */
export const fetchAndProcessNews = async () => {
    let newItemsCount = 0;
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';

    try {
        const feeds = getFeeds();
        console.log(`[INGESTION] Fetching from ${feeds.length} configured threat intel sources...`);

        // Bounded concurrency chunks
        const CHUNK_SIZE = 10;
        for (let i = 0; i < feeds.length; i += CHUNK_SIZE) {
            const chunk = feeds.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (sourceObj) => {
                const start = Date.now();
                const sourceId = sourceObj.id;
                try {
                    const parsed = await parser.parseURL(sourceObj.url);
                    const latencyMs = Date.now() - start;
                    const items = parsed?.items || [];
                    const latestPub = items[0]?.pubDate || items[0]?.isoDate || null;
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
                        httpStatus: 500,
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
            const validChunk = chunkResults.filter(Boolean);

            for (const { feed, sourceObj, sourceId, latencyMs, itemsCount, latestPub } of validChunk) {
                let acceptedForFeed = 0;
                let rejectedForFeed = 0;

                for (const item of (feed.items || [])) {
                    if (!item || !item.link || !item.title) {
                        rejectedForFeed++;
                        continue;
                    }

                    const severity = determineSeverity(item.title, item.contentSnippet || '', sourceObj.name || feed.title || '');
                    const classification = classifyRecord({
                        title: item.title,
                        contentSnippet: item.contentSnippet || '',
                        source: sourceObj.name || feed.title || '',
                        category: sourceObj.category
                    });

                    // Validate publication date (Phase 17 & 18)
                    let pubDate = null;
                    let dateAnomaly = false;
                    if (item.pubDate || item.isoDate) {
                        const parsedDate = new Date(item.pubDate || item.isoDate);
                        if (!isNaN(parsedDate.getTime())) {
                            if (parsedDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
                                dateAnomaly = true;
                                pubDate = new Date().toISOString();
                            } else {
                                pubDate = parsedDate.toISOString();
                            }
                        }
                    }

                    const newItem = {
                        title: item.title.trim(),
                        link: item.link.trim(),
                        pubDate: pubDate, // Null if publisher missing
                        contentSnippet: item.contentSnippet || '',
                        content: item.content || item.contentSnippet || '',
                        source: sourceObj.name || feed.title || 'Threat Intel Feed',
                        sourceId,
                        severity,
                        sourceCategory: sourceObj.category || 'General',
                        category: sourceObj.category || 'General',
                        intelCategory: classification.intelCategory,
                        intelCategoryDisplay: classification.displayName,
                        secondaryTopics: classification.secondaryTopics,
                        contentType: classification.contentType,
                        classificationMethod: classification.method,
                        classificationConfidence: classification.confidence,
                        classificationReason: classification.reason,
                        taxonomyVersion: classification.taxonomyVersion,
                        evidenceStatus: deriveEvidenceStatus(item.title, item.contentSnippet || '', classification),
                        dateAnomaly,
                        isSimulated: false,
                        environment: 'production'
                    };

                    try {
                        const articleId = await insertArticle(newItem);
                        if (articleId) {
                            acceptedForFeed++;
                            newItemsCount++;

                            // Extract IOCs and link
                            const text = `${newItem.title} ${newItem.contentSnippet}`;
                            const extracted = extractIOCs(text);
                            if (isDbConnected()) {
                                for (const ip of extracted.ips) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'IPv4', $2) ON CONFLICT DO NOTHING`, [articleId, ip]).catch(() => {});
                                }
                                for (const cve of extracted.cves) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'CVE', $2) ON CONFLICT DO NOTHING`, [articleId, cve]).catch(() => {});
                                }
                                for (const h of extracted.hashes) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'SHA256', $2) ON CONFLICT DO NOTHING`, [articleId, h]).catch(() => {});
                                }
                            }
                        } else {
                            rejectedForFeed++;
                        }
                    } catch {
                        rejectedForFeed++;
                    }
                }

                recordCollectionResult(sourceId, {
                    success: true,
                    httpStatus: 200,
                    latencyMs,
                    itemsCount,
                    itemsAccepted: acceptedForFeed,
                    itemsRejected: rejectedForFeed,
                    latestPubDate: latestPub
                });
            }
        }

        console.log(`[INGESTION] Completed ingestion run. Processed ${newItemsCount} new intelligence articles.`);
        return await getArticles({ limit: 100, isDemoEnabled });
    } catch (error) {
        console.error('[INGESTION] Fatal error in fetchAndProcessNews:', error);
        return await getArticles({ limit: 100, isDemoEnabled });
    }
};

/**
 * Authoritative News Retrieval
 * Queries PostgreSQL / In-Memory DAO with support for timeRange, severity, category, and pagination.
 */
export const getNews = async (options = {}) => {
    const isDemoEnabled = options.isDemoEnabled ?? (process.env.ENABLE_DEMO_DATA === 'true');
    return await getArticles({
        limit: options.limit || 100,
        offset: options.offset || 0,
        severity: options.severity || null,
        category: options.category || null,
        intelCategory: options.intelCategory || null,
        timeRange: options.timeRange || '24h',
        q: options.q || null,
        isDemoEnabled
    });
};

/**
 * Returns severity counts for the selected time window
 */
export const getSeverityStats = async (timeRange = '24h') => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const stats = await getArticleStats(timeRange, isDemoEnabled);
    return [
        { name: 'Critical', value: stats.critical, color: '#ef4444' },
        { name: 'High', value: stats.high, color: '#f97316' },
        { name: 'Medium', value: stats.medium, color: '#eab308' },
        { name: 'Low', value: stats.low, color: '#22c55e' },
        { name: 'Informational', value: stats.informational, color: '#3b82f6' }
    ];
};

export const backfillClassification = () => {
    // No-op for DB-backed architecture since all ingested articles are classified on insert
};
