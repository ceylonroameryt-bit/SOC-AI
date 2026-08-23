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

export const sendPeriodicSummary = async (toEmail) => {
    try {
        const reportText = generateReportText();

        const mailOptions = {
            from: process.env.EMAIL_USER || 'soc.intelligence.bot@gmail.com',
            to: toEmail,
            subject: `Security Intelligence Update - ${new Date().toLocaleTimeString()}`,
            text: reportText
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
