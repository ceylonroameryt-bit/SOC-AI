import express from 'express';
import { fetchAndProcessNews, getNews, getSeverityStats } from '../services/newsService.js';

const router = express.Router();

// Serve news from in-memory cache (instant response)
router.get('/', (req, res) => {
    try {
        const news = getNews();
        const limit = parseInt(req.query.limit) || 100;
        const { severity, category, intelCategory, q } = req.query;

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
