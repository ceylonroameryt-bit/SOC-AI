import express from 'express';
import { generateExecutiveBrief, generateRemediationSteps } from '../services/aiService.js';
import { clusterArticles } from '../services/clusteringEngine.js';
import { getNews } from '../services/newsService.js';
import { loadThreats, DEMO_THREATS } from './threats.js';

const router = express.Router();

// GET /api/ai/brief — Daily executive briefing
router.get('/brief', async (req, res) => {
    try {
        const news = getNews().slice(0, 50);
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const rawThreats = loadThreats();
        const threats = isDemoEnabled
            ? [...rawThreats.filter(t => !t.isSimulated), ...DEMO_THREATS]
            : rawThreats.filter(t => !t.isSimulated);

        const result = await generateExecutiveBrief(news, threats);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate executive briefing.', details: err.message });
    }
});

// POST /api/ai/remediate — Generate remediation steps for a threat
router.post('/remediate', async (req, res) => {
    const { threat } = req.body;
    if (!threat || typeof threat !== 'object') {
        return res.status(400).json({ error: 'Request body must include a "threat" object.' });
    }
    try {
        const result = await generateRemediationSteps(threat);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate remediation steps.', details: err.message });
    }
});

// GET /api/ai/clusters — Multi-factor hybrid deduplicated incident clusters
router.get('/clusters', (req, res) => {
    try {
        const news = getNews().slice(0, 200);
        const clusteringResult = clusterArticles(news, 2);

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json({
            clusters: clusteringResult.clusters,
            rawArticleCount: clusteringResult.rawArticleCount,
            uniqueArticleCount: clusteringResult.uniqueArticleCount,
            duplicatesSuppressed: clusteringResult.duplicatesSuppressed,
            deduplicationRate: clusteringResult.deduplicationRate,
            clustersFound: clusteringResult.clusters.length,
            totalArticles: clusteringResult.rawArticleCount,
            generatedAt: clusteringResult.generatedAt,
        });
    } catch (err) {
        res.status(500).json({ error: 'Clustering failed.', details: err.message });
    }
});

export default router;
