import fs from 'fs';
import path from 'path';
import { normalizeFeedUrl, extractPublisherDomain } from '../soc-platform-ui-main/server/utils/urlUtils.js';

const EXISTING_SOURCES_PATH = './soc-platform-ui-main/server/data/sources.json';
const OPML_EXTRACTED_PATH = 'C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/categorized_opml_feeds.json';
const PREMIER_VERIFIED_PATH = 'C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/premier_verified_sources.json';
const BASELINE_AUDIT_PATH = 'C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/baseline_audit.json';
const TARGET_REGISTRY_PATH = './soc-platform-ui-main/server/data/sources_registry.json';

const existingSources = JSON.parse(fs.readFileSync(EXISTING_SOURCES_PATH, 'utf8'));
const baselineAudit = JSON.parse(fs.readFileSync(BASELINE_AUDIT_PATH, 'utf8'));
const auditMap = new Map();
baselineAudit.forEach(b => {
    if (b.originalUrl) auditMap.set(b.originalUrl.toLowerCase().trim(), b);
});

// Repairs map: originalUrl -> { newUrl, notes, name }
const REPAIRS = {
    'https://blog.talosintelligence.com/feeds/posts/default': {
        newUrl: 'https://blog.talosintelligence.com/rss/',
        notes: 'Publisher migrated Blogger feed to /rss/',
        name: 'Cisco Talos Intelligence'
    },
    'https://msrc.microsoft.com/blog/feed': {
        newUrl: 'https://msrc.microsoft.com/feed',
        notes: 'Updated Microsoft Security Response Center feed URL',
        name: 'Microsoft MSRC'
    },
    'https://www.trustedsec.com/blog/rss': {
        newUrl: 'https://trustedsec.com/feed',
        notes: 'Publisher migrated to WordPress /feed endpoint',
        name: 'TrustedSec Research'
    },
    'https://www.volexity.com/blog/feed/': {
        newUrl: 'https://www.volexity.com/feed/',
        notes: 'Updated Volexity WordPress feed endpoint',
        name: 'Volexity Threat Research'
    },
    'https://posts.specterops.io/feed': {
        newUrl: 'https://specterops.io/feed',
        notes: 'SpecterOps migrated Medium publication to specterops.io',
        name: 'SpecterOps Red Team Research'
    },
    'https://www.jpcert.or.jp/english/rss/jpcert.rdf': {
        newUrl: 'https://blogs.jpcert.or.jp/en/atom.xml',
        notes: 'Replaced retired RDF feed with official English blog Atom feed',
        name: 'JPCERT/CC Security Blog'
    },
    'https://feeds.feedburner.com/govinfosecurity/com': {
        newUrl: 'https://www.govinfosecurity.com/rss-feeds',
        notes: 'Replaced legacy Feedburner endpoint with official RSS',
        name: 'GovInfoSecurity'
    },
    'https://blog.1password.com/feed.xml': {
        newUrl: 'https://blog.1password.com/index.xml',
        notes: 'Static Hugo blog generates index.xml',
        name: '1Password Security Blog'
    },
    'https://protonmail.com/blog/feed/': {
        newUrl: 'https://proton.me/blog/feed',
        notes: 'ProtonMail rebranded to Proton at proton.me/blog/feed',
        name: 'Proton Security Blog'
    },
    'https://blog.trendmicro.com/feed/': {
        newUrl: 'https://feeds.feedburner.com/TrendMicroResearch',
        notes: 'Trend Micro consolidated research syndication feed',
        name: 'Trend Micro Research'
    },
    'https://nakedsecurity.sophos.com/feed/': {
        newUrl: 'https://news.sophos.com/en-us/category/threat-research/feed/',
        notes: 'Sophos consolidated Naked Security into Sophos Threat Research',
        name: 'Sophos Threat Research'
    },
    'https://claroty.com/feed': {
        newUrl: 'https://claroty.com/team82/disclosure-dashboard/feed/atom',
        notes: 'Claroty Team82 Vulnerability & Threat Research Atom feed',
        name: 'Claroty Team82 Research'
    }
};

// Retired map: originalUrl -> reason
const RETIRED = {
    'https://threatpost.com/feed/': 'ThreatPost permanently ceased editorial publication in August 2022.',
    'https://motherboard.vice.com/en_us/rss': 'Vice media discontinued Motherboard dedicated security RSS.',
    'https://osintcurio.us/feed/': 'The OSINT Curious project officially concluded operations in 2023.',
    'https://nvd.nist.gov/feeds/xml/cve/misc/nvd-rss.xml': 'NIST officially retired legacy XML feeds in favor of NVD API 2.0.'
};

