import Parser from 'rss-parser';

const parser = new Parser({ timeout: 5000 }); // 5s per-feed timeout

// ─── Fallback news shown instantly if RSS fails ───────────────────────────────
const FALLBACK_NEWS = [
    { title: 'CISA Releases Critical Infrastructure Security Advisories', link: 'https://www.cisa.gov/cybersecurity-advisories', pubDate: new Date().toISOString(), contentSnippet: 'CISA has released advisories for multiple ICS and SCADA products containing critical vulnerabilities.', source: 'CISA', severity: 'Critical', category: 'Government', fetchedAt: new Date().toISOString() },
    { title: 'Ransomware Group Claims Attack on Major Financial Institution', link: 'https://www.bleepingcomputer.com', pubDate: new Date(Date.now() - 1800000).toISOString(), contentSnippet: 'A sophisticated ransomware group has claimed responsibility for a cyberattack on a large financial institution, encrypting systems and exfiltrating data.', source: 'BleepingComputer', severity: 'Critical', category: 'Ransomware', fetchedAt: new Date().toISOString() },
    { title: 'New Zero-Day Vulnerability Discovered in Popular VPN Software', link: 'https://thehackernews.com', pubDate: new Date(Date.now() - 3600000).toISOString(), contentSnippet: 'Security researchers have discovered a critical zero-day remote code execution vulnerability affecting millions of VPN users worldwide.', source: "The Hacker's News", severity: 'Critical', category: 'Vulnerability', fetchedAt: new Date().toISOString() },
    { title: 'APT Group Targets Healthcare Sector with Sophisticated Malware', link: 'https://krebsonsecurity.com', pubDate: new Date(Date.now() - 5400000).toISOString(), contentSnippet: 'A state-sponsored APT group has launched a targeted campaign against healthcare organizations using a novel multi-stage malware dropper.', source: 'Krebs on Security', severity: 'High', category: 'Malware', fetchedAt: new Date().toISOString() },
    { title: 'NIST Updates Cybersecurity Framework to Version 2.0', link: 'https://www.nist.gov/cyberframework', pubDate: new Date(Date.now() - 7200000).toISOString(), contentSnippet: 'NIST has released the final version of the Cybersecurity Framework 2.0, adding new governance and supply chain security guidance.', source: 'NIST', severity: 'Medium', category: 'Government', fetchedAt: new Date().toISOString() },
    { title: 'Large-Scale Phishing Campaign Targets Microsoft 365 Users', link: 'https://www.securityweek.com', pubDate: new Date(Date.now() - 9000000).toISOString(), contentSnippet: 'Security researchers have identified a large-scale phishing campaign using adversary-in-the-middle (AiTM) techniques to bypass MFA on Microsoft 365.', source: 'SecurityWeek', severity: 'High', category: 'Phishing', fetchedAt: new Date().toISOString() },
    { title: 'Data Breach Exposes 50 Million Records from Cloud Provider', link: 'https://www.darkreading.com', pubDate: new Date(Date.now() - 10800000).toISOString(), contentSnippet: 'A misconfigured cloud storage bucket has exposed over 50 million sensitive customer records including PII and financial data.', source: 'Dark Reading', severity: 'High', category: 'Data Breach', fetchedAt: new Date().toISOString() },
    { title: 'Botnet Infrastructure Leveraged for Distributed DDoS Attacks', link: 'https://www.bleepingcomputer.com', pubDate: new Date(Date.now() - 12600000).toISOString(), contentSnippet: 'Law enforcement agencies have dismantled a significant botnet used to conduct DDoS attacks against critical infrastructure targets globally.', source: 'BleepingComputer', severity: 'Medium', category: 'Malware', fetchedAt: new Date().toISOString() },
    { title: 'Critical Patch Released for Widely Exploited FortiGate Vulnerability', link: 'https://thehackernews.com', pubDate: new Date(Date.now() - 14400000).toISOString(), contentSnippet: 'Fortinet has released emergency patches for a critical authentication bypass vulnerability in FortiGate firewalls that is being actively exploited.', source: "The Hacker's News", severity: 'Critical', category: 'Vulnerability', fetchedAt: new Date().toISOString() },
    { title: 'Dark Web Market Lists Corporate VPN Credentials for Sale', link: 'https://krebsonsecurity.com', pubDate: new Date(Date.now() - 16200000).toISOString(), contentSnippet: 'Security analysts have identified listings on underground forums selling valid corporate VPN credentials for hundreds of Fortune 500 companies.', source: 'Krebs on Security', severity: 'High', category: 'Dark Web', fetchedAt: new Date().toISOString() },
];

