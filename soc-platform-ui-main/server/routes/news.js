import { filterByRange, severityStats } from '../services/dashboardEvidence.js';
import express from 'express';
import { fetchAndProcessNews, getAuthoritativeNews } from '../services/newsService.js';
import { classifyRecord, INTEL_CATEGORIES } from '../services/classificationEngine.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';

const router = express.Router();

// Serve authoritative news (PostgreSQL single source of truth with memory cache)
router.get('/', async (req, res) => {
    try {
        const rawNews = await getAuthoritativeNews();
        // P1 item 21: clamp limit 1–1000, default 100
        const rawLimit = parseInt(req.query.limit);
        const limit = Math.min(1000, Math.max(1, isNaN(rawLimit) ? 100 : rawLimit));
        const { severity, category, intelCategory, q } = req.query;

        // Ensure runtime data contract: all records must have classification fields
        const news = rawNews.map(item => {
            if (item.intelCategory && item.classificationMethod) return item;
            const res = classifyRecord(item);
            return {
                ...item,
                sourceCategory: item.sourceCategory || item.category || undefined,
                intelCategory: res.intelCategory,
                intelCategoryDisplay: res.displayName,
                secondaryTopics: item.secondaryTopics || res.secondaryTopics,
                contentType: item.contentType || res.contentType,
                evidenceStatus: item.evidenceStatus || res.evidenceStatus,
                classificationMethod: res.method,
                classificationConfidence: res.confidence,
                classificationReason: res.reason,
                taxonomyVersion: res.taxonomyVersion,
            };
        });

        let filtered = filterByRange(news, req.query.time || req.query.range || 'all');
        if (severity && severity !== 'all') {
            filtered = filtered.filter(item => severity.toLowerCase().split(',').includes(item.severity?.toLowerCase()));
        }
        if (category && category !== 'all') {
            filtered = filtered.filter(item => item.category?.toLowerCase() === category.toLowerCase());
        }
        // New taxonomy category filter — filters on intelCategory stable ID
        if (intelCategory && intelCategory !== 'all') {
            filtered = filtered.filter(item =>
                (item.intelCategory || 'needs-classification') === intelCategory
            );
        }
        if (q && q.trim()) {
            const query = q.toLowerCase();
            filtered = filtered.filter(item =>
                item.title?.toLowerCase().includes(query) ||
                item.contentSnippet?.toLowerCase().includes(query) ||
                item.source?.toLowerCase().includes(query)
            );
        }

        res.json(filtered.slice(0, limit));
    } catch (err) {
        console.error('[NEWS ROUTE] Error retrieving news:', err);
        res.status(500).json({ error: 'Failed to retrieve news feed.' });
    }
});


// Force refresh news feeds - Protected with INGEST_API_KEY (Phase 11)
router.post('/refresh', requireApiKeyMiddleware('INGEST_API_KEY'), async (req, res) => {
    try {
        const isAsync = req.query.async === 'true';
        if (isAsync) {
            fetchAndProcessNews('manual').catch(err => console.error('[REFRESH ERROR]', err));
            return res.json({
                success: true,
                message: 'Feed refresh job initiated in background.',
                timestamp: new Date().toISOString()
            });
        }
        const news = await fetchAndProcessNews('manual');
        res.json({ success: true, count: news.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to refresh feeds.', details: err.message });
    }
});

// Get stats for chart from authoritative news
router.get('/stats', async (req, res) => {
    try {
        const news = await getAuthoritativeNews();
        const stats = severityStats(filterByRange(news, req.query.time || req.query.range || 'all'));
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve stats.' });
    }
});

export default router;
