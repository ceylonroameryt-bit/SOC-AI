import Parser from '../soc-platform-ui-main/node_modules/rss-parser/index.js';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000
});

const targets = [
    { name: 'Black Hills InfoSec', home: 'https://www.blackhillsinfosec.com/blog/' },
    { name: 'Canadian Centre for Cyber Security', home: 'https://cyber.gc.ca/en/alerts-advisories' },
    { name: 'OWASP', home: 'https://owasp.org/' },
    { name: 'Fortinet', home: 'https://www.fortinet.com/blog' },
    { name: 'Dragos', home: 'https://www.dragos.com/blog/' },
    { name: 'Nozomi Networks', home: 'https://www.nozominetworks.com/blog/' },
    { name: 'Claroty', home: 'https://claroty.com/blog' },
    { name: 'HackerOne', home: 'https://www.hackerone.com/blog' },
    { name: 'Bugcrowd', home: 'https://www.bugcrowd.com/blog' },
    { name: 'YesWeHack', home: 'https://www.yeswehack.com/blog' },
    { name: 'Dashlane', home: 'https://www.dashlane.com/blog' },
    { name: 'SANS', home: 'https://www.sans.org/blog/' },
    { name: 'Packet Storm', home: 'https://packetstormsecurity.com/' },
    { name: 'McAfee Labs', home: 'https://www.mcafee.com/blogs/' },
    { name: 'Google Cloud Security', home: 'https://cloud.google.com/blog/topics/threat-intelligence' }
];

async function discover(target) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(target.home, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
            console.log(`❌ ${target.name} fetch returned HTTP ${res.status}`);
            return;
        }
        const html = await res.text();
        const feedMatches = html.match(/<link[^>]+type=["'](application\/(rss|atom)\+xml|text\/xml)["'][^>]*>/gi) || [];
        console.log(`\n🔍 ${target.name} (${target.home}): found ${feedMatches.length} link tag(s)`);
        for (const tag of feedMatches) {
            const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
            if (hrefMatch) {
                let feedUrl = hrefMatch[1];
                if (feedUrl.startsWith('/')) {
                    const u = new URL(target.home);
                    feedUrl = `${u.origin}${feedUrl}`;
                }
                console.log(`   Discovered candidate: ${feedUrl}`);
                try {
                    const p = await parser.parseURL(feedUrl);
                    console.log(`   ✅ VALID FEED: ${feedUrl} -> ${p.items?.length} items ("${p.title}")`);
                } catch (pe) {
                    console.log(`   ❌ Parse error for ${feedUrl}: ${pe.message}`);
                }
            }
        }
        if (feedMatches.length === 0) {
            // Also check for href ending in /feed or .xml
            const anyFeedLink = html.match(/href=["']([^"']+\/(feed|rss)(\/|\.xml)?)["']/gi) || [];
            if (anyFeedLink.length > 0) {
                console.log(`   Other feed links found in HTML:`, anyFeedLink.slice(0, 3));
            }
        }
    } catch (e) {
        console.log(`❌ ${target.name} error: ${e.message}`);
    }
}

async function run() {
    for (const t of targets) {
        await discover(t);
    }
}

run();
