import express from 'express';
import { enrichIP, enrichHash, enrichCVE, checkAbuseIPDB, enrichAllIOCs, extractIOCs } from '../services/enrichmentService.js';
import { generateQueryBundle, detectIOCType } from '../services/siemQueryService.js';

const router = express.Router();

// ── IP Enrichment ──────────────────────────────────────────────────────────────
// GET /api/enrich/ip/:ip
router.get('/ip/:ip', async (req, res) => {
    const { ip } = req.params;

    // Basic IPv4 validation
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
        res.status(500).json({ error: 'Enrichment failed.', details: err.message });
    }
});

// ── Hash Enrichment ────────────────────────────────────────────────────────────
// GET /api/enrich/hash/:hash
router.get('/hash/:hash', async (req, res) => {
    const { hash } = req.params;

    if (!/^[a-fA-F0-9]{32,64}$/.test(hash)) {
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
        res.status(500).json({ error: 'Enrichment failed.', details: err.message });
    }
});

// ── CVE Enrichment ─────────────────────────────────────────────────────────────
// GET /api/enrich/cve/:cveId
router.get('/cve/:cveId', async (req, res) => {
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
        res.status(500).json({ error: 'CVE enrichment failed.', details: err.message });
    }
});

// ── Bulk IOC Extraction + Enrichment ──────────────────────────────────────────
// POST /api/enrich/iocs
router.post('/iocs', async (req, res) => {
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
        res.status(500).json({ error: 'Bulk enrichment failed.', details: err.message });
    }
});

// ── SIEM Query Generator (standalone) ─────────────────────────────────────────
// GET /api/enrich/queries/:ioc
router.get('/queries/:ioc', (req, res) => {
    const { ioc } = req.params;
    const { type } = req.query; // optional ?type=ip|hash|domain|cve

    if (!ioc || ioc.length > 200) {
        return res.status(400).json({ error: 'Invalid IOC value.' });
    }

    const detectedType = type || detectIOCType(ioc);
    const bundle = generateQueryBundle(ioc, detectedType);
    res.json(bundle);
});

export default router;
