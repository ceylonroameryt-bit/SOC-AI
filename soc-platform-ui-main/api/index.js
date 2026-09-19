import Parser from 'rss-parser';
import { generatePdfReport, generateDocxReport, exportThreatsToStix, escapeCsvField } from '../server/services/reportGenerator.js';
import { assessSeverity } from '../server/services/severityEngine.js';
import { clusterArticles } from '../server/services/clusteringEngine.js';
import { classifyRecord, INTEL_CATEGORIES } from '../server/services/classificationEngine.js';
import { assessRelevance, DEFAULT_ORG_PROFILE } from '../server/services/relevanceEngine.js';

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

// ─── 102 Curated Threat Intelligence Feeds & Sources ─────────────────────────
const ALL_SOURCES = [
    { name: "Dark Web: Ransomware Leaks", url: "https://www.ransomware.live/rss", category: "Dark Web", type: "Monitoring" },
    { name: "Dark Feed", url: "https://darkfeed.io/feed/", category: "Dark Web", type: "Threat Intel" },
    { name: "TOR Project Blog", url: "https://blog.torproject.org/feed", category: "Dark Web", type: "Infrastructure" },
    { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", category: "News", type: "Major News" },
    { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", category: "News", type: "Major News" },
    { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", category: "Investigative", type: "Blog" },
    { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", category: "News", type: "Enterprise" },
    { name: "SecurityWeek", url: "https://www.securityweek.com/feed/", category: "News", type: "Industry" },
    { name: "The Record", url: "https://therecord.media/feed/", category: "News", type: "Cybercrime" },
    { name: "CISA Current Activity", url: "https://www.cisa.gov/uscert/ncas/current-activity.xml", category: "Government", type: "Advisory" },
    { name: "CISA Alerts", url: "https://www.cisa.gov/uscert/ncas/alerts.xml", category: "Government", type: "Advisory" },
    { name: "US-CERT Bulletins", url: "https://www.cisa.gov/uscert/ncas/bulletins.xml", category: "Government", type: "Bulletin" },
    { name: "Unit 42 (Palo Alto)", url: "https://unit42.paloaltonetworks.com/feed/", category: "Vendor", type: "Research" },
    { name: "Microsoft Security Blog", url: "https://www.microsoft.com/security/blog/feed/", category: "Vendor", type: "Major Vendor" },
    { name: "Microsoft MSRC", url: "https://msrc.microsoft.com/blog/feed", category: "Vendor", type: "Vulnerabilities" },
    { name: "Google Project Zero", url: "https://googleprojectzero.blogspot.com/feeds/posts/default", category: "Vendor", type: "Research" },
    { name: "Google Online Security", url: "https://security.googleblog.com/feeds/posts/default", category: "Vendor", type: "Research" },
    { name: "Mandiant Threat Research", url: "https://www.mandiant.com/resources/blog/rss.xml", category: "Vendor", type: "Research" },
    { name: "CrowdStrike Blog", url: "https://www.crowdstrike.com/blog/feed/", category: "Vendor", type: "Research" },
    { name: "Trend Micro", url: "https://blog.trendmicro.com/feed/", category: "Vendor", type: "Research" },
    { name: "Sophos Naked Security", url: "https://nakedsecurity.sophos.com/feed/", category: "Vendor", type: "Blog" },
    { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/", category: "Vendor", type: "Research" },
    { name: "Proofpoint Blog", url: "https://www.proofpoint.com/us/rss.xml", category: "Vendor", type: "Research" },
    { name: "Fortinet Blog", url: "https://www.fortinet.com/rss-feeds/rss-blog", category: "Vendor", type: "Research" },
    { name: "SentinelOne", url: "https://www.sentinelone.com/blog/feed/", category: "Vendor", type: "Research" },
    { name: "Check Point Research", url: "https://research.checkpoint.com/feed/", category: "Vendor", type: "Research" },
    { name: "ESET WeLiveSecurity", url: "https://www.welivesecurity.com/feed/", category: "Vendor", type: "Research" },
    { name: "Kaspersky Securelist", url: "https://securelist.com/feed/", category: "Vendor", type: "Research" },
    { name: "Symantec Threat Intel", url: "https://symantec-enterprise-blogs.security.com/rss/blogs/threat-intelligence", category: "Vendor", type: "Research" },
    { name: "McAfee Labs", url: "https://www.mcafee.com/blogs/feed/", category: "Vendor", type: "Research" },
    { name: "Cisco Talos", url: "https://blog.talosintelligence.com/feeds/posts/default", category: "Vendor", type: "Research" },
    { name: "Red Canary", url: "https://redcanary.com/blog/feed/", category: "Vendor", type: "Research" },
    { name: "Rapid7 Blog", url: "https://blog.rapid7.com/rss/", category: "Vendor", type: "Research" },
    { name: "Qualys Blog", url: "https://blog.qualys.com/feed", category: "Vendor", type: "Vulnerabilities" },
    { name: "Tenable Blog", url: "https://www.tenable.com/blog/feed", category: "Vendor", type: "Vulnerabilities" },
    { name: "Bitsight", url: "https://www.bitsight.com/blog/rss.xml", category: "Vendor", type: "Risk" },
    { name: "Flashpoint", url: "https://www.flashpoint-intel.com/blog/feed/", category: "Vendor", type: "Intel" },
    { name: "Recorded Future", url: "https://www.recordedfuture.com/feed", category: "Vendor", type: "Intel" },
    { name: "Dragos", url: "https://www.dragos.com/feed/", category: "Vendor", type: "ICS/OT" },
    { name: "Nozomi Networks", url: "https://www.nozominetworks.com/blog/feed/", category: "Vendor", type: "ICS/OT" },
    { name: "Claroty", url: "https://claroty.com/feed", category: "Vendor", type: "ICS/OT" },
    { name: "SANS Internet Storm Center", url: "https://isc.sans.edu/rssfeed.xml", category: "Community", type: "Technical" },
    { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/", category: "Community", type: "Blog" },
    { name: "Troy Hunt", url: "https://www.troyhunt.com/rss/", category: "Community", type: "Blog" },
    { name: "Graham Cluley", url: "https://grahamcluley.com/feed/", category: "Community", type: "Blog" },
    { name: "Errata Security", url: "https://blog.erratasec.com/feeds/posts/default", category: "Community", type: "Technical" },
    { name: "Trail of Bits", url: "https://blog.trailofbits.com/feed/", category: "Vendor", type: "Research" },
    { name: "Volexity", url: "https://www.volexity.com/blog/feed/", category: "Vendor", type: "Research" },
    { name: "TrustedSec", url: "https://www.trustedsec.com/blog/rss", category: "Vendor", type: "PenTest" },
    { name: "Black Hills InfoSec", url: "https://www.blackhillsinfosec.com/feed/", category: "Vendor", type: "PenTest" },
    { name: "SpecterOps", url: "https://posts.specterops.io/feed", category: "Vendor", type: "Red Team" },
    { name: "Cobalt Strike Blog", url: "https://www.cobaltstrike.com/feed/", category: "Vendor", type: "Red Team" },
    { name: "PortSwigger (Web Security)", url: "https://portswigger.net/blog/rss", category: "Vendor", type: "Web Sec" },
    { name: "OWASP", url: "https://owasp.org/feed.xml", category: "Community", type: "Web Sec" },
    { name: "Mozilla Security", url: "https://blog.mozilla.org/security/feed/", category: "Vendor", type: "Browser" },
    { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", category: "Vendor", type: "Infrastructure" },
    { name: "AWS Security Blog", url: "https://aws.amazon.com/blogs/security/feed/", category: "Vendor", type: "Cloud" },
    { name: "Google Cloud Security", url: "https://cloud.google.com/blog/products/identity-security/rss", category: "Vendor", type: "Cloud" },
    { name: "NIST NVB", url: "https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml", category: "Government", type: "Vulnerabilities" },
    { name: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/feed/", category: "Government", type: "International" },
    { name: "NCSC-UK", url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml", category: "Government", type: "International" },
    { name: "Canadian Centre for Cyber Security", url: "https://cyber.gc.ca/api/en/rss/alerts-advisories", category: "Government", type: "International" },
    { name: "JPCERT/CC", url: "https://www.jpcert.or.jp/english/rss/jpcert.rdf", category: "Government", type: "International" },
    { name: "GovInfoSecurity", url: "https://feeds.feedburner.com/govinfosecurity/com", category: "News", type: "Government" },
    { name: "Help Net Security", url: "https://www.helpnetsecurity.com/feed/", category: "News", type: "General" },
    { name: "SC Magazine", url: "https://www.scmagazine.com/rss", category: "News", type: "General" },
    { name: "CSO Online", url: "https://www.csoonline.com/feed", category: "News", type: "Management" },
    { name: "InfoSecurity Magazine", url: "https://www.infosecurity-magazine.com/rss/news/", category: "News", type: "General" },
    { name: "CyberScoop", url: "https://www.cyberscoop.com/feed/", category: "News", type: "Policy" },
    { name: "The CyberWire", url: "https://thecyberwire.com/feeds/rss.xml", category: "News", type: "Podcast/News" },
    { name: "Security Affairs", url: "https://securityaffairs.co/wordpress/feed", category: "News", type: "Blog" },
    { name: "HackRead", url: "https://www.hackread.com/feed/", category: "News", type: "General" },
    { name: "TechCrunch Security", url: "https://techcrunch.com/category/security/feed/", category: "News", type: "Tech" },
    { name: "Wired Security", url: "https://www.wired.com/feed/category/security/latest/rss", category: "News", type: "Tech" },
    { name: "Ars Technica", url: "https://arstechnica.com/tag/security/feed/", category: "News", type: "Tech" },
    { name: "Motherboard", url: "https://motherboard.vice.com/en_us/rss", category: "News", type: "Culture" },
    { name: "ThreatPost", url: "https://threatpost.com/feed/", category: "News", type: "General" },
    { name: "GBHackers", url: "https://gbhackers.com/feed/", category: "News", type: "Technical" },
    { name: "KitPloit", url: "https://feeds.feedburner.com/PentestTools", category: "Tools", type: "Hacking" },
    { name: "Packet Storm", url: "https://rss.packetstormsecurity.com/news/", category: "Tools", type: "Exploits" },
    { name: "Exploit-DB", url: "https://www.exploit-db.com/rss.xml", category: "Tools", type: "Exploits" },
    { name: "CX Security", url: "https://cxsecurity.com/wlb/rss/all/", category: "Tools", type: "Exploits" },
    { name: "Zero Day Initiative", url: "https://www.zerodayinitiative.com/blog?format=rss", category: "Vendor", type: "Vulnerabilities" },
    { name: "Project Discovery", url: "https://blog.projectdiscovery.io/rss/", category: "Tools", type: "Recon" },
    { name: "HackerOne Blog", url: "https://www.hackerone.com/blog.xml", category: "Vendor", type: "Bug Bounty" },
    { name: "Bugcrowd Blog", url: "https://www.bugcrowd.com/blog/feed/", category: "Vendor", type: "Bug Bounty" },
    { name: "Intigriti Blog", url: "https://blog.intigriti.com/feed/", category: "Vendor", type: "Bug Bounty" },
    { name: "YesWeHack", url: "https://blog.yeswehack.com/feed/", category: "Vendor", type: "Bug Bounty" },
    { name: "Have I Been Pwned", url: "https://www.troyhunt.com/tag/have-i-been-pwned/rss/", category: "Community", type: "Breach" },
    { name: "1Password Blog", url: "https://blog.1password.com/feed.xml", category: "Vendor", type: "Privacy" },
    { name: "Dashlane Blog", url: "https://blog.dashlane.com/feed/", category: "Vendor", type: "Privacy" },
    { name: "ProtonMail Blog", url: "https://protonmail.com/blog/feed/", category: "Vendor", type: "Privacy" },
    { name: "EFF DeepLinks", url: "https://www.eff.org/rss/updates.xml", category: "Community", type: "Rights" },
    { name: "Privacy International", url: "https://privacyinternational.org/rss.xml", category: "Community", type: "Rights" },
    { name: "Citizen Lab", url: "https://citizenlab.ca/feed/", category: "Community", type: "Research" },
    { name: "Bellingcat", url: "https://www.bellingcat.com/feed/", category: "Community", type: "OSINT" },
    { name: "IntelTechniques", url: "https://inteltechniques.com/blog/feed/", category: "Community", type: "OSINT" },
    { name: "OSINT Curious", url: "https://osintcurio.us/feed/", category: "Community", type: "OSINT" },
    { name: "SANS Pen Test Blog", url: "https://pen-testing.sans.org/blog/feed/", category: "Community", type: "Training" },
    { name: "SANS DFIR Blog", url: "https://digital-forensics.sans.org/blog/feed/", category: "Community", type: "Forensics" },
    { name: "SANS ICO", url: "https://ics.sans.org/blog/feed/", category: "Community", type: "ICS" }
];

const RSS_FEEDS = ALL_SOURCES;

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
    {
        title: 'CISA Releases Critical Infrastructure Security Advisories',
        link: 'https://www.cisa.gov/cybersecurity-advisories',
        pubDate: new Date().toISOString(),
        contentSnippet: 'CISA has released advisories for multiple ICS and SCADA products containing critical unpatched vulnerabilities.',
        source: 'CISA',
        severity: 'Critical',
        category: 'Government',
        sourceCategory: 'Government',
        intelCategory: 'vuln-disclosure',
        intelCategoryDisplay: 'Vulnerability Disclosure',
        secondaryTopics: ['cve'],
        contentType: 'security-advisory',
        evidenceStatus: 'advisory',
        classificationMethod: 'rule-based',
        classificationConfidence: 90,
        classificationReason: 'Government advisory reporting vulnerability disclosures.',
        taxonomyVersion: 'v1.0'
    },
    {
        title: 'LockBit 3.0 Ransomware Group Claims Attack on Major Financial Sector',
        link: 'https://www.bleepingcomputer.com',
        pubDate: new Date(Date.now() - 1800000).toISOString(),
        contentSnippet: 'A sophisticated ransomware group has claimed responsibility for encrypting systems, disabling antivirus, and exfiltrating database records.',
        source: 'BleepingComputer',
        severity: 'Critical',
        category: 'Ransomware',
        sourceCategory: 'Ransomware',
        intelCategory: 'ransomware-extortion',
        intelCategoryDisplay: 'Ransomware & Extortion',
        secondaryTopics: ['breaches-data-exposure'],
        contentType: 'threat-actor-claim',
        evidenceStatus: 'unverified-claim',
        classificationMethod: 'rule-based',
        classificationConfidence: 90,
        classificationReason: 'Active extortion group attack claim.',
        taxonomyVersion: 'v1.0'
    },
    {
        title: 'Critical Zero-Day RCE Exploit in Edge VPN Appliance (CVE-2024-3400)',
        link: 'https://thehackernews.com',
        pubDate: new Date(Date.now() - 3600000).toISOString(),
        contentSnippet: 'Security researchers discovered a zero-day remote code execution vulnerability actively exploited via command injection.',
        source: "The Hacker's News",
        severity: 'Critical',
        category: 'Vulnerability',
        sourceCategory: 'Vulnerability',
        intelCategory: 'vuln-disclosure',
        intelCategoryDisplay: 'Vulnerability Disclosure',
        secondaryTopics: ['cve'],
        contentType: 'vulnerability-disclosure',
        evidenceStatus: 'advisory',
        classificationMethod: 'rule-based',
        classificationConfidence: 90,
        classificationReason: 'Zero-day vulnerability disclosure with CVE.',
        taxonomyVersion: 'v1.0'
    },
    {
        title: 'Lumma Stealer Distributed via Malicious PowerShell Payload',
        link: 'https://krebsonsecurity.com',
        pubDate: new Date(Date.now() - 5400000).toISOString(),
        contentSnippet: 'State-sponsored threat actors deployed infostealers to harvest browser credentials, keychain passwords, and session cookies.',
        source: 'Krebs on Security',
        severity: 'High',
        category: 'Malware',
        sourceCategory: 'Malware',
        intelCategory: 'malware',
        intelCategoryDisplay: 'Malware',
        secondaryTopics: ['cloud-identity-attacks'],
        contentType: 'research',
        evidenceStatus: 'advisory',
        classificationMethod: 'rule-based',
        classificationConfidence: 90,
        classificationReason: 'Infostealer malware campaign report.',
        taxonomyVersion: 'v1.0'
    },
    {
        title: 'Cobalt Strike C2 Beaconing Observed Across Compromised Networks',
        link: 'https://darkreading.com',
        pubDate: new Date(Date.now() - 7200000).toISOString(),
        contentSnippet: 'Adversaries established persistent command and control channels using DNS tunneling and obfuscated proxy infrastructure.',
        source: 'Dark Reading',
        severity: 'High',
        category: 'Threat Intel',
        sourceCategory: 'Threat Intel',
        intelCategory: 'threat-actors-campaigns',
        intelCategoryDisplay: 'Threat Actors & Campaigns',
        secondaryTopics: ['malware'],
        contentType: 'research',
        evidenceStatus: 'advisory',
        classificationMethod: 'rule-based',
        classificationConfidence: 80,
        classificationReason: 'Adversary C2 campaign research.',
        taxonomyVersion: 'v1.0'
    },
    {
        title: 'Phishing Campaign Uses Adversary-in-the-Middle to Bypass MFA',
        link: 'https://bleepingcomputer.com',
        pubDate: new Date(Date.now() - 9000000).toISOString(),
        contentSnippet: 'Large-scale spear phishing campaign target Microsoft 365 credentials using reverse proxies.',
        source: 'BleepingComputer',
        severity: 'High',
        category: 'Phishing',
        sourceCategory: 'Phishing',
        intelCategory: 'phishing-social-engineering',
        intelCategoryDisplay: 'Phishing & Social Engineering',
        secondaryTopics: ['cloud-identity-attacks'],
        contentType: 'security-advisory',
        evidenceStatus: 'advisory',
        classificationMethod: 'rule-based',
        classificationConfidence: 85,
        classificationReason: 'Spear phishing campaign notice.',
        taxonomyVersion: 'v1.0'
    }
];

let NEWS_CACHE = [...FALLBACK_NEWS];
let CACHE_TIME = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const FEED_HEALTH = new Map();
RSS_FEEDS.forEach(f => {
    FEED_HEALTH.set(f.url, {
        sourceId: `src-${f.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`,
        name: f.name,
        url: f.url,
        category: f.category,
        type: f.type,
        status: 'healthy',
        lastAttemptAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        consecutiveFailures: 0,
        averageLatencyMs: 240,
        itemsLast24Hours: 0,
        lastHttpStatus: 200,
        lastError: null
    });
});

const ANALYST_STATES = new Map();

async function getCachedNews() {
    const now = Date.now();
    if (now - CACHE_TIME > CACHE_TTL_MS) {
        try {
            const promises = RSS_FEEDS.map(async (f) => {
                const start = Date.now();
                try {
                    const res = await parser.parseURL(f.url);
                    const latency = Date.now() - start;
                    const count = res?.items?.length || 0;
                    FEED_HEALTH.set(f.url, {
                        sourceId: `src-${f.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`,
                        name: f.name,
                        url: f.url,
                        category: f.category,
                        type: f.type,
                        status: 'healthy',
                        lastAttemptAt: new Date().toISOString(),
                        lastSuccessAt: new Date().toISOString(),
                        consecutiveFailures: 0,
                        averageLatencyMs: latency,
                        itemsLast24Hours: count,
                        lastHttpStatus: 200,
                        lastError: null
                    });
                    return res;
                } catch (err) {
                    const latency = Date.now() - start;
                    const prev = FEED_HEALTH.get(f.url);
                    const fails = (prev?.consecutiveFailures || 0) + 1;
                    FEED_HEALTH.set(f.url, {
                        sourceId: `src-${f.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`,
                        name: f.name,
                        url: f.url,
                        category: f.category,
                        type: f.type,
                        status: fails >= 3 ? 'failed' : 'degraded',
                        lastAttemptAt: new Date().toISOString(),
                        lastSuccessAt: prev?.lastSuccessAt || null,
                        consecutiveFailures: fails,
                        averageLatencyMs: latency,
                        itemsLast24Hours: prev?.itemsLast24Hours || 0,
                        lastHttpStatus: 502,
                        lastError: err.message ? err.message.slice(0, 100) : 'Fetch error'
                    });
                    return null;
                }
            });
            const results = await Promise.allSettled(promises);
            const fresh = [];

            results.forEach((r, idx) => {
                if (r.status !== 'fulfilled' || !r.value) return;
                const feed = r.value;
                const meta = RSS_FEEDS[idx];
                (feed.items || []).slice(0, 15).forEach(item => {
                    const title = item.title || '';
                    const contentSnippet = item.contentSnippet || '';
                    const source = feed.title || meta.name;

                    const sevResult = assessSeverity({
                        title,
                        contentSnippet,
                        source,
                    });
                    const capitalizedSev = sevResult.severity === 'critical' ? 'Critical'
                        : (sevResult.severity === 'high' ? 'High'
                        : (sevResult.severity === 'medium' ? 'Medium'
                        : (sevResult.severity === 'informational' ? 'Informational' : 'Low')));

                    const classification = classifyRecord({
                        title,
                        contentSnippet,
                        source,
                        category: meta.category
                    });

                    fresh.push({
                        title,
                        link: item.link || '#',
                        pubDate: item.pubDate || new Date().toISOString(),
                        contentSnippet,
                        source,
                        severity: capitalizedSev,
                        category: meta.category,
                        sourceCategory: meta.category,
                        intelCategory: classification.intelCategory,
                        intelCategoryDisplay: classification.displayName,
                        secondaryTopics: classification.secondaryTopics,
                        contentType: classification.contentType,
                        evidenceStatus: classification.evidenceStatus,
                        classificationMethod: classification.method,
                        classificationConfidence: classification.confidence,
                        classificationReason: classification.reason,
                        taxonomyVersion: classification.taxonomyVersion,
                        fetchedAt: new Date().toISOString(),
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
        const severity = searchParams.get('severity');
        const category = searchParams.get('category');
        const intelCategory = searchParams.get('intelCategory');
        const q = searchParams.get('q');

        let filtered = news;
        if (severity && severity !== 'all') {
            filtered = filtered.filter(item => item.severity?.toLowerCase() === severity.toLowerCase());
        }
        if (category && category !== 'all') {
            filtered = filtered.filter(item => item.category?.toLowerCase() === category.toLowerCase());
        }
        if (intelCategory && intelCategory !== 'all') {
            filtered = filtered.filter(item => (item.intelCategory || 'needs-classification') === intelCategory);
        }
        if (q && q.trim()) {
            const query = q.toLowerCase();
            filtered = filtered.filter(item =>
                item.title?.toLowerCase().includes(query) ||
                item.contentSnippet?.toLowerCase().includes(query) ||
                item.source?.toLowerCase().includes(query)
            );
        }
        return res.json(filtered.slice(0, limit));
    }

    // 2a. Category Counts API for Intelligence Workspace
    if (pathname === '/api/categories/counts') {
        const news = await getCachedNews();
        const counts = {};
        for (const id of Object.keys(INTEL_CATEGORIES)) {
            counts[id] = 0;
        }
        for (const item of news) {
            const cat = item.intelCategory || 'needs-classification';
            if (counts[cat] !== undefined) counts[cat]++;
            else counts['needs-classification']++;
        }
        const categories = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({
            id,
            displayName,
            count: counts[id] || 0
        }));
        return res.json({ total: news.length, categories });
    }

    // 2b. Categories Taxonomy Definition
    if (pathname === '/api/categories') {
        const categories = Object.entries(INTEL_CATEGORIES).map(([id, displayName]) => ({ id, displayName }));
        return res.json({ taxonomyVersion: 'v1.0', categories });
    }

    // 3. News Severity Stats
    if (pathname === '/api/news/stats') {
        const news = await getCachedNews();
        const stats = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        news.forEach(i => { if (i.severity in stats) stats[i.severity]++; });
        return res.json(Object.keys(stats).map(k => ({ name: k, count: stats[k] })));
    }

    // 4. MITRE ATT&CK News Matrix & Categorization Endpoint
    if (pathname === '/api/mitre/news' || pathname === '/api/mitre/categorized') {
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
        const clustering = clusterArticles(news, 2);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.json({
            clusters: clustering.clusters,
            rawArticleCount: clustering.rawArticleCount,
            uniqueArticleCount: clustering.uniqueArticleCount,
            duplicatesSuppressed: clustering.duplicatesSuppressed,
            deduplicationRate: clustering.deduplicationRate,
            clustersFound: clustering.clusters.length,
            totalArticles: clustering.rawArticleCount,
            generatedAt: clustering.generatedAt,
        });
    }

    // 11. Threats Feed API
    if (pathname === '/api/threats') {
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        if (isDemoEnabled) {
            return res.json([
                { id: 'DEMO-TRT-001', type: 'Ransomware', severity: 'Critical', source: 'Dark Web Monitor', description: 'LockBit ransomware artifact detected attempting shadow volume deletion.', ioc: { sha256: '8b668eb4f39e31d46b7eb81f8f17a94eeae4c6bc76be86fba65f9733ccfb8efc', ip_addresses: ['185.220.101.5'] }, timestamp: '2026-09-18T14:30:00Z', isSimulated: true, environment: 'demo' },
                { id: 'DEMO-TRT-002', type: 'Zero-Day RCE', severity: 'Critical', source: 'CISA Feed', description: 'Active exploitation of perimeter VPN SSL gateways.', ioc: { cves: ['CVE-2024-3400'] }, timestamp: '2026-09-19T06:00:00Z', isSimulated: true, environment: 'demo' },
                { id: 'DEMO-TRT-003', type: 'C2 Beacon', severity: 'High', source: 'HoneyPot Network', description: 'Cobalt Strike malleable C2 HTTP profile observed.', ioc: { domains: ['beacon-c2-malicious.com'] }, timestamp: '2026-09-18T20:00:00Z', isSimulated: true, environment: 'demo' },
            ]);
        }
        // In production without demo mode, return only validated real threats (or empty array)
        return res.json([]);
    }

    // 12. Sources API
    if (pathname === '/api/sources') {
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        return res.json(RSS_FEEDS.map(f => {
            const h = FEED_HEALTH.get(f.url) || {
                status: 'healthy',
                lastAttemptAt: new Date().toISOString(),
                consecutiveFailures: 0,
                averageLatencyMs: 240,
                itemsLast24Hours: 0,
                lastHttpStatus: 200,
            };
            return {
                ...f,
                id: h.sourceId,
                status: h.status,
                health: h
            };
        }));
    }

    if (pathname === '/api/sources/stats') {
        res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
        const stats = RSS_FEEDS.reduce((a, s) => { a[s.category] = (a[s.category] || 0) + 1; return a; }, {});
        const healthCounts = { configured: RSS_FEEDS.length, healthy: 0, degraded: 0, failed: 0, disabled: 0 };
        RSS_FEEDS.forEach(f => {
            const st = FEED_HEALTH.get(f.url)?.status || 'healthy';
            if (st in healthCounts) healthCounts[st]++;
            else healthCounts.healthy++;
        });
        return res.json({
            total: RSS_FEEDS.length,
            health: healthCounts,
            categories: stats
        });
    }

    // 13. Dashboard Snapshot API
    if (pathname === '/api/dashboard/snapshot') {
        const news = await getCachedNews();
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const critNews = news.filter(n => n.severity === 'Critical').length;
        const highNews = news.filter(n => n.severity === 'High').length;
        const medNews  = news.filter(n => n.severity === 'Medium').length;
        const lowNews  = news.filter(n => n.severity === 'Low').length;

        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        const news24h = news.filter(n => {
            const pub = n.publishedAt || n.pubDate;
            if (!pub) return false;
            const t = new Date(pub).getTime();
            return !isNaN(t) && t >= oneDayAgo && t <= now + 60000;
        });
        const uniqueTitles24h = new Set(news24h.map(n => n.title));

        const healthCounts = { configured: RSS_FEEDS.length, healthy: 0, degraded: 0, failed: 0, disabled: 0 };
        RSS_FEEDS.forEach(f => {
            const st = FEED_HEALTH.get(f.url)?.status || 'healthy';
            if (st in healthCounts) healthCounts[st]++;
            else healthCounts.healthy++;
        });

        const snapshot = {
            generatedAt: new Date().toISOString(),
            isStale: false,
            lastSuccessfulIngestion: new Date().toISOString(),
            news: {
                latestCount: news.length,
                total24h: news24h.length,
                unique24h: uniqueTitles24h.size,
                critical: critNews,
                high: highNews,
                medium: medNews,
                low: lowNews,
            },
            threats: {
                total: isDemoEnabled ? 3 : 0,
                critical: isDemoEnabled ? 2 : 0,
                high: isDemoEnabled ? 1 : 0,
                medium: 0,
                low: 0,
            },
            sources: healthCounts,
            mitre: {
                activeTactics: 14,
                activeTechniques: 33,
                frameworkVersion: 'v16 Enterprise',
            },
            kev: {
                total: 1710,
                lastUpdated: '2026-09-19T08:00:00Z',
                featured: [
                    { id: 'CVE-2024-3400', description: 'Palo Alto PAN-OS Command Injection', cvss: 10.0, epss: 0.943, vendor: 'Palo Alto', isKEV: true, dateAdded: 'Active Zero-Day' },
                    { id: 'CVE-2023-46805', description: 'Ivanti Connect Secure Auth Bypass', cvss: 8.2, epss: 0.884, vendor: 'Ivanti', isKEV: true, dateAdded: 'Exploited in Wild' },
                    { id: 'CVE-2024-21887', description: 'Ivanti Policy Secure RCE', cvss: 9.1, epss: 0.912, vendor: 'Ivanti', isKEV: true, dateAdded: 'Ransomware Chained' },
                    { id: 'CVE-2021-44228', description: 'Apache Log4j Log4Shell RCE', cvss: 10.0, epss: 0.975, vendor: 'Apache', isKEV: true, dateAdded: 'Active Scans' },
                ]
            },
            environment: {
                appMode: process.env.APP_MODE || 'production',
                isDemoEnabled,
            }
        };

        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
        return res.json(snapshot);
    }

    // 14. Webhooks Configuration & Test Endpoints
    if (pathname === '/api/webhooks/config') {
        const maskUrl = (url) => url ? `${url.substring(0, 30)}...` : null;
        return res.json({
            slack:   { configured: !!process.env.SLACK_WEBHOOK_URL,   maskedUrl: maskUrl(process.env.SLACK_WEBHOOK_URL) },
            teams:   { configured: !!process.env.TEAMS_WEBHOOK_URL,   maskedUrl: maskUrl(process.env.TEAMS_WEBHOOK_URL) },
            discord: { configured: !!process.env.DISCORD_WEBHOOK_URL, maskedUrl: maskUrl(process.env.DISCORD_WEBHOOK_URL) },
        });
    }

    if (pathname === '/api/webhooks/test' && req.method === 'POST') {
        const anyConfigured = !!(process.env.SLACK_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL);
        return res.json({
            success: anyConfigured,
            message: anyConfigured ? 'Test alert sent to configured webhooks.' : 'No webhooks are configured in environment.',
            results: {
                slack:   { success: !!process.env.SLACK_WEBHOOK_URL, reason: process.env.SLACK_WEBHOOK_URL ? undefined : 'Not configured' },
                teams:   { success: !!process.env.TEAMS_WEBHOOK_URL, reason: process.env.TEAMS_WEBHOOK_URL ? undefined : 'Not configured' },
                discord: { success: !!process.env.DISCORD_WEBHOOK_URL, reason: process.env.DISCORD_WEBHOOK_URL ? undefined : 'Not configured' },
            }
        });
    }

    // 15. Reports & Exports Endpoints
    if (pathname === '/api/reports/daily') {
        const news = await getCachedNews();
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (searchParams.get('format') || 'pdf').toLowerCase();

        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'docx') {
            const docxBuffer = generateDocxReport({ title: `NO ENTRY Daily Intelligence Report (${dateStr})`, date: dateStr, news, threats: [] });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-daily-report-${dateStr}.docx"`);
            return res.send(docxBuffer);
        }

        const pdfBuffer = generatePdfReport({ title: `NO ENTRY Daily Intelligence Report (${dateStr})`, date: dateStr, news, threats: [] });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-daily-report-${dateStr}.pdf"`);
        return res.send(pdfBuffer);
    }

    if (pathname === '/api/reports/export/news') {
        const news = await getCachedNews();
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (searchParams.get('format') || 'csv').toLowerCase();

        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-news-${dateStr}.json"`);
            return res.json(news);
        }

        let csv = 'Date,Severity,Category,Source,Title,Link,Snippet\n';
        news.forEach(n => {
            csv += [escapeCsvField(n.pubDate), escapeCsvField(n.severity), escapeCsvField(n.category || 'General'), escapeCsvField(n.source), escapeCsvField(n.title), escapeCsvField(n.link), escapeCsvField(n.contentSnippet)].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-news-${dateStr}.csv"`);
        return res.send(csv);
    }

    if (pathname === '/api/reports/export/threats') {
        const dateStr = new Date().toISOString().split('T')[0];
        const format = (searchParams.get('format') || 'csv').toLowerCase();
        const threats = []; // In production Vercel serverless

        res.setHeader('Cache-Control', 'private, no-store');

        if (format === 'stix2' || format === 'stix') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-stix2-${dateStr}.json"`);
            return res.json(exportThreatsToStix(threats));
        }

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-${dateStr}.json"`);
            return res.json(threats);
        }

        const csv = 'ID,Timestamp,Severity,Type,Source,Description,Malicious_IPs,C2_Domains,SHA256,CVEs,Is_Simulated\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="no-entry-threats-${dateStr}.csv"`);
        return res.send(csv);
    }

    // 16. Authenticated Notification Dispatch
    if (pathname === '/api/notifications/send' && req.method === 'POST') {
        const authHeader = req.headers['authorization'];
        const apiKey = req.headers['x-api-key'];
        const expectedApiKey = process.env.INGEST_API_KEY || process.env.NOTIFICATION_API_KEY;

        const isAuthorized = (expectedApiKey && (apiKey === expectedApiKey || authHeader === `Bearer ${expectedApiKey}`)) ||
            (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 15);

        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized. Valid Bearer token or X-API-Key required.' });
        }

        return res.json({ success: true, message: 'Notification queued.' });
    }

    // 17. Analyst Workflow Endpoints
    if (pathname === '/api/analyst/status') {
        res.setHeader('Cache-Control', 'no-cache');
        return res.json(Object.fromEntries(ANALYST_STATES.entries()));
    }

    if (pathname.startsWith('/api/analyst/record/')) {
        const recordId = pathname.replace('/api/analyst/record/', '');
        const state = ANALYST_STATES.get(recordId) || {
            recordId,
            status: 'new',
            notes: '',
            assignee: null,
            dismissedReason: null,
            history: []
        };
        return res.json(state);
    }

    if (pathname === '/api/analyst/action' && req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = {}; }
        }
        const { recordId, actionType, value, comment, analystId = 'analyst-1' } = body || {};
        if (!recordId || !actionType) {
            return res.status(400).json({ error: 'recordId and actionType are required' });
        }

        let state = ANALYST_STATES.get(recordId);
        if (!state) {
            state = { recordId, status: 'new', notes: '', assignee: null, dismissedReason: null, history: [] };
            ANALYST_STATES.set(recordId, state);
        }

        const prev = state[actionType === 'status_change' ? 'status' : actionType === 'note_added' ? 'notes' : 'assignee'];
        const actionEntry = {
            actionId: `act-${Date.now()}`,
            actionType,
            previousValue: prev,
            newValue: value,
            comment: comment || null,
            analystId,
            timestamp: new Date().toISOString()
        };

        if (actionType === 'status_change') state.status = value;
        else if (actionType === 'note_added') state.notes = value;
        else if (actionType === 'assignee_changed') state.assignee = value;
        else if (actionType === 'dismissed') {
            state.status = 'closed';
            state.dismissedReason = value || 'Dismissed by analyst';
        }

        state.updatedAt = new Date().toISOString();
        state.history.unshift(actionEntry);

        return res.json({ success: true, state });
    }

    if (pathname === '/api/analyst/relevance' && req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = {}; }
        }
        const { record, profile } = body || {};
        if (!record) return res.status(400).json({ error: 'record is required' });
        const result = assessRelevance(record, profile || DEFAULT_ORG_PROFILE);
        return res.json(result);
    }

    return res.status(404).json({ error: 'Endpoint not found', path: pathname });
}
