/**
 * mitreService.js
 * Maps ingested news and threats to MITRE ATT&CK Enterprise Tactics and Techniques.
 * Categorizes all news items into 14 MITRE tactics with keyword matching & hit tracking.
 * Provides APIs for MITRE Heatmap, Categorized News Feed, and Tactic Breakdown.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNews } from './newsService.js';
import { extractIOCs } from './enrichmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hit counter per technique (in-memory)
const techniqueHits = new Map();

// ── 14 MITRE ATT&CK Enterprise Tactics ──────────────────────────────────────────
export const MITRE_TACTICS = [
    {
        id: 'TA0043',
        name: 'Reconnaissance',
        shortName: 'Recon',
        icon: '🛰️',
        description: 'Gathering information to plan future adversary operations.',
        color: '#38bdf8'
    },
    {
        id: 'TA0042',
        name: 'Resource Development',
        shortName: 'Resource Dev',
        icon: '🏗️',
        description: 'Establishing resources to support operations (infrastructure, accounts, tools).',
        color: '#818cf8'
    },
    {
        id: 'TA0001',
        name: 'Initial Access',
        shortName: 'Initial Access',
        icon: '🚪',
        description: 'Techniques used to gain an initial foothold within a network.',
        color: '#f87171'
    },
    {
        id: 'TA0002',
        name: 'Execution',
        shortName: 'Execution',
        icon: '⚡',
        description: 'Techniques that result in adversary-controlled code running on a system.',
        color: '#fb923c'
    },
    {
        id: 'TA0003',
        name: 'Persistence',
        shortName: 'Persistence',
        icon: '⚓',
        description: 'Techniques used to maintain access across restarts and changed credentials.',
        color: '#facc15'
    },
    {
        id: 'TA0004',
        name: 'Privilege Escalation',
        shortName: 'Priv Esc',
        icon: '📈',
        description: 'Techniques used to gain higher-level permissions on a system or network.',
        color: '#a3e635'
    },
    {
        id: 'TA0005',
        name: 'Defense Evasion',
        shortName: 'Def Evasion',
        icon: '🥷',
        description: 'Techniques used to avoid detection throughout their compromise.',
        color: '#34d399'
    },
    {
        id: 'TA0006',
        name: 'Credential Access',
        shortName: 'Cred Access',
        icon: '🔑',
        description: 'Techniques for stealing credentials like passwords, tokens, and hashes.',
        color: '#2dd4bf'
    },
    {
        id: 'TA0007',
        name: 'Discovery',
        shortName: 'Discovery',
        icon: '🧭',
        description: 'Techniques used to observe the environment and gain post-compromise knowledge.',
        color: '#22d3ee'
    },
    {
        id: 'TA0008',
        name: 'Lateral Movement',
        shortName: 'Lateral Move',
        icon: '↔️',
        description: 'Techniques used to enter and control remote systems on a network.',
        color: '#60a5fa'
    },
    {
        id: 'TA0009',
        name: 'Collection',
        shortName: 'Collection',
        icon: '📦',
        description: 'Techniques used to gather information and sources of interest.',
        color: '#a78bfa'
    },
    {
        id: 'TA0011',
        name: 'Command and Control',
        shortName: 'C2',
        icon: '📡',
        description: 'Techniques used to communicate with systems under adversary control.',
        color: '#c084fc'
    },
    {
        id: 'TA0010',
        name: 'Exfiltration',
        shortName: 'Exfiltration',
        icon: '📤',
        description: 'Techniques used to steal data from the network.',
        color: '#f472b6'
    },
    {
        id: 'TA0040',
        name: 'Impact',
        shortName: 'Impact',
        icon: '💥',
        description: 'Techniques used to disrupt availability or compromise integrity.',
        color: '#ef4444'
    },
];

// ── Technique Keyword Catalogue ────────────────────────────────────────────────
const TECHNIQUE_KEYWORD_MAP = [
    // Reconnaissance (TA0043)
    { id: 'T1595', tactic: 'TA0043', name: 'Active Scanning', keywords: ['port scan', 'nmap', 'shodan', 'masscan', 'scanning', 'vulnerability scan'] },
    { id: 'T1596', tactic: 'TA0043', name: 'Search Open Technical Databases', keywords: ['shodan', 'censys', 'passive dns', 'whois', 'virustotal lookup'] },
    { id: 'T1598', tactic: 'TA0043', name: 'Phishing for Information', keywords: ['spear phishing', 'credential harvesting', 'pretexting', 'reconnaissance phishing'] },
    { id: 'T1589', tactic: 'TA0043', name: 'Gather Victim Identity Information', keywords: ['employee email list', 'osint', 'linkedin scraping', 'gather credentials'] },

    // Resource Development (TA0042)
    { id: 'T1583', tactic: 'TA0042', name: 'Acquire Infrastructure', keywords: ['bulletproof hosting', 'vps', 'c2 infrastructure', 'domain registration', 'botnet rental'] },
    { id: 'T1587', tactic: 'TA0042', name: 'Develop Capabilities', keywords: ['custom malware', 'exploit development', 'malware development', 'builder tool'] },
    { id: 'T1588', tactic: 'TA0042', name: 'Obtain Capabilities', keywords: ['dark web market', 'exploit purchase', 'bought credentials', 'infostealer logs'] },

    // Initial Access (TA0001)
    { id: 'T1566', tactic: 'TA0001', name: 'Phishing', keywords: ['phishing', 'spearphishing', 'malicious email', 'credential phish', 'business email compromise', 'bec', 'smishing', 'quishing'] },
    { id: 'T1190', tactic: 'TA0001', name: 'Exploit Public-Facing Application', keywords: ['rce', 'remote code execution', 'exploit', 'sql injection', 'sqli', 'log4j', 'zero-day', '0-day', 'unpatched', 'vulnerability', 'cve-', 'cve_'] },
    { id: 'T1133', tactic: 'TA0001', name: 'External Remote Services', keywords: ['vpn exploit', 'rdp', 'citrix', 'pulse secure', 'remote access', 'fortinet vpn', 'ivanti'] },
    { id: 'T1195', tactic: 'TA0001', name: 'Supply Chain Compromise', keywords: ['supply chain', 'solarwinds', '3cx', 'software supply chain', 'npm package', 'pypi', 'typosquatting', 'backdoored library'] },
    { id: 'T1078', tactic: 'TA0001', name: 'Valid Accounts', keywords: ['stolen credentials', 'credential stuffing', 'password spray', 'valid account', 'compromised account'] },
    { id: 'T1189', tactic: 'TA0001', name: 'Drive-by Compromise', keywords: ['drive-by download', 'malicious website', 'waterholing', 'exploit kit', 'compromised website'] },

    // Execution (TA0002)
    { id: 'T1059', tactic: 'TA0002', name: 'Command and Scripting Interpreter', keywords: ['powershell', 'cmd.exe', 'bash script', 'python script', 'vbscript', 'wscript', 'javascript payload', 'batch file', 'sh script'] },
    { id: 'T1204', tactic: 'TA0002', name: 'User Execution', keywords: ['malicious attachment', 'macro', 'lnk file', 'user clicked', 'trojanized', 'iso file', 'zip attachment'] },
    { id: 'T1047', tactic: 'TA0002', name: 'Windows Management Instrumentation', keywords: ['wmi execution', 'wmic', 'wmi query', 'wmi event'] },
    { id: 'T1569', tactic: 'TA0002', name: 'System Services', keywords: ['service execution', 'psexec service', 'service binary'] },

    // Persistence (TA0003)
    { id: 'T1053', tactic: 'TA0003', name: 'Scheduled Task/Job', keywords: ['scheduled task', 'cron job', 'schtasks', 'crontab', 'persistence task', 'startup task'] },
    { id: 'T1543', tactic: 'TA0003', name: 'Create or Modify System Process', keywords: ['service installation', 'systemd service', 'launchd', 'windows service creation'] },
    { id: 'T1547', tactic: 'TA0003', name: 'Boot or Logon Autostart', keywords: ['registry run key', 'autostart', 'startup folder', 'registry persistence', 'runonce'] },
    { id: 'T1136', tactic: 'TA0003', name: 'Create Account', keywords: ['backdoor account', 'admin account created', 'rogue account', 'shadow account'] },
    { id: 'T1505', tactic: 'TA0003', name: 'Server Software Component', keywords: ['web shell', 'webshell', 'godzilla', 'behinder', 'chopper webshell'] },

    // Privilege Escalation (TA0004)
    { id: 'T1068', tactic: 'TA0004', name: 'Exploitation for Privilege Escalation', keywords: ['privilege escalation', 'local privilege', 'kernel exploit', 'lpe', 'elevation of privilege', 'root access', 'system privilege'] },
    { id: 'T1548', tactic: 'TA0004', name: 'Abuse Elevation Control Mechanism', keywords: ['uac bypass', 'sudo abuse', 'setuid', 'elevation bypass', 'sudoers'] },

    // Defense Evasion (TA0005)
    { id: 'T1027', tactic: 'TA0005', name: 'Obfuscated Files or Information', keywords: ['obfuscation', 'encoded payload', 'packed', 'encrypted payload', 'steganography', 'base64 payload', 'xor encoding'] },
    { id: 'T1562', tactic: 'TA0005', name: 'Impair Defenses', keywords: ['disable antivirus', 'kill defender', 'tamper protection', 'disable logging', 'edrevasion', 'edr bypass', 'kill agent'] },
    { id: 'T1070', tactic: 'TA0005', name: 'Indicator Removal', keywords: ['log deletion', 'timestomping', 'evidence removal', 'clear event logs', 'delete history'] },
    { id: 'T1036', tactic: 'TA0005', name: 'Masquerading', keywords: ['masquerading', 'renamed binary', 'fake process', 'living off the land', 'lolbin', 'spoofed process name'] },
    { id: 'T1055', tactic: 'TA0005', name: 'Process Injection', keywords: ['process hollowing', 'dll injection', 'process injection', 'reflective injection', 'early bird injection'] },

    // Credential Access (TA0006)
    { id: 'T1003', tactic: 'TA0006', name: 'OS Credential Dumping', keywords: ['credential dump', 'mimikatz', 'lsass', 'ntds.dit', 'sam database', 'pass the hash', 'dumping hashes'] },
    { id: 'T1110', tactic: 'TA0006', name: 'Brute Force', keywords: ['brute force', 'password spray', 'credential stuffing', 'dictionary attack'] },
    { id: 'T1555', tactic: 'TA0006', name: 'Credentials from Password Stores', keywords: ['keychain', 'browser credentials', 'password manager', 'credential store', 'redline stealer', 'lumma stealer', 'vidar'] },
    { id: 'T1558', tactic: 'TA0006', name: 'Steal or Forge Kerberos Tickets', keywords: ['kerberoasting', 'golden ticket', 'silver ticket', 'as-rep roasting'] },

    // Discovery (TA0007)
    { id: 'T1082', tactic: 'TA0007', name: 'System Information Discovery', keywords: ['system enumeration', 'whoami', 'systeminfo', 'hostname discovery', 'operating system version'] },
    { id: 'T1046', tactic: 'TA0007', name: 'Network Service Discovery', keywords: ['network scan', 'service enumeration', 'port scan', 'nmap scan', 'internal network scan'] },
    { id: 'T1087', tactic: 'TA0007', name: 'Account Discovery', keywords: ['net user', 'domain admins query', 'enumerate accounts', 'ldap discovery'] },

    // Lateral Movement (TA0008)
    { id: 'T1021', tactic: 'TA0008', name: 'Remote Services', keywords: ['lateral movement', 'psexec', 'wmi execution', 'rdp lateral', 'smb share', 'winrm remote'] },
    { id: 'T1550', tactic: 'TA0008', name: 'Use Alternate Authentication Material', keywords: ['pass the ticket', 'pass the hash', 'session hijacking', 'token impersonation'] },

    // Collection (TA0009)
    { id: 'T1114', tactic: 'TA0009', name: 'Email Collection', keywords: ['email theft', 'exchange server dump', 'mailbox exfil', 'email compromise', 'inbox rules'] },
    { id: 'T1560', tactic: 'TA0009', name: 'Archive Collected Data', keywords: ['data archive', 'zip compression', 'rar archive', 'data staging', '7z archive'] },
    { id: 'T1005', tactic: 'TA0009', name: 'Data from Local System', keywords: ['data collection', 'file search', 'data theft', 'sensitive documents', 'exfiltrated files'] },

    // Command and Control (TA0011)
    { id: 'T1071', tactic: 'TA0011', name: 'Application Layer Protocol', keywords: ['c2', 'command and control', 'beaconing', 'cobalt strike', 'beacon', 'http c2', 'dns c2', 'sliver c2', 'brute ratel', 'havoc c2'] },
    { id: 'T1090', tactic: 'TA0011', name: 'Proxy', keywords: ['tor network', 'proxy server', 'vpn tunnel', 'traffic obfuscation', 'onion routing'] },
    { id: 'T1572', tactic: 'TA0011', name: 'Protocol Tunneling', keywords: ['dns tunneling', 'http tunneling', 'icmp tunnel', 'port forwarding', 'ngrok'] },

    // Exfiltration (TA0010)
    { id: 'T1048', tactic: 'TA0010', name: 'Exfiltration Over Alternative Protocol', keywords: ['data exfiltration', 'exfil', 'data leak', 'stolen data dump', 'mega.nz upload', 'telegram exfiltration'] },
    { id: 'T1537', tactic: 'TA0010', name: 'Transfer Data to Cloud Account', keywords: ['s3 bucket upload', 'cloud upload', 'azure blob exfil', 'google drive exfil', 'dropbox exfil'] },

    // Impact (TA0040)
    { id: 'T1486', tactic: 'TA0040', name: 'Data Encrypted for Impact', keywords: ['ransomware', 'file encryption', 'encrypt', 'lockbit', 'clop', 'blackcat', 'alphv', 'royal ransomware', 'ransom note', 'decryptor', 'darkangels', 'akira ransomware', 'play ransomware', 'rhysida'] },
    { id: 'T1498', tactic: 'TA0040', name: 'Network Denial of Service', keywords: ['ddos', 'dos attack', 'flood attack', 'amplification attack', 'denial of service', 'botnet attack'] },
    { id: 'T1489', tactic: 'TA0040', name: 'Service Stop', keywords: ['service disruption', 'system shutdown', 'kill process', 'wiper shutdown'] },
    { id: 'T1485', tactic: 'TA0040', name: 'Data Destruction', keywords: ['wiper', 'data destruction', 'format disk', 'shamoon', 'whispergate', 'caddywiper', 'hermeticwiper'] },
    { id: 'T1491', tactic: 'TA0040', name: 'Defacement', keywords: ['defacement', 'website defaced', 'web defacement'] },
    { id: 'T1496', tactic: 'TA0040', name: 'Resource Hijacking', keywords: ['cryptominer', 'crypto mining', 'xmrig', 'monero miner', 'coin miner'] },
];

let techniqueCatalogue = TECHNIQUE_KEYWORD_MAP;
console.log(`[MITRE] Loaded ${techniqueCatalogue.length} technique mappings.`);

/**
 * Map a piece of text to ATT&CK techniques and increment hit counters.
 */
