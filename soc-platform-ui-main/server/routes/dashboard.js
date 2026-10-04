import { getKevSnapshot } from '../services/kevSnapshot.js';
import { newsMetrics, filterByRange } from '../services/dashboardEvidence.js';
import express from 'express';
import { getAuthoritativeNews } from '../services/newsService.js';
import { getFeedHealthStats, getFeedHealthRecords } from '../services/feedHealthService.js';
import { getLatestCollectionRun } from '../services/collectionRunService.js';
import { mapTextToTechniques } from '../services/mitreService.js';

const router = express.Router();

let lastSnapshotCache = null;
let lastSnapshotTime = 0;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds

/**
 * GET /api/dashboard/snapshot
 * High-speed unified snapshot for all mission control telemetry.
 * All metrics are derived from the SAME authoritative intelligence records.
 */
router.get('/snapshot', async (req, res) => {
    try {
        const now = Date.now();
        const range = req.query.time || req.query.range || '24h';
        const forceRefresh = req.query.refresh === 'true' || lastSnapshotCache?.news?.range !== range;

        if (!forceRefresh && lastSnapshotCache && (now - lastSnapshotTime < CACHE_TTL_MS)) {
            res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
            return res.json(lastSnapshotCache);
        }

        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const allNews = await getAuthoritativeNews();
        const filteredNews = filterByRange(allNews, range);

        const sourceStats = getFeedHealthStats();
        const latestRun = getLatestCollectionRun();
        const sourceRecords = getFeedHealthRecords({ page: 1, limit: 5000 })?.records || [];
        const lastSuccessAt = sourceRecords.map(r => r.health?.lastSuccessAt).filter(Boolean).sort().at(-1) || null;
        const latestPubAt = sourceRecords.map(r => r.health?.latestPublicationAt).filter(Boolean).sort().at(-1) || null;

        // Calculate severity counts from the SAME intelligence records
        const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const item of filteredNews) {
            const sev = (item.severity || 'medium').toLowerCase();
            if (sev in severityCounts) severityCounts[sev]++;
        }

        // Truthful Pipeline State (Phases 5, 6, 26, 35)
        let pipelineState = 'NO DATA';
        let pipelineStatusLabel = 'No Data In Range';

        if (latestRun && (latestRun.state === 'failed' || latestRun.state === 'error')) {
            pipelineState = 'COLLECTION FAILURE';
            pipelineStatusLabel = 'Collection Run Failed';
        } else if (!lastSuccessAt || (Date.now() - new Date(lastSuccessAt).getTime() > 24 * 3600 * 1000)) {
            pipelineState = 'STALE';
            pipelineStatusLabel = 'Telemetry Stale (>24h)';
        } else if (filteredNews.length === 0) {
            pipelineState = 'NO DATA';
            pipelineStatusLabel = 'No Intel In Range';
        } else if (sourceStats.degraded > 0 || sourceStats.failed > 0) {
            pipelineState = 'DEGRADED';
            pipelineStatusLabel = 'Pipeline Degraded';
        } else {
            pipelineState = 'LIVE';
            pipelineStatusLabel = 'Live Telemetry Active';
        }

        // ATT&CK technique mapping from the same filtered window
        const activeTechniques = new Set(
            filteredNews.flatMap(n => mapTextToTechniques(`${n.title || ''} ${n.contentSnippet || ''}`, null, false))
        ).size;

        const snapshot = {
            generatedAt: new Date().toISOString(),
            isStale: pipelineState === 'STALE',
            pipelineState,
            pipelineStatusLabel,
            lastSuccessfulIngestion: lastSuccessAt,
            latestPublication: latestPubAt,
            collectionRun: latestRun ? {
                runId: latestRun.run_id || latestRun.runId,
                trigger: latestRun.trigger,
                startedAt: latestRun.started_at || latestRun.startedAt,
                completedAt: latestRun.completed_at || latestRun.completedAt,
                sourcesAttempted: latestRun.sources_attempted || latestRun.sourcesAttempted || 0,
                sourcesSucceeded: latestRun.sources_succeeded || latestRun.sourcesSucceeded || 0,
                sourcesFailed: latestRun.sources_failed || latestRun.sourcesFailed || 0,
                articlesParsed: latestRun.articles_parsed || latestRun.articlesParsed || 0,
                articlesAccepted: latestRun.articles_accepted || latestRun.articlesAccepted || 0,
                articlesRejected: latestRun.articles_rejected || latestRun.articlesRejected || 0,
            } : null,
            news: {
                ...newsMetrics(allNews, range),
                total: filteredNews.length,
                total24h: filteredNews.length,
                critical: severityCounts.critical,
                high: severityCounts.high,
                medium: severityCounts.medium,
                low: severityCounts.low,
                totalArchive: allNews.length,
            },
            threats: {
                total: filteredNews.length,
                critical: severityCounts.critical,
                high: severityCounts.high,
                medium: severityCounts.medium,
                low: severityCounts.low,
            },
            sources: sourceStats,
            mitre: {
                activeTechniques,
                scope: range
            },
            kev: await getKevSnapshot(),
            environment: {
                appMode: process.env.APP_MODE || 'production',
                isDemoEnabled,
            }
        };

        lastSnapshotCache = snapshot;
        lastSnapshotTime = now;

        res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
        res.json(snapshot);

    } catch (err) {
        console.error('[DASHBOARD SNAPSHOT ERROR]', err);
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