// ─── RSS Feed Sources ─────────────────────────────────────────────────────────
const RSS_FEEDS = [
    { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', name: 'CISA Advisories', category: 'Government', type: 'Official Advisories' },
    { url: 'https://www.bleepingcomputer.com/feed/', name: 'BleepingComputer', category: 'News', type: 'Security News' },
    { url: 'https://feeds.feedburner.com/TheHackersNews', name: "The Hacker's News", category: 'News', type: 'Threat Intelligence' },
    { url: 'https://krebsonsecurity.com/feed/', name: 'Krebs on Security', category: 'Research', type: 'Security Research' },
];

// ─── Keyword Classification ───────────────────────────────────────────────────
const SEVERITY_KEYWORDS = {
    Critical: ['zero-day', 'rce', 'remote code execution', 'critical', 'exploit', 'unpatched', 'active exploitation'],
    High:     ['ransomware', 'breach', 'leak', 'vulnerability', 'attack', 'malware', 'backdoor', 'trojan', 'apt'],
    Medium:   ['patch', 'update', 'warning', 'advisory', 'phishing', 'scam', 'botnet', 'ddos'],
};

const CATEGORY_KEYWORDS = {
    'Ransomware':   ['ransomware', 'encrypt', 'extortion', 'lockbit', 'clop', 'blackcat'],
    'Data Breach':  ['breach', 'leak', 'database', 'exposed', 'records', 'dump', 'stolen'],
    'Vulnerability':['vulnerability', 'cve', 'zero-day', 'exploit', 'bug', 'patch', 'rce'],
    'Malware':      ['malware', 'trojan', 'virus', 'spyware', 'backdoor', 'loader', 'botnet'],
    'Phishing':     ['phishing', 'scam', 'credential', 'harvesting', 'social engineering'],
    'Government':   ['cisa', 'fbi', 'nsa', 'nist', 'directive', 'act', 'regulation'],
    'Dark Web':     ['dark web', 'onion', 'tor', 'market', 'underground', 'forum'],
};

function determineSeverity(title = '', snippet = '') {
    const text = `${title} ${snippet}`.toLowerCase();
    if (SEVERITY_KEYWORDS.Critical.some(k => text.includes(k))) return 'Critical';
    if (SEVERITY_KEYWORDS.High.some(k => text.includes(k))) return 'High';
    if (SEVERITY_KEYWORDS.Medium.some(k => text.includes(k))) return 'Medium';
    return 'Low';
}

function determineCategory(title = '', snippet = '') {
    const text = `${title} ${snippet}`.toLowerCase();
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
        if (kws.some(k => text.includes(k))) return cat;
    }
    return 'General Info';
}

// ─── In-Memory Cache ───────────────────────────────────────────────────────────
let NEWS_CACHE = [...FALLBACK_NEWS];  // Pre-seeded with fallback so first call is instant
let CACHE_TIME = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let fetchInProgress = false;

async function getNews() {
    const now = Date.now();

    // Start a background refresh if cache is stale, but return immediately
    if (!fetchInProgress && now - CACHE_TIME > CACHE_TTL_MS) {
        fetchInProgress = true;
        fetchRSSInBackground();
    }

    return NEWS_CACHE;
}

async function fetchRSSInBackground() {
    try {
        const news = [];
        const promises = RSS_FEEDS.map(f =>
            parser.parseURL(f.url).catch(() => null)
        );
        const results = await Promise.allSettled(promises);

        results.forEach((result, i) => {
            if (result.status !== 'fulfilled' || !result.value) return;
            const feed = result.value;
            const meta = RSS_FEEDS[i];
            feed.items.slice(0, 12).forEach(item => {
                news.push({
                    title: item.title || '',
                    link: item.link || '#',
                    pubDate: item.pubDate || new Date().toISOString(),
                    contentSnippet: item.contentSnippet || '',
                    source: feed.title || meta.name,
                    severity: determineSeverity(item.title, item.contentSnippet),
                    category: determineCategory(item.title, item.contentSnippet),
                    fetchedAt: new Date().toISOString(),
                });
            });
        });

        if (news.length > 0) {
            // Merge with fallback, deduplicate by link
            const merged = [...news, ...FALLBACK_NEWS];
            const seen = new Set();
            const unique = merged.filter(item => {
                if (seen.has(item.link)) return false;
                seen.add(item.link);
                return true;
            });
            unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            NEWS_CACHE = unique.slice(0, 60);
            CACHE_TIME = Date.now();
        }
    } catch (e) {
        // silently fail — fallback data is already in cache
    } finally {
        fetchInProgress = false;
    }
}

