/**
 * enrichmentService.js
 * Provides automated threat intelligence enrichment for IPs, file hashes, and CVEs.
 * Integrates with: VirusTotal, AbuseIPDB, FIRST EPSS, and CISA KEV catalog.
 */

// ── In-Memory LRU Cache (1-hour TTL) ─────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const enrichmentCache = new Map();

const getCached = (key) => {
    const entry = enrichmentCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        enrichmentCache.delete(key);
        return null;
    }
    return entry.data;
};

const setCache = (key, data) => {
    enrichmentCache.set(key, { data, timestamp: Date.now() });
};

// ── CISA KEV Catalog (cached, refreshed daily) ────────────────────────────────
let kevCatalog = null;
let kevLastFetch = 0;
const KEV_REFRESH_MS = 24 * 60 * 60 * 1000;

const fetchKEVCatalog = async () => {
    if (kevCatalog && Date.now() - kevLastFetch < KEV_REFRESH_MS) return kevCatalog;
    try {
        const resp = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
        if (!resp.ok) throw new Error(`KEV fetch failed: ${resp.status}`);
        const data = await resp.json();
        kevCatalog = new Set((data.vulnerabilities || []).map(v => v.cveID));
        kevLastFetch = Date.now();
        console.log(`[KEV] Loaded ${kevCatalog.size} known exploited vulnerabilities.`);
    } catch (err) {
        console.error('[KEV] Failed to fetch catalog:', err.message);
        kevCatalog = kevCatalog || new Set(); // keep stale data if available
    }
    return kevCatalog;
};

// Initialize KEV catalog on module load
fetchKEVCatalog().catch(() => {});

// ── IOC Extraction ─────────────────────────────────────────────────────────────
const IOC_PATTERNS = {
    ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    md5: /\b[a-fA-F0-9]{32}\b/g,
    sha1: /\b[a-fA-F0-9]{40}\b/g,
    sha256: /\b[a-fA-F0-9]{64}\b/g,
    cve: /CVE-\d{4}-\d{4,7}/gi,
    domain: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|gov|edu|info|biz|co|uk|de|fr|ru|cn|onion)\b/g,
};

// Private IP ranges to exclude from enrichment (RFC 1918)
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.|255\.)/;

export const extractIOCs = (text) => {
    if (!text) return { ips: [], hashes: [], cves: [], domains: [] };
    const clean = text.replace(/\s+/g, ' ');

    const ips = [...new Set((clean.match(IOC_PATTERNS.ipv4) || [])
        .filter(ip => !PRIVATE_IP_REGEX.test(ip)))];

    const hashes = [...new Set([
        ...(clean.match(IOC_PATTERNS.sha256) || []),
        ...(clean.match(IOC_PATTERNS.sha1) || []),
        ...(clean.match(IOC_PATTERNS.md5) || []),
    ])];

    const cves = [...new Set((clean.match(IOC_PATTERNS.cve) || [])
        .map(c => c.toUpperCase()))];

    const domains = [...new Set((clean.match(IOC_PATTERNS.domain) || [])
        .filter(d => !ips.includes(d)))]
        .slice(0, 10); // cap at 10 domains

    return { ips: ips.slice(0, 10), hashes: hashes.slice(0, 5), cves: cves.slice(0, 5), domains };
};

// ── VirusTotal ─────────────────────────────────────────────────────────────────
const vtRequest = async (endpoint) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) return null;

    const resp = await fetch(`https://www.virustotal.com/api/v3/${endpoint}`, {
        headers: { 'x-apikey': apiKey, 'Accept': 'application/json' }
    });
    if (!resp.ok) throw new Error(`VirusTotal ${resp.status}: ${await resp.text()}`);
    return resp.json();
};

export const enrichIP = async (ip) => {
    const cacheKey = `vt:ip:${ip}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = {
        ip,
        source: 'VirusTotal',
        maliciousEngines: 0,
        totalEngines: 0,
        maliciousnessScore: 0,
        reputation: 0,
        country: null,
        asnOwner: null,
        categories: [],
        vtLink: `https://www.virustotal.com/gui/ip-address/${ip}`,
        enrichedAt: new Date().toISOString(),
        error: null,
    };

    try {
        if (!process.env.VIRUSTOTAL_API_KEY) {
            result.error = 'VIRUSTOTAL_API_KEY not configured';
            return result;
        }
        const data = await vtRequest(`ip_addresses/${ip}`);
        const stats = data?.data?.attributes?.last_analysis_stats || {};
        const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
        const total = Object.values(stats).reduce((a, b) => a + b, 0);

        result.maliciousEngines = malicious;
        result.totalEngines = total;
        result.maliciousnessScore = total > 0 ? Math.round((malicious / total) * 100) : 0;
        result.reputation = data?.data?.attributes?.reputation || 0;
        result.country = data?.data?.attributes?.country || null;
        result.asnOwner = data?.data?.attributes?.as_owner || null;
        result.categories = Object.values(data?.data?.attributes?.categories || {});
    } catch (err) {
        result.error = err.message;
        console.warn(`[VT] IP enrichment failed for ${ip}:`, err.message);
    }

    setCache(cacheKey, result);
    return result;
};

