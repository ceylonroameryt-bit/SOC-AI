/**
 * routes/news.js
 * Express router for Threat Intelligence Articles & Taxonomy Filtering.
 * Backed by PostgreSQL authoritative store and respects the global time range filter.
 */

import express from 'express';
import { getNews, fetchAndProcessNews, getSeverityStats } from '../services/newsService.js';

const router = express.Router();

/**
 * GET /api/news
 * Returns paginated intelligence articles filtered by severity, category, intelCategory, timeRange, and keyword search.
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        const severity = req.query.severity || null;
        const category = req.query.category || null;
        const intelCategory = req.query.intelCategory || null;
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const q = req.query.q || null;
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';

        const news = await getNews({
            limit,
            offset,
            severity,
            category,
            intelCategory,
            timeRange,
            q,
            isDemoEnabled
        });

        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        res.json(news);
    } catch (err) {
        console.error('[NEWS ROUTE] Error retrieving news feed:', err);
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to retrieve news feed.' });
    }
});

/**
 * POST /api/news/refresh
 * Protected feed collection trigger.
 * Rejects unauthenticated requests to prevent anonymous denial-of-service on external feeds.
 */
router.post('/refresh', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    const validKey = process.env.INGEST_API_KEY;

    if (!validKey || apiKey !== validKey) {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            error: 'Authentication required. Administrative API key required to trigger external source collection.'
        });
    }

    try {
        const news = await fetchAndProcessNews();
        res.json({ success: true, count: news.length, message: 'Feeds successfully collected and indexed.' });
    } catch (err) {
        console.error('[NEWS REFRESH ERROR]', err);
        res.status(500).json({ success: false, code: 'REFRESH_ERROR', error: 'Failed to refresh feeds.', details: err.message });
    }
});

/**
 * GET /api/news/stats
 * Returns severity aggregation counts for the selected time window.
 */
router.get('/stats', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const stats = await getSeverityStats(timeRange);
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        res.json(stats);
    } catch (err) {
        console.error('[NEWS STATS ERROR]', err);
        res.status(500).json({ success: false, code: 'STATS_ERROR', error: 'Failed to retrieve severity statistics.' });
    }
});

export default router;
