import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByRange, newsMetrics, severityStats, buildDigest } from '../server/services/dashboardEvidence.js';
import { createKevReader } from '../server/services/kevSnapshot.js';

const now = Date.parse('2026-09-20T12:00:00Z');
const item = (hours, severity = 'High') => ({ title: `Report ${hours}`, link: `https://example.org/${hours}`, source: 'Fixture', pubDate: new Date(now - hours * 3600000).toISOString(), severity });
const items = [item(1), item(24, 'Critical'), item(25, 'Low'), item(120, 'Informational'), item(240, 'unknown'), item(-1), { title: 'undated' }];

test('time windows include boundary, reject future and undated records, and widen correctly', () => {
    assert.equal(filterByRange(items, '24h', now).length, 2);
    assert.equal(filterByRange(items, '7d', now).length, 4);
    assert.equal(filterByRange(items, '30d', now).length, 5);
    assert.equal(filterByRange(items, 'all', now).length, 6);
    assert.deepEqual(filterByRange(items, 'invalid', now), filterByRange(items, '24h', now));
});

test('metrics and severity chart account for every selected report including informational and unknown', () => {
    for (const range of ['24h', '7d', '30d', 'all']) {
        const metrics = newsMetrics(items, range, now);
        const chart = severityStats(filterByRange(items, range, now));
        assert.equal(metrics.total, chart.reduce((n, s) => n + s.count, 0));
        assert.equal(metrics.critical, chart.find(s => s.name === 'Critical').count);
    }
    assert.equal(newsMetrics([], '24h', now).total, 0);
});

test('digest retains provenance, removes duplicate/unsafe URLs, and never supplies example claims', () => {
    const digest = buildDigest([item(1), item(1), item(120), { ...item(2), link: 'javascript:alert(1)' }], '24h', now);
    assert.equal(digest.sources.length, 1);
    assert.equal(digest.sources[0].url, item(1).link);
    assert.equal(digest.generationMethod, 'extractive');
    assert.equal(buildDigest([], '24h', now).content, null);
});

test('KEV fetch deduplicates concurrent calls and preserves timestamps on refresh failure', async () => {
    let clock = now;
    let calls = 0;
    const reader = createKevReader(async () => {
        calls++;
        if (calls > 1) throw new Error('offline');
        return { ok: true, json: async () => ({ dateReleased: '2026-09-19', vulnerabilities: [{ cveID: 'CVE-2026-12345', vendorProject: 'Example', vulnerabilityName: 'Example advisory', dateAdded: '2026-09-19' }] }) };
    }, () => clock);
    const [first, same] = await Promise.all([reader(), reader()]);
    assert.deepEqual(first, same);
    assert.equal(calls, 1);
    assert.equal(first.total, 1);
    assert.equal(first.featured[0].epss, null);
    clock += 3600001;
    const stale = await reader();
    assert.equal(stale.status, 'stale');
    assert.equal(stale.retrievedAt, first.retrievedAt);
    assert.equal(stale.total, 1);
});

test('KEV failed cold start is unavailable, not zero or a fabricated total', async () => {
    const reader = createKevReader(async () => { throw new Error('offline'); }, () => now);
    const result = await reader();
    assert.equal(result.status, 'unavailable');
    assert.equal(result.total, null);
    assert.deepEqual(result.featured, []);
});
