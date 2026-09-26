// Shared by Express and Vercel so counts use the same reporting window.
export function normalizeRange(value) {
    return ['24h', '7d', '30d', 'all'].includes(value) ? value : '24h';
}

export function filterByRange(items, range, now = Date.now()) {
    const normalized = normalizeRange(range);
    const duration = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 }[normalized];
    return items.filter(item => {
        const date = Date.parse(item.publishedAt || item.pubDate || '');
        return normalized === 'all' ? (!Number.isFinite(date) || date <= now)
            : Number.isFinite(date) && date >= now - duration && date <= now;
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
        range: normalizeRange(range), total: selected.length, latestCount: items.length,
        total24h: filterByRange(items, '24h', now).length,
        ...Object.fromEntries(severityStats(selected).map(s => [s.name.toLowerCase(), s.count])),
    };
}

export function buildDigest(items, range, now = Date.now()) {
    const selected = filterByRange(items, range, now);
    const seen = new Set();
    const sources = [...selected].sort((a, b) => (Date.parse(b.publishedAt || b.pubDate) || 0) - (Date.parse(a.publishedAt || a.pubDate) || 0))
        .filter(item => {
            if (!/^https?:\/\//i.test(item.link || '') || seen.has(item.link)) return false;
            seen.add(item.link);
            return true;
        }).slice(0, 10).map(item => ({ title: item.title, url: item.link, publisher: item.source, publishedAt: item.publishedAt || item.pubDate }));
    return {
        content: sources.length ? '## Source-linked intelligence digest\n' + sources.map((s, i) => `- [${i + 1}] ${String(s.title).replace(/[\r\n]/g, ' ')} — ${s.publisher}`).join('\n') : null,
        headline: `${sources.length} source reports · ${normalizeRange(range)}`,
        sources, range: normalizeRange(range), generatedAt: now, cached: false,
        generationMethod: 'extractive',
        notice: 'Headlines from collected sources; not an AI assessment or independently verified incident report.',
    };
}

