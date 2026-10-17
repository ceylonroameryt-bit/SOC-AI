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

import { deduplicateArticles } from './articleIdentity.js';

let sharedNews = null;
export function setSharedNews(records) {
    sharedNews = records === null ? null : deduplicateArticles(records);
}

const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'TacticLensBot/1.0 (+https://tacticlens.co.uk/bot)' }
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
export const getNews = (options = {}) => {
    if (sharedNews !== null) {
        let result = sharedNews;
        if (options && typeof options === 'object') {
            if (options.limit) result = result.slice(0, options.limit);
        }
        return result;
    }
    const isDemoEnabled = options?.isDemoEnabled ?? (process.env.ENABLE_DEMO_DATA === 'true');
    return getArticles({
        limit: options?.limit || 100,
        offset: options?.offset || 0,
        severity: options?.severity || null,
        category: options?.category || null,
        intelCategory: options?.intelCategory || null,
        timeRange: options?.timeRange || '24h',
        q: options?.q || null,
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

    const raw = getNews();
    let records = Array.isArray(raw) ? raw : [];

    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs   = dateTo   ? new Date(dateTo).getTime()   : null;
    const hasDateFilter = fromMs !== null || toMs !== null;

    if (hasDateFilter) {
        records = records.filter(item => {
            if (!item.pubDate) return false;
            const ms = new Date(item.pubDate).getTime();
            if (isNaN(ms)) return false;
            if (fromMs !== null && ms < fromMs) return false;
            if (toMs   !== null && ms >= toMs)  return false;
            return true;
        });
    }

    if (q && q.trim()) {
        const lower = q.toLowerCase();
        records = records.filter(item =>
            (item.title  || '').toLowerCase().includes(lower) ||
            (item.contentSnippet || '').toLowerCase().includes(lower) ||
            (item.source || '').toLowerCase().includes(lower)
        );
    }

    if (source && source !== 'all') {
        const srcLower = source.toLowerCase();
        records = records.filter(item => (item.source || '').toLowerCase().includes(srcLower));
    }

    if (category && category !== 'all') {
        const catLower = category.toLowerCase();
        records = records.filter(item =>
            (item.intelCategory || item.category || '').toLowerCase() === catLower
        );
    }

    if (severity && severity !== 'all') {
        records = records.filter(item => (item.severity || '').toLowerCase() === severity.toLowerCase());
    }

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

    if (mappedOnly === 'true') {
        records = records.filter(item => Array.isArray(item.mitreTechniques) && item.mitreTechniques.length > 0);
    } else if (mappedOnly === 'false') {
        records = records.filter(item => !Array.isArray(item.mitreTechniques) || item.mitreTechniques.length === 0);
    }

    records = [...records];
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

    const all = Array.isArray(raw) ? raw : [];
    const datedAll = all.filter(n => n.pubDate).map(n => new Date(n.pubDate).getTime()).filter(ms => !isNaN(ms));
    const archiveCoverage = {
        oldest: datedAll.length ? new Date(Math.min(...datedAll)).toISOString() : null,
        newest: datedAll.length ? new Date(Math.max(...datedAll)).toISOString() : null,
        total: all.length,
    };

    return { records: paged, total, page: safePage, totalPages, archiveCoverage };
}

