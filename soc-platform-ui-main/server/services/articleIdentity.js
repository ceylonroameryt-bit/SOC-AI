/** Remove known tracking only. Preserve publisher IDs, query values and path case. */
export function canonicalArticleUrl(value) {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        url.hash = '';
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
        }
        url.searchParams.sort();
        return url.href;
    } catch { return null; }
}
export function articleKey(article) {
    const url = canonicalArticleUrl(article.link);
    if (url) return url;
    // Preserve different publishers and missing-link articles. No fuzzy headline merging.
    return JSON.stringify([article.source || '', article.title || '', article.pubDate || '']);
}
export function deduplicateArticles(records) {
    const seen = new Set();
    return records.filter(record => {
        if (!record || typeof record !== 'object') return false;
        const key = articleKey(record);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
