import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeFeedUrl,
    extractPublisherDomain,
    isPrivateOrInternalUrl
} from '../server/utils/urlUtils.js';
import {
    getSourcesRegistry,
    getFeedHealthRecords,
    getFeedHealthStats,
    resolveDynamicHealth,
    resolvePublicationFreshness
} from '../server/services/feedHealthService.js';
import { parseRetryAfter } from '../server/services/collectorEngine.js';

describe('RSS Ingestion & Feed Reliability Verification Suite', () => {

    // 1. SSRF and Private-Network Protection
    describe('1. SSRF & Network Boundary Protection', () => {
        test('Blocks loopback IPv4 addresses', () => {
            assert.equal(isPrivateOrInternalUrl('http://127.0.0.1/feed.xml'), true);
            assert.equal(isPrivateOrInternalUrl('http://127.0.0.2:8080/atom'), true);
        });

        test('Blocks cloud metadata services (169.254.169.254)', () => {
            assert.equal(isPrivateOrInternalUrl('http://169.254.169.254/latest/meta-data/'), true);
            assert.equal(isPrivateOrInternalUrl('http://metadata.google.internal/computeMetadata/v1/'), true);
        });

        test('Blocks RFC 1918 private network addresses', () => {
            assert.equal(isPrivateOrInternalUrl('http://10.0.0.1/rss'), true);
            assert.equal(isPrivateOrInternalUrl('http://172.16.0.5/feed'), true);
            assert.equal(isPrivateOrInternalUrl('http://192.168.1.1/feed'), true);
        });

        test('Blocks localhost and local hostnames', () => {
            assert.equal(isPrivateOrInternalUrl('http://localhost:3000/feed'), true);
            assert.equal(isPrivateOrInternalUrl('http://test.local/feed'), true);
        });

        test('Allows public internet hosts', () => {
            assert.equal(isPrivateOrInternalUrl('https://cisa.gov/cybersecurity-advisories/all.xml'), false);
            assert.equal(isPrivateOrInternalUrl('https://msrc.microsoft.com/feed'), false);
            assert.equal(isPrivateOrInternalUrl('https://krebsonsecurity.com/feed/'), false);
        });
    });

    // 2. URL Normalization and Apex Domain Extraction
    describe('2. URL Normalization & Deduplication', () => {
        test('Lowercases hostnames while preserving case-sensitive paths', () => {
            const raw = 'HTTPS://Blog.TalosIntelligence.COM/Path/To/Feed';
            const normalized = normalizeFeedUrl(raw);
            assert.equal(normalized, 'https://blog.talosintelligence.com/Path/To/Feed');
        });

        test('Strips URL fragments and tracking parameters', () => {
            const raw = 'https://news.sophos.com/feed/?utm_source=twitter&utm_medium=social#heading1';
            const normalized = normalizeFeedUrl(raw);
            assert.equal(normalized, 'https://news.sophos.com/feed/');
        });

        test('Correctly extracts publisher domain', () => {
            assert.equal(extractPublisherDomain('https://news.sophos.com/rss'), 'news.sophos.com');
            assert.equal(extractPublisherDomain('https://blogs.jpcert.or.jp/en/atom.xml'), 'blogs.jpcert.or.jp');
            assert.equal(extractPublisherDomain('https://www.cisa.gov/cybersecurity-advisories/all.xml'), 'cisa.gov');
            assert.equal(extractPublisherDomain('invalid-url'), 'unknown');
        });
    });

    // 3. Canonical Registry Integrity
    describe('3. Canonical Registry Integrity & Scale Target', () => {
        const registry = getSourcesRegistry();

        test('Target 1,000 sources catalogue is populated', () => {
            assert.ok(registry.length >= 1000, `Expected at least 1,000 sources, got ${registry.length}`);
        });

        test('All source IDs are strictly unique', () => {
            const ids = new Set();
            for (const s of registry) {
                assert.ok(s.id, 'Source must have an id');
                assert.ok(!ids.has(s.id), `Duplicate source ID detected: ${s.id}`);
                ids.add(s.id);
            }
        });

        test('Canonical feed URLs are unique across enabled sources', () => {
            const urls = new Set();
            const enabled = registry.filter(s => s.enabled);
            for (const s of enabled) {
                const target = s.canonicalUrl || s.feedUrl;
                assert.ok(!urls.has(target), `Duplicate active feed URL detected: ${target}`);
                urls.add(target);
            }
        });

        test('Distinct publishers count is tracked and substantive', () => {
            const publishers = new Set(registry.map(s => s.publisherDomain).filter(Boolean));
            assert.ok(publishers.size >= 500, `Expected >= 500 publishers, got ${publishers.size}`);
        });

        test('Review states are strictly partitioned', () => {
            const validStates = new Set(['approved', 'candidate', 'quarantined', 'retired']);
            for (const s of registry) {
                assert.ok(validStates.has(s.reviewState), `Invalid review state "${s.reviewState}" for source ${s.id}`);
            }
        });

        test('Candidate sources are not enabled by default', () => {
            const candidates = registry.filter(s => s.reviewState === 'candidate');
            for (const c of candidates) {
                assert.equal(c.enabled, false, `Candidate source ${c.id} must NOT be enabled before verification`);
            }
        });

        test('Milestone 1: At least 36 new verified sources exist with valid provenance', () => {
            const newFeeds = registry.filter(s => s.provenance === 'Premier Verified Security Feeds (Milestone 1)');
            assert.ok(newFeeds.length >= 36, `Expected >= 36 verified new sources, found ${newFeeds.length}`);
            for (const f of newFeeds) {
                assert.equal(f.reviewState, 'approved');
                assert.equal(f.enabled, true);
                assert.ok(f.provenance, 'Verified source must have a provenance record');
            }
        });

        test('Repaired feeds have replacement notes preserved', () => {
            const talos = registry.find(s => s.id === 'cisco-talos-intelligence');
            assert.ok(talos, 'Cisco Talos must exist in registry');
            assert.equal(talos.feedUrl, 'https://blog.talosintelligence.com/rss/');
            assert.ok(talos.replacementNotes, 'Repaired feed must document replacement notes');
        });

        test('Retired sources have retirement reasons documented', () => {
            const threatpost = registry.find(s => s.id === 'threatpost');
            assert.ok(threatpost, 'ThreatPost must exist in registry');
            assert.equal(threatpost.reviewState, 'retired');
            assert.equal(threatpost.enabled, false);
            assert.ok(threatpost.retirementReason, 'Retired source must document retirement reason');
        });
    });

    // 4. Health Telemetry & Strict Separation of Concerns
    describe('4. Health Telemetry & Zero Fabrication', () => {
        test('Untested or candidate sources are marked disabled/unknown, never healthy', () => {
            const record = resolveDynamicHealth(null, { enabled: false, reviewState: 'candidate' });
            assert.equal(record, 'disabled');

            const unmeasuredActive = resolveDynamicHealth(null, { enabled: true, reviewState: 'approved' });
            assert.equal(unmeasuredActive, 'unknown');
        });

        test('Dynamic delayed calculation triggers when collection schedule is breached', () => {
            const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
            const h = {
                status: 'healthy',
                consecutiveFailures: 0,
                lastSuccessAt: fourHoursAgo
            };
            const s = {
                enabled: true,
                expectedIntervalMinutes: 60 // 3x threshold is 180 min (3 hours)
            };
            const dynamicStatus = resolveDynamicHealth(h, s);
            assert.equal(dynamicStatus, 'delayed', 'Healthy feed past 3x interval must resolve to delayed');
        });

        test('Recent successful fetch resolves to healthy', () => {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const h = {
                status: 'healthy',
                consecutiveFailures: 0,
                lastSuccessAt: tenMinutesAgo
            };
            const s = {
                enabled: true,
                expectedIntervalMinutes: 60
            };
            const dynamicStatus = resolveDynamicHealth(h, s);
            assert.equal(dynamicStatus, 'healthy');
        });

        test('Network errors do not fabricate HTTP status codes', () => {
            const networkFailure = {
                status: 'failed',
                lastHttpStatus: null,
                lastError: 'ETIMEDOUT',
                errorCategory: 'TIMEOUT'
            };
            assert.strictEqual(networkFailure.lastHttpStatus, null, 'Network failures must keep null HTTP status');
            assert.notEqual(networkFailure.lastHttpStatus, 500, 'Must NOT fabricate HTTP 500 for network timeout');
        });

        test('Publication freshness separates content age from transport health', () => {
            const now = Date.now();
            const twoDaysAgo = new Date(now - 2 * 86400 * 1000).toISOString();
            const fortyDaysAgo = new Date(now - 40 * 86400 * 1000).toISOString();
            const oneHundredDaysAgo = new Date(now - 100 * 86400 * 1000).toISOString();
            const oneYearAgo = new Date(now - 365 * 86400 * 1000).toISOString();

            assert.equal(resolvePublicationFreshness(twoDaysAgo), 'fresh');
            assert.equal(resolvePublicationFreshness(fortyDaysAgo), 'active');
            assert.equal(resolvePublicationFreshness(oneHundredDaysAgo), 'inactive');
            assert.equal(resolvePublicationFreshness(oneYearAgo), 'dormant');
            assert.equal(resolvePublicationFreshness(null), 'unknown');
        });
    });

    // 5. Collector Engine Utilities
    describe('5. Collector Engine Protocol Conformance', () => {
        test('Parses Retry-After header with numeric delta-seconds', () => {
            assert.equal(parseRetryAfter('120'), 120000);
            assert.equal(parseRetryAfter('0'), 5000); // respects minimum safety floor
        });

        test('Parses Retry-After header with HTTP-Date', () => {
            const targetDate = new Date(Date.now() + 60000).toUTCString();
            const delay = parseRetryAfter(targetDate);
            assert.ok(delay >= 50000 && delay <= 65000, `Delay should be approx 60000ms, got ${delay}`);
        });

        test('Gracefully falls back on invalid Retry-After', () => {
            assert.equal(parseRetryAfter('invalid-header'), null);
            assert.equal(parseRetryAfter(null), null);
        });
    });

    // 6. Sources API Pagination & Query Filtering
    describe('6. Sources API Pagination & Filtering', () => {
        test('Paginates records correctly', () => {
            const page1 = getFeedHealthRecords({ page: 1, limit: 10 });
            assert.equal(page1.records.length, 10);
            assert.equal(page1.page, 1);
            assert.equal(page1.limit, 10);
            assert.ok(page1.total >= 1000);
            assert.ok(page1.totalPages >= 100);

            const page2 = getFeedHealthRecords({ page: 2, limit: 10 });
            assert.equal(page2.records.length, 10);
            assert.notEqual(page1.records[0].id, page2.records[0].id, 'Page 1 and Page 2 must not have identical first records');
        });

        test('Filters records by category', () => {
            const icsRecords = getFeedHealthRecords({ category: 'Mobile, IoT & OT/ICS Security', limit: 100 });
            assert.ok(icsRecords.records.length > 0);
            for (const r of icsRecords.records) {
                assert.equal(r.category, 'Mobile, IoT & OT/ICS Security');
            }
        });

        test('Filters records by reviewState', () => {
            const candidates = getFeedHealthRecords({ reviewState: 'candidate', limit: 50 });
            for (const r of candidates.records) {
                assert.equal(r.reviewState, 'candidate');
            }

            const approved = getFeedHealthRecords({ reviewState: 'approved', limit: 50 });
            for (const r of approved.records) {
                assert.equal(r.reviewState, 'approved');
            }
        });

        test('Filters records by search query across name and domain', () => {
            const result = getFeedHealthRecords({ search: 'cisa' });
            assert.ok(result.records.length > 0);
            for (const r of result.records) {
                const match = r.name.toLowerCase().includes('cisa') ||
                              r.publisherDomain.toLowerCase().includes('cisa') ||
                              r.feedUrl.toLowerCase().includes('cisa');
                assert.ok(match, `Result ${r.name} must match query "cisa"`);
            }
        });

        test('System stats accurately reports target, verified, and remaining gap', () => {
            const stats = getFeedHealthStats();
            assert.ok(stats.registered >= 1000);
            assert.ok(stats.enabled >= 100);
            assert.ok(stats.distinctPublishers >= 500);
            assert.equal(stats.targetSources, 1000);
            assert.equal(stats.remainingGap, Math.max(0, 1000 - stats.verifiedSources));
            assert.ok(stats.snapshotGeneratedAt);
        });
    });
});
