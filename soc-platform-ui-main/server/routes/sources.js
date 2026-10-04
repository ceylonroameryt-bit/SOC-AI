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
 */
router.get('/', (req, res) => {
    try {
        const sourcesWithHealth = getFeedHealthRecords();
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        res.json(sourcesWithHealth);
    } catch (error) {
        console.error('[SOURCES ROUTE] Error reading sources:', error);
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
});

/**
 * GET /api/sources/stats
 * Returns category distribution and measured operational health status.
 */
router.get('/stats', (req, res) => {
    try {
        const records = getFeedHealthRecords();
        const healthStats = getFeedHealthStats();

        const categories = records.reduce((acc, source) => {
            const cat = source.category || 'General';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});

        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        res.json({
            total: records.length,
            health: healthStats,
            categories,
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
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json({
            summary: stats,
            sources: getFeedHealthRecords()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve feed health telemetry' });
    }
});

export default router;