export const mapTextToTechniques = (text, newsItemId = null, recordHit = true) => {
    if (!text) return [];
    const lower = text.toLowerCase();
    const matched = [];

    for (const technique of techniqueCatalogue) {
        if (technique.keywords.some(kw => lower.includes(kw))) {
            if (recordHit) {
                const current = techniqueHits.get(technique.id) || { count: 0, items: [] };
                current.count += 1;
                if (newsItemId && !current.items.includes(newsItemId)) {
                    // Cap items array to last 500 entries to prevent unbounded memory growth
                    if (current.items.length >= 500) current.items.shift();
                    current.items.push(newsItemId);
                }
                techniqueHits.set(technique.id, current);
            }
            matched.push(technique.id);
        }
    }
    return matched;
};

/**
 * Get detailed technique info by ID
 */
export const getTechniqueInfo = (techniqueId) => {
    const tech = techniqueCatalogue.find(t => t.id === techniqueId);
    if (!tech) return null;
    const tactic = MITRE_TACTICS.find(t => t.id === tech.tactic);
    return {
        id: tech.id,
        name: tech.name,
        tacticId: tech.tactic,
        tacticName: tactic?.name || 'Unknown',
        tacticShortName: tactic?.shortName || 'Unknown',
        tacticColor: tactic?.color || '#38bdf8',
        tacticIcon: tactic?.icon || '🛡️',
        mitreUrl: `https://attack.mitre.org/techniques/${tech.id}/`
    };
};

