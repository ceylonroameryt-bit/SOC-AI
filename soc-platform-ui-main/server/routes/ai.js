import express from 'express';
import { generateExecutiveBrief, generateRemediationSteps, clusterSimilarItems } from '../services/aiService.js';
import { getNews } from '../services/newsService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const THREATS_FILE = path.join(__dirname, '../data/threats.json');

const router = express.Router();

const loadThreats = () => {
    try { return JSON.parse(fs.readFileSync(THREATS_FILE, 'utf8')); }
    catch { return []; }
};

// GET /api/ai/brief — Daily executive briefing
router.get('/brief', async (req, res) => {
    try {
        const news    = getNews().slice(0, 50);
        const threats = loadThreats().slice(0, 20);
        const result  = await generateExecutiveBrief(news, threats);
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

// GET /api/ai/clusters — De-duplicated incident clusters from recent news
router.get('/clusters', (req, res) => {
    try {
        const news     = getNews().slice(0, 200);
        const clusters = clusterSimilarItems(news, 0.30);
        res.json({
            clusters,
            totalArticles: news.length,
            clustersFound: clusters.length,
            deduplicationRate: news.length > 0
                ? Math.round(((news.length - clusters.length) / news.length) * 100)
                : 0,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: 'Clustering failed.', details: err.message });
    }
});

export default router;
