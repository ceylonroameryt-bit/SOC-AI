import { filterByRange } from '../services/dashboardEvidence.js';
import express from 'express';
import { generateExecutiveBrief, generateRemediationSteps } from '../services/aiService.js';
import { clusterArticles } from '../services/clusteringEngine.js';
import { getNews } from '../services/newsService.js';
import { loadThreats, DEMO_THREATS } from './threats.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI rate limit exceeded. Please slow down.' }
});

import { getAuthoritativeNews } from '../services/newsService.js';
import { saveAiBriefToDb, getLatestAiBriefFromDb, isDbConnected } from '../db/db.js';

// GET /api/ai/brief — Executive briefing with PostgreSQL persistence and rate protection
router.get('/brief', aiLimiter, async (req, res) => {
    try {
        const range = req.query.time || req.query.range || '24h';

        // Check if fresh brief exists in PostgreSQL (< 4 hours old)
        if (isDbConnected()) {
            try {
                const storedBrief = await getLatestAiBriefFromDb(range);
                if (storedBrief && storedBrief.generated_at) {
                    const ageMs = Date.now() - new Date(storedBrief.generated_at).getTime();
                    if (ageMs < 4 * 60 * 60 * 1000) {
                        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
                        return res.json({
                            headline: storedBrief.headline,
                            content: storedBrief.content,
                            sources: storedBrief.sources || [],
                            sourceCount: storedBrief.source_count || 0,
                            reportingWindow: storedBrief.reporting_window || range,
                            generationMethod: storedBrief.generation_method,
                            generatedAt: storedBrief.generated_at,
                            notice: storedBrief.notice,
                            cached: true
                        });
                    }
                }
            } catch (dbErr) {
                console.warn('[AI BRIEF] DB lookup failed:', dbErr.message);
            }
        }

        const allNews = await getAuthoritativeNews();
        const news = filterByRange(allNews, range).slice(0, 50);
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const rawThreats = loadThreats();
        const threats = isDemoEnabled
            ? [...rawThreats.filter(t => !t.isSimulated), ...DEMO_THREATS]
            : rawThreats.filter(t => !t.isSimulated);

        const result = await generateExecutiveBrief(news, threats, range);

        // Save generated briefing to PostgreSQL
        if (isDbConnected() && result.content && !result.error) {
            try {
                await saveAiBriefToDb({
                    reportingWindow: range,
                    headline: result.headline || 'Executive Threat Briefing',
                    content: result.content,
                    sources: result.sources || [],
                    sourceCount: result.sourceCount || 0,
                    generationMethod: result.generationMethod || 'heuristic-digest',
                    notice: result.notice || 'AI-generated assessment'
                });
            } catch (saveErr) {
                console.warn('[AI BRIEF] Failed to save brief to DB:', saveErr.message);
            }
        }

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json(result);
    } catch (err) {
        console.error('[AI BRIEF]', err.message);
        res.status(500).json({ error: 'Failed to generate executive briefing.' });
    }
});

// GET /api/ai/stats — Real AI configuration state (P1 item 23)
router.get('/stats', (req, res) => {
    const openaiKey = process.env.OPENAI_API_KEY;
    const ollamaUrl = process.env.OLLAMA_URL;
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    const ollamaEnabled = process.env.USE_OLLAMA === 'true';

    const openaiConfigured = !!(openaiKey
        && openaiKey.trim()
        && !openaiKey.includes('your-openai-api-key')
        && !openaiKey.startsWith('sk-your-'));
    const ollamaConfigured = !!(ollamaUrl || ollamaEnabled);
    const pythonServiceConfigured = !!(aiServiceUrl && aiServiceUrl.trim());

    res.json({
        openai: {
            configured: openaiConfigured,
            model: openaiConfigured ? (process.env.OPENAI_MODEL || 'gpt-4o-mini') : null,
        },
        ollama: {
            configured: ollamaConfigured,
            url: ollamaConfigured ? (ollamaUrl || 'http://localhost:11434') : null,
            model: ollamaConfigured ? (process.env.OLLAMA_MODEL || 'llama3') : null,
        },
        pythonService: {
            configured: pythonServiceConfigured,
            url: pythonServiceConfigured ? aiServiceUrl : null,
        },
        anyConfigured: openaiConfigured || ollamaConfigured || pythonServiceConfigured,
        generatedAt: new Date().toISOString(),
    });
});

// POST /api/ai/remediate — Generate remediation steps for a threat
// P0 item 3: require auth + rate limiting
router.post('/remediate', aiLimiter, requireApiKeyMiddleware('INGEST_API_KEY'), async (req, res) => {
    const { threat } = req.body;
    if (!threat || typeof threat !== 'object') {
        return res.status(400).json({ error: 'Request body must include a "threat" object.' });
    }
    try {
        const result = await generateRemediationSteps(threat);
        res.json(result);
    } catch (err) {
        console.error('[AI REMEDIATE]', err.message);
        res.status(500).json({ error: 'Failed to generate remediation steps.' });
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
        console.error('[AI CLUSTERS]', err.message);
        res.status(500).json({ error: 'Clustering failed.' });
    }
});

export default router;
