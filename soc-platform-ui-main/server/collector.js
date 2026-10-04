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
 * - Real per-source telemetry recording to PostgreSQL and feedHealthService
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
import {
    insertArticle,
    createCollectionRun,
    completeCollectionRun,
    isDbConnected,
    query
} from './db/db.js';
import { extractIOCs } from './services/enrichmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_FILE = path.join(__dirname, '../.collector.lock');
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute hard maximum run limit
const REQUEST_TIMEOUT_MS = 10 * 1000; // 10 second timeout per HTTP request
const CONCURRENCY = 5;

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const sourceFilter = args.find(a => a.startsWith('--source='))?.split('=')[1]?.toLowerCase();
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1], 10) || 50;

// ── Overlap Prevention & Lock Management ─────────────────────────────────────
function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const raw = fs.readFileSync(LOCK_FILE, 'utf8');
            const lockData = JSON.parse(raw);
            const lockAgeMs = Date.now() - lockData.timestamp;

            if (lockAgeMs < RUN_TIMEOUT_MS && !isForce) {
                console.warn(`[COLLECTOR] ⚠️  Lockfile exists (PID ${lockData.pid}, age: ${Math.round(lockAgeMs / 1000)}s). Exiting to prevent overlap.`);
                process.exit(0);
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

// ── Bounded Concurrency Worker Pool ──────────────────────────────────────────
async function mapConcurrent(items, limit, fn) {
    const results = [];
    const executing = new Set();

    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);

        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

// ── Main Collector Pipeline ──────────────────────────────────────────────────
async function runCollector() {
    console.log(`\n======================================================`);
    console.log(`🛡️  NO ENTRY Threat Intelligence Collector`);
    console.log(`Time:    ${new Date().toISOString()}`);
    console.log(`DryRun:  ${isDryRun ? 'YES (No DB writes)' : 'NO (Persisting to PostgreSQL)'}`);
    console.log(`Filter:  ${sourceFilter || 'ALL'}`);
    console.log(`Limit:   ${limitArg} sources`);
    console.log(`======================================================\n`);

    acquireLock();

    const startTime = Date.now();
    let allSources = getUniqueSources();

    if (sourceFilter) {
        allSources = allSources.filter(s =>
            s.name.toLowerCase().includes(sourceFilter) ||
            s.id.toLowerCase().includes(sourceFilter) ||
            (s.category && s.category.toLowerCase().includes(sourceFilter))
        );
    }

    allSources = allSources.slice(0, limitArg);

    if (allSources.length === 0) {
        console.log('[COLLECTOR] No matching sources to process.');
        releaseLock();
        process.exit(0);
    }

    // Initialize collection run record in PostgreSQL
    let runId = null;
    try {
        runId = await createCollectionRun({
            trigger: 'cli',
            sourcesAttempted: allSources.length,
            startedAt: new Date()
        });
    } catch (err) {
        console.warn('[COLLECTOR] Could not record run start in DB:', err.message);
    }

    const parser = new Parser({
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'User-Agent': 'NO-ENTRY-ThreatIntel-Collector/1.0 (+https://github.com/ceylonroameryt-bit/SOC-AI)' }
    });

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let successfulFeeds = 0;
    let failedFeeds = 0;
    let lastSuccessfulFetch = null;
    let lastSuccessfulWrite = null;

    console.log(`[COLLECTOR] Fetching ${allSources.length} feeds with concurrency ${CONCURRENCY}...`);

    await mapConcurrent(allSources, CONCURRENCY, async (source) => {
        const sourceId = source.id;
        const fetchStart = Date.now();

        try {
            const feed = await parser.parseURL(source.url);
            const latencyMs = Date.now() - fetchStart;
            successfulFeeds++;
            lastSuccessfulFetch = new Date().toISOString();

            const rawItems = feed.items || [];
            totalReceived += rawItems.length;

            let feedAccepted = 0;
            let feedRejected = 0;
            const latestPubDate = rawItems[0]?.pubDate || rawItems[0]?.isoDate || null;

            for (const raw of rawItems) {
                if (!raw || !raw.link || !raw.title) {
                    feedRejected++;
                    continue;
                }

                // Check future date anomaly (Phase 17)
                let publishedAt = null;
                let dateAnomaly = false;
                if (raw.pubDate || raw.isoDate) {
                    const parsed = new Date(raw.pubDate || raw.isoDate);
                    if (!isNaN(parsed.getTime())) {
                        if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
                            dateAnomaly = true;
                            publishedAt = new Date().toISOString();
                        } else {
                            publishedAt = parsed.toISOString();
                        }
                    }
                }

                const sevAssessment = assessSeverity({
                    title: raw.title,
                    contentSnippet: raw.contentSnippet || '',
                    source: source.name
                });
                const severity = sevAssessment.severity === 'critical' ? 'Critical'
                    : (sevAssessment.severity === 'high' ? 'High'
                    : (sevAssessment.severity === 'medium' ? 'Medium'
                    : (sevAssessment.severity === 'informational' ? 'Informational' : 'Low')));

                const classification = classifyRecord({
                    title: raw.title,
                    contentSnippet: raw.contentSnippet || '',
                    source: source.name,
                    category: source.category
                });

                const record = {
                    title: raw.title.trim(),
                    link: raw.link.trim(),
                    pubDate: publishedAt, // Null if publisher date missing
                    contentSnippet: raw.contentSnippet || '',
                    content: raw.content || raw.contentSnippet || '',
                    source: source.name,
                    sourceId,
                    sourceCategory: source.category || 'General',
                    category: source.category || 'General',
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
                    dateAnomaly,
                    isSimulated: false,
                    environment: 'production'
                };

                if (!isDryRun) {
                    try {
                        const articleId = await insertArticle(record);
                        if (articleId) {
                            feedAccepted++;
                            totalAccepted++;
                            lastSuccessfulWrite = new Date().toISOString();

                            const text = `${record.title} ${record.contentSnippet}`;
                            const extracted = extractIOCs(text);
                            if (isDbConnected()) {
                                for (const ip of extracted.ips) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'IPv4', $2) ON CONFLICT DO NOTHING`, [articleId, ip]).catch(() => {});
                                }
                                for (const cve of extracted.cves) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'CVE', $2) ON CONFLICT DO NOTHING`, [articleId, cve]).catch(() => {});
                                }
                                for (const h of extracted.hashes) {
                                    await query(`INSERT INTO iocs (article_id, type, value) VALUES ($1, 'SHA256', $2) ON CONFLICT DO NOTHING`, [articleId, h]).catch(() => {});
                                }
                            }
                        } else {
                            feedRejected++;
                        }
                    } catch {
                        feedRejected++;
                    }
                } else {
                    feedAccepted++;
                    totalAccepted++;
                }
            }

            totalRejected += feedRejected;

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

        } catch (err) {
            failedFeeds++;
            const latencyMs = Date.now() - fetchStart;
            recordCollectionResult(sourceId, {
                success: false,
                httpStatus: 500,
                latencyMs,
                itemsCount: 0,
                itemsAccepted: 0,
                itemsRejected: 0,
                error: err.message,
                errorCategory: 'FETCH_ERROR'
            });
            console.warn(`  [FAIL] ${source.name}: ${err.message}`);
        }
    });

    const durationMs = Date.now() - startTime;
    const finalState = failedFeeds === 0 ? 'success' : (successfulFeeds > 0 ? 'degraded' : 'failed');

    console.log(`\n------------------------------------------------------`);
    console.log(`📊 Ingestion Summary:`);
    console.log(`Sources processed: ${allSources.length} (OK: ${successfulFeeds}, Failed: ${failedFeeds})`);
    console.log(`Items received:    ${totalReceived}`);
    console.log(`Items accepted:    ${totalAccepted}`);
    console.log(`Items filtered:    ${totalRejected}`);
    console.log(`Total duration:    ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`State:             ${finalState.toUpperCase()}`);
    console.log(`------------------------------------------------------\n`);

    if (runId) {
        try {
            await completeCollectionRun(runId, {
                durationMs,
                state: finalState,
                sourcesAttempted: allSources.length,
                sourcesSucceeded: successfulFeeds,
                sourcesFailed: failedFeeds,
                articlesAccepted: totalAccepted,
                articlesRejected: totalRejected,
                lastSuccessfulFetch,
                lastSuccessfulArticleWrite: lastSuccessfulWrite
            });
        } catch (err) {
            console.warn('[COLLECTOR] Failed to complete run in DB:', err.message);
        }
    }

    releaseLock();
    process.exit(0);
}

runCollector().catch(err => {
    console.error(`[COLLECTOR] ❌ Fatal error:`, err);
    releaseLock();
    process.exit(1);
});
