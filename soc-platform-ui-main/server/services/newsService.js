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

import { executeIngestionCycle } from './ingestion/ingestionEngine.js';

/**
 * Fetch and process external threat intelligence feeds via Central Ingestion Engine.
 * Persists all accepted intelligence to the authoritative database.
 */
export const fetchAndProcessNews = async (options = {}) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';

    try {
        await executeIngestionCycle({
            trigger: options.trigger || 'api',
            force: options.force || false
        });
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
