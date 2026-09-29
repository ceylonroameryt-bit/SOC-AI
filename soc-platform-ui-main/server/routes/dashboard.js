import { getKevSnapshot } from '../services/kevSnapshot.js';
import { newsMetrics, filterByRange } from '../services/dashboardEvidence.js';
import express from 'express';
import { getNews } from '../services/newsService.js';
import { loadThreats, DEMO_THREATS } from './threats.js';
import { getFeedHealthStats, getFeedHealthRecords } from '../services/feedHealthService.js';
import { mapTextToTechniques } from '../services/mitreService.js';

const router = express.Router();

let lastSnapshotCache = null;
let lastSnapshotTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * GET /api/dashboard/snapshot
 * High-speed unified snapshot for all mission control telemetry.
 */
router.get('/snapshot', async (req, res) => {
    try {
        const now = Date.now();
        const range = req.query.time || req.query.range || '24h';
        const forceRefresh = req.query.refresh === 'true' || lastSnapshotCache?.news?.range !== range;

        if (!forceRefresh && lastSnapshotCache && (now - lastSnapshotTime < CACHE_TTL_MS)) {
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
            return res.json(lastSnapshotCache);
        }

        const news = getNews();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const rawThreats = loadThreats();
        const threats = isDemoEnabled
            ? [...rawThreats.filter(t => !t.isSimulated), ...DEMO_THREATS]
            : rawThreats.filter(t => !t.isSimulated);

        const sourceStats = getFeedHealthStats();

        // Threat severities
        const threatSeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const t of threats) {
            const sev = (t.severity || 'medium').toLowerCase();
            if (sev in threatSeverityCounts) threatSeverityCounts[sev]++;
        }

        const snapshot = {
            generatedAt: new Date().toISOString(),
            isStale: false,
            lastSuccessfulIngestion: (getFeedHealthRecords()?.records || []).map(r => r.health?.lastSuccessAt).filter(Boolean).sort().at(-1) || null,
            news: newsMetrics(news, range),
            threats: {
                total: threats.length,
                critical: threatSeverityCounts.critical,
                high: threatSeverityCounts.high,
                medium: threatSeverityCounts.medium,
                low: threatSeverityCounts.low,
            },
            sources: sourceStats,
            mitre: { activeTechniques: new Set(filterByRange(news, range).flatMap(n => mapTextToTechniques(`${n.title || ''} ${n.contentSnippet || ''}`, null, false))).size, scope: range },
            kev: await getKevSnapshot(),
            environment: {
                appMode: process.env.APP_MODE || 'production',
                isDemoEnabled,
            }
        };

        lastSnapshotCache = snapshot;
        lastSnapshotTime = now;

        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        res.json(snapshot);

    } catch (err) {
        console.error('[DASHBOARD SNAPSHOT ERROR]', err);
        // Fallback to last known good snapshot with isStale: true
        if (lastSnapshotCache?.news?.range === (req.query.time || req.query.range || '24h')) {
            return res.json({
                ...lastSnapshotCache,
                isStale: true,
                staleReason: 'Using last-known-good telemetry snapshot due to refresh error',
            });
        }
        res.status(500).json({ error: 'Failed to generate dashboard snapshot', message: err.message });
    }
});

export default router;
