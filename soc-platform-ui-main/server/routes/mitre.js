import { getNews } from '../services/newsService.js';
import { filterByRange } from '../services/dashboardEvidence.js';
import express from 'express';
import {
    getHeatmapData,
    mapTextToTechniques,
    getTopTechniques,
    getTactics,
    getCategorizedNews,
    getTechniqueInfo
} from '../services/mitreService.js';

const router = express.Router();

// GET /api/mitre/news — Get all news categorized by MITRE Framework Tactics & Techniques
router.get('/news', (req, res) => {
    try {
        const { tactic, technique, severity, q, page, limit } = req.query;
        const result = getCategorizedNews({
            tacticId: tactic,
            techniqueId: technique,
            severity,
            search: q,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 40,
        });

        res.json(result);
    } catch (err) {
        console.error('[MITRE ROUTE] Failed to get categorized news:', err);
        res.status(500).json({ error: 'Failed to retrieve MITRE categorized news.', details: err.message });
    }
});

// GET /api/mitre/heatmap — Full heatmap data for all techniques
router.get('/heatmap', (req, res) => {
    try {
        const selected = filterByRange(getNews(), req.query.time || req.query.range || 'all');
        const hits = new Map();
        for (const item of selected) {
            for (const id of mapTextToTechniques(`${item.title || ''} ${item.contentSnippet || ''}`, null, false)) {
                const links = hits.get(id) || [];
                links.push(item.link || item.id);
                hits.set(id, links);
            }
        }
        const heatmap = getHeatmapData().map(t => ({ ...t, hitCount: hits.get(t.techniqueId)?.length || 0, linkedItems: (hits.get(t.techniqueId) || []).filter(Boolean) }));
        const tactics = getTactics();

        // Group techniques by tactic
        const byTactic = tactics.map(tactic => ({
            ...tactic,
            techniques: heatmap.filter(t => t.tacticId === tactic.id),
        }));

        res.json({
            tactics: byTactic,
            totalTechniques: heatmap.length,
            activeTechniques: heatmap.filter(t => t.hitCount > 0).length,
            lastUpdated: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate MITRE heatmap.', details: err.message });
    }
});

// GET /api/mitre/top — Top N most active techniques
router.get('/top', (req, res) => {
    const n = Math.min(parseInt(req.query.n) || 10, 50);
    res.json(getTopTechniques(n));
});

// GET /api/mitre/tactics — List all 14 tactics with details
router.get('/tactics', (req, res) => {
    res.json(getTactics());
});

// GET /api/mitre/technique/:id — Detailed technique lookup
router.get('/technique/:id', (req, res) => {
    const info = getTechniqueInfo(req.params.id);
    if (!info) return res.status(404).json({ error: 'Technique not found' });
    res.json(info);
});

export default router;
