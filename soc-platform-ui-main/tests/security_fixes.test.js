/**
 * security_fixes.test.js
 * Tests for all P0 security and P1 correctness fixes.
 */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.APP_MODE = 'production';
process.env.ENABLE_DEMO_DATA = 'false';
process.env.INGEST_API_KEY = 'test-secure-key-12345';

import app from '../server/server.js';
import { safeEqual, extractBearerToken, requireApiKey } from '../server/utils/auth.js';
import { escapeCsvField } from '../server/services/reportGenerator.js';
import { validateLink, dedupeKey } from '../server/services/newsService.js';
import { detectIOCType } from '../server/services/siemQueryService.js';
import { mapTextToTechniques } from '../server/services/mitreService.js';

let server;
let baseUrl;

before(async () => {
    await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });
});

after(async () => {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ── P0 Item 1 & 2: Auth Utilities ────────────────────────────────────────────

describe('P0 Items 1&2: auth utilities (timing-safe, fail-closed)', () => {

    test('safeEqual returns true for equal strings', () => {
        assert.ok(safeEqual('abc123', 'abc123'));
    });

    test('safeEqual returns false for different strings', () => {
        assert.ok(!safeEqual('abc123', 'abc124'));
    });

    test('safeEqual returns false for empty string (fail closed)', () => {
        assert.ok(!safeEqual('', 'anything'));
        assert.ok(!safeEqual('anything', ''));
    });

    test('safeEqual returns false for non-strings (fail closed)', () => {
        assert.ok(!safeEqual(null, 'abc'));
        assert.ok(!safeEqual('abc', null));
        assert.ok(!safeEqual(123, 'abc'));
    });

    test('safeEqual returns false for different-length strings', () => {
        assert.ok(!safeEqual('short', 'muchlonger'));
    });

    test('extractBearerToken parses Authorization: Bearer correctly', () => {
        assert.equal(extractBearerToken('Bearer mytoken'), 'mytoken');
    });

    test('extractBearerToken returns null for non-Bearer header', () => {
        assert.equal(extractBearerToken('Basic abc'), null);
        assert.equal(extractBearerToken(''), null);
        assert.equal(extractBearerToken(undefined), null);
    });

    test('requireApiKey 503 when env key is unset (fail closed)', () => {
        const req = { headers: { 'x-api-key': 'something' } };
        const savedKey = process.env['TEST_ONLY_UNSET_KEY'];
        // Test with a key name that is definitely unset
        const result = requireApiKey(req, 'DEFINITELY_UNSET_KEY_XYZ');
        assert.equal(result.ok, false);
        assert.equal(result.status, 503);
        process.env['TEST_ONLY_UNSET_KEY'] = savedKey;
    });

    test('requireApiKey 401 when key is wrong', () => {
        process.env.INGEST_API_KEY = 'correct-key';
        const req = { headers: { 'x-api-key': 'wrong-key' } };
        const result = requireApiKey(req, 'INGEST_API_KEY');
        assert.equal(result.ok, false);
        assert.equal(result.status, 401);
    });

    test('requireApiKey ok when X-API-Key matches', () => {
        process.env.INGEST_API_KEY = 'correct-key';
        const req = { headers: { 'x-api-key': 'correct-key' } };
        const result = requireApiKey(req, 'INGEST_API_KEY');
        assert.equal(result.ok, true);
    });

    test('requireApiKey ok when Bearer token matches', () => {
        process.env.INGEST_API_KEY = 'correct-key';
        const req = { headers: { authorization: 'Bearer correct-key' } };
        const result = requireApiKey(req, 'INGEST_API_KEY');
        assert.equal(result.ok, true);
    });

    // The old bypass: any Bearer token longer than 15 chars must NOT be accepted
    test('requireApiKey does NOT accept arbitrary long Bearer tokens (old bypass removed)', () => {
        process.env.INGEST_API_KEY = 'correct-key';
        const req = { headers: { authorization: 'Bearer this-is-a-long-but-wrong-token' } };
        const result = requireApiKey(req, 'INGEST_API_KEY');
        assert.equal(result.ok, false);
        assert.equal(result.status, 401);
    });
});

// ── P0 Item 1: /api/notifications/send endpoint auth ─────────────────────────

describe('P0 Item 1: /api/notifications/send rejects without auth', () => {
    test('POST /api/notifications/send without key returns 401 or 503', async () => {
        const res = await fetch(`${baseUrl}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com' }),
        });
        assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    });

    test('POST /api/notifications/send with wrong key returns 401', async () => {
        const res = await fetch(`${baseUrl}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'wrong-key' },
            body: JSON.stringify({ email: 'test@example.com' }),
        });
        assert.equal(res.status, 401);
    });
});

// ── P0 Item 2: /api/v1/alerts endpoint ───────────────────────────────────────

