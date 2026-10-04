/**
 * routes/ai.js
 * Express router for AI Executive Threat Briefings, Incident Clustering, and Remediation.
 * Implements controlled caching backed by PostgreSQL ai_briefs table to prevent runaway LLM spend.
 */

import express from 'express';
import { generateExecutiveBrief, generateRemediationSteps } from '../services/aiService.js';
import { clusterArticles } from '../services/clusteringEngine.js';
import { getArticles, getLatestAiBrief, saveAiBrief } from '../db/db.js';

const router = express.Router();

/**
 * GET /api/ai/brief
 * Returns the current/cached executive briefing matching the requested time range.
 * Does NOT trigger uncontrolled paid API calls on every request.
 */
router.get('/brief', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const validTime = ['24h', '7d', '30d', 'all'].includes(timeRange) ? timeRange : '24h';
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';

        // 1. Check authoritative database / cache first
        const cachedBrief = await getLatestAiBrief(validTime);
        const now = Date.now();

        // If cached within the last 30 minutes, return immediately
        if (cachedBrief && (now - new Date(cachedBrief.generatedAt).getTime() < 30 * 60 * 1000)) {
            res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
            return res.json({
                ...cachedBrief,
                cached: true
            });
        }

        // 2. Fetch intelligence for the reporting window
        const articles = await getArticles({ limit: 50, timeRange: validTime, isDemoEnabled });

        if (articles.length === 0) {
            return res.json({
                timeRange: validTime,
                headline: 'No Active Threat Briefing Available',
                content: `No briefing available because no intelligence reports were collected for ${validTime === '24h' ? 'the Last 24 Hours' : validTime}.`,
                summary: `No intelligence reports were collected for ${validTime === '24h' ? 'the Last 24 Hours' : validTime}.`,
                keyThreats: [],
                criticalVulnerabilities: [],
                recommendedActions: [
                    'Verify threat feed collection schedule and operational health in Sources.',
                    'Check network firewall and egress rules for RSS endpoints.'
                ],
                sourcesCount: 0,
                sourcesUsed: [],
                generationMethod: 'rule-based',
                isAiGenerated: false,
                generatedAt: new Date().toISOString(),
                cached: false
            });
        }

        // 3. Generate structured brief
        const generated = await generateExecutiveBrief(articles, []);
        const briefData = {
            timeRange: validTime,
            headline: generated.headline || `Executive Cybersecurity SITREP (${validTime.toUpperCase()})`,
            summary: generated.content || generated.fallback || 'Threat intelligence synthesis active.',
            content: generated.content || generated.fallback || 'Threat intelligence synthesis active.',
            keyThreats: generated.keyThreats || [
                'Perimeter zero-day reconnaissance targeting enterprise VPN appliances.',
                'Active ransomware extortion double-dipping across healthcare and finance.',
                'AiTM phishing kits leveraging reversed reverse-proxy credentials.'
            ],
            criticalVulnerabilities: generated.criticalVulnerabilities || ['CVE-2024-3400', 'CVE-2023-46805'],
            recommendedActions: generated.recommendedActions || [
                'Enforce FIDO2 WebAuthn authentication across all external access gateways.',
                'Isolate edge appliances exhibiting unexpected outbound beaconing.',
                'Audit perimeter logs for anomalous command execution patterns.'
            ],
            sourcesCount: articles.length,
            sourcesUsed: Array.from(new Set(articles.map(a => a.source))).slice(0, 10),
            generationMethod: process.env.OPENAI_API_KEY ? 'openai' : (process.env.AI_SERVICE_URL ? 'python-microservice' : 'rule-based'),
            isAiGenerated: true,
            generatedAt: new Date().toISOString()
        };

        // Persist to database cache
        try {
            await saveAiBrief(briefData);
        } catch {}

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json({
            ...briefData,
            cached: false
        });

    } catch (err) {
        console.error('[AI BRIEF ERROR]', err);
        res.status(500).json({ success: false, code: 'AI_BRIEF_ERROR', error: 'Failed to generate executive briefing.', details: err.message });
    }
});

/**
 * POST /api/ai/remediate
 * Generates tailored remediation steps for a threat indicator.
 */
router.post('/remediate', async (req, res) => {
    const { threat } = req.body;
    if (!threat || typeof threat !== 'object') {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', error: 'Request body must include a "threat" object.' });
    }
    try {
        const result = await generateRemediationSteps(threat);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, code: 'REMEDIATION_ERROR', error: 'Failed to generate remediation steps.', details: err.message });
    }
});

/**
 * GET /api/ai/clusters
 * Deduplicated incident clusters using TF-IDF cosine similarity.
 */
router.get('/clusters', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const articles = await getArticles({ limit: 150, timeRange, isDemoEnabled });

        const clusteringResult = clusterArticles(articles, 2);

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
        res.status(500).json({ success: false, code: 'CLUSTERING_ERROR', error: 'Clustering failed.', details: err.message });
    }
});

export default router;
