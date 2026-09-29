/**
 * explore.js — /api/explore
 *
 * Date-based archive search endpoint for the Explore page.
 * Supports timezone-aware "today" / "yesterday" / range queries
 * and combines date, keyword, category, severity, and MITRE filters.
 *
 * All filtering is server-side over the persistent news archive.
 * External feeds are NOT crawled at query time.
 */

import express from 'express';
import { enrichArticleWithMitre, MITRE_TACTICS } from '../services/mitreService.js';
import { queryArchive, getNews } from '../services/newsService.js';

const router = express.Router();

/**
 * Compute UTC boundaries for a named date preset in the requested timezone.
/**
 * Convert a local calendar date string (YYYY-MM-DD) in an IANA timezone into the exact UTC ISO string
 * of local midnight (00:00:00.000). Handles DST forward/backward shifts and timezone offsets accurately.
 */
export function getLocalMidnightUTC(dateStr, timeZone) {
    const [y, m, d] = dateStr.split('-').map(Number);
    let guess = Date.UTC(y, m - 1, d, 0, 0, 0);
    for (let iter = 0; iter < 3; iter++) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
        }).formatToParts(new Date(guess));
        const p = {};
        parts.forEach(x => p[x.type] = x.value);
        let hr = parseInt(p.hour, 10);
        if (hr === 24) hr = 0;
        const min = parseInt(p.minute, 10);
        const sec = parseInt(p.second, 10);
        const localDay = parseInt(p.day, 10);
        const localMonth = parseInt(p.month, 10);
        const localYear = parseInt(p.year, 10);

        const targetDays = Date.UTC(y, m - 1, d) / 86400000;
        const actualDays = Date.UTC(localYear, localMonth - 1, localDay) / 86400000;
        const diffDays = targetDays - actualDays;
        const diffMs = (diffDays * 86400 + (0 - hr) * 3600 + (0 - min) * 60 + (0 - sec)) * 1000;
        if (diffMs === 0) break;
        guess += diffMs;
    }
    return new Date(guess).toISOString();
}

/** Shift a YYYY-MM-DD date string by N days in calendar space. */
export function shiftDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return dt.toISOString().slice(0, 10);
}

/** Validate an IANA timezone string; return 'UTC' on failure. */
export function safeTimezone(tz) {
    if (!tz) return 'UTC';
    try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return tz; } catch { return 'UTC'; }
}

/**
 * Compute UTC boundaries for a named date preset in the requested timezone.
 * Returns { dateFrom: ISO string, dateTo: ISO string } or null if unrecognised.
 */
function presetWindow(preset, tz) {
    const safeTz = safeTimezone(tz);
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: safeTz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);

    const tomorrowStr = shiftDateStr(todayStr, 1);
    const yestStr     = shiftDateStr(todayStr, -1);
    const d7agoStr    = shiftDateStr(todayStr, -7);
    const d30agoStr   = shiftDateStr(todayStr, -30);

    const windows = {
        today:     { dateFrom: getLocalMidnightUTC(todayStr, safeTz),   dateTo: getLocalMidnightUTC(tomorrowStr, safeTz) },
        yesterday: { dateFrom: getLocalMidnightUTC(yestStr, safeTz),    dateTo: getLocalMidnightUTC(todayStr, safeTz) },
        last7:     { dateFrom: getLocalMidnightUTC(d7agoStr, safeTz),   dateTo: getLocalMidnightUTC(tomorrowStr, safeTz) },
        last30:    { dateFrom: getLocalMidnightUTC(d30agoStr, safeTz),  dateTo: getLocalMidnightUTC(tomorrowStr, safeTz) },
    };

    return windows[preset] || null;
}