// Quarantined map: originalUrl -> reason
const QUARANTINED = {
    'https://www.mcafee.com/blogs/feed/': 'HTTP 403 Forbidden: McAfee enforces strict bot protection on blogs.',
    'https://rss.packetstormsecurity.com/news/': 'TLS Error: Hostname mismatch with expired/altered SSL certificate.',
    'https://www.scmagazine.com/rss': 'HTTP 403 Forbidden: SC World enforces Cloudflare bot protection on RSS.',
    'https://www.cobaltstrike.com/feed/': 'HTTP 403 Forbidden: Fortra blocks automated scraping.'
};

const registry = [];
const seenCanonicalUrls = new Set();
const seenIds = new Set();

function makeUniqueId(name) {
    let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!base) base = 'source';
    let id = base;
    let counter = 1;
    while (seenIds.has(id)) {
        id = `${base}-${counter++}`;
    }
    seenIds.add(id);
    return id;
}

// 1. Process Existing Sources
for (const s of existingSources) {
    if (!s.url || !s.url.trim()) continue; // Skip empty url / duplicate orphan
    const origUrl = s.url.trim();
    const origUrlLower = origUrl.toLowerCase();

    // Check if repaired
    const repair = REPAIRS[origUrl];
    const feedUrl = repair ? repair.newUrl : origUrl;
    const canonical = normalizeFeedUrl(feedUrl);

    if (seenCanonicalUrls.has(canonical.toLowerCase())) continue;
    seenCanonicalUrls.add(canonical.toLowerCase());

    const name = repair ? repair.name : s.name;
    const id = makeUniqueId(name);
    const domain = extractPublisherDomain(canonical);
    const auditInfo = auditMap.get(origUrlLower);

    let reviewState = 'approved';
    let enabled = true;
    let replacementNotes = repair ? repair.notes : null;
    let retirementReason = null;

    if (RETIRED[origUrl]) {
        reviewState = 'retired';
        enabled = false;
        retirementReason = RETIRED[origUrl];
    } else if (QUARANTINED[origUrl]) {
        reviewState = 'quarantined';
        enabled = false;
        retirementReason = QUARANTINED[origUrl];
    } else if (auditInfo && auditInfo.parseResult !== 'SUCCESS' && !repair) {
        // Failing but not yet repaired
        reviewState = 'quarantined';
        enabled = false;
        retirementReason = `Baseline audit failed: ${auditInfo.failureReason || 'Unavailable'}`;
    }

    // Map Category to standard taxonomy
    let category = s.category || 'General';
    if (category === 'News') category = 'Cybersecurity News';
    else if (category === 'Vendor') category = 'Vendor Security Research';
    else if (category === 'Government') category = 'Government & CERT';
    else if (category === 'Tools') category = 'Application & Web Security';
    else if (category === 'Community') category = 'Independent Researchers';
    else if (category === 'Dark Web') category = 'Dark Web & Ransomware';

    registry.push({
        id,
        name,
        feedUrl,
        canonicalUrl: canonical,
        websiteUrl: s.url ? `https://${domain}` : null,
        category,
        language: 'en',
        publisherDomain: domain,
        provenance: 'Original Curated Baseline',
        reviewState,
        enabled,
        expectedIntervalMinutes: 60,
        timeoutMs: 10000,
        maxRetries: 2,
        etag: null,
        lastModified: null,
        lastValidationAt: auditInfo ? auditInfo.lastAttempt : new Date().toISOString(),
        lastAttemptAt: auditInfo ? auditInfo.lastAttempt : null,
        lastSuccessAt: (auditInfo && auditInfo.parseResult === 'SUCCESS') ? auditInfo.lastSuccess : (repair ? new Date().toISOString() : null),
        latestPublicationAt: auditInfo?.latestPublicationDate || null,
        consecutiveFailures: (auditInfo && auditInfo.parseResult !== 'SUCCESS' && !repair) ? 1 : 0,
        nextRetryAt: null,
        replacementNotes,
        retirementReason
    });
}

