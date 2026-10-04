/**
 * dashboardEvidence.js
 * Central telemetry filtering and evidence calculation.
 * Ensures consistent time range filtering across Express and Vercel serverless.
 */

// Authoritative supported time ranges
export function normalizeRange(value) {
    return ['24h', '7d', '30d', 'all'].includes(value) ? value : '24h';
}

/**
 * Filter items by range based on published date (or ingested date fallback),
 * strictly excluding future-dated anomalies from past reporting windows.
 */
export function filterByRange(items, range, now = Date.now()) {
    const normalized = normalizeRange(range);
    const duration = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 }[normalized];
    
    return items.filter(item => {
        // Exclude future-dated anomalies from historical time windows
        if (item.dateAnomaly) return false;

        const dateStr = item.pubDate || item.publishedAt || item.ingestedAt;
        if (!dateStr) {
            // Null publication date items are only included in 'all' view
            return normalized === 'all';
        }

        const date = Date.parse(dateStr);
        if (!Number.isFinite(date)) return normalized === 'all';

        // Reject future timestamps exceeding current time
        if (date > now + 60000) return false; // 1 min clock skew tolerance

        return normalized === 'all' ? true : (date >= now - duration && date <= now);
    });
}

export function severityStats(items) {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0, Unclassified: 0 };
    for (const item of items) {
        const key = Object.keys(counts).find(k => k.toLowerCase() === String(item.severity).toLowerCase());
        counts[key || 'Unclassified']++;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

export function newsMetrics(items, range, now = Date.now()) {
    const selected = filterByRange(items, range, now);
    return {
        range: normalizeRange(range),
        total: selected.length,
        latestCount: items.length,
        total24h: filterByRange(items, '24h', now).length,
        ...Object.fromEntries(severityStats(selected).map(s => [s.name.toLowerCase(), s.count])),
    };
}

export function buildDigest(items, range, now = Date.now()) {
    const selected = filterByRange(items, range, now);
    const seen = new Set();
    const sources = [...selected]
        .sort((a, b) => (Date.parse(b.pubDate || b.publishedAt || '') || 0) - (Date.parse(a.pubDate || a.publishedAt || '') || 0))
        .filter(item => {
            if (!/^https?:\/\//i.test(item.link || '') || seen.has(item.link)) return false;
            seen.add(item.link);
            return true;
        })
        .slice(0, 10)
        .map(item => ({
            title: item.title,
            url: item.link,
            publisher: item.source,
            publishedAt: item.pubDate || item.publishedAt
        }));

    const rangeStr = normalizeRange(range);
    const timeLabel = rangeStr === '24h' ? 'Last 24 Hours' : rangeStr === '7d' ? 'Last 7 Days' : rangeStr === '30d' ? 'Last 30 Days' : 'All Time';

    if (sources.length === 0) {
        return {
            content: null,
            headline: `0 source reports · ${timeLabel}`,
            sources: [],
            range: rangeStr,
            generatedAt: now,
            cached: false,
            generationMethod: 'extractive',
            notice: 'No intelligence reports were collected for this reporting window.',
        };
    }

    return {
        content: '## Source-linked intelligence digest\n' + sources.map((s, i) => `- [${i + 1}] ${String(s.title).replace(/[\r\n]/g, ' ')} — ${s.publisher}`).join('\n'),
        headline: `${sources.length} source reports · ${timeLabel}`,
        sources,
        range: rangeStr,
        generatedAt: now,
        cached: false,
        generationMethod: 'extractive',
        notice: 'Headlines from collected sources; not an AI assessment or independently verified incident report.',
    };
}

export default {
    normalizeRange,
    filterByRange,
    severityStats,
    newsMetrics,
    buildDigest,
};