/**
 * Get heatmap data: each technique with its hit count and tactic grouping.
 */
export const getHeatmapData = () => {
    return techniqueCatalogue.map(tech => ({
        techniqueId: tech.id,
        name: tech.name,
        tacticId: tech.tactic,
        tacticName: MITRE_TACTICS.find(t => t.id === tech.tactic)?.name || 'Unknown',
        hitCount: techniqueHits.get(tech.id)?.count || 0,
        linkedItems: techniqueHits.get(tech.id)?.items || [],
    }));
};

/**
 * Process a batch of news items and update technique hit counters.
 */
export const processNewsForMitre = (newsItems) => {
    if (!Array.isArray(newsItems)) return;
    for (const item of newsItems) {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`;
        const techniques = mapTextToTechniques(text, item.link || item.id);
        item.mitreTechniques = techniques;
    }
};

/**
 * Get all news articles categorized by MITRE Framework (Tactics & Techniques).
 * Filters supported: tacticId, techniqueId, severity, search, page, limit
 */
export const getCategorizedNews = (options = {}) => {
    const {
        tacticId,
        techniqueId,
        severity,
        search,
        page = 1,
        limit = 50,
    } = options;

    const allNews = getNews();
    if (!allNews || allNews.length === 0) {
        return {
            articles: [],
            tacticsSummary: MITRE_TACTICS.map(t => ({ ...t, articleCount: 0, topTechniques: [] })),
            totalCategorized: 0,
            totalArticles: 0,
            pagination: { page, limit, totalPages: 0, totalCount: 0 },
            coverageStats: { totalTactics: MITRE_TACTICS.length, activeTactics: 0, coveragePercent: 0 }
        };
    }

    // Process and enrich each article with MITRE details & IOCs
    // Reuses mapTextToTechniques() to avoid duplicating keyword-matching logic
    const categorizedArticles = allNews.map((item, idx) => {
        const text = `${item.title || ''} ${item.contentSnippet || ''}`;

        // Use the single source-of-truth matching function (read-only, don't increment counter on GET)
        const matchedIds = mapTextToTechniques(text, item.link || item.id, false);

        // Resolve full technique details from matched IDs
        const matchedTechniques = matchedIds.map(techId => {
            const tech = techniqueCatalogue.find(t => t.id === techId);
            const tactic = MITRE_TACTICS.find(t => t.id === tech?.tactic);
            return {
                id: techId,
                name: tech?.name || techId,
                tacticId: tech?.tactic || 'Unknown',
                tacticName: tactic?.name || 'Unknown',
                tacticColor: tactic?.color || '#38bdf8',
                tacticIcon: tactic?.icon || '🛡️',
                mitreUrl: `https://attack.mitre.org/techniques/${techId}/`
            };
        });

        // Unique tactic objects
        const matchedTacticIds = new Set(matchedTechniques.map(t => t.tacticId));
        const matchedTactics = Array.from(matchedTacticIds).map(id => {
            const found = MITRE_TACTICS.find(t => t.id === id);
            return found || { id, name: id, shortName: id, icon: '🛡️', color: '#38bdf8' };
        });

        // Fast extraction of IOCs
        const extracted = extractIOCs(text);

        return {
            id: item.id || `news-${idx}-${encodeURIComponent((item.title || '').slice(0, 20))}`,
            title: item.title || 'Untitled Threat Alert',
            link: item.link || '#',
            pubDate: item.pubDate || new Date().toISOString(),
            contentSnippet: item.contentSnippet || '',
            source: item.source || 'Threat Intelligence Feed',
            severity: item.severity || 'Medium',
            category: item.category || 'General Info',
            mitreTechniques: matchedTechniques,
            mitreTactics: matchedTactics,
            isMitreCategorized: matchedTechniques.length > 0,
            extractedIOCs: extracted,
        };
    });

    // Compute tactic summaries across ALL news
    const tacticCounts = new Map();
    const tacticTechMap = new Map();

    MITRE_TACTICS.forEach(t => {
        tacticCounts.set(t.id, 0);
        tacticTechMap.set(t.id, new Map());
    });

    let totalCategorizedCount = 0;

    categorizedArticles.forEach(art => {
        if (art.mitreTactics.length > 0) totalCategorizedCount++;

        art.mitreTactics.forEach(tactic => {
            const cur = tacticCounts.get(tactic.id) || 0;
            tacticCounts.set(tactic.id, cur + 1);
        });

        art.mitreTechniques.forEach(tech => {
            const techMap = tacticTechMap.get(tech.tacticId);
            if (techMap) {
                techMap.set(tech.id, (techMap.get(tech.id) || 0) + 1);
            }
        });
    });

    const tacticsSummary = MITRE_TACTICS.map(tactic => {
        const techMap = tacticTechMap.get(tactic.id) || new Map();
        const topTechs = Array.from(techMap.entries())
            .map(([id, count]) => {
                const info = techniqueCatalogue.find(tc => tc.id === id);
                return { id, name: info?.name || id, count };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            ...tactic,
            articleCount: tacticCounts.get(tactic.id) || 0,
            topTechniques: topTechs,
        };
    });

    // Apply Filters
    let filtered = categorizedArticles;

    if (tacticId && tacticId !== 'all') {
        filtered = filtered.filter(art =>
            art.mitreTactics.some(t => t.id.toLowerCase() === tacticId.toLowerCase() || t.shortName.toLowerCase() === tacticId.toLowerCase())
        );
    }

    if (techniqueId && techniqueId !== 'all') {
        filtered = filtered.filter(art =>
            art.mitreTechniques.some(tech => tech.id.toLowerCase() === techniqueId.toLowerCase())
        );
    }

    if (severity && severity !== 'all') {
        filtered = filtered.filter(art =>
            art.severity.toLowerCase() === severity.toLowerCase()
        );
    }

    if (search && search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter(art =>
            art.title.toLowerCase().includes(q) ||
            art.contentSnippet.toLowerCase().includes(q) ||
            art.source.toLowerCase().includes(q) ||
            art.mitreTechniques.some(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
        );
    }

    // Sort by publication date descending
    filtered.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Pagination
    const totalCount = filtered.length;
    const numLimit = Math.max(1, parseInt(limit) || 50);
    const numPage = Math.max(1, parseInt(page) || 1);
    const totalPages = Math.ceil(totalCount / numLimit);
    const paginatedArticles = filtered.slice((numPage - 1) * numLimit, numPage * numLimit);

    const activeTacticsCount = tacticsSummary.filter(t => t.articleCount > 0).length;

    return {
        articles: paginatedArticles,
        tacticsSummary,
        totalCategorized: totalCategorizedCount,
        totalArticles: allNews.length,
        pagination: {
            page: numPage,
            limit: numLimit,
            totalPages,
            totalCount,
        },
        coverageStats: {
            totalTactics: MITRE_TACTICS.length,
            activeTactics: activeTacticsCount,
            coveragePercent: Math.round((activeTacticsCount / MITRE_TACTICS.length) * 100),
        },
    };
};

/**
 * Get top N most active techniques
 */
export const getTopTechniques = (n = 10) => {
    return getHeatmapData()
        .filter(t => t.hitCount > 0)
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, n);
};

export const getTactics = () => MITRE_TACTICS;