/** Convert a plain YYYY-MM-DD date string to the UTC midnight for that date in the given tz. */
function dateToTZMidnight(dateStr, tz, addDay = false) {
    const safeTz = safeTimezone(tz);
    const targetStr = addDay ? shiftDateStr(dateStr, 1) : dateStr;
    return getLocalMidnightUTC(targetStr, safeTz);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explore
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Query params:
 *   preset      today | yesterday | last7 | last30
 *   dateFrom    ISO-8601 or YYYY-MM-DD (inclusive start; converted via tz if no time)
 *   dateTo      ISO-8601 or YYYY-MM-DD (exclusive end; converted via tz if no time)
 *   tz          IANA timezone (default UTC)
 *   q           Keyword (title, summary, source)
 *   source      Source name (partial match)
 *   category    Intel category or legacy category
 *   severity    Critical|High|Medium|Low
 *   tacticId    TA0001 … TA0043
 *   techniqueId T1566 … etc.
 *   mappedOnly  true | false
 *   sort        pub_desc | pub_asc | ingested_desc
 *   page        1-indexed
 *   limit       1-200
 */
router.get('/', (req, res) => {
    try {
        const {
            preset,
            dateFrom: rawDateFrom,
            dateTo:   rawDateTo,
            tz: rawTz = 'UTC',
            q, source, category, severity,
            tacticId, techniqueId, mappedOnly,
            sort = 'pub_desc',
            page = '1',
            limit = '50',
        } = req.query;

        const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
        const safePage  = Math.max(1, parseInt(page, 10) || 1);
        const tz        = safeTimezone(rawTz);

        let dateFrom = null;
        let dateTo   = null;

        if (preset) {
            const w = presetWindow(preset, tz);
            if (!w) return res.status(400).json({ error: `Unknown preset "${preset}". Use: today, yesterday, last7, last30.` });
            dateFrom = w.dateFrom;
            dateTo   = w.dateTo;
        } else {
            if (rawDateFrom) {
                dateFrom = /T/.test(rawDateFrom) ? rawDateFrom : dateToTZMidnight(rawDateFrom, tz, false);
            }
            if (rawDateTo) {
                // For plain dates, dateTo is exclusive end → add 1 day so the selected date is fully included
                dateTo = /T/.test(rawDateTo) ? rawDateTo : dateToTZMidnight(rawDateTo, tz, true);
            }
        }

        // Validate date range
        if (dateFrom && dateTo) {
            const fromMs = new Date(dateFrom).getTime();
            const toMs   = new Date(dateTo).getTime();
            if (isNaN(fromMs) || isNaN(toMs)) return res.status(400).json({ error: 'Invalid date value.' });
            if (fromMs >= toMs) return res.status(400).json({ error: 'dateFrom must be before dateTo.' });
            if (toMs - fromMs > 366 * 86_400_000) return res.status(400).json({ error: 'Date range must not exceed 366 days.' });
        }

        const result = queryArchive({
            dateFrom, dateTo, q, source, category, severity,
            tacticId, techniqueId, mappedOnly,
            sort, page: safePage, limit: safeLimit,
        });

        // Enrich page results with MITRE data (read-only, no hit counter)
        const enriched = result.records.map(item => enrichArticleWithMitre({ ...item }));

        res.setHeader('Cache-Control', 'no-cache');
        res.json({
            records: enriched,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            resolvedWindow: { preset: preset || null, dateFrom, dateTo, tz },
            archiveCoverage: result.archiveCoverage,
        });
    } catch (err) {
        console.error('[EXPLORE] Error:', err);
        res.status(500).json({ error: 'Explore query failed.', details: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explore/meta — filter dropdown options
// ─────────────────────────────────────────────────────────────────────────────
router.get('/meta', (req, res) => {
    try {
        const news = getNews();
        const sourcesSet    = new Set();
        const categoriesSet = new Set();
        news.forEach(item => {
            if (item.source) sourcesSet.add(item.source);
            const cat = item.intelCategory || item.category;
            if (cat) categoriesSet.add(cat);
        });

        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        res.json({
            sources: Array.from(sourcesSet).sort(),
            categories: Array.from(categoriesSet).sort(),
            tactics: MITRE_TACTICS.map(t => ({ id: t.id, name: t.name, shortName: t.shortName, icon: t.icon, color: t.color })),
            severities: ['Critical', 'High', 'Medium', 'Low'],
            sortOptions: [
                { value: 'pub_desc',      label: 'Newest publication first' },
                { value: 'pub_asc',       label: 'Oldest publication first' },
                { value: 'ingested_desc', label: 'Recently ingested first' },
            ],
        });
    } catch (err) {
        console.error('[EXPLORE META]', err);
        res.status(500).json({ error: 'Failed to retrieve explore metadata.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explore/article/:id — full article detail with mapping provenance
// ─────────────────────────────────────────────────────────────────────────────
router.get('/article/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !/^[\w\-]{4,60}$/.test(id)) return res.status(400).json({ error: 'Invalid article ID.' });

        const news = getNews();
        const item = news.find(n => n.id === id);
        if (!item) return res.status(404).json({ error: 'Article not found in archive.' });

        const enriched = enrichArticleWithMitre({ ...item });

        const provenance = enriched.mappingMethod === 'keyword-heuristic'
            ? 'Automatically mapped by keyword matching against the MITRE ATT\u0026CK technique catalogue. ' +
              'Mappings are heuristic and have not been analyst-confirmed.'
            : 'Not mapped — no MITRE ATT\u0026CK keywords matched in the title or summary of this article.';

        // Defensible related reports based on shared MITRE techniques or threat taxonomy
        const targetTechIds = new Set(enriched.mitreTechniques.map(t => t.id));
        const targetCat = enriched.intelCategory || enriched.category;
        const candidatePool = news.filter(n => n.id !== id && (n.link !== enriched.link));

        const scored = [];
        for (const candidate of candidatePool.slice(0, 1000)) {
            const candEnriched = enrichArticleWithMitre({ ...candidate });
            let score = 0;
            const sharedTechs = [];
            for (const t of candEnriched.mitreTechniques) {
                if (targetTechIds.has(t.id)) {
                    score += 10;
                    sharedTechs.push(t.id);
                }
            }
            const candCat = candEnriched.intelCategory || candEnriched.category;
            if (targetCat && candCat && targetCat.toLowerCase() === candCat.toLowerCase()) {
                score += 3;
            }

            if (score > 0) {
                const relationReason = sharedTechs.length > 0
                    ? `Shares MITRE ATT&CK technique${sharedTechs.length > 1 ? 's' : ''} (${sharedTechs.join(', ')})`
                    : `Shares threat taxonomy category (${targetCat})`;
                scored.push({
                    id: candEnriched.id,
                    title: candEnriched.title,
                    link: candEnriched.link,
                    pubDate: candEnriched.pubDate,
                    source: candEnriched.source,
                    severity: candEnriched.severity,
                    category: candCat,
                    score,
                    relationReason,
                    mitreTechniques: candEnriched.mitreTechniques.slice(0, 3)
                });
            }
            if (scored.length >= 20) break;
        }

        scored.sort((a, b) => b.score - a.score);
        const relatedReports = scored.slice(0, 4);

        res.setHeader('Cache-Control', 'public, s-maxage=300');
        res.json({
            ...enriched,
            mappingProvenance: provenance,
            relatedReports,
        });
    } catch (err) {
        console.error('[EXPLORE ARTICLE]', err);
        res.status(500).json({ error: 'Failed to retrieve article.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explore/coverage — archive date coverage summary
// ─────────────────────────────────────────────────────────────────────────────
router.get('/coverage', (req, res) => {
    try {
        const news = getNews();
        const dated = news.filter(n => n.pubDate).map(n => new Date(n.pubDate).getTime()).filter(ms => !isNaN(ms));
        const total       = news.length;
        const withDate    = dated.length;
        const oldest = withDate ? new Date(Math.min(...dated)).toISOString() : null;
        const newest = withDate ? new Date(Math.max(...dated)).toISOString() : null;

        // Per-day counts for last 30 days (UTC)
        const now = Date.now();
        const cutoff = now - 30 * 86_400_000;
        const byDay = {};
        news.forEach(item => {
            if (!item.pubDate) return;
            const ms = new Date(item.pubDate).getTime();
            if (isNaN(ms) || ms < cutoff) return;
            const day = new Date(ms).toISOString().slice(0, 10);
            byDay[day] = (byDay[day] || 0) + 1;
        });

        res.setHeader('Cache-Control', 'public, s-maxage=300');
        res.json({
            total,
            withPublicationDate: withDate,
            withoutPublicationDate: total - withDate,
            oldest,
            newest,
            last30DaysByDay: Object.entries(byDay)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date)),
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve archive coverage.' });
    }
});

export default router;