// ─── Threat Generator ─────────────────────────────────────────────────────────
let THREATS_CACHE = [];
let THREATS_DATE = '';

function getThreats() {
    const todayStr = new Date().toDateString();
    if (THREATS_CACHE.length > 0 && THREATS_DATE === todayStr) return THREATS_CACHE;

    const types = ['Malware', 'Ransomware', 'Phishing', 'Botnet', 'Dark Web Leak', 'Zero-Day'];
    const severities = ['Critical', 'High', 'Medium', 'Low'];
    const sources = ['Dark Web Monitor', 'HoneyPot Network', 'Threat Intel Feed', 'Internal SOC'];
    const count = 4 + Math.floor(Math.random() * 4);
    const threats = [];

    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isDarkWeb = type === 'Dark Web Leak';
        const severity = isDarkWeb ? 'Critical' : severities[Math.floor(Math.random() * severities.length)];
        threats.push({
            id: `TRT-${Date.now()}-${i}`,
            type,
            severity,
            source: isDarkWeb ? 'Onion Forum Monitor' : sources[Math.floor(Math.random() * sources.length)],
            description: isDarkWeb
                ? 'Credential dump detected on underground forum matching corporate domain patterns.'
                : `Active ${type} campaign detected via network sensors. IOCs indicate targeting financial sector.`,
            ioc: {
                md5: Math.random() > 0.5 ? '5e884898da28047151d0e56f8dc62927' : undefined,
                sha256: Math.random() > 0.5 ? 'e3b0c44298fc1c149afbf4c8996fb924' : undefined,
                ip_addresses: [`192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`],
                domains: isDarkWeb ? ['hidden-service.onion'] : [`malicious-${Math.floor(Math.random()*1000)}.com`],
            },
            timestamp: new Date().toISOString(),
        });
    }

    THREATS_CACHE = threats;
    THREATS_DATE = todayStr;
    return threats;
}

// ─── Vercel Serverless Handler ────────────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const url = new URL(req.url, `https://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/health') {
        return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (path === '/api/news') {
        res.setHeader('Cache-Control', 'no-store');
        const news = await getNews();
        return res.json(news);
    }

    if (path === '/api/news/stats') {
        const news = await getNews();
        const stats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        news.forEach(item => { if (item.severity in stats) stats[item.severity]++; });
        return res.json(Object.keys(stats).map(k => ({ name: k, count: stats[k] })));
    }

    if (path === '/api/threats') {
        return res.json(getThreats());
    }

    if (path.startsWith('/api/threats/')) {
        const id = path.replace('/api/threats/', '');
        const threat = getThreats().find(t => t.id === id);
        return threat ? res.json(threat) : res.status(404).json({ message: 'Threat not found' });
    }

    if (path === '/api/sources') {
        return res.json(RSS_FEEDS.map(f => ({ ...f, status: 'Active' })));
    }

    if (path === '/api/sources/stats') {
        const stats = RSS_FEEDS.reduce((a, s) => { a[s.category] = (a[s.category] || 0) + 1; return a; }, {});
        return res.json({ total: RSS_FEEDS.length, categories: stats });
    }

    if (path === '/api/reports/daily') {
        const news = await getNews();
        const threats = getThreats();
        const todayStr = new Date().toDateString();
        const todaysNews = news.filter(n => new Date(n.pubDate).toDateString() === todayStr);

        let report = `DAILY SECURITY INTELLIGENCE REPORT\nGenerated: ${new Date().toLocaleString()}\n==========================================\n\n`;
        report += `[ SUMMARY ]\nTotal Threats: ${threats.length}\nTotal News: ${todaysNews.length}\n\n`;
        report += `[ ACTIVE THREATS ]\n`;
        threats.forEach(t => { report += `• [${t.severity.toUpperCase()}] ${t.type} (${t.source})\n  ${t.description}\n\n`; });
        report += `==========================================\n\n[ GLOBAL SECURITY NEWS ]\n`;
        todaysNews.forEach(n => { report += `• ${n.title}\n  Source: ${n.source} | Severity: ${n.severity}\n  Link: ${n.link}\n\n`; });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="Daily_Report_${new Date().toISOString().split('T')[0]}.txt"`);
        return res.send(report);
    }

    if (path === '/api/notifications/send') {
        return res.json({ success: false, error: 'Email not available in serverless demo.' });
    }

    return res.status(404).json({ error: 'Not found', path });
}
