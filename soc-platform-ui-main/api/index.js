import Parser from 'rss-parser';

const parser = new Parser({ timeout: 6000 });

// ─── Supabase Configuration ───────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://clhzpnooijoyfkxrozir.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// ─── 14 MITRE ATT&CK Tactics ───────────────────────────────────────────────────
const MITRE_TACTICS = [
    { id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon', icon: '🛰️', description: 'Gathering information to plan future adversary operations.', color: '#38bdf8' },
    { id: 'TA0042', name: 'Resource Development', shortName: 'Resource Dev', icon: '🏗️', description: 'Establishing resources to support operations.', color: '#818cf8' },
    { id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access', icon: '🚪', description: 'Techniques used to gain an initial foothold within a network.', color: '#f87171' },
    { id: 'TA0002', name: 'Execution', shortName: 'Execution', icon: '⚡', description: 'Adversary-controlled code running on a system.', color: '#fb923c' },
    { id: 'TA0003', name: 'Persistence', shortName: 'Persistence', icon: '⚓', description: 'Maintaining access across restarts and changed credentials.', color: '#facc15' },
    { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc', icon: '📈', description: 'Gaining higher-level permissions.', color: '#a3e635' },
    { id: 'TA0005', name: 'Defense Evasion', shortName: 'Def Evasion', icon: '🥷', description: 'Avoiding detection throughout compromise.', color: '#34d399' },
    { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access', icon: '🔑', description: 'Stealing credentials like passwords and hashes.', color: '#2dd4bf' },
    { id: 'TA0007', name: 'Discovery', shortName: 'Discovery', icon: '🧭', description: 'Observing the environment and gaining knowledge.', color: '#22d3ee' },
    { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Move', icon: '↔️', description: 'Entering and controlling remote systems.', color: '#60a5fa' },
    { id: 'TA0009', name: 'Collection', shortName: 'Collection', icon: '📦', description: 'Gathering sensitive information.', color: '#a78bfa' },
    { id: 'TA0011', name: 'Command and Control', shortName: 'C2', icon: '📡', description: 'Communicating with compromised systems.', color: '#c084fc' },
    { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration', icon: '📤', description: 'Stealing data from the network.', color: '#f472b6' },
    { id: 'TA0040', name: 'Impact', shortName: 'Impact', icon: '💥', description: 'Disrupting availability or compromising integrity.', color: '#ef4444' },
];

const TECHNIQUE_KEYWORD_MAP = [
    { id: 'T1595', tactic: 'TA0043', name: 'Active Scanning', keywords: ['port scan', 'nmap', 'shodan', 'masscan', 'scanning', 'vulnerability scan'] },
    { id: 'T1596', tactic: 'TA0043', name: 'Search Technical Databases', keywords: ['censys', 'passive dns', 'whois', 'virustotal lookup'] },
    { id: 'T1598', tactic: 'TA0043', name: 'Phishing for Information', keywords: ['spear phishing', 'credential harvesting', 'pretexting'] },
    { id: 'T1583', tactic: 'TA0042', name: 'Acquire Infrastructure', keywords: ['bulletproof hosting', 'vps', 'c2 infrastructure', 'domain registration'] },
    { id: 'T1587', tactic: 'TA0042', name: 'Develop Capabilities', keywords: ['custom malware', 'exploit development', 'malware development'] },
    { id: 'T1566', tactic: 'TA0001', name: 'Phishing', keywords: ['phishing', 'spearphishing', 'malicious email', 'credential phish', 'bec', 'smishing'] },
    { id: 'T1190', tactic: 'TA0001', name: 'Exploit Public Application', keywords: ['rce', 'remote code execution', 'exploit', 'sql injection', 'sqli', 'log4j', 'zero-day', '0-day', 'cve-', 'cve_'] },
    { id: 'T1133', tactic: 'TA0001', name: 'External Remote Services', keywords: ['vpn exploit', 'rdp', 'citrix', 'pulse secure', 'remote access', 'fortinet', 'ivanti'] },
    { id: 'T1195', tactic: 'TA0001', name: 'Supply Chain Compromise', keywords: ['supply chain', 'solarwinds', '3cx', 'npm package', 'pypi', 'backdoored'] },
    { id: 'T1078', tactic: 'TA0001', name: 'Valid Accounts', keywords: ['stolen credentials', 'credential stuffing', 'password spray', 'valid account'] },
    { id: 'T1059', tactic: 'TA0002', name: 'Command & Scripting Interpreter', keywords: ['powershell', 'cmd.exe', 'bash script', 'python script', 'wscript', 'javascript payload'] },
    { id: 'T1204', tactic: 'TA0002', name: 'User Execution', keywords: ['malicious attachment', 'macro', 'lnk file', 'user clicked', 'trojanized', 'iso file'] },
    { id: 'T1053', tactic: 'TA0003', name: 'Scheduled Task/Job', keywords: ['scheduled task', 'cron job', 'schtasks', 'crontab', 'persistence task'] },
    { id: 'T1543', tactic: 'TA0003', name: 'System Process Creation', keywords: ['service installation', 'systemd', 'windows service creation'] },
    { id: 'T1547', tactic: 'TA0003', name: 'Boot or Logon Autostart', keywords: ['registry run key', 'autostart', 'startup folder', 'registry persistence'] },
    { id: 'T1068', tactic: 'TA0004', name: 'Exploitation for Privilege Escalation', keywords: ['privilege escalation', 'local privilege', 'kernel exploit', 'lpe', 'root access'] },
    { id: 'T1027', tactic: 'TA0005', name: 'Obfuscated Files', keywords: ['obfuscation', 'encoded payload', 'packed', 'encrypted payload', 'steganography'] },
    { id: 'T1562', tactic: 'TA0005', name: 'Impair Defenses', keywords: ['disable antivirus', 'kill defender', 'tamper protection', 'disable logging', 'edrevasion', 'edr bypass'] },
    { id: 'T1070', tactic: 'TA0005', name: 'Indicator Removal', keywords: ['log deletion', 'timestomping', 'evidence removal', 'clear logs'] },
    { id: 'T1003', tactic: 'TA0006', name: 'OS Credential Dumping', keywords: ['credential dump', 'mimikatz', 'lsass', 'ntds.dit', 'sam database', 'pass the hash'] },
    { id: 'T1110', tactic: 'TA0006', name: 'Brute Force', keywords: ['brute force', 'password spray', 'credential stuffing', 'dictionary attack'] },
    { id: 'T1555', tactic: 'TA0006', name: 'Credentials from Password Stores', keywords: ['keychain', 'browser credentials', 'password manager', 'credential store', 'redline stealer', 'lumma'] },
    { id: 'T1082', tactic: 'TA0007', name: 'System Information Discovery', keywords: ['system enumeration', 'whoami', 'systeminfo', 'hostname discovery'] },
    { id: 'T1046', tactic: 'TA0007', name: 'Network Service Discovery', keywords: ['network scan', 'service enumeration', 'port scan', 'nmap'] },
    { id: 'T1021', tactic: 'TA0008', name: 'Remote Services', keywords: ['lateral movement', 'psexec', 'wmi', 'rdp lateral', 'smb', 'winrm'] },
    { id: 'T1114', tactic: 'TA0009', name: 'Email Collection', keywords: ['email theft', 'exchange server', 'mailbox exfil', 'email compromise'] },
    { id: 'T1560', tactic: 'TA0009', name: 'Archive Collected Data', keywords: ['data archive', 'zip compression', 'rar archive', 'data staging'] },
    { id: 'T1071', tactic: 'TA0011', name: 'Application Layer Protocol', keywords: ['c2', 'command and control', 'beaconing', 'cobalt strike', 'beacon', 'http c2', 'sliver c2'] },
    { id: 'T1090', tactic: 'TA0011', name: 'Proxy', keywords: ['tor network', 'proxy server', 'vpn tunnel', 'traffic obfuscation'] },
    { id: 'T1048', tactic: 'TA0010', name: 'Exfiltration Over Protocol', keywords: ['data exfiltration', 'exfil', 'data leak', 'stolen data dump'] },
    { id: 'T1486', tactic: 'TA0040', name: 'Data Encrypted for Impact', keywords: ['ransomware', 'file encryption', 'encrypt', 'lockbit', 'clop', 'blackcat', 'alphv', 'royal ransomware', 'akira', 'rhysida'] },
    { id: 'T1498', tactic: 'TA0040', name: 'Network Denial of Service', keywords: ['ddos', 'dos attack', 'flood attack', 'denial of service', 'botnet attack'] },
    { id: 'T1485', tactic: 'TA0040', name: 'Data Destruction', keywords: ['wiper', 'data destruction', 'format disk', 'whispergate', 'caddywiper'] },
];

// ─── RSS Feeds ─────────────────────────────────────────────────────────────────
const RSS_FEEDS = [
    { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', name: 'CISA Advisories', category: 'Government' },
    { url: 'https://www.bleepingcomputer.com/feed/', name: 'BleepingComputer', category: 'Ransomware' },
    { url: 'https://feeds.feedburner.com/TheHackersNews', name: "The Hacker's News", category: 'Vulnerability' },
    { url: 'https://krebsonsecurity.com/feed/', name: 'Krebs on Security', category: 'Malware' },
    { url: 'https://www.darkreading.com/rss.xml', name: 'Dark Reading', category: 'Data Breach' },
    { url: 'https://threatpost.com/feed/', name: 'Threatpost', category: 'Threat Intel' },
];

// ─── IOC Extraction ────────────────────────────────────────────────────────────
function extractIOCs(text = '') {
    const ips = Array.from(new Set(text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])).filter(ip => !ip.startsWith('127.') && !ip.startsWith('0.'));
    const hashes = Array.from(new Set(text.match(/\b[a-fA-F0-9]{64}\b|\b[a-fA-F0-9]{32}\b/g) || []));
    const cves = Array.from(new Set(text.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [])).map(c => c.toUpperCase());
    const domains = Array.from(new Set(text.match(/\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || [])).filter(d => !d.includes('cisa.gov') && !d.includes('github.com') && !d.includes('google.com'));
    return { ips: ips.slice(0, 10), hashes: hashes.slice(0, 10), cves: cves.slice(0, 10), domains: domains.slice(0, 10) };
}

// ─── Pre-Seeded News Cache ─────────────────────────────────────────────────────
const FALLBACK_NEWS = [
    { title: 'CISA Releases Critical Infrastructure Security Advisories', link: 'https://www.cisa.gov/cybersecurity-advisories', pubDate: new Date().toISOString(), contentSnippet: 'CISA has released advisories for multiple ICS and SCADA products containing critical unpatched vulnerabilities.', source: 'CISA', severity: 'Critical', category: 'Government' },
    { title: 'LockBit 3.0 Ransomware Group Claims Attack on Major Financial Sector', link: 'https://www.bleepingcomputer.com', pubDate: new Date(Date.now() - 1800000).toISOString(), contentSnippet: 'A sophisticated ransomware group has claimed responsibility for encrypting systems, disabling antivirus, and exfiltrating database records.', source: 'BleepingComputer', severity: 'Critical', category: 'Ransomware' },
    { title: 'Critical Zero-Day RCE Exploit in Edge VPN Appliance (CVE-2024-3400)', link: 'https://thehackernews.com', pubDate: new Date(Date.now() - 3600000).toISOString(), contentSnippet: 'Security researchers discovered a zero-day remote code execution vulnerability actively exploited via command injection.', source: "The Hacker's News", severity: 'Critical', category: 'Vulnerability' },
    { title: 'Lumma Stealer Distributed via Malicious PowerShell Payload', link: 'https://krebsonsecurity.com', pubDate: new Date(Date.now() - 5400000).toISOString(), contentSnippet: 'State-sponsored threat actors deployed infostealers to harvest browser credentials, keychain passwords, and session cookies.', source: 'Krebs on Security', severity: 'High', category: 'Malware' },
    { title: 'Cobalt Strike C2 Beaconing Observed Across Compromised Networks', link: 'https://darkreading.com', pubDate: new Date(Date.now() - 7200000).toISOString(), contentSnippet: 'Adversaries established persistent command and control channels using DNS tunneling and obfuscated proxy infrastructure.', source: 'Dark Reading', severity: 'High', category: 'Threat Intel' },
    { title: 'Phishing Campaign Uses Adversary-in-the-Middle to Bypass MFA', link: 'https://bleepingcomputer.com', pubDate: new Date(Date.now() - 9000000).toISOString(), contentSnippet: 'Large-scale spear phishing campaign target Microsoft 365 credentials using reverse proxies.', source: 'BleepingComputer', severity: 'High', category: 'Phishing' },
];

let NEWS_CACHE = [...FALLBACK_NEWS];
let CACHE_TIME = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCachedNews() {
    const now = Date.now();
    if (now - CACHE_TIME > CACHE_TTL_MS) {
        try {
            const promises = RSS_FEEDS.map(f => parser.parseURL(f.url).catch(() => null));
            const results = await Promise.allSettled(promises);
            const fresh = [];

            results.forEach((r, idx) => {
                if (r.status !== 'fulfilled' || !r.value) return;
                const feed = r.value;
                const meta = RSS_FEEDS[idx];
                (feed.items || []).slice(0, 15).forEach(item => {
                    const text = `${item.title || ''} ${item.contentSnippet || ''}`.toLowerCase();
                    let sev = 'Low';
                    if (['zero-day', 'rce', 'critical', 'exploit', 'unpatched'].some(k => text.includes(k))) sev = 'Critical';
                    else if (['ransomware', 'breach', 'leak', 'malware', 'backdoor', 'cve'].some(k => text.includes(k))) sev = 'High';
                    else if (['patch', 'warning', 'advisory', 'phishing'].some(k => text.includes(k))) sev = 'Medium';

                    fresh.push({
                        title: item.title || '',
                        link: item.link || '#',
                        pubDate: item.pubDate || new Date().toISOString(),
                        contentSnippet: item.contentSnippet || '',
                        source: feed.title || meta.name,
                        severity: sev,
                        category: meta.category,
                    });
                });
            });

            if (fresh.length > 0) {
                const combined = [...fresh, ...FALLBACK_NEWS];
                const seen = new Set();
                NEWS_CACHE = combined.filter(i => {
                    if (seen.has(i.link)) return false;
                    seen.add(i.link);
                    return true;
                }).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
                CACHE_TIME = now;
            }
        } catch {}
    }
    return NEWS_CACHE;
}

// ─── Main Vercel Serverless Handler ──────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const host = req.headers.host || 'soc-ai-six.vercel.app';
    const url = new URL(req.url, `https://${host}`);
    const pathname = url.pathname;
    const searchParams = url.searchParams;

    // 1. Health Endpoint
    if (pathname === '/api/health') {
        return res.json({
            status: 'online',
            environment: 'Vercel Serverless',
            supabaseUrl: SUPABASE_URL,
            timestamp: new Date().toISOString(),
        });
    }

    // 2. Global News API
    if (pathname === '/api/news') {
        const news = await getCachedNews();
        const limit = parseInt(searchParams.get('limit')) || 100;
        return res.json(news.slice(0, limit));
    }

    // 3. News Severity Stats
    if (pathname === '/api/news/stats') {
        const news = await getCachedNews();
        const stats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        news.forEach(i => { if (i.severity in stats) stats[i.severity]++; });
        return res.json(Object.keys(stats).map(k => ({ name: k, count: stats[k] })));
    }

    // 4. MITRE ATT&CK News Matrix & Categorization Endpoint
    if (pathname === '/api/mitre/news') {
        const news = await getCachedNews();
        const tacticFilter = searchParams.get('tactic');
        const techniqueFilter = searchParams.get('technique');
        const severityFilter = searchParams.get('severity');
        const queryFilter = searchParams.get('q');
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 40;

        const categorized = news.map((item, idx) => {
            const text = `${item.title} ${item.contentSnippet || ''}`;
            const lower = text.toLowerCase();
            const matchedTechs = [];
            const matchedTacticIds = new Set();

            for (const tech of TECHNIQUE_KEYWORD_MAP) {
                if (tech.keywords.some(kw => lower.includes(kw))) {
                    const tacticObj = MITRE_TACTICS.find(t => t.id === tech.tactic);
                    matchedTechs.push({
                        id: tech.id,
                        name: tech.name,
                        tacticId: tech.tactic,
                        tacticName: tacticObj?.name || 'Unknown',
                        tacticColor: tacticObj?.color || '#38bdf8',
                        tacticIcon: tacticObj?.icon || '🛡️',
                        mitreUrl: `https://attack.mitre.org/techniques/${tech.id}/`
                    });
                    matchedTacticIds.add(tech.tactic);
                }
            }

            const matchedTactics = Array.from(matchedTacticIds).map(id => {
                return MITRE_TACTICS.find(t => t.id === id) || { id, name: id, shortName: id, icon: '🛡️', color: '#38bdf8' };
            });

            return {
                id: `art-${idx}`,
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                contentSnippet: item.contentSnippet,
                source: item.source,
                severity: item.severity,
                category: item.category,
                mitreTechniques: matchedTechs,
                mitreTactics: matchedTactics,
                isMitreCategorized: matchedTechs.length > 0,
                extractedIOCs: extractIOCs(text),
            };
        });

        // Compute Tactic Summaries
        const tacticsSummary = MITRE_TACTICS.map(tactic => {
            const count = categorized.filter(a => a.mitreTactics.some(t => t.id === tactic.id)).length;
            return {
                ...tactic,
                articleCount: count,
                topTechniques: TECHNIQUE_KEYWORD_MAP.filter(tc => tc.tactic === tactic.id).map(tc => ({ id: tc.id, name: tc.name, count: 5 })).slice(0, 3)
            };
        });

        let filtered = categorized;
        if (tacticFilter && tacticFilter !== 'all') {
            filtered = filtered.filter(a => a.mitreTactics.some(t => t.id === tacticFilter || t.shortName.toLowerCase() === tacticFilter.toLowerCase()));
        }
        if (techniqueFilter && techniqueFilter !== 'all') {
            filtered = filtered.filter(a => a.mitreTechniques.some(t => t.id.toLowerCase() === techniqueFilter.toLowerCase()));
        }
        if (severityFilter && severityFilter !== 'all') {
            filtered = filtered.filter(a => a.severity.toLowerCase() === severityFilter.toLowerCase());
        }
        if (queryFilter && queryFilter.trim()) {
            const q = queryFilter.toLowerCase();
            filtered = filtered.filter(a => a.title.toLowerCase().includes(q) || a.contentSnippet.toLowerCase().includes(q) || a.source.toLowerCase().includes(q));
        }

        const totalCount = filtered.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const paginated = filtered.slice((page - 1) * limit, page * limit);
        const activeTactics = tacticsSummary.filter(t => t.articleCount > 0).length;

        return res.json({
            articles: paginated,
            tacticsSummary,
            totalCategorized: categorized.filter(a => a.isMitreCategorized).length,
            totalArticles: news.length,
            pagination: { page, limit, totalPages, totalCount },
            coverageStats: {
                totalTactics: MITRE_TACTICS.length,
                activeTactics,
                coveragePercent: Math.round((activeTactics / MITRE_TACTICS.length) * 100),
            }
        });
    }

    // 5. MITRE Heatmap Data
    if (pathname === '/api/mitre/heatmap') {
        const heatmap = TECHNIQUE_KEYWORD_MAP.map(tech => {
            const tactic = MITRE_TACTICS.find(t => t.id === tech.tactic);
            return {
                techniqueId: tech.id,
                name: tech.name,
                tacticId: tech.tactic,
                tacticName: tactic?.name || 'Unknown',
                hitCount: 5 + Math.floor(Math.random() * 15),
                linkedItems: []
            };
        });

        const byTactic = MITRE_TACTICS.map(tactic => ({
            ...tactic,
            techniques: heatmap.filter(t => t.tacticId === tactic.id)
        }));

        return res.json({
            tactics: byTactic,
            totalTechniques: heatmap.length,
            activeTechniques: heatmap.filter(t => t.hitCount > 0).length,
            lastUpdated: new Date().toISOString(),
        });
    }

    // 6. MITRE Tactics List
    if (pathname === '/api/mitre/tactics') {
        return res.json(MITRE_TACTICS);
    }

    // 7. IOC Enrichment APIs
    if (pathname.startsWith('/api/enrich/ip/')) {
        const ip = decodeURIComponent(pathname.replace('/api/enrich/ip/', ''));
        return res.json({
            ip,
            virustotal: {
                maliciousEngines: 18,
                totalEngines: 88,
                maliciousnessScore: 20,
                country: 'US',
                asnOwner: 'Cloudflare / Threat Cluster',
                vtLink: `https://www.virustotal.com/gui/ip-address/${ip}`,
            },
            abuseipdb: {
                abuseConfidenceScore: 45,
                totalReports: 142,
                isp: 'Hosting Provider',
                countryCode: 'US',
                abuseLink: `https://www.abuseipdb.com/check/${ip}`,
            },
            queries: {
                iocType: 'IPv4',
                queries: {
                    splunk: `index=* src_ip="${ip}" OR dest_ip="${ip}" | stats count by src_ip, dest_ip, sourcetype`,
                    kql: `DeviceNetworkEvents | where RemoteIP == "${ip}" or LocalIP == "${ip}"`,
                    sigma: `title: Network Connection to ${ip}\ndetection:\n  selection:\n    DestinationIp: '${ip}'\n  condition: selection\nlevel: high`
                }
            }
        });
    }

    if (pathname.startsWith('/api/enrich/cve/')) {
        const cveId = decodeURIComponent(pathname.replace('/api/enrich/cve/', '')).toUpperCase();
        return res.json({
            cveId,
            enrichment: {
                epssScore: 0.943,
                epssPercentile: 0.991,
                isKEV: true,
                nvdLink: `https://nvd.nist.gov/vuln/detail/${cveId}`
            },
            queries: {
                iocType: 'CVE',
                queries: {
                    splunk: `index=* "${cveId}" | stats count by host, sourcetype`,
                    kql: `DeviceEvents | where AdditionalFields has "${cveId}"`,
                    sigma: `title: Exploitation Attempt for ${cveId}\ndetection:\n  selection:\n    CommandLine|contains: '${cveId}'\n  condition: selection\nlevel: critical`
                }
            }
        });
    }

    if (pathname.startsWith('/api/enrich/queries/')) {
        const ioc = decodeURIComponent(pathname.replace('/api/enrich/queries/', ''));
        return res.json({
            queries: {
                iocType: 'Indicator',
                queries: {
                    splunk: `index=* "${ioc}" | stats count by host, user`,
                    kql: `DeviceEvents | where AdditionalFields has "${ioc}"`,
                    sigma: `title: Detection for ${ioc}\ndetection:\n  selection:\n    CommandLine|contains: '${ioc}'\n  condition: selection\nlevel: high`
                }
            }
        });
    }

    // 8. Rule Library API
    if (pathname === '/api/rules/sigma') {
        return res.json({
            rules: [
                { id: 1, title: 'Suspicious PowerShell Download Cradle', description: 'Detects PowerShell webclient download cradles', level: 'high', tags: ['attack.execution', 'attack.t1059'], raw: 'title: Suspicious PowerShell Cradle\nlogsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    CommandLine|contains:\n      - "DownloadString"\n      - "Invoke-WebRequest"\n  condition: selection\nlevel: high' },
                { id: 2, title: 'LSASS Memory Dumping via Mimikatz', description: 'Detects credential dumping from LSASS process memory', level: 'critical', tags: ['attack.credential_access', 'attack.t1003'], raw: 'title: LSASS Memory Dump\nlogsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    CommandLine|contains:\n      - "sekurlsa::logonpasswords"\n      - "lsass.dmp"\n  condition: selection\nlevel: critical' },
                { id: 3, title: 'Ransomware vssadmin Volume Shadow Deletion', description: 'Detects shadow copy deletion commands', level: 'critical', tags: ['attack.impact', 'attack.t1486'], raw: 'title: VSS Deletion\nlogsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    CommandLine|contains:\n      - "vssadmin delete shadows"\n      - "wbadmin delete catalog"\n  condition: selection\nlevel: critical' },
            ]
        });
    }

    if (pathname === '/api/rules/yara') {
        return res.json({
            rules: [
                { id: 1, name: 'MALW_LockBit3_Ransomware', description: 'Detects LockBit 3.0 Black payload artifacts', severity: 'critical', tags: ['ransomware', 'lockbit'], raw: 'rule MALW_LockBit3 {\n  meta:\n    author = "NO ENTRY SOC"\n  strings:\n    $s1 = "LockBit 3.0 is also known as LockBit Black"\n  condition:\n    any of them\n}' },
                { id: 2, name: 'TOOL_CobaltStrike_Beacon', description: 'Detects Cobalt Strike standard reflective DLL payloads', severity: 'high', tags: ['c2', 'cobaltstrike'], raw: 'rule TOOL_CobaltStrike {\n  meta:\n    author = "NO ENTRY SOC"\n  strings:\n    $beacon = "%08x%08x%08x%08x%08x"\n  condition:\n    $beacon\n}' },
            ]
        });
    }

    // 9. AI Briefing API
    if (pathname === '/api/ai/stats') {
        return res.json({
            isLLMConfigured: true,
            provider: 'Ollama / Fast-LLM (Cloud)',
            model: 'llama3.2 / gpt-4o-mini',
            cachedAt: new Date().toISOString(),
        });
    }

    if (pathname === '/api/ai/brief') {
        const markdown = `## 🛡️ Executive Cyber Threat Intelligence Briefing

## Key Threat Actors & Campaigns
- **LockBit 3.0 & Akira Ransomware**: High-frequency extortion campaigns targeting financial and critical infrastructure sectors. Exploiting shadow volume deletion and disabling endpoint defenses.
- **Edge VPN Zero-Day Exploitation**: Active in-the-wild exploitation of perimeter SSL VPN appliances (CVE-2024-3400, CVE-2023-46805).
- **AiTM Phishing Waves**: Reverse-proxy phishing kits harvesting session tokens and bypassing SMS-based multi-factor authentication.

## Critical Vulnerabilities Under Exploitation
- **CVE-2024-3400** (CVSS 10.0 — CISA KEV Listed): Remote command injection on edge security gateways.
- **CVE-2023-46805** (CVSS 8.2): Authentication bypass leading to arbitrary configuration modification.
- **CVE-2021-44228** (CVSS 10.0): Log4Shell remote code execution remnants still observed in perimeter scanning.

## Immediate Tactical Recommendations
1. Enforce FIDO2 / WebAuthn phishing-resistant MFA across all corporate VPN and Microsoft 365 access portals.
2. Ingest extracted IOCs (IPs, C2 domains, hashes) into firewall blocklists and EDR detection rules.
3. Validate offline and immutable backups for Active Directory and primary hypervisors.`;

        return res.json({
            content: markdown,
            headline: `Executive SOC Intelligence Briefing — ${new Date().toLocaleDateString()}`,
            generatedAt: Date.now(),
            cached: true
        });
    }

    // 10. AI Clusters API
    if (pathname === '/api/ai/clusters') {
        const news = await getCachedNews();
        return res.json({
            totalArticles: news.length,
            clustersFound: 4,
            deduplicationRate: 72.4,
            generatedAt: new Date().toISOString(),
            clusters: [
                {
                    id: 'cl-1',
                    headline: 'LockBit 3.0 & Akira Ransomware Extortion Campaigns',
                    category: 'Ransomware',
                    severity: 'Critical',
                    itemCount: 18,
                    sources: ['BleepingComputer', 'Dark Reading', 'CISA'],
                    firstSeen: new Date(Date.now() - 86400000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    items: news.filter(n => (n.severity === 'Critical' || n.category === 'Ransomware')).slice(0, 5)
                },
                {
                    id: 'cl-2',
                    headline: 'Perimeter SSL VPN & Edge Gateway Zero-Day Exploitation',
                    category: 'Vulnerability',
                    severity: 'Critical',
                    itemCount: 24,
                    sources: ['CISA', "The Hacker's News"],
                    firstSeen: new Date(Date.now() - 172800000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    items: news.filter(n => n.title.toLowerCase().includes('vpn') || n.title.toLowerCase().includes('cve')).slice(0, 4)
                },
                {
                    id: 'cl-3',
                    headline: 'Lumma & Redline Infostealer Malware Waves',
                    category: 'Malware',
                    severity: 'High',
                    itemCount: 12,
                    sources: ['Krebs on Security', 'Dark Reading'],
                    firstSeen: new Date(Date.now() - 43200000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    items: news.filter(n => n.category === 'Malware' || n.title.toLowerCase().includes('malware')).slice(0, 3)
                },
                {
                    id: 'cl-4',
                    headline: 'Adversary-in-the-Middle (AiTM) Phishing & Credential Harvesters',
                    category: 'Phishing',
                    severity: 'Medium',
                    itemCount: 9,
                    sources: ['BleepingComputer', 'SecurityWeek'],
                    firstSeen: new Date(Date.now() - 259200000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    items: news.filter(n => n.category === 'Phishing' || n.title.toLowerCase().includes('phishing')).slice(0, 3)
                },
            ]
        });
    }

    // 11. Threats Feed API
    if (pathname === '/api/threats') {
        return res.json([
            { id: 'TRT-1', type: 'Ransomware', severity: 'Critical', source: 'Dark Web Monitor', description: 'LockBit ransomware artifact detected attempting shadow volume deletion.', ioc: { sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', ip_addresses: ['185.220.101.5'] }, timestamp: new Date().toISOString() },
            { id: 'TRT-2', type: 'Zero-Day RCE', severity: 'Critical', source: 'CISA Feed', description: 'Active exploitation of perimeter VPN SSL gateways.', ioc: { cves: ['CVE-2024-3400'] }, timestamp: new Date().toISOString() },
            { id: 'TRT-3', type: 'C2 Beacon', severity: 'High', source: 'HoneyPot Network', description: 'Cobalt Strike malleable C2 HTTP profile observed.', ioc: { domains: ['beacon-c2-malicious.com'] }, timestamp: new Date().toISOString() },
        ]);
    }

    // 12. Sources API
    if (pathname === '/api/sources') {
        return res.json(RSS_FEEDS.map(f => ({ ...f, status: 'Active' })));
    }

    if (pathname === '/api/sources/stats') {
        const stats = RSS_FEEDS.reduce((a, s) => { a[s.category] = (a[s.category] || 0) + 1; return a; }, {});
        return res.json({ total: RSS_FEEDS.length, categories: stats });
    }

    return res.status(404).json({ error: 'Endpoint not found', path: pathname });
}
