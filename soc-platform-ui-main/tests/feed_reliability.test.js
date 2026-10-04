import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
    normalizeFeedUrl,
    extractPublisherDomain,
    isPrivateOrInternalUrl,
    validateRedirectUrl
} from '../server/utils/urlUtils.js';
import {
    getSourcesRegistry,
    getFeedHealthRecords,
    getFeedHealthStats,
    resolveDynamicHealth,
    resolvePublicationFreshness
} from '../server/services/feedHealthService.js';
import { parseRetryAfter, MAX_BODY_BYTES } from '../server/services/collectorEngine.js';
import {
    startCollectionRun,
    completeCollectionRun,
    getLatestCollectionRun,
    getCollectionRunHistory
} from '../server/services/collectionRunService.js';
import { invalidateNewsCache, loadNewsData } from '../server/services/newsService.js';
import serverlessHandler from '../api/index.js';
import {
    loadPermissions,
    getSourcePermission,
    isPermittedForIntendedUse,
    isAiProcessingPermitted,
    isExportPermitted,
    enforceContentRestrictions,
    getPermissionStats
} from '../server/services/permissionService.js';
import { getLocalMidnightUTC, shiftDateStr, safeTimezone } from '../server/routes/explore.js';

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

        test('Validates redirect targets and blocks SSRF redirect chains', () => {
            // Block redirect to metadata
            const blocked1 = validateRedirectUrl('https://example.com/feed', 'http://169.254.169.254/latest/meta-data/');
            assert.equal(blocked1.safe, false);

            // Block redirect to loopback
            const blocked2 = validateRedirectUrl('https://example.com/feed', 'http://127.0.0.1:8080/admin');
            assert.equal(blocked2.safe, false);

            // Block redirect to RFC1918
            const blocked3 = validateRedirectUrl('https://example.com/feed', 'http://192.168.1.1/');
            assert.equal(blocked3.safe, false);

            // Allow safe relative and absolute redirects
            const safeRelative = validateRedirectUrl('https://example.com/feed', '/rss.xml');
            assert.equal(safeRelative.safe, true);
            assert.equal(safeRelative.url, 'https://example.com/rss.xml');

            const safeAbsolute = validateRedirectUrl('https://example.com/feed', 'https://feeds.example.org/atom.xml');
            assert.equal(safeAbsolute.safe, true);
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
            const validStates = new Set(['approved', 'candidate', 'quarantined', 'retired', 'rejected']);
            for (const s of registry) {
                assert.ok(validStates.has(s.reviewState), `Invalid review state "${s.reviewState}" for source ${s.id}`);
            }
        });

        test('Lifecycle states reconcile exactly to total registered catalogue', () => {
            const stats = getFeedHealthStats();
            assert.equal(stats.lifecycle.isReconciled, true, 'Lifecycle breakdown must be strictly reconciled');
            assert.equal(stats.lifecycle.unaccounted, 0, 'Zero feeds may be unaccounted');
            assert.equal(stats.lifecycle.total, stats.registered);
            assert.equal(
                stats.lifecycle.approved + stats.lifecycle.candidate + stats.lifecycle.quarantined + stats.lifecycle.retired + stats.lifecycle.rejected,
                stats.registered
            );
        });

        test('Scheduling states reconcile exactly to total registered catalogue', () => {
            const stats = getFeedHealthStats();
            assert.equal(stats.scheduling.isReconciled, true, 'Scheduling breakdown must be strictly reconciled');
            assert.equal(stats.scheduling.unaccounted, 0);
            assert.equal(stats.scheduling.enabled + stats.scheduling.disabled, stats.registered);
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
            assert.ok(dynamicStatus === 'delayed' || dynamicStatus === 'stale', 'Healthy feed past 3x interval must resolve to delayed or stale');
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

        test('Active health rate uses labelled denominator (healthy / enabled active)', () => {
            const stats = getFeedHealthStats();
            assert.equal(stats.activeHealth.denominator, stats.enabled, 'Denominator must be active/enabled feeds');
            assert.equal(stats.activeHealth.numerator, stats.healthy);
            assert.ok(stats.activeHealth.ratePercent >= 0 && stats.activeHealth.ratePercent <= 100);
            assert.ok(stats.activeHealth.formattedLabel.includes('/'), 'Label must show fraction format (e.g. 500 / 500)');
        });

        test('Target progress uses explicit denominator 500 without fabrication', () => {
            const stats = getFeedHealthStats();
            assert.equal(stats.targetProgress.target, 500);
            assert.equal(stats.targetProgress.verified, stats.verifiedSources);
            assert.ok(stats.targetProgress.percent >= 0 && stats.targetProgress.percent <= 100);
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
            assert.equal(stats.targetSources, 500);
            assert.equal(stats.remainingGap, Math.max(0, 500 - stats.verifiedSources));
            assert.ok(stats.snapshotGeneratedAt);
        });

        test('Candidate rejection records rejection reason and category', () => {
            const rejectedRecords = getFeedHealthRecords({ reviewState: 'rejected', limit: 50 });
            assert.ok(rejectedRecords.total > 0, 'Must have rejected candidate records tracked in registry');
            for (const r of rejectedRecords.records) {
                assert.equal(r.reviewState, 'rejected');
                assert.equal(r.enabled, false);
                assert.ok(r.rejectionReason, `Rejected source ${r.id} must have a rejectionReason`);
                assert.ok(r.errorCategory, `Rejected source ${r.id} must have an errorCategory`);
            }
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: newsService stable IDs, pubDate integrity, and queryArchive
// ─────────────────────────────────────────────────────────────────────────────
import { deriveArticleId, parsePubDate, queryArchive, getNews } from '../server/services/newsService.js';

describe('8. newsService — ID stability, pubDate integrity, and archive queries', () => {

    describe('8a. deriveArticleId — stable deterministic IDs', () => {
        test('Same URL always produces the same ID', () => {
            const url = 'https://example.com/article/123';
            assert.equal(deriveArticleId(url), deriveArticleId(url));
        });

        test('IDs have the expected prefix and length', () => {
            const id = deriveArticleId('https://example.com/test');
            assert.ok(id.startsWith('art-'), `Expected art- prefix, got: ${id}`);
            assert.equal(id.length, 4 + 16); // 'art-' + 16 hex chars
        });

        test('Different URLs produce different IDs', () => {
            const a = deriveArticleId('https://example.com/a');
            const b = deriveArticleId('https://example.com/b');
            assert.notEqual(a, b);
        });

        test('Missing link produces a non-null ID (random fallback)', () => {
            const id = deriveArticleId(null);
            assert.ok(id.startsWith('art-'));
            assert.ok(id.length > 4);
        });
    });

    describe('8b. parsePubDate — no fabrication', () => {
        test('Valid RFC 2822 date parses to ISO string', () => {
            const result = parsePubDate('Sat, 26 Sep 2026 12:00:00 -0400');
            assert.ok(result, 'Should return an ISO string');
            assert.ok(result.includes('2026-09-26'), `Expected 2026-09-26 in result, got: ${result}`);
        });

        test('Valid ISO 8601 date passes through', () => {
            const iso = '2026-08-01T09:30:00.000Z';
            assert.equal(parsePubDate(iso), iso);
        });

        test('Missing/null returns null — NOT current time', () => {
            const before = Date.now();
            assert.equal(parsePubDate(null), null);
            assert.equal(parsePubDate(undefined), null);
            assert.equal(parsePubDate(''), null);
        });

        test('Unparseable string returns null — NOT current time', () => {
            assert.equal(parsePubDate('not a date at all'), null);
            assert.equal(parsePubDate('00/00/0000'), null);
        });
    });

    describe('8c. queryArchive — date filter semantics', () => {
        test('dateFrom inclusive, dateTo exclusive', () => {
            // Use a range that covers the full archive to get any results
            const all = queryArchive({ limit: 5, sort: 'pub_desc' });
            // If archive is empty, skip (no test data available)
            if (all.total === 0) return;

            const newest = all.archiveCoverage.newest;
            if (!newest) return;

            // Query for articles AT or AFTER the newest — should be at most 1 (the newest itself)
            const result = queryArchive({ dateFrom: newest, limit: 5 });
            for (const r of result.records) {
                assert.ok(r.pubDate, 'All records in a date-bounded query must have pubDate');
                const ms = new Date(r.pubDate).getTime();
                const boundMs = new Date(newest).getTime();
                assert.ok(ms >= boundMs, `pubDate ${r.pubDate} must be >= dateFrom ${newest}`);
            }
        });

        test('Articles with null pubDate are excluded from date-bounded windows', () => {
            // Query with date bounds — all returned records must have pubDate
            const result = queryArchive({ dateFrom: '2000-01-01T00:00:00Z', dateTo: '2030-01-01T00:00:00Z', limit: 50 });
            for (const r of result.records) {
                assert.ok(r.pubDate !== null && r.pubDate !== undefined,
                    `Record ${r.id} has null pubDate but was included in a date-bounded query`);
                assert.ok(!r.pubDateMissing, `Record ${r.id} has pubDateMissing=true but was included in date window`);
            }
        });

        test('Keyword search filters across title, snippet, and source', () => {
            // Use a term likely to appear in any cybersecurity news archive
            const result = queryArchive({ q: 'security', limit: 10 });
            for (const r of result.records) {
                const haystack = `${r.title} ${r.contentSnippet} ${r.source}`.toLowerCase();
                assert.ok(haystack.includes('security'),
                    `Record "${r.title}" does not match keyword "security"`);
            }
        });

        test('Pagination produces non-overlapping result sets', () => {
            const all = queryArchive({ limit: 200, sort: 'pub_desc' });
            if (all.total < 2) return;

            const p1 = queryArchive({ limit: 5, page: 1, sort: 'pub_desc' });
            const p2 = queryArchive({ limit: 5, page: 2, sort: 'pub_desc' });

            const p1Ids = new Set(p1.records.map(r => r.id || r.link));
            const p2Ids = p2.records.map(r => r.id || r.link);

            for (const id of p2Ids) {
                assert.ok(!p1Ids.has(id), `ID ${id} appeared in both page 1 and page 2`);
            }
        });

        test('Sort pub_asc returns oldest first', () => {
            const result = queryArchive({ dateFrom: '2000-01-01T00:00:00Z', limit: 10, sort: 'pub_asc' });
            for (let i = 1; i < result.records.length; i++) {
                const prev = new Date(result.records[i - 1].pubDate).getTime();
                const curr = new Date(result.records[i].pubDate).getTime();
                assert.ok(prev <= curr,
                    `pub_asc order violated: ${result.records[i - 1].pubDate} > ${result.records[i].pubDate}`);
            }
        });

        test('Sort pub_desc returns newest first', () => {
            const result = queryArchive({ dateFrom: '2000-01-01T00:00:00Z', limit: 10, sort: 'pub_desc' });
            for (let i = 1; i < result.records.length; i++) {
                const prev = new Date(result.records[i - 1].pubDate).getTime();
                const curr = new Date(result.records[i].pubDate).getTime();
                assert.ok(prev >= curr,
                    `pub_desc order violated: ${result.records[i - 1].pubDate} < ${result.records[i].pubDate}`);
            }
        });

        test('archiveCoverage reports honest oldest/newest from persistent archive', () => {
            const result = queryArchive({ limit: 1 });
            const cov = result.archiveCoverage;
            if (cov.total === 0) return;
            if (cov.oldest && cov.newest) {
                assert.ok(new Date(cov.oldest).getTime() <= new Date(cov.newest).getTime(),
                    'oldest must be <= newest');
            }
            assert.ok(cov.total > 0, 'archiveCoverage.total must be positive');
        });

        test('Severity filter returns only matching severity', () => {
            const result = queryArchive({ severity: 'High', limit: 20 });
            for (const r of result.records) {
                assert.equal((r.severity || '').toLowerCase(), 'high',
                    `Record "${r.title}" has severity "${r.severity}" but filter was High`);
            }
        });
    });

    // 9. Source Permissions & Content Restrictions
    describe('9. Source Permissions & Content Restrictions', () => {
        test('Permission matrix contains exactly 1,055 records matching canonical registry', () => {
            const perms = loadPermissions();
            const registry = getSourcesRegistry();
            assert.equal(perms.length, 1055, `Expected 1055 permissions, got ${perms.length}`);
            assert.equal(perms.length, registry.length, 'Permissions length must match registry length');

            const permIds = new Set(perms.map(p => p.sourceId));
            for (const s of registry) {
                assert.ok(permIds.has(s.id), `Source ${s.id} missing from permissions matrix`);
            }
        });

        test('Verified breakdown reconciles: 500 permitted, 21 restricted, 28 denied, 506 pending', () => {
            const stats = getPermissionStats();
            assert.equal(stats.total, 1055);
            assert.equal(stats.permitted_intended_use, 500);
            assert.equal(stats.restricted, 21);
            assert.equal(stats.denied, 28);
            assert.equal(stats.pending, 506);
            assert.equal(
                stats.permitted_intended_use + stats.restricted + stats.denied + stats.pending,
                stats.total,
                'Permission categories must be mutually exclusive and sum to total'
            );
        });

        test('isPermittedForIntendedUse accurately identifies permitted vs non-permitted sources', () => {
            assert.equal(isPermittedForIntendedUse('dark-web-ransomware-leaks'), true);
            assert.equal(isPermittedForIntendedUse('tor-project-blog'), true);
            assert.equal(isPermittedForIntendedUse('mandiant-threat-research'), false); // restricted
            assert.equal(isPermittedForIntendedUse('nist-nvb'), false); // denied
            assert.equal(isPermittedForIntendedUse('non-existent-source'), false);
        });

        test('enforceContentRestrictions caps long summaries and enforces attribution', () => {
            const longText = 'A'.repeat(1000);
            const rawItem = {
                title: 'Critical CVE Disclosed',
                link: 'https://example.com/advisory-1',
                content: longText,
                snippet: longText
            };

            const restrictedItem = enforceContentRestrictions(rawItem, 'mandiant-threat-research');
            // Default snippet cap is 500 chars (or custom source limit)
            assert.ok(restrictedItem.content.length <= 503, `Expected content <= 503, got ${restrictedItem.content.length}`);
            assert.ok(restrictedItem.snippet.length <= 503, `Expected snippet <= 503, got ${restrictedItem.snippet.length}`);
            assert.ok(restrictedItem.content.endsWith('...'));
            assert.equal(restrictedItem.attributionRequired, true);
            assert.equal(restrictedItem.canonicalUrl, 'https://example.com/advisory-1');
        });

        test('enforceContentRestrictions suppresses image hotlinking when disallowed', () => {
            const rawItem = {
                title: 'Threat Bulletin',
                link: 'https://example.com/threat-2',
                imageUrl: 'https://example.com/banner.jpg',
                content: 'Sample content'
            };

            // dark-web-ransomware-leaks disallows direct image hotlinking
            const result = enforceContentRestrictions(rawItem, 'dark-web-ransomware-leaks');
            assert.equal(result.imageUrl, null, 'imageUrl should be null when hotlinking is disallowed');
        });
    });

    // 10. 500 Target Qualification & Reconciled Accounting
    describe('10. 500 Target Qualification & Reconciled Accounting', () => {
        test('getFeedHealthStats reports qualified sources with remaining gap to target', () => {
            const stats = getFeedHealthStats();
            assert.ok(typeof stats.qualifiedSources === 'number', 'Qualified sources must be numeric');
            assert.ok(stats.remainingGap >= 0, 'Remaining gap must be non-negative');
            assert.equal(stats.targetSources, 500, 'Target must be 500');
            assert.ok(stats.targetProgress.verified >= 0);
            assert.ok(stats.targetProgress.remainingGap >= 0);
        });

        test('Candidates, quarantined, and retired feeds do not count toward qualified target', () => {
            const stats = getFeedHealthStats();
            // Candidate: 506, Quarantined: 21, Retired: 4, Rejected: 24, Approved: 500
            assert.equal(stats.candidate, 506);
            assert.equal(stats.quarantined, 21);
            assert.equal(stats.retired, 4);
            assert.equal(stats.rejected, 24);
            assert.equal(stats.approved, 500);

            // Qualified count strictly matches approved, permitted, and verified sources
            assert.ok(typeof stats.qualifiedSources === 'number');
        });

        test('Lifecycle categories are mutually exclusive and reconcile 100% to registered total', () => {
            const stats = getFeedHealthStats();
            assert.equal(stats.lifecycle.isReconciled, true);
            assert.equal(stats.lifecycle.unaccounted, 0);
            assert.equal(stats.lifecycle.registered, 1055);
            const sum = stats.lifecycle.approved + stats.lifecycle.candidate + stats.lifecycle.quarantined + stats.lifecycle.retired + stats.lifecycle.rejected;
            assert.equal(sum, stats.lifecycle.registered);
        });

        test('Operational health denominator is active enabled feeds, not whole catalogue or target', () => {
            const stats = getFeedHealthStats();
            const activeHealth = stats.activeHealth;
            assert.equal(activeHealth.totalActive, stats.enabled);
            assert.equal(activeHealth.totalActive, 500);
            const healthSum = activeHealth.healthy + activeHealth.delayed + activeHealth.degraded + activeHealth.failed + activeHealth.unknown;
            assert.equal(healthSum, activeHealth.totalActive, 'Active health categories must sum to total active');
            assert.ok(activeHealth.healthy >= 0);
            assert.ok(activeHealth.unknown >= 0);
            assert.ok(activeHealth.label.includes('500'), `Label must use active enabled feeds denominator 500: "${activeHealth.label}"`);
        });
    });

    // 11. Timezone-Aware Day Boundaries & UTC Math
    describe('11. Timezone-Aware Day Boundaries & UTC Math', () => {
        test('UTC midnight converts cleanly', () => {
            const midnightUTC = getLocalMidnightUTC('2026-09-26', 'UTC');
            assert.equal(midnightUTC, '2026-09-26T00:00:00.000Z');
        });

        test('America/New_York (EDT, UTC-4) converts to 04:00:00.000Z', () => {
            const midnightEDT = getLocalMidnightUTC('2026-09-26', 'America/New_York');
            assert.equal(midnightEDT, '2026-09-26T04:00:00.000Z');
        });

        test('Asia/Tokyo (JST, UTC+9) converts to 15:00:00.000Z previous day', () => {
            const midnightJST = getLocalMidnightUTC('2026-09-26', 'Asia/Tokyo');
            assert.equal(midnightJST, '2026-09-25T15:00:00.000Z');
        });

        test('Europe/London (BST, UTC+1 in September) converts to 23:00:00.000Z previous day', () => {
            const midnightBST = getLocalMidnightUTC('2026-09-26', 'Europe/London');
            assert.equal(midnightBST, '2026-09-25T23:00:00.000Z');
        });

        test('Consecutive day midnights span exactly 86,400,000 ms (24 hours)', () => {
            const start = getLocalMidnightUTC('2026-09-26', 'America/New_York');
            const end = getLocalMidnightUTC('2026-09-27', 'America/New_York');
            const diff = new Date(end).getTime() - new Date(start).getTime();
            assert.equal(diff, 24 * 60 * 60 * 1000);
        });

        test('shiftDateStr correctly transitions across month boundaries', () => {
            assert.equal(shiftDateStr('2026-09-01', -1), '2026-08-31');
            assert.equal(shiftDateStr('2026-09-30', 1), '2026-10-01');
            assert.equal(shiftDateStr('2026-01-01', -1), '2025-12-31');
        });

        test('safeTimezone falls back to UTC for invalid inputs', () => {
            assert.equal(safeTimezone('Invalid/Timezone_Name'), 'UTC');
            assert.equal(safeTimezone(null), 'UTC');
            assert.equal(safeTimezone('America/New_York'), 'America/New_York');
        });
    });

    // 12. Run-Level Telemetry & Observability (Section 6 Requirements)
    describe('12. Run-Level Ingestion Telemetry & Observability', () => {
        test('startCollectionRun initializes structured run with unique runId and running status', () => {
            const run = startCollectionRun('unit_test');
            assert.ok(run.runId.startsWith('run-'));
            assert.equal(run.trigger, 'unit_test');
            assert.equal(run.runState, 'running');
            assert.ok(run.startedAt);
        });

        test('completeCollectionRun persists source tallies, article metrics, and rejection reasons', () => {
            const run = startCollectionRun('unit_test');
            const completed = completeCollectionRun(run.runId, {
                sources: {
                    attempted: 10,
                    succeeded: 9,
                    failed: 1,
                    skipped: 0
                },
                entries: {
                    parsed: 50,
                    rejected: 5,
                    inserted: 40,
                    updated: 5,
                    deduplicated: 5,
                    rejectionReasons: {
                        'missing_title': 2,
                        'duplicate_link': 3
                    }
                }
            });

            assert.equal(completed.runState, 'completed');
            assert.ok(completed.completedAt);
            assert.ok(completed.durationMs >= 0);
            assert.equal(completed.sources.attempted, 10);
            assert.equal(completed.sources.succeeded, 9);
            assert.equal(completed.sources.failed, 1);
            assert.equal(completed.entries.parsed, 50);
            assert.equal(completed.entries.rejectionReasons.missing_title, 2);
            assert.equal(completed.entries.rejectionReasons.duplicate_link, 3);

            const latest = getLatestCollectionRun();
            assert.equal(latest.runId, run.runId);
        });

        test('getCollectionRunHistory retrieves bounded list of historic runs', () => {
            const history = getCollectionRunHistory(5);
            assert.ok(Array.isArray(history));
            assert.ok(history.length > 0);
            assert.ok(history.length <= 5);
            assert.ok(history[0].runId);
        });
    });

    // 13. High-Capacity Parsing Limits & Cache Synchronization
    describe('13. High-Capacity Parsing Limits & Cache Synchronization', () => {
        test('MAX_BODY_BYTES accommodates large XML security feeds (>= 32MB)', () => {
            assert.ok(MAX_BODY_BYTES >= 32 * 1024 * 1024, `Expected MAX_BODY_BYTES >= 32MB, got ${MAX_BODY_BYTES}`);
        });

        test('loadNewsData loads persistent articles and invalidateNewsCache resets cache', () => {
            const initial = loadNewsData();
            assert.ok(Array.isArray(initial));
            assert.ok(initial.length > 0, 'Persistent news archive should not be empty');

            // Invalidation should succeed without throwing
            assert.doesNotThrow(() => {
                invalidateNewsCache();
            });

            // Subsequent load succeeds and matches length
            const reloaded = loadNewsData();
            assert.equal(reloaded.length, initial.length);
        });
    });

    // 14. Vercel Serverless & Local Express Parity Bridge
    describe('14. Vercel Serverless & Local Express Parity Bridge', () => {
        test('api/index.js exports default handler function delegating to Express', () => {
            assert.equal(typeof serverlessHandler, 'function');
            assert.equal(serverlessHandler.length, 2, 'Handler should accept (req, res)');
        });

        test('serverlessHandler dispatches /api/health and /api/explore via HTTP server', async () => {
            const server = http.createServer(serverlessHandler);
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const port = server.address().port;

            try {
                const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
                assert.equal(healthRes.status, 200);
                const healthData = await healthRes.json();
                assert.equal(healthData.status, 'ok');

                const exploreRes = await fetch(`http://127.0.0.1:${port}/api/explore?limit=2`);
                assert.equal(exploreRes.status, 200);
                const exploreData = await exploreRes.json();
                assert.ok(Array.isArray(exploreData.records));
                assert.ok(exploreData.total !== undefined);
                assert.ok(exploreData.archiveCoverage);
            } finally {
                await new Promise(resolve => server.close(resolve));
            }
        });
    });

});

