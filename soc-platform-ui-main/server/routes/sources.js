import express from 'express';
import {
    getFeedHealthRecords,
    getFeedHealthStats,
    getUniqueSources
} from '../services/feedHealthService.js';

const router = express.Router();

/**
 * GET /api/sources
 * Returns unique configured threat intelligence sources with measured collection health.
 * Supports query params: search, category, health, reviewState, language, page, limit, paginated.
 */
router.get('/', (req, res) => {
    try {
        const { search, category, health, reviewState, language, page, limit, paginated } = req.query;

        if (paginated === 'true' || (page && limit)) {
            const result = getFeedHealthRecords({
                search,
                category,
                health,
                reviewState,
                language,
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || 50
            });
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            return res.json(result);
        }

        // Return array of all matching records (backward compatible with existing callers & tests)
        const result = getFeedHealthRecords({
            search,
            category,
            health,
            reviewState,
            language,
            page: 1,
            limit: 5000
        });
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json(result.records);
    } catch (error) {
        console.error('[SOURCES ROUTE] Error reading sources:', error);
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
});

/**
 * GET /api/sources/stats
 * Returns category distribution, review states, progress toward 1,000 target, and measured health.
 */
router.get('/stats', (req, res) => {
    try {
        const healthStats = getFeedHealthStats();
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json({
            total: healthStats.registered,
            ...healthStats
        });
    } catch (error) {
        console.error('[SOURCES ROUTE] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch source stats' });
    }
});

/**
 * GET /api/sources/health
 * Returns measured health telemetry list for all feeds.
 */
router.get('/health', (req, res) => {
    try {
        const stats = getFeedHealthStats();
        const recordsResult = getFeedHealthRecords({ page: 1, limit: 5000 });
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json({
            summary: stats,
            sources: recordsResult.records
        });
    } catch (error) {
        console.error('[SOURCES ROUTE] Error retrieving health:', error);
        res.status(500).json({ error: 'Failed to retrieve feed health telemetry' });
    }
});

export default router;
