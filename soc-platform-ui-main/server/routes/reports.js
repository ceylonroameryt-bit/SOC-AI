import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    generatePdfReport,
    generateDocxReport,
    exportThreatsToStix,
    escapeCsvField
} from '../services/reportGenerator.js';
import { getAuthoritativeNews } from '../services/newsService.js';
import { getThreatsFromDb, isDbConnected } from '../db/db.js';
import { filterByRange } from '../services/dashboardEvidence.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THREATS_FILE = path.join(__dirname, '../data/threats.json');

const loadThreatsFallback = () => {
    if (!fs.existsSync(THREATS_FILE)) return [];
    try {
        const raw = fs.readFileSync(THREATS_FILE, 'utf8');
        if (!raw || !raw.trim()) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
};

async function getAuthoritativeThreats() {
    if (isDbConnected()) {
        try {
            return await getThreatsFromDb({ limit: 1000 });
        } catch {
            return loadThreatsFallback();
        }
    }
    return loadThreatsFallback();
}

/**
 * GET /api/reports/daily
 * Default: Returns PDF
 * ?format=docx: Returns DOCX
 * Phase 14: queries authoritative database and includes provenance and honest empty explanation.
 */
router.get('/daily', async (req, res) => {
    try {
        const range = req.query.time || req.query.range || '24h';
        const allNews = await getAuthoritativeNews();
        const news = filterByRange(allNews, range);
        const threats = await getAuthoritativeThreats();
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (req.query.format || 'pdf').toLowerCase();

        res.setHeader('Cache-Control', 'private, no-store');

        const metadata = {
            reportingWindow: range,
            generationTimestamp: new Date().toISOString(),
            intelligenceCount: news.length,
            threatCount: threats.length,
            criticalCount: news.filter(n => n.severity === 'Critical').length,
            highCount: news.filter(n => n.severity === 'High').length,
            provenance: 'Generated from authoritative PostgreSQL threat intelligence database.',
            notice: news.length === 0
                ? 'Notice: No intelligence records were collected for this reporting window.'
                : undefined,
        };

        if (format === 'docx') {
            const docxBuffer = generateDocxReport({
                title: `NO ENTRY SOC Intelligence Report (${dateStr})`,
                date: dateStr,
                news,
                threats,
                metadata,
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-daily-report-${dateStr}.docx"`);
            return res.send(docxBuffer);
        }

        // PDF by default
        const pdfBuffer = generatePdfReport({
            title: `NO ENTRY SOC Intelligence Report (${dateStr})`,
            date: dateStr,
            news,
            threats,
            metadata,
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-daily-report-${dateStr}.pdf"`);
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('[REPORTS ROUTE] Generation error:', error);
        res.status(500).json({ error: 'Failed to generate report', message: error.message });
    }
});

/**
 * GET /api/reports/export/threats
 * Default: CSV
 * ?format=json: JSON
 * ?format=stix2: STIX 2.1 bundle
 */
router.get('/export/threats', async (req, res) => {
    try {
        const threats = await getAuthoritativeThreats();
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (req.query.format || 'csv').toLowerCase();

        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'stix2' || format === 'stix') {
            const stixBundle = exportThreatsToStix(threats);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-stix2-${dateStr}.json"`);
            return res.json(stixBundle);
        }

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-${dateStr}.json"`);
            return res.json(threats);
        }

        // Default: CSV
        let csv = 'ID,Timestamp,Severity,Type,Source,Description,Malicious_IPs,C2_Domains,SHA256,CVEs,Is_Simulated\n';
        threats.forEach(t => {
            const ips = t.ioc?.ip_addresses ? t.ioc.ip_addresses.join('; ') : '';
            const domains = t.ioc?.domains ? t.ioc.domains.join('; ') : '';
            const sha256 = t.ioc?.sha256 || '';
            const cves = t.ioc?.cves ? t.ioc.cves.join('; ') : '';
            const isSimulated = t.isSimulated ? 'true' : 'false';

            csv += [
                escapeCsvField(t.id),
                escapeCsvField(t.timestamp),
                escapeCsvField(t.severity),
                escapeCsvField(t.type),
                escapeCsvField(t.source),
                escapeCsvField(t.description),
                escapeCsvField(ips),
                escapeCsvField(domains),
                escapeCsvField(sha256),
                escapeCsvField(cves),
                escapeCsvField(isSimulated)
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-${dateStr}.csv"`);
        return res.send(csv);

    } catch (error) {
        console.error('[REPORTS ROUTE] Export threats error:', error);
        res.status(500).json({ error: 'Failed to export threats', message: error.message });
    }
});

/**
 * GET /api/reports/export/news
 * Default: CSV
 * ?format=json: JSON
 */
router.get('/export/news', async (req, res) => {
    try {
        const range = req.query.time || req.query.range || 'all';
        const allNews = await getAuthoritativeNews();
        const news = filterByRange(allNews, range);
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (req.query.format || 'csv').toLowerCase();

        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-news-${dateStr}.json"`);
            return res.json(news);
        }

        let csv = 'Date,Severity,Category,Source,Title,Link,Snippet\n';
        news.forEach(n => {
            csv += [
                escapeCsvField(n.pubDate),
                escapeCsvField(n.severity),
                escapeCsvField(n.category || 'General'),
                escapeCsvField(n.source),
                escapeCsvField(n.title),
                escapeCsvField(n.link),
                escapeCsvField(n.contentSnippet)
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-news-${dateStr}.csv"`);
        return res.send(csv);

    } catch (error) {
        console.error('[REPORTS ROUTE] Export news error:', error);
        res.status(500).json({ error: 'Failed to export news', message: error.message });
    }
});

export default router;
