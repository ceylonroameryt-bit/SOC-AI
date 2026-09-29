import test from 'node:test';
import assert from 'node:assert/strict';
import Parser from 'rss-parser';
import yaml from 'js-yaml';

// Stub upstreams, exercise the actual production handler without live network traffic.
const now = Date.now();
const reports = [
    { title: 'Remote code execution investigation', link: 'https://example.org/recent', pubDate: new Date(now - 3600000).toISOString(), contentSnippet: 'A reported exploit requires review.' },
    { title: 'Phishing investigation', link: 'https://example.org/older', pubDate: new Date(now - 3 * 86400000).toISOString(), contentSnippet: 'Reported credential theft.' },
];
let failFeeds = true;
let feedCalls = 0;
Parser.prototype.parseURL = async () => {
    feedCalls++;
    if (failFeeds) throw new Error('fixture outage');
    return { items: reports };
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({ dateReleased: '2026-09-20', vulnerabilities: [] }) });
process.env.ENABLE_DEMO_DATA = 'false';
const { default: handler } = await import('../api/index.js');
async function request(url) {
    let body;
    const res = { setHeader() {}, status() { return this; }, json(value) { body = value; return this; } };
    await handler({ url, method: 'GET', headers: { host: 'localhost' } }, res);
    return body;
}

test('cold source health is unknown and a failed collector does not fabricate news', async () => {
    const sources = await request('/api/sources');
    assert.ok(sources.every(s => s.status === 'unknown' && s.health.lastSuccessAt === null));
    const failedRequests = await Promise.all([request('/api/news?time=24h'), request('/api/news?time=24h')]);
    assert.deepEqual(failedRequests, [[], []]);
    assert.equal(feedCalls, sources.length, 'Concurrent dashboard requests must share one collection pass');
    failFeeds = false;
});

test('Vercel feed, chart and snapshot agree for both reporting windows', async () => {
    for (const [range, expected] of [['24h', 1], ['7d', 2]]) {
        const news = await request(`/api/news?time=${range}`);
        const stats = await request(`/api/news/stats?time=${range}`);
        const snapshot = await request(`/api/dashboard/snapshot?time=${range}`);
        assert.equal(news.length, expected);
        assert.equal(snapshot.news.total, expected);
        assert.equal(stats.reduce((n, s) => n + s.count, 0), expected);
        assert.equal(snapshot.kev.total, 0);
    }
});

test('heatmap counts are deterministic and equal matched report evidence', async () => {
    const first = await request('/api/mitre/heatmap?time=24h');
    const second = await request('/api/mitre/heatmap?time=24h');
    assert.deepEqual(first.tactics, second.tactics);
    const techniques = first.tactics.flatMap(t => t.techniques);
    assert.ok(techniques.every(t => t.hitCount <= 1));
    assert.equal(techniques.find(t => t.techniqueId === 'T1190').hitCount, 1);
});

test('brief cites the selected report and honestly reports extractive generation', async () => {
    const brief = await request('/api/ai/brief?time=24h');
    assert.equal(brief.sources.length, 1);
    assert.equal(brief.sources[0].url, reports[0].link);
    assert.equal(brief.generationMethod, 'extractive');
    assert.equal((await request('/api/ai/stats')).isLLMConfigured, false);
});

test('shadow-copy rule has T1490 mapping and handles executable paths with reordered arguments', async () => {
    const rules = (await request('/api/rules/sigma')).rules;
    const rule = rules.find(r => r.tags.includes('attack.t1490'));
    assert.ok(rule);
    const parsed = yaml.load(rule.raw);
    assert.equal(parsed.status, 'experimental');
    const selection = parsed.detection.selection_vss;
    const matches = event => event.Image.toLowerCase().endsWith(selection['Image|endswith'].toLowerCase()) && selection['CommandLine|contains|all'].every(term => event.CommandLine.toLowerCase().includes(term));
    assert.ok(matches({ Image: 'C:\\Windows\\System32\\vssadmin.exe', CommandLine: 'vssadmin.exe /quiet delete shadows /all' }));
    assert.equal(matches({ Image: 'C:\\Windows\\System32\\vssadmin.exe', CommandLine: 'vssadmin.exe list shadows' }), false);
    assert.equal(matches({ Image: 'C:\\Windows\\System32\\notepad.exe', CommandLine: 'notepad.exe delete shadows.txt' }), false);
});


test('enrichment uses missing-provider states instead of fixed reputation or EPSS scores', async () => {
    const cve = await request('/api/enrich/cve/CVE-2026-12345');
    assert.equal(cve.enrichment.epssScore, null);
    assert.equal(cve.enrichment.isKEV, false, 'Empty retrieved catalog is distinct from a failed lookup');
    assert.ok((await request('/api/enrich/cve/not-a-cve')).error);
    assert.ok((await request('/api/enrich/ip/999.1.1.1')).error);
});
