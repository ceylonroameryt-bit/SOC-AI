import Parser from '../soc-platform-ui-main/node_modules/rss-parser/index.js';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000
});

const candidates = [
    { name: 'Cisco Talos', testUrls: ['https://blog.talosintelligence.com/rss/', 'https://blog.talosintelligence.com/feed/'] },
    { name: 'Fortinet Blog', testUrls: ['https://www.fortinet.com/blog/threat-research/rss', 'https://www.fortinet.com/blog/rss', 'https://www.fortinet.com/rss-feeds/blogs.xml'] },
    { name: 'Google Cloud Security', testUrls: ['https://cloud.google.com/blog/products/identity-security/rss/', 'https://cloud.google.com/blog/topics/threat-intelligence/rss/', 'https://cloud.google.com/feeds/gcp-security-bulletins.xml'] },
    { name: 'Mandiant Threat Research', testUrls: ['https://cloud.google.com/blog/topics/threat-intelligence/rss/', 'https://cloud.google.com/feeds/mandiant-threat-intelligence.xml', 'https://cloud.google.com/blog/products/identity-security/mandiant/rss'] },
    { name: 'Microsoft MSRC', testUrls: ['https://msrc.microsoft.com/blog/feed/', 'https://msrc.microsoft.com/feed', 'https://msrc.microsoft.com/blog/rss', 'https://techcommunity.microsoft.com/gxcuf89792/rss/board?board.id=MicrosoftSecurityandCompliance'] },
    { name: 'Dragos', testUrls: ['https://www.dragos.com/feed/rss/', 'https://www.dragos.com/blog/rss.xml', 'https://www.dragos.com/blog/feed/', 'https://www.dragos.com/feed'] },
    { name: 'Nozomi Networks', testUrls: ['https://www.nozominetworks.com/feed', 'https://www.nozominetworks.com/blog/rss.xml', 'https://www.nozominetworks.com/feed/'] },
    { name: 'Claroty', testUrls: ['https://claroty.com/blog/feed', 'https://claroty.com/rss.xml', 'https://claroty.com/feed.xml'] },
    { name: 'TrustedSec', testUrls: ['https://trustedsec.com/blog/feed', 'https://trustedsec.com/feed', 'https://trustedsec.com/feed/rss/'] },
    { name: 'Black Hills InfoSec', testUrls: ['https://www.blackhillsinfosec.com/feed', 'https://www.blackhillsinfosec.com/blog/feed/', 'https://blackhillsinfosec.com/feed/'] },
    { name: 'Volexity', testUrls: ['https://www.volexity.com/blog/feed/', 'https://www.volexity.com/feed/'] },
    { name: 'SpecterOps', testUrls: ['https://specterops.io/feed', 'https://specterops.io/blog/feed/', 'https://posts.specterops.io/feed?format=xml'] },
    { name: 'OWASP', testUrls: ['https://owasp.org/feed.xml', 'https://owasp.org/assets/feed.xml', 'https://owasp.org/blog/feed'] },
    { name: 'JPCERT/CC', testUrls: ['https://blogs.jpcert.or.jp/en/atom.xml', 'https://www.jpcert.or.jp/english/rss/jpcert_en.rdf', 'https://blogs.jpcert.or.jp/ja/atom.xml'] },
    { name: 'GovInfoSecurity', testUrls: ['https://www.govinfosecurity.com/rss-feeds', 'https://feeds.feedburner.com/govinfosecurity/com'] },
    { name: 'SC Magazine', testUrls: ['https://www.scworld.com/feed', 'https://www.scmagazine.com/rss/news/'] },
    { name: 'Packet Storm', testUrls: ['https://packetstormsecurity.com/feeds/news/', 'https://packetstormsecurity.com/feeds/'] },
    { name: 'HackerOne Blog', testUrls: ['https://www.hackerone.com/blog.rss', 'https://www.hackerone.com/blog/rss.xml', 'https://www.hackerone.com/blog/feed'] },
    { name: 'Bugcrowd Blog', testUrls: ['https://www.bugcrowd.com/feed/', 'https://www.bugcrowd.com/blog/feed/'] },
    { name: 'YesWeHack', testUrls: ['https://blog.yeswehack.com/feed', 'https://www.yeswehack.com/blog/feed'] },
    { name: '1Password Blog', testUrls: ['https://blog.1password.com/feed.xml', 'https://blog.1password.com/index.xml', 'https://blog.1password.com/feed/'] },
    { name: 'Dashlane Blog', testUrls: ['https://www.dashlane.com/blog/feed', 'https://blog.dashlane.com/feed/'] },
    { name: 'ProtonMail / Proton', testUrls: ['https://proton.me/blog/feed', 'https://protonmail.com/blog/feed/'] },
    { name: 'SANS Blogs', testUrls: ['https://www.sans.org/blog/rss.xml', 'https://www.sans.org/blog/rss/', 'https://www.sans.org/feed/'] },
    { name: 'Trend Micro', testUrls: ['https://www.trendmicro.com/en_us/research.rss', 'https://feeds.feedburner.com/TrendMicroResearch'] },
    { name: 'Sophos Naked Security', testUrls: ['https://news.sophos.com/en-us/feed/', 'https://news.sophos.com/en-us/category/threat-research/feed/'] },
    { name: 'Canadian Centre for Cyber Security', testUrls: ['https://cyber.gc.ca/en/rss/alerts-advisories', 'https://www.cyber.gc.ca/api/en/rss/alerts-advisories'] }
];

async function checkUrl(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8'
            },
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
        const text = await res.text();
        const clean = text.replace(/^\uFEFF/, '').trim();
        if (!clean.includes('<rss') && !clean.includes('<feed') && !clean.includes('<channel')) {
            return { ok: false, status: res.status, reason: 'HTML returned' };
        }
        const parsed = await parser.parseString(clean);
        return { ok: true, status: res.status, items: parsed.items?.length || 0, title: parsed.title };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function run() {
    for (const c of candidates) {
        console.log(`Checking ${c.name}...`);
        let found = false;
        for (const url of c.testUrls) {
            const res = await checkUrl(url);
            if (res.ok) {
                console.log(`  ✅ SUCCESS: ${url} -> ${res.items} items ("${res.title}")`);
                found = true;
                break;
            } else {
                console.log(`  ❌ Failed ${url}: ${res.reason || res.error}`);
            }
        }
        if (!found) {
            console.log(`  ⚠️  NO WORKING URL for ${c.name}`);
        }
    }
}

run();
