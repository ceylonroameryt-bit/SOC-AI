import express from 'express';
import { fetchAndProcessNews, getNews, getSeverityStats } from '../services/newsService.js';
import { classifyRecord, INTEL_CATEGORIES } from '../services/classificationEngine.js';

const router = express.Router();

// Serve news from in-memory cache (instant response)
router.get('/', (req, res) => {
    try {
        const rawNews = getNews();
        const limit = parseInt(req.query.limit) || 100;
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

        let filtered = news;
        if (severity && severity !== 'all') {
            filtered = filtered.filter(item => item.severity?.toLowerCase() === severity.toLowerCase());
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


// Force refresh news feeds
router.post('/refresh', async (req, res) => {
    try {
        const news = await fetchAndProcessNews();
        res.json({ success: true, count: news.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to refresh feeds.', details: err.message });
    }
});

// Get stats for chart
router.get('/stats', (req, res) => {
    try {
        const stats = getSeverityStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve stats.' });
    }
});

export default router;
