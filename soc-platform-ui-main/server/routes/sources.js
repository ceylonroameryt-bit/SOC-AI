import { sharedStorageRequired } from '../services/sharedSnapshotService.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';
import express from 'express';
import {
    getFeedHealthRecords,
    getFeedHealthStats,
    getUniqueSources
} from '../services/feedHealthService.js';
import { getPermissionStats, getSourcePermission } from '../services/permissionService.js';
import { getLatestCollectionRun, getCollectionRunHistory } from '../services/collectionRunService.js';
import { fetchAndProcessNews } from '../services/newsService.js';

const router = express.Router();

/**
 * GET /api/sources
 * Returns unique configured threat intelligence sources with measured collection health.
 * Supports query params: search, category, health, reviewState, language, page, limit, paginated.
 */
router.get('/', (req, res) => {
    try {
        const { search, category, health, reviewState, permissionStatus, language, page, limit, paginated } = req.query;

        if (paginated === 'true' || (page && limit)) {
            const result = getFeedHealthRecords({
                search,
                category,
                health,
                reviewState,
                permissionStatus,
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
            permissionStatus,
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

/**
 * GET /api/sources/permissions
 * Returns permissions matrix summary and breakdown.
 */
router.get('/permissions', (req, res) => {
    try {
        const stats = getPermissionStats();
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        res.json(stats);
    } catch (error) {
        console.error('[SOURCES ROUTE] Error retrieving permissions:', error);
        res.status(500).json({ error: 'Failed to retrieve source permissions' });
    }
});

/**
 * GET /api/sources/:id
 * Returns single source record with full health and permission evidence.
 */
/**
 * GET /api/sources/runs
 * Returns history of background ingestion runs with Section 6 telemetry metrics.
 */
router.get('/runs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const history = getCollectionRunHistory(limit);
        res.setHeader('Cache-Control', 'no-cache');
        res.json({
            total: history.length,
            latest: history[0] || null,
            runs: history
        });
    } catch (error) {
        console.error('[SOURCES ROUTE] Error retrieving run history:', error);
        res.status(500).json({ error: 'Failed to retrieve ingestion runs' });
    }
});

/**
 * GET /api/sources/runs/latest
 * Returns most recent background ingestion run.
 */
router.get('/runs/latest', (req, res) => {
    try {
        const latest = getLatestCollectionRun();
        res.setHeader('Cache-Control', 'no-cache');
        if (!latest) {
            return res.json({ status: 'no_runs_recorded', message: 'No ingestion runs recorded yet.' });
        }
        res.json(latest);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve latest run' });
    }
});

/**
 * POST /api/sources/refresh
 * Triggers an ingestion run for active feeds.
 */
router.post('/refresh', requireApiKeyMiddleware('ADMIN_API_KEY'), async (req, res) => {
    if (sharedStorageRequired()) return res.status(503).json({ error: 'Use the scheduled collector workflow to refresh shared intelligence.', code: 'COLLECTOR_REQUIRED' });
    try {
        const isAsync = req.query.async === 'true';
        if (isAsync) {
            fetchAndProcessNews('manual').catch(err => console.error('[REFRESH ERROR]', err));
            return res.json({
                success: true,
                message: 'Collection job initiated in background.',
                timestamp: new Date().toISOString()
            });
        }

        const news = await fetchAndProcessNews('manual');
        const latest = getLatestCollectionRun();
        res.json({
            success: true,
            message: 'Collection job completed successfully.',
            run: latest,
            totalArticles: news.length
        });
    } catch (error) {
        console.error('[SOURCES ROUTE] Error executing refresh:', error);
        res.status(500).json({ error: 'Failed to execute source refresh', details: error.message });
    }
});

router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const all = getFeedHealthRecords({ page: 1, limit: 5000 });
        const record = all.records.find(s => s.id === id);
        if (!record) {
            return res.status(404).json({ error: 'Source not found in registry' });
        }
        res.setHeader('Cache-Control', 'public, s-maxage=60');
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve source' });
    }
});

export default router;
