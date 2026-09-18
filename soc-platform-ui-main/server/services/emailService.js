import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEWS_FILE = path.join(__dirname, '../data/news.json');
const THREATS_FILE = path.join(__dirname, '../data/threats.json');

// Configure via ENV or hardcode for demo
// USER MUST CONFIGURE THIS
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com', // Replace with valid
        pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD'    // Replace with valid
    }
});

const loadData = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return [];
    }
};

const generateReportText = () => {
    const news = loadData(NEWS_FILE);
    const threats = loadData(THREATS_FILE);
    const todayStr = new Date().toDateString();

    const todaysNews = news.filter(n => new Date(n.pubDate).toDateString() === todayStr);
    const todaysThreats = threats.filter(t => new Date(t.timestamp).toDateString() === todayStr);

    let report = `PERIODIC SECURITY INTELLIGENCE REPORT\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `==========================================\n\n`;

    report += `[ SUMMARY ]\n`;
    report += `Total New Threats: ${todaysThreats.length}\n`;
    report += `Total News Items: ${todaysNews.length}\n`;
    report += `\n`;

    report += `[ ACTIVE THREATS ]\n`;
    if (todaysThreats.length === 0) report += `No active threats detected in this period.\n`;
    todaysThreats.forEach(t => {
        report += `• [${t.severity.toUpperCase()}] ${t.type} (${t.source})\n`;
        report += `  desc: ${t.description}\n`;
        report += `\n`;
    });
    report += `==========================================\n\n`;

    report += `[ GLOBAL SECURITY NEWS ]\n`;
    if (todaysNews.length === 0) report += `No news items for this period.\n`;
    todaysNews.forEach(n => {
        report += `• ${n.title}\n`;
        report += `  Source: ${n.source} | Severity: ${n.severity || 'N/A'}\n`;
        report += `  Link: ${n.link}\n`;
        report += `\n`;
    });

    return report;
};

const generateReportHtml = () => {
    const news = loadData(NEWS_FILE);
    const threats = loadData(THREATS_FILE);
    const todayStr = new Date().toDateString();

    const todaysNews = news.filter(n => new Date(n.pubDate).toDateString() === todayStr);
    const todaysThreats = threats.filter(t => new Date(t.timestamp).toDateString() === todayStr);

    const severityColor = (sev) => {
        const s = (sev || '').toLowerCase();
        if (s === 'critical') return '#ef4444';
        if (s === 'high') return '#f97316';
        if (s === 'medium') return '#eab308';
        return '#3b82f6';
    };

    const threatsHtml = todaysThreats.length === 0
        ? '<p style="color: #64748b; font-style: italic;">No active threats detected in this period.</p>'
        : todaysThreats.map(t => `
            <div style="padding: 10px 14px; margin-bottom: 8px; background-color: #f8fafc; border-left: 4px solid ${severityColor(t.severity)}; border-radius: 4px;">
                <span style="display: inline-block; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 2px 6px; background-color: ${severityColor(t.severity)}; color: #ffffff; border-radius: 3px; margin-right: 8px;">${t.severity}</span>
                <strong style="color: #0f172a;">${t.type || 'Threat'}</strong> <span style="color: #64748b; font-size: 12px;">(${t.source || 'Unknown'})</span>
                <p style="margin: 4px 0 0 0; color: #334155; font-size: 13px;">${t.description || ''}</p>
            </div>
        `).join('');

    const newsHtml = todaysNews.length === 0
        ? '<p style="color: #64748b; font-style: italic;">No news items for this period.</p>'
        : todaysNews.map(n => `
            <div style="padding: 10px 14px; margin-bottom: 8px; background-color: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;">
                <a href="${n.link || '#'}" style="font-weight: 600; color: #2563eb; text-decoration: none; font-size: 14px;">${n.title}</a>
                <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                    Source: <strong>${n.source || 'N/A'}</strong> | Severity: <span style="color: ${severityColor(n.severity)}; font-weight: 600;">${n.severity || 'N/A'}</span>
                </div>
            </div>
        `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
                <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">NO ENTRY — Security Intelligence Report</h1>
                <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">Generated: ${new Date().toLocaleString()}</p>
            </div>
            <div style="padding: 24px;">
                <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                    <div style="padding: 12px 16px; background-color: #f1f5f9; border-radius: 6px; flex: 1;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Active Threats</div>
                        <div style="font-size: 22px; font-weight: 700; color: #0f172a;">${todaysThreats.length}</div>
                    </div>
                    <div style="padding: 12px 16px; background-color: #f1f5f9; border-radius: 6px; flex: 1;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">News Items</div>
                        <div style="font-size: 22px; font-weight: 700; color: #0f172a;">${todaysNews.length}</div>
                    </div>
                </div>

                <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Active Threats</h3>
                ${threatsHtml}

                <h3 style="margin: 24px 0 12px 0; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">Global Security News</h3>
                ${newsHtml}
            </div>
            <div style="padding: 14px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
                NO ENTRY SOC Intelligence Platform &bull; Automated Briefing
            </div>
        </div>
    </body>
    </html>
    `;
};

export const sendPeriodicSummary = async (toEmail) => {
    try {
        const reportText = generateReportText();
        const reportHtml = generateReportHtml();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'soc.intelligence.bot@gmail.com',
            to: toEmail,
            subject: `Security Intelligence Update - ${new Date().toLocaleTimeString()}`,
            text: reportText,
            html: reportHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Sent successfully: ' + info.response);
        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('[EMAIL ERROR]', error.message);
        // Never leak internal error details to the client
        return { success: false, error: 'Email delivery failed. Check server logs.' };
    }
};