export const enrichHash = async (hash) => {
    const cacheKey = `vt:hash:${hash}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = {
        hash,
        source: 'VirusTotal',
        maliciousEngines: 0,
        totalEngines: 0,
        maliciousnessScore: 0,
        fileName: null,
        fileType: null,
        fileSize: null,
        vtLink: `https://www.virustotal.com/gui/file/${hash}`,
        enrichedAt: new Date().toISOString(),
        error: null,
    };

    try {
        if (!process.env.VIRUSTOTAL_API_KEY) {
            result.error = 'VIRUSTOTAL_API_KEY not configured';
            return result;
        }
        const data = await vtRequest(`files/${hash}`);
        const stats = data?.data?.attributes?.last_analysis_stats || {};
        const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
        const total = Object.values(stats).reduce((a, b) => a + b, 0);

        result.maliciousEngines = malicious;
        result.totalEngines = total;
        result.maliciousnessScore = total > 0 ? Math.round((malicious / total) * 100) : 0;
        result.fileName = data?.data?.attributes?.meaningful_name || null;
        result.fileType = data?.data?.attributes?.type_description || null;
        result.fileSize = data?.data?.attributes?.size || null;
    } catch (err) {
        result.error = err.message;
        console.warn(`[VT] Hash enrichment failed for ${hash}:`, err.message);
    }

    setCache(cacheKey, result);
    return result;
};

// ── AbuseIPDB ─────────────────────────────────────────────────────────────────
export const checkAbuseIPDB = async (ip) => {
    const cacheKey = `abuse:${ip}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = {
        ip,
        source: 'AbuseIPDB',
        abuseConfidenceScore: 0,
        totalReports: 0,
        countryCode: null,
        isp: null,
        usageType: null,
        isWhitelisted: false,
        abuseLink: `https://www.abuseipdb.com/check/${ip}`,
        enrichedAt: new Date().toISOString(),
        error: null,
    };

    try {
        if (!process.env.ABUSEIPDB_API_KEY) {
            result.error = 'ABUSEIPDB_API_KEY not configured';
            return result;
        }
        const resp = await fetch(
            `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
            { headers: { 'Key': process.env.ABUSEIPDB_API_KEY, 'Accept': 'application/json' } }
        );
        if (!resp.ok) throw new Error(`AbuseIPDB ${resp.status}`);
        const data = await resp.json();
        const d = data?.data || {};

        result.abuseConfidenceScore = d.abuseConfidenceScore || 0;
        result.totalReports = d.totalReports || 0;
        result.countryCode = d.countryCode || null;
        result.isp = d.isp || null;
        result.usageType = d.usageType || null;
        result.isWhitelisted = d.isWhitelisted || false;
    } catch (err) {
        result.error = err.message;
        console.warn(`[AbuseIPDB] Check failed for ${ip}:`, err.message);
    }

    setCache(cacheKey, result);
    return result;
};

// ── EPSS + CISA KEV ───────────────────────────────────────────────────────────
export const enrichCVE = async (cveId) => {
    const cacheKey = `cve:${cveId.toUpperCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const result = {
        cveId: cveId.toUpperCase(),
        epssScore: null,
        epssPercentile: null,
        isKEV: false,
        kevDateAdded: null,
        nvdLink: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        epssLink: `https://www.first.org/epss/`,
        enrichedAt: new Date().toISOString(),
        error: null,
    };

    try {
        // Fetch EPSS score
        const epssResp = await fetch(
            `https://api.first.org/data/v1/epss?cve=${cveId}`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (epssResp.ok) {
            const epssData = await epssResp.json();
            const entry = epssData?.data?.[0];
            if (entry) {
                result.epssScore = parseFloat(entry.epss || 0);
                result.epssPercentile = parseFloat(entry.percentile || 0);
            }
        }

        // Check CISA KEV
        const kev = await fetchKEVCatalog();
        result.isKEV = kev.has(result.cveId);

    } catch (err) {
        result.error = err.message;
        console.warn(`[EPSS/KEV] CVE enrichment failed for ${cveId}:`, err.message);
    }

    setCache(cacheKey, result);
    return result;
};

// ── Bulk Enrichment ───────────────────────────────────────────────────────────
export const enrichAllIOCs = async (iocs) => {
    const results = { ips: [], hashes: [], cves: [] };

    // Run enrichments in parallel with concurrency cap
    const ipPromises = (iocs.ips || []).slice(0, 5).map(async ip => {
        const [vt, abuse] = await Promise.all([
            enrichIP(ip).catch(() => null),
            checkAbuseIPDB(ip).catch(() => null),
        ]);
        return { ip, virustotal: vt, abuseipdb: abuse };
    });

    const hashPromises = (iocs.hashes || []).slice(0, 3).map(hash =>
        enrichHash(hash).catch(() => null)
    );

    const cvePromises = (iocs.cves || []).slice(0, 5).map(cve =>
        enrichCVE(cve).catch(() => null)
    );

    results.ips = (await Promise.all(ipPromises)).filter(Boolean);
    results.hashes = (await Promise.all(hashPromises)).filter(Boolean);
    results.cves = (await Promise.all(cvePromises)).filter(Boolean);

    return results;
};
