/**
 * routes/reports.js
 * Express router for Executive & Tactical Intelligence Reports (PDF, DOCX, CSV, JSON, STIX).
 * Queries the authoritative PostgreSQL / In-Memory database matching dashboard filters.
 */

import express from 'express';
import {
    generatePdfReport,
    generateDocxReport,
    exportThreatsToStix,
    escapeCsvField
} from '../services/reportGenerator.js';
import { getArticles, getArticleStats, getThreatAlerts } from '../db/db.js';

const router = express.Router();

/**
 * GET /api/reports/daily
 * Generates an executive SITREP report in PDF or DOCX format.
 * Matches current reporting window and authoritative database intelligence.
 */
router.get('/daily', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const format = (req.query.format || 'pdf').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';

        const [news, threats, stats] = await Promise.all([
            getArticles({ limit: 100, timeRange, isDemoEnabled }),
            getThreatAlerts(isDemoEnabled),
            getArticleStats(timeRange, isDemoEnabled)
        ]);

        const dateStr = new Date().toISOString().split('T')[0];
        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'docx') {
            const docxBuffer = generateDocxReport({
                title: `NO ENTRY SOC Intelligence Report (${dateStr})`,
                date: dateStr,
                news,
                threats,
                timeRange,
                totalCount: stats.total,
                criticalCount: stats.critical,
                highCount: stats.high
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
            timeRange,
            totalCount: stats.total,
            criticalCount: stats.critical,
            highCount: stats.high
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-daily-report-${dateStr}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('[REPORTS ROUTE ERROR]', err);
        res.status(500).json({ success: false, code: 'REPORT_GEN_ERROR', error: 'Failed to generate intelligence report.', details: err.message });
    }
});

/**
 * GET /api/reports/export/news
 * Exports news records in CSV or JSON.
 */
router.get('/export/news', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || 'all').toLowerCase();
        const format = (req.query.format || 'json').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const articles = await getArticles({ limit: 500, timeRange, isDemoEnabled });

        if (format === 'csv') {
            const headers = ['Date', 'Severity', 'Category', 'Source', 'Title', 'Link', 'Snippet'];
            const rows = articles.map(item => [
                escapeCsvField(item.pubDate || ''),
                escapeCsvField(item.severity || ''),
                escapeCsvField(item.category || item.sourceCategory || ''),
                escapeCsvField(item.source || ''),
                escapeCsvField(item.title || ''),
                escapeCsvField(item.link || ''),
                escapeCsvField(item.contentSnippet || item.snippet || '')
            ].join(','));

            const csvContent = [headers.join(','), ...rows].join('\r\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="no-entry-news-export.csv"');
            return res.send(csvContent);
        }

        res.setHeader('Content-Type', 'application/json');
        res.json(articles);
    } catch (err) {
        res.status(500).json({ success: false, code: 'EXPORT_ERROR', error: 'News export failed.' });
    }
});

/**
 * GET /api/reports/export/threats
 * Exports threat records in STIX 2.1 or JSON.
 */
router.get('/export/threats', async (req, res) => {
    try {
        const format = (req.query.format || 'json').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const threats = await getThreatAlerts(isDemoEnabled);

        if (format === 'stix') {
            const stixBundle = exportThreatsToStix(threats);
            res.setHeader('Content-Type', 'application/json');
            return res.json(stixBundle);
        }

        res.setHeader('Content-Type', 'application/json');
        res.json(threats);
    } catch (err) {
        res.status(500).json({ success: false, code: 'EXPORT_ERROR', error: 'Threats export failed.' });
    }
});

/**
 * GET /api/reports/export/csv
 * Exports authoritative intelligence records to RFC 4180 CSV with formula injection protection.
 */
router.get('/export/csv', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const articles = await getArticles({ limit: 500, timeRange, isDemoEnabled });

        const headers = [
            'ID', 'Title', 'Severity', 'Category', 'Source',
            'Source URL', 'Published Date', 'Ingested Date', 'Classification Method'
        ];

        const rows = articles.map(item => [
            escapeCsvField(item.id || ''),
            escapeCsvField(item.title || ''),
            escapeCsvField(item.severity || ''),
            escapeCsvField(item.category || item.sourceCategory || ''),
            escapeCsvField(item.source || ''),
            escapeCsvField(item.link || ''),
            escapeCsvField(item.pubDate || ''),
            escapeCsvField(item.ingestedAt || ''),
            escapeCsvField(item.classificationMethod || '')
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\r\n');
        const filename = `no-entry-threat-export-${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(csvContent);

    } catch (err) {
        console.error('[CSV EXPORT ERROR]', err);
        res.status(500).json({ success: false, code: 'EXPORT_ERROR', error: 'CSV export failed.' });
    }
});

/**
 * GET /api/reports/export/json
 * Full structured JSON dump of authoritative intelligence records.
 */
router.get('/export/json', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const articles = await getArticles({ limit: 500, timeRange, isDemoEnabled });

        const exportPayload = {
            metadata: {
                platform: 'NO ENTRY SOC Intelligence Platform',
                reportingWindow: timeRange,
                generatedAt: new Date().toISOString(),
                recordCount: articles.length,
                isDemoEnabled
            },
            articles
        };

        const filename = `no-entry-intel-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(exportPayload);

    } catch (err) {
        res.status(500).json({ success: false, code: 'EXPORT_ERROR', error: 'JSON export failed.' });
    }
});

/**
 * GET /api/reports/export/stix
 * Exports threats in OASIS STIX 2.1 JSON format.
 */
router.get('/export/stix', async (req, res) => {
    try {
        const timeRange = (req.query.time || req.query.range || '24h').toLowerCase();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const [news, threats] = await Promise.all([
            getArticles({ limit: 100, timeRange, isDemoEnabled }),
            getThreatAlerts(isDemoEnabled)
        ]);

        const combined = [...news, ...threats];
        const stixBundle = exportThreatsToStix(combined);
        const filename = `no-entry-stix2.1-bundle-${new Date().toISOString().split('T')[0]}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(stixBundle);

    } catch (err) {
        res.status(500).json({ success: false, code: 'EXPORT_ERROR', error: 'STIX export failed.' });
    }
});

export default router;
