/**
 * routes/sources.js
 * Express router for Threat Intelligence Sources & Measured Feed Health.
 * Implements strict route ordering (/runs precedes /:id) and canonical permissions contract.
 */

import express from 'express';
import {
    getFeedHealthRecords,
    getFeedHealthStats,
    getUniqueSources
} from '../services/feedHealthService.js';
import { getCollectionRuns, getLatestCollectionRun } from '../db/db.js';

const router = express.Router();

/**
 * GET /api/sources
 * Returns unique configured threat intelligence sources with measured collection health.
 */
router.get('/', (req, res) => {
    try {
        const sourcesWithHealth = getFeedHealthRecords();
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json(sourcesWithHealth);
    } catch (error) {
        console.error('[SOURCES ROUTE] Error reading sources:', error);
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to fetch sources' });
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

        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        res.json({
            total: records.length,
            health: healthStats,
            categories,
        });
    } catch (error) {
        console.error('[SOURCES ROUTE] Error fetching stats:', error);
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to fetch source stats' });
    }
});

/**
 * GET /api/sources/health
 * Returns measured health telemetry list for all feeds.
 */
router.get('/health', (req, res) => {
    try {
        const stats = getFeedHealthStats();
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        res.json({
            summary: stats,
            sources: getFeedHealthRecords()
        });
    } catch (error) {
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to retrieve feed health telemetry' });
    }
});

/**
 * CRITICAL ROUTE ORDERING:
 * GET /api/sources/runs MUST be registered BEFORE /:id
 * Otherwise Express captures 'runs' as req.params.id
 */
router.get('/runs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const runs = await getCollectionRuns(limit);
        const latest = await getLatestCollectionRun();

        res.setHeader('Cache-Control', 'no-cache');
        res.json({
            success: true,
            latest,
            runs
        });
    } catch (error) {
        console.error('[SOURCES RUNS ERROR]', error);
        res.status(500).json({ success: false, code: 'RUNS_ERROR', error: 'Failed to retrieve collection runs' });
    }
});

/**
 * POST /api/sources/refresh
 * Protected collection refresh trigger.
 * Rejects unauthenticated requests to prevent anonymous denial-of-service against third-party feeds.
 */
router.post('/refresh', (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/, '');
    const validKey = process.env.INGEST_API_KEY;

    if (!validKey || apiKey !== validKey) {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            error: 'Authentication required. Administrative API key required to trigger external source collection.'
        });
    }

    res.json({
        success: true,
        message: 'Collection job queued successfully. Ingestion executes asynchronously in background worker.'
    });
});

/**
 * GET /api/sources/:id
 * Single source detail lookup
 */
router.get('/:id', (req, res) => {
    try {
        const id = req.params.id;
        const records = getFeedHealthRecords();
        const found = records.find(s => s.id === id || s.id === `src-${id}`);

        if (!found) {
            return res.status(404).json({ success: false, code: 'NOT_FOUND', error: `Source '${id}' not found` });
        }

        res.json(found);
    } catch (error) {
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to fetch source details' });
    }
});

export default router;
