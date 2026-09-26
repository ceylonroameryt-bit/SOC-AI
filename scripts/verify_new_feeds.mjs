import fs from 'fs';
import Parser from '../soc-platform-ui-main/node_modules/rss-parser/index.js';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000
});

// Load existing sources to ensure no duplicates
const existingSources = JSON.parse(fs.readFileSync('./soc-platform-ui-main/server/data/sources.json', 'utf8'));
const existingUrls = new Set(existingSources.map(s => (s.url || '').toLowerCase().trim()));

// Curated high-priority candidates from major cybersecurity organizations
const premierCandidates = [
    { name: "CISA Cybersecurity Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", category: "Government & CERT", language: "en" },
    { name: "CERT-EU Security Advisories", url: "https://cert.europa.eu/publications/security-advisories/rss", category: "Government & CERT", language: "en" },
    { name: "BSI Deutschland Security Advisories", url: "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed_Sicherheitshinweise.xml", category: "Government & CERT", language: "de" },
    { name: "CERT-NZ Security Advisories", url: "https://www.cert.govt.nz/it-specialists/advisories/rss", category: "Government & CERT", language: "en" },
    { name: "ACSC Alerts (Australia)", url: "https://www.cyber.gov.au/rss/alerts.xml", category: "Government & CERT", language: "en" },
    { name: "GitHub Security Lab Research", url: "https://github.blog/tag/security-lab/feed/", category: "Application & Web Security", language: "en" },
    { name: "Google Threat Analysis Group (TAG)", url: "https://blog.google/threat-analysis-group/rss/", category: "Vendor Security Research", language: "en" },
    { name: "Wiz Security Blog", url: "https://www.wiz.io/blog/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Snyk Security Research", url: "https://snyk.io/blog/feed.xml", category: "Application & Web Security", language: "en" },
    { name: "The DFIR Report", url: "https://thedfirreport.com/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Malware Unicorn", url: "https://malwareunicorn.org/feed.xml", category: "Malware & Ransomware Research", language: "en" },
    { name: "BleepingComputer Deals & News", url: "https://www.bleepingcomputer.com/feed/", category: "Cybersecurity News", language: "en" },
    { name: "Red Canary Threat Research", url: "https://redcanary.com/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Palo Alto Unit 42 Research", url: "https://unit42.paloaltonetworks.com/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Huntress Blog", url: "https://www.huntress.com/blog/rss.xml", category: "Vendor Security Research", language: "en" },
    { name: "PortSwigger Research", url: "https://portswigger.net/research/rss", category: "Application & Web Security", language: "en" },
    { name: "Tenable Cyber Exposure Alerts", url: "https://www.tenable.com/blog/feed", category: "Vulnerability Disclosures", language: "en" },
    { name: "Kaspersky Securelist Research", url: "https://securelist.com/feed/", category: "Malware & Ransomware Research", language: "en" },
    { name: "Abuse.ch URLhaus Recent Additions", url: "https://urlhaus.abuse.ch/feeds/rss/", category: "Malware & Ransomware Research", language: "en" },
    { name: "Threatpost Media (Archive)", url: "https://threatpost.com/feed/", category: "Cybersecurity News", language: "en" },
    { name: "Zero Day Initiative Blog", url: "https://www.zerodayinitiative.com/blog?format=rss", category: "Vulnerability Disclosures", language: "en" },
    { name: "Talos Threat Intel", url: "https://blog.talosintelligence.com/rss/", category: "Vendor Security Research", language: "en" },
    { name: "Elastic Security Labs", url: "https://www.elastic.co/security-labs/rss/feed.xml", category: "Vendor Security Research", language: "en" },
    { name: "Permiso Cloud Security", url: "https://permiso.io/blog/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "SpecterOps BloodHound & Red Team", url: "https://specterops.io/feed", category: "Incident Response & Forensics", language: "en" },
    { name: "Datadog Security Labs", url: "https://securitylabs.datadoghq.com/rss/feed.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Cybereason Nocturnus Blog", url: "https://www.cybereason.com/blog/rss.xml", category: "Vendor Security Research", language: "en" },
    { name: "Recorded Future Research", url: "https://www.recordedfuture.com/feed", category: "Vendor Security Research", language: "en" },
    { name: "Curated Intel", url: "https://www.curatedintel.org/feeds/posts/default", category: "Threat Intelligence", language: "en" },
    { name: "Anomali Threat Research", url: "https://www.anomali.com/blog/rss.xml", category: "Vendor Security Research", language: "en" },
    { name: "Nviso Labs Blog", url: "https://blog.nviso.eu/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Secureworks Counter Threat Unit", url: "https://www.secureworks.com/rss?feed=blog", category: "Vendor Security Research", language: "en" },
    { name: "SentinelOne Research", url: "https://www.sentinelone.com/blog/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Morphisec Threat Research", url: "https://blog.morphisec.com/rss.xml", category: "Malware & Ransomware Research", language: "en" },
    { name: "Checkpoint Research", url: "https://research.checkpoint.com/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Intezer Threat Research", url: "https://intezer.com/blog/feed/", category: "Malware & Ransomware Research", language: "en" },
    { name: "Qualys Security Research", url: "https://blog.qualys.com/feed", category: "Vulnerability Disclosures", language: "en" },
    { name: "Rapid7 Research Blog", url: "https://blog.rapid7.com/rss/", category: "Vulnerability Disclosures", language: "en" },
    { name: "Synack Red Team Blog", url: "https://www.synack.com/blog/feed/", category: "Application & Web Security", language: "en" },
    { name: "Cisco Talos Intelligence", url: "https://blog.talosintelligence.com/rss/", category: "Vendor Security Research", language: "en" },
    { name: "Darktrace Threat Research", url: "https://darktrace.com/blog/rss", category: "Vendor Security Research", language: "en" },
    { name: "Malwarebytes Labs", url: "https://www.malwarebytes.com/blog/feed/index.xml", category: "Malware & Ransomware Research", language: "en" },
    { name: "Trellix Threat Labs", url: "https://www.trellix.com/en-us/about/newsroom/stories/threat-labs.xml", category: "Vendor Security Research", language: "en" },
    { name: "Eclypsium Supply Chain & Firmware", url: "https://eclypsium.com/feed/", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "Armis IoT Security", url: "https://www.armis.com/blog/feed/", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "Bishop Fox Security Research", url: "https://bishopfox.com/blog/rss.xml", category: "Application & Web Security", language: "en" },
    { name: "Aqua Security Cloud Native Research", url: "https://blog.aquasec.com/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Praetorian Cybersecurity", url: "https://www.praetorian.com/feed/", category: "Application & Web Security", language: "en" },
    { name: "Mandiant (Google Cloud Feed)", url: "https://cloud.google.com/feeds/mandiant-threat-intelligence.xml", category: "Vendor Security Research", language: "en" },
    { name: "SOCRadar Dark Web & Intel", url: "https://socradar.io/feed/", category: "Dark Web & Ransomware", language: "en" },
    { name: "Resecurity Cyber Threat Intel", url: "https://www.resecurity.com/feed", category: "Threat Intelligence", language: "en" },
    { name: "Group-IB Threat Intel", url: "https://www.group-ib.com/blog/feed/", category: "Vendor Security Research", language: "en" },
    { name: "SecurityScorecard Research", url: "https://securityscorecard.com/blog/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Kaspersky Threat Intelligence", url: "https://www.kaspersky.com/blog/feed/", category: "Cybersecurity News", language: "en" },
    { name: "Blackberry Cybersecurity Blog", url: "https://blogs.blackberry.com/en/home/rss", category: "Vendor Security Research", language: "en" },
    { name: "NCC Group Research", url: "https://research.nccgroup.com/feed/", category: "Application & Web Security", language: "en" },
    { name: "SecuriteInfo Antivirus Signatures", url: "https://www.securiteinfo.com/rss/malware.xml", category: "Malware & Ransomware Research", language: "fr" },
    { name: "CERT-PL (Poland CSIRT)", url: "https://cert.pl/rss.xml", category: "Government & CERT", language: "pl" },
    { name: "ANSSI Advisories (France)", url: "https://www.cert.ssi.gouv.fr/feed/", category: "Government & CERT", language: "fr" },
    { name: "CCN-CERT (Spain)", url: "https://www.ccn-cert.cni.es/es/rss.html", category: "Government & CERT", language: "es" }
];

// Also pull candidates from the OPML
const opmlCandidates = JSON.parse(fs.readFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/categorized_opml_feeds.json', 'utf8'));

// Combine candidates
const combined = [...premierCandidates];
for (const op of opmlCandidates) {
    if (!combined.some(c => c.url === op.feedUrl)) {
        combined.push({
            name: op.name,
            url: op.feedUrl,
            category: op.category,
            language: 'en',
            provenance: 'zer0yu/CyberSecurityRSS'
        });
    }
}

async function validateFeed(candidate) {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(candidate.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
            },
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
        const rawText = await res.text();
        const clean = rawText.replace(/^\uFEFF/, '').trim();
        if (!clean.includes('<rss') && !clean.includes('<feed') && !clean.includes('<channel')) {
            return { ok: false, status: res.status, reason: 'HTML returned' };
        }
        const parsed = await parser.parseString(clean);
        const items = parsed.items || [];
        if (items.length === 0) return { ok: false, reason: 'Empty feed' };
        const latestDate = items[0]?.pubDate || items[0]?.isoDate || null;
        return {
            ok: true,
            candidate,
            itemsCount: items.length,
            title: parsed.title,
            finalUrl: res.url,
            latestDate,
            latencyMs: Date.now() - start
        };
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

async function run() {
    console.log(`Starting validation across candidates to find at least 50+ rock-solid new feeds...`);
    const verified = [];
    const targetCount = 60; // target 60 so we comfortably exceed the 36 milestone

    for (let i = 0; i < combined.length && verified.length < targetCount; i++) {
        const c = combined[i];
        if (existingUrls.has(c.url.toLowerCase())) {
            continue; // Skip already existing
        }
        if (verified.some(v => v.finalUrl.toLowerCase() === c.url.toLowerCase())) {
            continue; // Skip duplicate final
        }

        const res = await validateFeed(c);
        if (res.ok) {
            verified.push({
                name: c.name || res.title,
                url: c.url,
                finalUrl: res.finalUrl,
                category: c.category || 'Threat Intelligence',
                language: c.language || 'en',
                provenance: c.provenance || 'Curated Threat Intel Registry',
                itemsCount: res.itemsCount,
                latestDate: res.latestDate,
                latencyMs: res.latencyMs
            });
            console.log(`[VERIFIED ${verified.length}/${targetCount}] ${c.name} (${res.itemsCount} items, ${res.latencyMs}ms)`);
        } else {
            // failed, skip
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`\n✅ Finished! Verified ${verified.length} brand new working feeds.`);
    fs.writeFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/verified_new_feeds.json', JSON.stringify(verified, null, 2));
}

run().catch(console.error);
