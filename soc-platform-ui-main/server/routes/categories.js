import express from 'express';
import { getNews } from '../services/newsService.js';
import { INTEL_CATEGORIES } from '../services/classificationEngine.js';

const router = express.Router();

/**
 * GET /api/categories/counts
 * Returns per-category counts computed across the full news cache (not paginated).
 * Category filter is applied BEFORE counting, so callers know what's available.
 * Used by the Intelligence table category dropdown to show live counts.
 */
router.get('/counts', (req, res) => {
    try {
        const news = getNews();

        // Build counts for all taxonomy categories
        const counts = {};
        for (const id of Object.keys(INTEL_CATEGORIES)) {
            counts[id] = 0;
        }

        // Total (unfiltered) count
        let total = 0;

        for (const item of news) {
            const cat = item.intelCategory || 'needs-classification';
            if (counts[cat] !== undefined) {
                counts[cat]++;
            } else {
                counts['needs-classification']++;
            }
            total++;
        }

        // Format as an ordered array for the dropdown
        const result = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({
            id,
            displayName,
            count: counts[id] || 0,
        }));

        res.json({ total, categories: result });
    } catch (err) {
        console.error('[CATEGORIES] Error computing category counts:', err);
        res.status(500).json({ error: 'Failed to compute category counts.' });
    }
});

/**
 * GET /api/categories
 * Returns the full taxonomy definition (IDs + display names), no counts.
 * Used by filter dropdowns that need the label map.
 */
router.get('/', (_req, res) => {
    const taxonomy = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({ id, displayName }));
    res.json({ taxonomyVersion: 'v1.0', categories: taxonomy });
});

export default router;
