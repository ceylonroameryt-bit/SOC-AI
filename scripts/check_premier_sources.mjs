import fs from 'fs';
import Parser from '../soc-platform-ui-main/node_modules/rss-parser/index.js';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    },
    timeout: 8000
});

const candidates = [
    { name: "CISA ICS Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "CISA Medical ICS Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/ics-medical-advisories.xml", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "AWS Security Bulletins", url: "https://aws.amazon.com/security/security-bulletins/rss/", category: "Cloud & Identity Security", language: "en" },
    { name: "Malware Traffic Analysis", url: "https://www.malware-traffic-analysis.net/blog-entries.rss", category: "Malware & Ransomware Research", language: "en" },
    { name: "CIRCL CERT Advisories (Luxembourg)", url: "https://www.circl.lu/feed.xml", category: "Government & CERT", language: "en" },
    { name: "CERT-FR Bulletins (France)", url: "https://www.cert.ssi.gouv.fr/feed/", category: "Government & CERT", language: "fr" },
    { name: "CERT-PL (Poland)", url: "https://cert.pl/rss.xml", category: "Government & CERT", language: "pl" },
    { name: "MDSec ActiveBreach Research", url: "https://www.mdsec.co.uk/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Outflank Security Research", url: "https://outflank.nl/blog/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Sekoia.io Cyber Threat Intelligence", url: "https://blog.sekoia.io/feed/", category: "Threat Intelligence", language: "en" },
    { name: "GreyNoise Threat Labs", url: "https://www.greynoise.io/blog/rss.xml", category: "Threat Intelligence", language: "en" },
    { name: "Shodan Threat Monitoring", url: "https://blog.shodan.io/rss/", category: "Threat Intelligence", language: "en" },
    { name: "Censys Cyber Research", url: "https://censys.com/feed/", category: "Threat Intelligence", language: "en" },
    { name: "Decipher Security News (Cisco Duo)", url: "https://duo.com/decipher/rss", category: "Cybersecurity News", language: "en" },
    { name: "CyberScoop Policy & Breach News", url: "https://cyberscoop.com/feed/", category: "Cybersecurity News", language: "en" },
    { name: "Wiz Cloud Threat Research", url: "https://www.wiz.io/blog/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Snyk Vulnerability Database", url: "https://snyk.io/blog/feed.xml", category: "Application & Web Security", language: "en" },
    { name: "The DFIR Report Investigations", url: "https://thedfirreport.com/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Red Canary Detection Engineering", url: "https://redcanary.com/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Huntress Labs SOC Research", url: "https://www.huntress.com/blog/rss.xml", category: "Vendor Security Research", language: "en" },
    { name: "PortSwigger Web Security Research", url: "https://portswigger.net/research/rss", category: "Application & Web Security", language: "en" },
    { name: "Elastic Security Labs", url: "https://www.elastic.co/security-labs/rss/feed.xml", category: "Vendor Security Research", language: "en" },
    { name: "Permiso Cloud Threat Research", url: "https://permiso.io/blog/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Datadog Security Labs Research", url: "https://securitylabs.datadoghq.com/rss/feed.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Nviso European Threat Research", url: "https://blog.nviso.eu/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "Synack Red Team Threat Reports", url: "https://www.synack.com/blog/feed/", category: "Application & Web Security", language: "en" },
    { name: "Eclypsium Firmware Threat Research", url: "https://eclypsium.com/feed/", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "Bishop Fox Security Research", url: "https://bishopfox.com/blog/rss.xml", category: "Application & Web Security", language: "en" },
    { name: "Aqua Security Cloud Native Research", url: "https://blog.aquasec.com/rss.xml", category: "Cloud & Identity Security", language: "en" },
    { name: "Praetorian Labs Research", url: "https://www.praetorian.com/feed/", category: "Application & Web Security", language: "en" },
    { name: "SOCRadar Dark Web & Ransomware", url: "https://socradar.io/feed/", category: "Dark Web & Ransomware", language: "en" },
    { name: "Resecurity Threat Intelligence", url: "https://www.resecurity.com/feed", category: "Threat Intelligence", language: "en" },
    { name: "Group-IB Cybercrime Research", url: "https://www.group-ib.com/blog/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Kaspersky Global Threat Intelligence", url: "https://www.kaspersky.com/blog/feed/", category: "Vendor Security Research", language: "en" },
    { name: "Curated Intel Threat Repository", url: "https://www.curatedintel.org/feeds/posts/default", category: "Threat Intelligence", language: "en" },
    { name: "CERT-PL CSIRT Advisories", url: "https://cert.pl/rss.xml", category: "Government & CERT", language: "pl" },
    { name: "Fox-IT Security Research (Netherlands)", url: "https://blog.fox-it.com/feed/", category: "Incident Response & Forensics", language: "en" },
    { name: "NCC Group Trust & Threat Research", url: "https://research.nccgroup.com/feed/", category: "Application & Web Security", language: "en" },
    { name: "Attify IoT & Automotive Security", url: "https://blog.attify.com/feed/", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "Pen Test Partners Hardware/IoT Research", url: "https://www.pentestpartners.com/security-blog/feed/", category: "Mobile, IoT & OT/ICS Security", language: "en" },
    { name: "CERT Estonia (RIA)", url: "https://www.ria.ee/en/rss.xml", category: "Government & CERT", language: "en" },
    { name: "BleepingComputer News Feed", url: "https://www.bleepingcomputer.com/feed/", category: "Cybersecurity News", language: "en" },
    { name: "The Record by Recorded Future", url: "https://therecord.media/feed", category: "Cybersecurity News", language: "en" }
];

async function checkAll() {
    console.log(`Checking ${candidates.length} premier cybersecurity sources...`);
    const verified = [];
    for (const c of candidates) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(c.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0',
                    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
                },
                redirect: 'follow',
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) {
                console.log(`❌ ${c.name} -> HTTP ${res.status}`);
                continue;
            }
            const text = await res.text();
            const clean = text.replace(/^\uFEFF/, '').trim();
            if (!clean.includes('<rss') && !clean.includes('<feed') && !clean.includes('<channel')) {
                console.log(`❌ ${c.name} -> HTML returned`);
                continue;
            }
            const p = await parser.parseString(clean);
            const items = p.items || [];
            if (items.length > 0) {
                console.log(`✅ [${verified.length + 1}] ${c.name}: ${items.length} items ("${p.title}")`);
                verified.push({
                    name: c.name,
                    feedUrl: c.url,
                    canonicalUrl: res.url,
                    category: c.category,
                    language: c.language,
                    itemsCount: items.length,
                    title: p.title,
                    latestPublicationDate: items[0]?.pubDate || items[0]?.isoDate || null
                });
            }
        } catch (e) {
            console.log(`❌ ${c.name} -> ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
    }
    console.log(`\nVerified ${verified.length} pristine dedicated cybersecurity sources!`);
    fs.writeFileSync('C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/premier_verified_sources.json', JSON.stringify(verified, null, 2));
}

checkAll().catch(console.error);