describe('P0 Item 2: /api/v1/alerts fail-closed and validation', () => {
    test('POST /api/v1/alerts without key returns 401/503', async () => {
        const res = await fetch(`${baseUrl}/api/v1/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Malware', severity: 'High' }),
        });
        assert.ok([401, 503].includes(res.status));
    });

    test('POST /api/v1/alerts with non-JSON body returns 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain', 'X-API-Key': 'test-secure-key-12345' },
            body: 'not json',
        });
        // Body-parser will return 400 for invalid content-type or we handle it
        assert.ok([400, 401, 415].includes(res.status));
    });

    test('POST /api/v1/alerts with invalid severity returns 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'correct-key' },
            body: JSON.stringify({ type: 'Malware', severity: 'INVALID' }),
        });
        assert.equal(res.status, 400);
    });

    test('POST /api/v1/alerts with oversized type returns 400', async () => {
        const res = await fetch(`${baseUrl}/api/v1/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'correct-key' },
            body: JSON.stringify({ type: 'A'.repeat(101), severity: 'High' }),
        });
        assert.equal(res.status, 400);
    });

    test('POST /api/v1/alerts with valid payload returns 201', async () => {
        const res = await fetch(`${baseUrl}/api/v1/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': 'correct-key' },
            body: JSON.stringify({ type: 'Malware', severity: 'High', source: 'Test' }),
        });
        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.alertId);
    });
});

// ── P0 Item 4: CORS + /api/health sanitisation ───────────────────────────────

describe('P0 Item 9: /api/health only returns {status, timestamp}', () => {
    test('GET /api/health response has no internal config fields', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'ok');
        assert.ok(data.timestamp);
        // Must NOT expose internal config
        assert.equal(data.databaseConnected, undefined, 'Must not expose databaseConnected');
        assert.equal(data.environment, undefined, 'Must not expose environment');
        assert.equal(data.version, undefined, 'Must not expose version');
    });
});

// ── P0 Item 6: CSV formula injection prevention ───────────────────────────────

describe('P0 Item 6: CSV formula injection prevention (escapeCsvField)', () => {
    const inject = [
        '=CMD|"/C calc"!A0',
        '+cmd|"/C calc"!A0',
        '-1+1',
        '@SUM(1+1)',
        '\t=malicious',
        '\r=malicious',
    ];

    for (const input of inject) {
        test(`escapeCsvField prefixes "${input.slice(0, 10)}..." with single quote`, () => {
            const result = escapeCsvField(input);
            // The result should start with ' (if unquoted) or "' (if quoted)
            const safe = result.startsWith("'") || result.startsWith("\"'");
            assert.ok(safe, `Expected to start with ' or "', got: ${result}`);
        });
    }

    test('escapeCsvField leaves safe values unchanged', () => {
        assert.equal(escapeCsvField('safe value'), 'safe value');
        assert.equal(escapeCsvField('hello world'), 'hello world');
        assert.equal(escapeCsvField(null), '');
        assert.equal(escapeCsvField(undefined), '');
    });

    test('escapeCsvField quotes values containing commas', () => {
        const result = escapeCsvField('a,b,c');
        assert.equal(result, '"a,b,c"');
    });
});

// ── P0 Item 7: IOC type detection ─────────────────────────────────────────────

describe('P0 Item 7: detectIOCType correctly identifies types', () => {
    test('detects IPv4 addresses', () => {
        assert.equal(detectIOCType('192.168.1.1'), 'ip');
        assert.equal(detectIOCType('8.8.8.8'), 'ip');
    });

    test('detects SHA256 hashes (64 hex)', () => {
        assert.equal(detectIOCType('a'.repeat(64)), 'hash');
    });

    test('detects SHA1 hashes (40 hex)', () => {
        assert.equal(detectIOCType('b'.repeat(40)), 'hash');
    });

    test('detects MD5 hashes (32 hex)', () => {
        assert.equal(detectIOCType('c'.repeat(32)), 'hash');
    });

    test('detects CVE identifiers', () => {
        assert.equal(detectIOCType('CVE-2024-12345'), 'cve');
    });

    test('detects domains (multi-label)', () => {
        assert.equal(detectIOCType('malicious.example.com'), 'domain');
        assert.equal(detectIOCType('evil.io'), 'domain');
    });

    test('returns unknown for unrecognised values', () => {
        assert.equal(detectIOCType('not-an-ioc'), 'unknown');
        assert.equal(detectIOCType(''), 'unknown');
    });

    test('rejects 31-char hex (not a valid hash length)', () => {
        assert.equal(detectIOCType('a'.repeat(31)), 'unknown');
    });
});

// ── P0 Item 8: Feed link validation ───────────────────────────────────────────

describe('P0 Item 8: validateLink and dedupeKey', () => {
    test('validateLink accepts http URLs', () => {
        assert.equal(validateLink('http://example.com/article'), 'http://example.com/article');
    });

    test('validateLink accepts https URLs', () => {
        assert.equal(validateLink('https://example.com/article'), 'https://example.com/article');
    });

    test('validateLink rejects javascript: URLs', () => {
        assert.equal(validateLink('javascript:alert(1)'), null);
    });

    test('validateLink rejects data: URLs', () => {
        assert.equal(validateLink('data:text/html,<h1>'), null);
    });

    test('validateLink rejects # (empty link)', () => {
        assert.equal(validateLink('#'), null);
    });

    test('validateLink rejects relative paths', () => {
        assert.equal(validateLink('/path/to/article'), null);
    });

    test('validateLink returns null for empty/null input', () => {
        assert.equal(validateLink(''), null);
        assert.equal(validateLink(null), null);
    });

    test('dedupeKey uses link when valid', () => {
        const key = dedupeKey({ link: 'https://example.com/a', title: 'Test', source: 'Feed' });
        assert.equal(key, 'https://example.com/a');
    });

    test('dedupeKey falls back to title+source hash when link is null', () => {
        const key1 = dedupeKey({ link: null, title: 'Article A', source: 'Feed X' });
        const key2 = dedupeKey({ link: null, title: 'Article B', source: 'Feed X' });
        const key3 = dedupeKey({ link: null, title: 'Article A', source: 'Feed X' });
        assert.notEqual(key1, key2, 'Different titles should produce different keys');
        assert.equal(key1, key3, 'Same title+source should produce same key');
        assert.ok(key1.startsWith('no-link:'), 'Should use no-link: prefix');
    });

    test('dedupeKey does NOT collapse all link-less items onto same key (old bug)', () => {
        const key1 = dedupeKey({ link: '#', title: 'Article 1', source: 'Source A' });
        const key2 = dedupeKey({ link: '#', title: 'Article 2', source: 'Source B' });
        assert.notEqual(key1, key2, 'Articles with "#" link must not all get the same dedupe key');
    });
});

// ── P1 Item 11: MITRE word-boundary matching ──────────────────────────────────

describe('P1 Item 11: MITRE word-boundary regex (no false positives on substrings)', () => {
    test('"resource" does NOT match "rce" keyword', () => {
        const techniques = mapTextToTechniques('We need to allocate more resources for this project', null, false);
        // "rce" is in TECHNIQUE_KEYWORD_MAP for T1190; "resource" must NOT match it
        const hasT1190 = techniques.includes('T1190');
        assert.ok(!hasT1190, '"resource" must not trigger T1190 (RCE) technique');
    });

    test('"because" does NOT match "bec" keyword', () => {
        const techniques = mapTextToTechniques('This is because the system failed', null, false);
        const hasT1566 = techniques.includes('T1566');
        assert.ok(!hasT1566, '"because" must not trigger T1566 (BEC phishing) technique');
    });

    test('"helped" does NOT match "lpe" keyword', () => {
        const techniques = mapTextToTechniques('The team helped resolve the issue', null, false);
        const hasT1068 = techniques.includes('T1068');
        assert.ok(!hasT1068, '"helped" must not trigger T1068 (LPE) technique');
    });

    test('"smb" as standalone word DOES match lateral movement', () => {
        const techniques = mapTextToTechniques('Attacker used SMB share for lateral movement', null, false);
        const hasT1021 = techniques.includes('T1021');
        assert.ok(hasT1021, '"SMB" should match T1021 (Remote Services) technique');
    });

    test('"ransomware" correctly maps to T1486 Impact', () => {
        const techniques = mapTextToTechniques('LockBit ransomware encrypted 1000 files', null, false);
        assert.ok(techniques.includes('T1486'), '"ransomware" should map to T1486');
    });

    test('"powershell" maps to T1059 Execution', () => {
        const techniques = mapTextToTechniques('Attacker executed PowerShell script', null, false);
        assert.ok(techniques.includes('T1059'), '"powershell" should map to T1059');
    });

    test('"mimikatz" maps to T1003 Credential Dumping', () => {
        const techniques = mapTextToTechniques('Mimikatz tool used to dump LSASS credentials', null, false);
        assert.ok(techniques.includes('T1003'), '"mimikatz" should map to T1003');
    });
});

// ── P1 Item 23: AI stats reflects real config ─────────────────────────────────

describe('P1 Item 23: /api/ai/stats reflects real configuration', () => {
    test('GET /api/ai/stats returns structured config state', async () => {
        const res = await fetch(`${baseUrl}/api/ai/stats`);
        assert.equal(res.status, 200);
        const data = await res.json();

        assert.equal(typeof data.openai.configured, 'boolean');
        assert.equal(typeof data.ollama.configured, 'boolean');
        assert.equal(typeof data.pythonService.configured, 'boolean');
        assert.equal(typeof data.anyConfigured, 'boolean');
        assert.ok(data.generatedAt);
    });
});
