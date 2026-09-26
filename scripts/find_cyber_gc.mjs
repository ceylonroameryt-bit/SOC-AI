async function findLinks() {
    try {
        const res = await fetch('https://www.cyber.gc.ca/en/alerts-advisories', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const html = await res.text();
        const matches = html.match(/href="([^"]*feed[^"]*|[^"]*rss[^"]*|[^"]*atom[^"]*)"/gi);
        console.log('Matches:', matches);
    } catch (e) {
        console.error(e);
    }
}
findLinks();
