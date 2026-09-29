import fs from 'fs';
import path from 'path';
import Parser from '../soc-platform-ui-main/node_modules/rss-parser/index.js';

const SOURCES_FILE = './soc-platform-ui-main/server/data/sources.json';
const OUTPUT_FILE = 'C:/Users/Sujampathi/.gemini/antigravity-ide/brain/d0ec47be-5c54-4edf-946b-0f548f260b12/scratch/baseline_audit.json';

const rawSources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0 (+https://soc-ai-six.vercel.app/)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    },
    timeout: 10000
});

async function auditFeed(source, index) {
    const start = Date.now();
    const sourceId = `src-${(source.name || `feed-${index}`).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
    
    if (!source.url || !source.url.trim()) {
        return {
            sourceId,
            name: source.name,
            originalUrl: source.url,
            finalUrl: null,
            category: source.category,
            httpStatus: null,
            parseResult: 'EMPTY_URL',
            latencyMs: 0,
            itemCount: 0,
            latestPublicationDate: null,
            lastAttempt: new Date().toISOString(),
            lastSuccess: null,
            failureReason: 'Missing or empty URL',
            failureClassification: 'Invalid or retired endpoint'
        };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(source.url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 NoEntrySOC-Auditor/1.0',
                'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8'
            },
            redirect: 'follow',
            signal: controller.signal
        });

        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        const finalUrl = response.url;
        const httpStatus = response.status;
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
            let classification = 'HTTP 5xx';
            if (httpStatus === 403) classification = 'HTTP 403/access restriction';
            else if (httpStatus === 404) classification = 'HTTP 404/410';
            else if (httpStatus === 410) classification = 'HTTP 404/410';
            else if (httpStatus === 429) classification = 'HTTP 429/rate limit';
            else if (httpStatus >= 400 && httpStatus < 500) classification = `HTTP ${httpStatus}`;

            return {
                sourceId,
                name: source.name,
                originalUrl: source.url,
                finalUrl,
                category: source.category,
                httpStatus,
                parseResult: 'HTTP_ERROR',
                latencyMs,
                itemCount: 0,
                latestPublicationDate: null,
                lastAttempt: new Date().toISOString(),
                lastSuccess: null,
                failureReason: `HTTP status ${httpStatus} (${response.statusText})`,
                failureClassification: classification
            };
        }

        const rawText = await response.text();
        const trimmed = rawText.trim();

        if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html') || contentType.includes('text/html')) {
            // Check if it really doesn't have xml/rss
            if (!trimmed.includes('<rss') && !trimmed.includes('<feed') && !trimmed.includes('<channel')) {
                return {
                    sourceId,
                    name: source.name,
                    originalUrl: source.url,
                    finalUrl,
                    category: source.category,
                    httpStatus,
                    parseResult: 'HTML_RETURNED',
                    latencyMs,
                    itemCount: 0,
                    latestPublicationDate: null,
                    lastAttempt: new Date().toISOString(),
                    lastSuccess: null,
                    failureReason: 'HTML page returned instead of XML feed',
                    failureClassification: 'HTML returned instead of XML'
                };
            }
        }

        // Try parsing
        try {
            // Remove BOM or leading weird characters if any
            let cleanXml = rawText.replace(/^\uFEFF/, '').trim();
            const feed = await parser.parseString(cleanXml);
            const items = feed.items || [];
            let latestPub = null;
            if (items.length > 0) {
                for (const item of items) {
                    if (item.pubDate || item.isoDate) {
                        const d = new Date(item.pubDate || item.isoDate);
                        if (!isNaN(d.getTime())) {
                            if (!latestPub || d > new Date(latestPub)) {
                                latestPub = d.toISOString();
                            }
                        }
                    }
                }
            }

            // Check freshness
            let classification = 'Healthy';
            if (items.length === 0) {
                classification = 'Valid empty feed';
            } else if (latestPub) {
                const daysOld = (Date.now() - new Date(latestPub).getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld > 180) {
                    classification = 'Successfully collected but old publications';
                }
            }

            return {
                sourceId,
                name: source.name,
                originalUrl: source.url,
                finalUrl,
                category: source.category,
                httpStatus,
                parseResult: 'SUCCESS',
                latencyMs,
                itemCount: items.length,
                latestPublicationDate: latestPub,
                lastAttempt: new Date().toISOString(),
                lastSuccess: new Date().toISOString(),
                failureReason: null,
                failureClassification: classification
            };
        } catch (parseErr) {
            return {
                sourceId,
                name: source.name,
                originalUrl: source.url,
                finalUrl,
                category: source.category,
                httpStatus,
                parseResult: 'PARSE_ERROR',
                latencyMs,
                itemCount: 0,
                latestPublicationDate: null,
                lastAttempt: new Date().toISOString(),
                lastSuccess: null,
                failureReason: parseErr.message,
                failureClassification: 'Malformed or unsupported feed'
            };
        }
    } catch (netErr) {
        const latencyMs = Date.now() - start;
        let classification = 'DNS or TLS error';
        if (netErr.name === 'AbortError' || netErr.message?.includes('timeout') || netErr.message?.includes('aborted')) {
            classification = 'Timeout';
        } else if (netErr.message?.includes('ENOTFOUND')) {
            classification = 'DNS or TLS error';
        } else if (netErr.message?.includes('certificate') || netErr.message?.includes('SSL') || netErr.message?.includes('TLS')) {
            classification = 'DNS or TLS error';
        }

        return {
            sourceId,
            name: source.name,
            originalUrl: source.url,
            finalUrl: null,
            category: source.category,
            httpStatus: null, // REAL: network error has no HTTP status
            parseResult: 'NETWORK_ERROR',
            latencyMs,
            itemCount: 0,
            latestPublicationDate: null,
            lastAttempt: new Date().toISOString(),
            lastSuccess: null,
            failureReason: netErr.message,
            failureClassification: classification
        };
    }
}

async function run() {
    console.log(`Auditing ${rawSources.length} sources...`);
    const results = [];
    const CONCURRENCY = 4;

    for (let i = 0; i < rawSources.length; i += CONCURRENCY) {
        const slice = rawSources.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(slice.map((s, idx) => auditFeed(s, i + idx)));
        results.push(...chunkResults);
        console.log(`Audited ${results.length}/${rawSources.length} feeds...`);
        // small pause to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`Audit written to ${OUTPUT_FILE}`);

    // Summary stats
    const classificationCounts = {};
    let healthyCount = 0;
    for (const r of results) {
        const c = r.failureClassification;
        classificationCounts[c] = (classificationCounts[c] || 0) + 1;
        if (r.parseResult === 'SUCCESS') healthyCount++;
    }

    console.log('\n--- AUDIT SUMMARY ---');
    console.log(`Total configured: ${results.length}`);
    console.log(`Successfully parsed: ${healthyCount}`);
    console.log(`Failed / degraded: ${results.length - healthyCount}`);
    console.log('Classifications:', JSON.stringify(classificationCounts, null, 2));
}

run().catch(console.error);
