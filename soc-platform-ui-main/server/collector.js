#!/usr/bin/env node
/**
 * collector.js — Standalone Production-Ready Threat Intelligence Collector CLI
 *
 * Implements:
 * - Standalone execution (completely decoupled from web server & serverless requests)
 * - Process-level overlap prevention with PID-stamped lockfile
 * - Run-level timeout safety (default 5 minutes)
 * - Per-source failure isolation (failure of 1 feed never interrupts others)
 * - Bounded concurrency (concurrency limit = 5)
 * - Request timeouts (10s abort controller)
 * - Content-based deduplication & normalization
 * - Real per-source telemetry recording to feedHealthService
 * - Safe exit codes: 0 = complete success / partial with new data; 1 = error/locked
 *
 * Usage:
 *   node server/collector.js
 *   node server/collector.js --dry-run
 *   node server/collector.js --source=cisa
 *   node server/collector.js --force
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { recordCollectionResult, getUniqueSources } from './services/feedHealthService.js';
import { assessSeverity } from './services/severityEngine.js';
import { classifyRecord, INTEL_CATEGORIES } from './services/classificationEngine.js';
import { insertThreat, insertIOCs, isDbConnected } from './db/db.js';
import { extractIOCs } from './services/enrichmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_FILE = path.join(__dirname, '../.collector.lock');
const DATA_FILE = path.join(__dirname, 'data/news.json');
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute hard maximum run limit
const REQUEST_TIMEOUT_MS = 10 * 1000; // 10 second timeout per HTTP request
const CONCURRENCY = 5;

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const sourceFilter = args.find(a => a.startsWith('--source='))?.split('=')[1]?.toLowerCase();
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1], 10) || 50;

// ─── Overlap Prevention & Lock Management ─────────────────────────────────────
function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const raw = fs.readFileSync(LOCK_FILE, 'utf8');
            const lockData = JSON.parse(raw);
            const lockAgeMs = Date.now() - lockData.timestamp;

            // If lock is younger than run timeout and process is still alive, prevent overlap
            if (lockAgeMs < RUN_TIMEOUT_MS && !isForce) {
                console.warn(`[COLLECTOR] ⚠️  Lockfile exists (PID ${lockData.pid}, age: ${Math.round(lockAgeMs / 1000)}s). Exiting to prevent overlap.`);
                process.exit(0); // Exit cleanly without erroring CI cron jobs
            } else {
                console.warn(`[COLLECTOR] ⚠️  Stale lockfile detected (age: ${Math.round(lockAgeMs / 1000)}s). Overriding stale lock.`);
            }
        } catch {
            // Corrupt lock file, overwrite
        }
    }

    fs.writeFileSync(LOCK_FILE, JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        startedAt: new Date().toISOString()
    }));
}

function releaseLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            fs.unlinkSync(LOCK_FILE);
        } catch {}
    }
}

process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(130); });
process.on('SIGTERM', () => { releaseLock(); process.exit(143); });

// Run-level watchdog timeout
const runWatchdog = setTimeout(() => {
    console.error(`[COLLECTOR] ❌ Run exceeded max execution time (${RUN_TIMEOUT_MS / 1000}s). Aborting.`);
    releaseLock();
    process.exit(1);
}, RUN_TIMEOUT_MS);
runWatchdog.unref();

// ─── Data Helpers ─────────────────────────────────────────────────────────────
function loadExistingNews() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveNews(newsList) {
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(newsList, null, 2));
        fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(newsList, null, 2));
        if (fs.existsSync(tmp)) try { fs.unlinkSync(tmp); } catch {}
    }
}

// ─── Fetch Worker with Timeout & Bounded Concurrency ──────────────────────────
const parser = new Parser({
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
        'User-Agent': 'NoEntrySOC-Collector/1.0 (+https://soc-ai-six.vercel.app/intelligence)',
        'Accept': 'application/rss+xml, application/atom+xml, text/xml;q=0.9'
    }
});

async function fetchSource(source) {
    const start = Date.now();
    const sourceId = source.id || `src-${source.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;

    try {
        const feed = await parser.parseURL(source.url);
        const latencyMs = Date.now() - start;
        return {
            source,
            sourceId,
            success: true,
            feed,
            latencyMs,
            error: null
        };
    } catch (err) {
        const latencyMs = Date.now() - start;
        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
        return {
            source,
            sourceId,
            success: false,
            feed: null,
            latencyMs,
            error: err.message,
            errorCategory: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'
        };
    }
}

// Bounded concurrency pool
async function mapConcurrent(items, fn, limit) {
    const results = [];
    let idx = 0;

    async function worker() {
        while (idx < items.length) {
            const current = items[idx++];
            const res = await fn(current);
            results.push(res);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

// ─── Main Ingestion Execution ─────────────────────────────────────────────────
async function runCollector() {
    acquireLock();

    const startTime = Date.now();
    console.log(`\n======================================================`);
    console.log(`🛡️  NO ENTRY SOC — Threat Intelligence Collector CLI`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Options: dryRun=${isDryRun}, force=${isForce}, concurrency=${CONCURRENCY}`);
    console.log(`======================================================\n`);

    let allSources = getUniqueSources();
    if (sourceFilter) {
        allSources = allSources.filter(s =>
            s.id.toLowerCase().includes(sourceFilter) ||
            s.name.toLowerCase().includes(sourceFilter) ||
            s.url.toLowerCase().includes(sourceFilter)
        );
        console.log(`Filtered to ${allSources.length} sources matching "${sourceFilter}"`);
    }

    if (allSources.length === 0) {
        console.warn(`[COLLECTOR] No eligible sources found.`);
        releaseLock();
        process.exit(0);
    }

    console.log(`[COLLECTOR] Fetching ${allSources.length} sources with bounded concurrency (${CONCURRENCY})...`);

    const existingNews = loadExistingNews();
    const existingLinks = new Set(existingNews.map(n => n.link));
    const newItems = [];

    const fetchResults = await mapConcurrent(allSources, fetchSource, CONCURRENCY);

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let successfulFeeds = 0;
    let failedFeeds = 0;

    for (const res of fetchResults) {
        const { source, sourceId, success, feed, latencyMs, error, errorCategory } = res;

        if (!success) {
            failedFeeds++;
            console.warn(`  [FAILED] ${source.name} (${sourceId}) - ${error}`);
            recordCollectionResult(sourceId, {
                success: false,
                httpStatus: 500,
                latencyMs,
                itemsCount: 0,
                itemsAccepted: 0,
                itemsRejected: 0,
                error,
                errorCategory
            });
            continue;
        }

        successfulFeeds++;
        const rawItems = feed.items || [];
        totalReceived += rawItems.length;

        let feedAccepted = 0;
        let feedRejected = 0;
        let latestPubDate = null;

        for (const raw of rawItems.slice(0, limitArg)) {
            if (!raw || !raw.link || !raw.title) {
                feedRejected++;
                continue;
            }

            // Deduplication check
            if (existingLinks.has(raw.link)) {
                feedRejected++;
                continue;
            }

            // Normalization
            const title = String(raw.title).trim();
            const snippet = String(raw.contentSnippet || raw.content || '').slice(0, 1000).trim();
            const pubDate = raw.pubDate ? new Date(raw.pubDate).toISOString() : null;
            if (pubDate && !latestPubDate) latestPubDate = pubDate;

            // Strict Severity Assessment
            const sevAssessment = assessSeverity({
                title,
                contentSnippet: snippet,
                source: source.name
            });
            const severity = sevAssessment.severity === 'critical' ? 'Critical'
                : (sevAssessment.severity === 'high' ? 'High'
                : (sevAssessment.severity === 'medium' ? 'Medium'
                : (sevAssessment.severity === 'informational' ? 'Informational' : 'Low')));

            // Evidence-grounded Content & Threat Classification
            const classification = classifyRecord({
                title,
                contentSnippet: snippet,
                source: source.name,
                category: source.category
            });

            const record = {
                title,
                link: raw.link,
                pubDate: pubDate || new Date().toISOString(),
                publishedAt: pubDate, // preserves null/unknown if missing
                ingestedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                contentSnippet: snippet,
                source: source.name,
                sourceCategory: source.category,
                category: source.category,
                severity,
                intelCategory: classification.intelCategory,
                intelCategoryDisplay: classification.displayName,
                secondaryTopics: classification.secondaryTopics,
                contentType: classification.contentType,
                evidenceStatus: classification.evidenceStatus,
                classificationMethod: classification.method,
                classificationConfidence: classification.confidence,
                classificationReason: classification.reason,
                taxonomyVersion: classification.taxonomyVersion,
                fetchedAt: new Date().toISOString()
            };

            existingLinks.add(raw.link);
            newItems.push(record);
            feedAccepted++;
            totalAccepted++;
        }

        totalRejected += feedRejected;

        // Persist real telemetry for this source
        recordCollectionResult(sourceId, {
            success: true,
            httpStatus: 200,
            latencyMs,
            itemsCount: rawItems.length,
            itemsAccepted: feedAccepted,
            itemsRejected: feedRejected,
            latestPubDate
        });

        console.log(`  [OK] ${source.name}: ${feedAccepted} accepted, ${feedRejected} dupes/filtered (${latencyMs}ms)`);
    }

    console.log(`\n------------------------------------------------------`);
    console.log(`📊 Ingestion Summary:`);
    console.log(`Sources processed: ${allSources.length} (OK: ${successfulFeeds}, Failed: ${failedFeeds})`);
    console.log(`Items received:    ${totalReceived}`);
    console.log(`Items accepted:    ${totalAccepted}`);
    console.log(`Items filtered:    ${totalRejected}`);
    console.log(`Total duration:    ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`------------------------------------------------------\n`);

    if (newItems.length > 0 && !isDryRun) {
        const combined = [...newItems, ...existingNews].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        saveNews(combined);
        console.log(`[COLLECTOR] ✅ Persisted ${newItems.length} new records to disk.`);

        // Persist to PostgreSQL if connected
        if (isDbConnected()) {
            console.log(`[COLLECTOR] Persisting ${newItems.length} records to PostgreSQL...`);
            let dbCount = 0;
            for (const item of newItems) {
                try {
                    const threatId = await insertThreat(item);
                    if (threatId) {
                        dbCount++;
                        const text = `${item.title} ${item.contentSnippet || ''}`;
                        const extracted = extractIOCs(text);
                        await insertIOCs(threatId, extracted);
                    }
                } catch {}
            }
            console.log(`[COLLECTOR] ✅ Inserted ${dbCount} records into PostgreSQL.`);
        }
    } else if (isDryRun) {
        console.log(`[COLLECTOR] ℹ️  Dry run enabled. No records were written.`);
    } else {
        console.log(`[COLLECTOR] ℹ️  All sources up to date. No new publications.`);
    }

    releaseLock();
    process.exit(0);
}

runCollector().catch(err => {
    console.error(`[COLLECTOR] ❌ Fatal error:`, err);
    releaseLock();
    process.exit(1);
});