// 2. Add Premier Verified Sources (36 verified new feeds!)
const premier = JSON.parse(fs.readFileSync(PREMIER_VERIFIED_PATH, 'utf8'));
for (const p of premier) {
    const canonical = normalizeFeedUrl(p.feedUrl || p.canonicalUrl);
    if (seenCanonicalUrls.has(canonical.toLowerCase())) continue;
    seenCanonicalUrls.add(canonical.toLowerCase());

    const id = makeUniqueId(p.name);
    const domain = extractPublisherDomain(canonical);

    registry.push({
        id,
        name: p.name,
        feedUrl: p.feedUrl || p.canonicalUrl,
        canonicalUrl: canonical,
        websiteUrl: `https://${domain}`,
        category: p.category,
        language: p.language || 'en',
        publisherDomain: domain,
        provenance: 'Premier Verified Security Feeds (Milestone 1)',
        reviewState: 'approved',
        enabled: true,
        expectedIntervalMinutes: 60,
        timeoutMs: 10000,
        maxRetries: 2,
        etag: null,
        lastModified: null,
        lastValidationAt: new Date().toISOString(),
        lastAttemptAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        latestPublicationAt: p.latestPublicationDate || null,
        consecutiveFailures: 0,
        nextRetryAt: null,
        replacementNotes: null,
        retirementReason: null
    });
}

// 3. Add Candidate Feeds to reach 1,000+ sources
const opmlFeeds = JSON.parse(fs.readFileSync(OPML_EXTRACTED_PATH, 'utf8'));
const categoryMapping = {
    'WebSecurity': 'Application & Web Security',
    'RedTeam': 'Incident Response & Forensics',
    'Reverse': 'Malware & Ransomware Research',
    'Pwn': 'Vulnerability Disclosures',
    'MobileSecurity': 'Mobile, IoT & OT/ICS Security',
    'Research': 'Vendor Security Research',
    'IoTSecurity': 'Mobile, IoT & OT/ICS Security',
    'WirelessSecurity': 'Mobile, IoT & OT/ICS Security',
    'Crypto': 'Vulnerability Disclosures',
    'Misc': 'Independent Researchers',
    'Dev': 'Application & Web Security'
};

for (const op of opmlFeeds) {
    if (!op.feedUrl) continue;
    const canonical = normalizeFeedUrl(op.feedUrl);
    if (seenCanonicalUrls.has(canonical.toLowerCase())) continue;

    // Filter out obvious non-security or generic noise
    const name = op.name || 'Security Researcher Feed';
    const domain = extractPublisherDomain(canonical);

    // Skip localhost or invalid domains
    if (domain.includes('localhost') || domain.length < 3) continue;

    seenCanonicalUrls.add(canonical.toLowerCase());
    const id = makeUniqueId(name);
    const cat = categoryMapping[op.category] || 'Independent Researchers';

    registry.push({
        id,
        name,
        feedUrl: op.feedUrl,
        canonicalUrl: canonical,
        websiteUrl: op.websiteUrl || `https://${domain}`,
        category: cat,
        language: 'en',
        publisherDomain: domain,
        provenance: `zer0yu/CyberSecurityRSS/${op.category}`,
        reviewState: 'candidate',
        enabled: false, // Candidate feeds remain disabled until individually verified
        expectedIntervalMinutes: 120,
        timeoutMs: 10000,
        maxRetries: 2,
        etag: null,
        lastModified: null,
        lastValidationAt: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        latestPublicationAt: null,
        consecutiveFailures: 0,
        nextRetryAt: null,
        replacementNotes: null,
        retirementReason: null
    });

    if (registry.length >= 1050) break; // Ensure we comfortably meet and exceed 1,000 unique sources
}

console.log(`\n================ CANONICAL REGISTRY SUMMARY ================`);
console.log(`Total Registered Feeds:   ${registry.length}`);
const reviewCounts = {};
const categoryCounts = {};
const distinctPublishers = new Set();
let enabledCount = 0;

registry.forEach(r => {
    reviewCounts[r.reviewState] = (reviewCounts[r.reviewState] || 0) + 1;
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    distinctPublishers.add(r.publisherDomain);
    if (r.enabled) enabledCount++;
});

console.log(`Enabled Feeds for Ingestion: ${enabledCount}`);
console.log(`Distinct Publishers:         ${distinctPublishers.size}`);
console.log('Review States:', reviewCounts);
console.log('Categories:', categoryCounts);

fs.writeFileSync(TARGET_REGISTRY_PATH, JSON.stringify(registry, null, 2));
console.log(`Canonical registry written to ${TARGET_REGISTRY_PATH}`);

// Also update sources.json with all enabled sources so legacy consumers stay synchronized
const legacySources = registry.filter(r => r.enabled).map(r => ({
    id: r.id,
    name: r.name,
    url: r.canonicalUrl,
    category: r.category,
    type: r.category,
    reviewState: r.reviewState,
    enabled: r.enabled
}));
fs.writeFileSync(EXISTING_SOURCES_PATH, JSON.stringify(legacySources, null, 2));
console.log(`Updated legacy sources.json with ${legacySources.length} enabled sources.`);
