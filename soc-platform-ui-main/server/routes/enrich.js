import express from 'express';
import rateLimit from 'express-rate-limit';
import { enrichIP, enrichHash, enrichCVE, enrichDomain, checkAbuseIPDB, enrichAllIOCs, extractIOCs } from '../services/enrichmentService.js';
import { generateQueryBundle, detectIOCType } from '../services/siemQueryService.js';

const router = express.Router();

// P0 item 5: VirusTotal free tier is 4 req/min per API key.
// Use a conservative 4-req/min limiter (per IP) on enrichment endpoints.
const vtLimiter = rateLimit({
    windowMs: 60 * 1000,          // 1 minute
    max: 4,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for threat enrichment. VirusTotal free tier allows 4 requests/min.' },
});

// A more generous limiter for non-VT query generation
const queryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for query generation.' },
});

// ── IP Enrichment ──────────────────────────────────────────────────────────────
// GET /api/enrich/ip/:ip
router.get('/ip/:ip', vtLimiter, async (req, res) => {
    const { ip } = req.params;

    // Basic IPv4 validation (P0 item 7: length cap)
    if (!ip || ip.length > 45) {
        return res.status(400).json({ error: 'Invalid IP address.' });
    }
    if (!/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IPv4 address format.' });
    }

    try {
        const [virustotal, abuseipdb, queries] = await Promise.all([
            enrichIP(ip),
            checkAbuseIPDB(ip),
            Promise.resolve(generateQueryBundle(ip, 'ip')),
        ]);

        res.json({ ip, virustotal, abuseipdb, queries });
    } catch (err) {
        console.error('[ENRICH IP]', err.message);
        res.status(500).json({ error: 'Enrichment failed.' });
    }
});

// ── Hash Enrichment ────────────────────────────────────────────────────────────
// GET /api/enrich/hash/:hash
// P0 item 13: validate exactly 32, 40 or 64 hex chars only
router.get('/hash/:hash', vtLimiter, async (req, res) => {
    const { hash } = req.params;

    if (!hash || !/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(hash)) {
        return res.status(400).json({ error: 'Invalid hash format. Provide MD5 (32), SHA1 (40), or SHA256 (64) hex string.' });
    }

    try {
        const [virustotal, queries] = await Promise.all([
            enrichHash(hash),
            Promise.resolve(generateQueryBundle(hash, 'hash')),
        ]);

        res.json({ hash, virustotal, queries });
    } catch (err) {
        console.error('[ENRICH HASH]', err.message);
        res.status(500).json({ error: 'Enrichment failed.' });
    }
});

// ── CVE Enrichment ─────────────────────────────────────────────────────────────
// GET /api/enrich/cve/:cveId
router.get('/cve/:cveId', vtLimiter, async (req, res) => {
    const cveId = req.params.cveId.toUpperCase();

    if (!/^CVE-\d{4}-\d{4,7}$/.test(cveId)) {
        return res.status(400).json({ error: 'Invalid CVE format. Expected: CVE-YYYY-NNNNN' });
    }

    try {
        const [enrichment, queries] = await Promise.all([
            enrichCVE(cveId),
            Promise.resolve(generateQueryBundle(cveId, 'cve')),
        ]);

        res.json({ cveId, enrichment, queries });
    } catch (err) {
        console.error('[ENRICH CVE]', err.message);
        res.status(500).json({ error: 'CVE enrichment failed.' });
    }
});

// ── Domain Enrichment ──────────────────────────────────────────────────────────
// GET /api/enrich/domain/:domain (Phase 19)
router.get('/domain/:domain', vtLimiter, async (req, res) => {
    const { domain } = req.params;

    if (!domain || domain.length > 253) {
        return res.status(400).json({ error: 'Invalid domain length.' });
    }
    if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain format.' });
    }

    try {
        const [virustotal, queries] = await Promise.all([
            enrichDomain(domain),
            Promise.resolve(generateQueryBundle(domain, 'domain')),
        ]);

        res.json({ domain, virustotal, queries });
    } catch (err) {
        console.error('[ENRICH DOMAIN]', err.message);
        res.status(500).json({ error: 'Domain enrichment failed.' });
    }
});

// ── Bulk IOC Extraction + Enrichment ──────────────────────────────────────────
// POST /api/enrich/iocs
router.post('/iocs', vtLimiter, async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Request body must include a non-empty "text" field.' });
    }
    if (text.length > 10000) {
        return res.status(400).json({ error: 'Text too long. Maximum 10,000 characters.' });
    }

    try {
        const extracted = extractIOCs(text);
        const enriched = await enrichAllIOCs(extracted);

        // Generate query bundles for each IOC
        const ipQueries = extracted.ips.map(ip => generateQueryBundle(ip, 'ip'));
        const hashQueries = extracted.hashes.map(h => generateQueryBundle(h, 'hash'));
        const cveQueries = extracted.cves.map(c => generateQueryBundle(c, 'cve'));
        const domainQueries = extracted.domains.map(d => generateQueryBundle(d, 'domain'));

        res.json({
            extracted,
            enriched,
            queries: {
                ips: ipQueries,
                hashes: hashQueries,
                cves: cveQueries,
                domains: domainQueries,
            },
            summary: {
                totalIOCs: extracted.ips.length + extracted.hashes.length + extracted.cves.length + extracted.domains.length,
                extractedAt: new Date().toISOString(),
            }
        });
    } catch (err) {
        console.error('[ENRICH BULK]', err.message);
        res.status(500).json({ error: 'Bulk enrichment failed.' });
    }
});

// ── SIEM Query Generator (standalone) ─────────────────────────────────────────
// GET /api/enrich/queries/:ioc
// P0 item 7: reject unknown IOC types, cap length at 200
router.get('/queries/:ioc', queryLimiter, (req, res) => {
    const ioc = req.params.ioc;

    if (!ioc || ioc.length > 200) {
        return res.status(400).json({ error: 'IOC value missing or exceeds 200-character limit.' });
    }

    const detectedType = req.query.type || detectIOCType(ioc);

    // P0 item 7: reject IOCs that don't match a known type
    if (detectedType === 'unknown') {
        return res.status(400).json({
            error: 'IOC does not match any known type (ip, domain, hash, cve). Provide ?type=ip|domain|hash|cve to override.'
        });
    }

    const bundle = generateQueryBundle(ioc, detectedType);
    res.json(bundle);
});

export default router;
