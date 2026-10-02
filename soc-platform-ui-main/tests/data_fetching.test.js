import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createSnapshotLoader, applySharedSnapshot, validateSnapshot, sharedSnapshotMiddleware } from '../server/services/sharedSnapshotService.js';
import { getNews, setSharedNews } from '../server/services/newsService.js';
import app from '../server/server.js';

const snapshot = (articles = []) => ({ version: 1, publishedAt: '2026-10-01T12:00:00Z', articles, health: [], runs: [] });
const article = { id: 'art-test-1234', title: 'Test security advisory', link: 'https://example.com/advisory', source: 'Test', pubDate: '2026-10-01T10:00:00Z', severity: 'High' };

test('shared loader coalesces requests, refreshes after TTL and preserves full records', async () => {
    let reads = 0; let now = 0; const applied = [];
    const load = createSnapshotLoader({ now: () => now, ttlMs: 60,
        read: async () => { reads++; return snapshot([{ ...article, sequence: reads }]); },
        apply: s => applied.push(s) });
    await Promise.all([load(), load(), load()]); assert.equal(reads, 1);
    await load(); assert.equal(reads, 1);
    now = 61; const latest = await load(); assert.equal(reads, 2);
    assert.equal(latest.articles[0].sequence, 2); assert.equal(applied.length, 2);
});
test('failed refresh rejects instead of silently returning stale data, and can recover', async () => {
    let now = 0; let fail = false;
    const load = createSnapshotLoader({ now: () => now, ttlMs: 1, apply: () => {},
        read: async () => { if (fail) throw Error('offline'); return snapshot(); } });
    await load(); now = 2; fail = true;
    await assert.rejects(load(), /offline/); fail = false; await load();
});
test('invalid snapshot is rejected and empty shared collection never falls back to seed', () => {
    assert.throws(() => validateSnapshot({}), /Invalid/);
    applySharedSnapshot(snapshot()); assert.deepEqual(getNews(), []);
    applySharedSnapshot(snapshot([article])); assert.deepEqual(getNews(), [article]);
    setSharedNews(null);
});
test('serverless missing storage gives actionable 503 and leaves health available', async () => {
    const old = process.env.VERCEL; process.env.VERCEL = '1';
    try {
        const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; } };
        await sharedSnapshotMiddleware({ method:'GET', path:'/news' }, res, () => assert.fail('must not serve seed'));
        assert.equal(res.statusCode,503); assert.equal(res.body.code,'DATA_UNAVAILABLE');
        let health = false;
        await sharedSnapshotMiddleware({ method:'GET', path:'/health' }, res, () => { health = true; });
        assert.equal(health,true);
    } finally { if (old === undefined) delete process.env.VERCEL; else process.env.VERCEL = old; }
});
test('website read routes resolve to JSON; reserved runs route is not a source ID', async () => {
    applySharedSnapshot(snapshot([article]));
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        for (const path of ['/api/news','/api/news/stats','/api/explore','/api/explore/meta','/api/explore/coverage',
            '/api/explore/article/art-test-1234','/api/sources','/api/sources/stats','/api/sources/runs','/api/sources/runs/latest',
            '/api/mitre/news','/api/mitre/heatmap','/api/categories','/api/threats','/api/rules/sigma','/api/rules/yara']) {
            const response = await fetch(base+path);
            assert.equal(response.status,200,path); assert.match(response.headers.get('content-type'), /application\/json/,path);
            const body = await response.json();
            if(path === '/api/sources/runs') assert.ok(Array.isArray(body.runs));
            if(path === '/api/news') assert.equal(body[0].id, article.id);
        }
    } finally { setSharedNews(null); await new Promise(resolve => server.close(resolve)); }
});

test('duplicate identity removes tracking variants but preserves distinct stories', async () => {
    const { canonicalArticleUrl, deduplicateArticles } = await import('../server/services/articleIdentity.js');
    assert.equal(canonicalArticleUrl('https://example.com/a?id=1&utm_source=rss#top'), 'https://example.com/a?id=1');
    const rows = [
        {...article, link:'https://example.com/a?id=1&utm_source=rss'},
        {...article, link:'https://example.com/a?id=1&fbclid=x'},
        {...article, link:'https://example.com/a?id=2'},
        {...article, link:'https://other.example/a?id=1'},
    ];
    assert.equal(deduplicateArticles(rows).length,3);
    assert.equal(canonicalArticleUrl('javascript:alert(1)'),null);
    assert.notEqual(canonicalArticleUrl('https://example.com/a?source=one'), canonicalArticleUrl('https://example.com/a?source=two'));
    applySharedSnapshot(snapshot(rows));
    assert.equal(getNews().length,3);
    setSharedNews(null);
});
