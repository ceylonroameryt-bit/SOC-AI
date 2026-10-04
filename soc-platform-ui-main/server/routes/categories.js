/**
 * routes/categories.js
 * Express router for Threat Intelligence Category Counts & Taxonomy Metadata.
 * Queries authoritative database and honors global time range filter.
 */

import express from 'express';
import { getNews } from '../services/newsService.js';
import { INTEL_CATEGORIES } from '../services/classificationEngine.js';

const router = express.Router();

/**
 * GET /api/categories/counts
 * Returns per-category counts computed across the authoritative store.
 */
router.get('/counts', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const news = await getNews({ limit: 500, timeRange, isDemoEnabled });

        const counts = {};
        for (const id of Object.keys(INTEL_CATEGORIES)) {
            counts[id] = 0;
        }

        let total = 0;
        for (const item of (news || [])) {
            const cat = item.intelCategory || 'needs-classification';
            if (counts[cat] !== undefined) {
                counts[cat]++;
            } else {
                counts['needs-classification'] = (counts['needs-classification'] || 0) + 1;
            }
            total++;
        }

        const result = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({
            id,
            displayName,
            count: counts[id] || 0,
        }));

        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        res.json({ total, categories: result });
    } catch (err) {
        console.error('[CATEGORIES] Error computing category counts:', err);
        res.status(500).json({ success: false, code: 'CATEGORIES_ERROR', error: 'Failed to compute category counts.' });
    }
});

/**
 * GET /api/categories
 * Returns the full taxonomy definition (IDs + display names).
 */
router.get('/', (_req, res) => {
    const taxonomy = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({ id, displayName }));
    res.json({ taxonomyVersion: 'v1.0', categories: taxonomy });
});

export default router;
