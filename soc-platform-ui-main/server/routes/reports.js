import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEWS_FILE = path.join(__dirname, '../data/news.json');
const THREATS_FILE = path.join(__dirname, '../data/threats.json');

const loadData = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
};

router.get('/daily', (req, res) => {
    try {
        const news = loadData(NEWS_FILE);
        const threats = loadData(THREATS_FILE);
        const todayStr = new Date().toDateString();

        // Filter for today
        const todaysNews = news.filter(n => new Date(n.pubDate).toDateString() === todayStr);
        const todaysThreats = threats.filter(t => new Date(t.timestamp).toDateString() === todayStr);

        let report = `DAILY SECURITY INTELLIGENCE REPORT\n`;
        report += `Generated: ${new Date().toLocaleString()}\n`;
        report += `==========================================\n\n`;

        report += `[ SUMMARY ]\n`;
        report += `Total New Threats: ${todaysThreats.length}\n`;
        report += `Total News Items: ${todaysNews.length}\n`;
        report += `\n`;

        report += `[ ACTIVE THREATS ]\n`;
        if (todaysThreats.length === 0) report += `No active threats detected today.\n`;
        todaysThreats.forEach(t => {
            report += `• [${t.severity.toUpperCase()}] ${t.type} (${t.source})\n`;
            report += `  desc: ${t.description}\n`;
            if (t.ioc?.ip_addresses) report += `  IPs: ${t.ioc.ip_addresses.join(', ')}\n`;
            report += `\n`;
        });
        report += `==========================================\n\n`;

        report += `[ GLOBAL SECURITY NEWS ]\n`;
        if (todaysNews.length === 0) report += `No news items for today.\n`;
        todaysNews.forEach(n => {
            report += `• ${n.title}\n`;
            report += `  Source: ${n.source} | Severity: ${n.severity || 'N/A'}\n`;
            report += `  Link: ${n.link}\n`;
            report += `\n`;
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="Daily_Report_${new Date().toISOString().split('T')[0]}.txt"`);
        res.send(report);

    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).send('Error generating report');
    }
});

// Helper to escape CSV fields
const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

router.get('/export/threats', (req, res) => {
    try {
        const threats = loadData(THREATS_FILE);
        let csv = 'ID,Date,Severity,Type,Source,Description,Malicious IPs,C2 Domains,MD5 Hash,SHA1 Hash,SHA256 Hash\n';

        threats.forEach(t => {
            const ips = t.ioc?.ip_addresses ? t.ioc.ip_addresses.join('; ') : '';
            const domains = t.ioc?.domains ? t.ioc.domains.join('; ') : '';
            const md5 = t.ioc?.md5 || '';
            const sha1 = t.ioc?.sha1 || '';
            const sha256 = t.ioc?.sha256 || '';

            csv += [
                escapeCSV(t.id),
                escapeCSV(t.timestamp),
                escapeCSV(t.severity),
                escapeCSV(t.type),
                escapeCSV(t.source),
                escapeCSV(t.description),
                escapeCSV(ips),
                escapeCSV(domains),
                escapeCSV(md5),
                escapeCSV(sha1),
                escapeCSV(sha256)
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="Threat_History_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).send('Error exporting threats');
    }
});

router.get('/export/news', (req, res) => {
    try {
        const news = loadData(NEWS_FILE);
        let csv = 'Date,Severity,Category,Source,Title,Link,Snippet\n';

        news.forEach(n => {
            csv += [
                escapeCSV(n.pubDate),
                escapeCSV(n.severity),
                escapeCSV(n.category || 'General'),
                escapeCSV(n.source),
                escapeCSV(n.title),
                escapeCSV(n.link),
                escapeCSV(n.contentSnippet)
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="News_Archive_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).send('Error exporting news');
    }
});

export default router;
