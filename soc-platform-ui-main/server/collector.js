#!/usr/bin/env node
import { canonicalArticleUrl, deduplicateArticles } from './services/articleIdentity.js';
/**
 * collector.js — Standalone Production Threat Intelligence Collector CLI
 *
 * Implements:
 * - Standalone execution (completely decoupled from web server & serverless requests)
 * - Process-level overlap prevention with PID-stamped lockfile
 * - Run-level timeout safety (default 5 minutes)
 * - Per-source failure isolation
 * - Per-host rate limiting & concurrency bounding
 * - Conditional HTTP requests with ETag & Last-Modified
 * - HTTP 304 Not Modified handling
 * - Respect for HTTP 429/503 Retry-After headers
 * - SSRF Protection against loopback & private addresses
 * - Real per-source telemetry recording to feedHealthService (NO fabricated 500 codes!)
 * - Content-based deduplication & normalization
 * - Article retention capping (max 10,000 articles)
 *
 * Usage:
 *   node server/collector.js
 *   node server/collector.js --dry-run
 *   node server/collector.js --source=cisa
 *   node server/collector.js --force
 */

import 'dotenv/config';
import fs from 'fs';
import { hasDatabase } from './db/db.js';
import { readSharedSnapshot, applySharedSnapshot, publishSharedSnapshot } from './services/sharedSnapshotService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUniqueSources, recordCollectionResult } from './services/feedHealthService.js';
import { collectFeed, executeCollectionPool } from './services/collectorEngine.js';
import { assessSeverity } from './services/severityEngine.js';
import { classifyRecord } from './services/classificationEngine.js';
import { insertThreat, insertIOCs, isDbConnected, closeDb } from './db/db.js';
import { extractIOCs } from './services/enrichmentService.js';
import { deriveArticleId, parsePubDate, invalidateNewsCache } from './services/newsService.js';
import { enforceContentRestrictions, getSourcePermission } from './services/permissionService.js';
import { startCollectionRun, completeCollectionRun, failCollectionRun } from './services/collectionRunService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_FILE = path.join(__dirname, '../.collector.lock');
const DATA_FILE = path.join(__dirname, 'data/news.json');
const REGISTRY_FILE = path.join(__dirname, 'data/sources_registry.json');
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute hard maximum run limit
const CONCURRENCY = 5;
const MAX_ARTICLES_RETENTION = 10000;

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

            if (lockAgeMs < RUN_TIMEOUT_MS) {
                console.warn(`[COLLECTOR] ⚠️  Lockfile exists (PID ${lockData.pid}, age: ${Math.round(lockAgeMs / 1000)}s). Exiting to prevent overlap.`);
                process.exit(0);
            } else {
                fs.unlinkSync(LOCK_FILE);
                console.warn(`[COLLECTOR] ⚠️  Stale lockfile detected (age: ${Math.round(lockAgeMs / 1000)}s). Overriding stale lock.`);
            }
        } catch {
            // Corrupt lock file, overwrite
        }
    }

    // Exclusive creation prevents two simultaneous collectors from owning the lock.
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        startedAt: new Date().toISOString()
    }), { flag: 'wx' });
}

function releaseLock() {
    if (fs.existsSync(LOCK_FILE)) {
        try {
            const owner = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
            if (owner.pid === process.pid) fs.unlinkSync(LOCK_FILE);
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
    // Enforce retention limit
    const capped = newsList.slice(0, MAX_ARTICLES_RETENTION);
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(capped, null, 2));
        fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(capped, null, 2));
        if (fs.existsSync(tmp)) try { fs.unlinkSync(tmp); } catch {}
    }
}

function updateRegistryEtags(updates) {
    if (!fs.existsSync(REGISTRY_FILE) || updates.length === 0) return;
    try {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        const updateMap = new Map(updates.map(u => [u.id, u]));

        let modified = false;
        for (const item of registry) {
            const upd = updateMap.get(item.id);
            if (upd) {
                if (upd.etag) item.etag = upd.etag;
                if (upd.lastModified) item.lastModified = upd.lastModified;
                modified = true;
            }
        }

        if (modified) {
            fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
        }
    } catch (e) {
        console.warn('[COLLECTOR] Warning updating registry headers:', e.message);
    }
}

// ─── Main Ingestion Execution ─────────────────────────────────────────────────
async function runCollector() {
    acquireLock();
    if (process.env.REQUIRE_SHARED_STORAGE === 'true' && !hasDatabase()) {
        throw new Error('DATABASE_URL is required: collection cannot publish to the website');
    }
    let previousSnapshot = null;
    if (hasDatabase()) {
        try {
            previousSnapshot = await readSharedSnapshot();
            applySharedSnapshot(previousSnapshot);
        } catch (error) {
            // Only an uninitialized store can bootstrap; outages must not overwrite history.
            if (error.code !== '42P01' && error.message !== 'No published collection available') throw error;
        }
    }

    const startTime = Date.now();
    const runRecord = startCollectionRun('cli', { concurrency: CONCURRENCY, sourceFilter });

    console.log(`\n======================================================`);
    console.log(`🛡️  NO ENTRY SOC — Threat Intelligence Collector CLI v2.0`);
    console.log(`Started at: ${new Date().toISOString()} | Run ID: ${runRecord.runId}`);
    console.log(`Options: dryRun=${isDryRun}, force=${isForce}, concurrency=${CONCURRENCY}`);
    console.log(`======================================================\n`);

    let allSources = getUniqueSources().filter(s => {
        const permission = getSourcePermission(s.id);
        return s.enabled && s.reviewState === 'approved' &&
            permission?.permissionOutcome === 'permitted_for_intended_use' &&
            permission.rules?.fetchingPermitted === true && permission.rules?.storingPermitted === true;
    });
    if (sourceFilter) {
        allSources = allSources.filter(s =>
            s.id.toLowerCase().includes(sourceFilter) ||
            s.name.toLowerCase().includes(sourceFilter) ||
            (s.canonicalUrl || s.feedUrl).toLowerCase().includes(sourceFilter)
        );
        console.log(`Filtered to ${allSources.length} sources matching "${sourceFilter}"`);
    }

    if (allSources.length === 0 && process.env.REQUIRE_SHARED_STORAGE === 'true') {
        throw new Error('No approved sources with documented fetch/store permission');
    }
    if (allSources.length === 0) {
        console.warn(`[COLLECTOR] No eligible active sources found.`);
        completeCollectionRun(runRecord.runId, {
            sources: { attempted: 0, succeeded: 0, notModified304: 0, failed: 0, skipped: 0 }
        });
        clearTimeout(runWatchdog);
        releaseLock();
        await closeDb();
        return;
    }

    console.log(`[COLLECTOR] Fetching ${allSources.length} active sources with bounded pool (${CONCURRENCY})...`);

    const existingNews = deduplicateArticles(previousSnapshot ? previousSnapshot.articles : loadExistingNews());
    const existingLinks = new Set(existingNews.map(n => canonicalArticleUrl(n.link)));
    const newItems = [];
    const headerUpdates = [];
    const rejectionReasons = {
        duplicate_link: 0,
        missing_required_fields: 0,
        content_policy_filtered: 0
    };

    let lastSuccessfulFetch = null;
    let lastSuccessfulArticleWrite = null;

    const fetchResults = await executeCollectionPool(allSources, CONCURRENCY, (completed, total, res) => {
        if (completed % 25 === 0 || completed === total) {
            console.log(`[COLLECTOR PROGRESS] Processed ${completed}/${total} feeds...`);
        }
    });

    let totalReceived = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let successfulFeeds = 0;
    let failedFeeds = 0;
    let notModifiedFeeds = 0;

    for (const res of fetchResults) {
        const { source, sourceId, success, notModified, feed, httpStatus, latencyMs, error, errorCategory, etag, lastModified, retryAfterMs } = res;

        if (notModified) {
            notModifiedFeeds++;
            successfulFeeds++;
            lastSuccessfulFetch = new Date().toISOString();
            console.log(`  [304 NOT MODIFIED] ${source.name} (${latencyMs}ms)`);
            recordCollectionResult(sourceId, {
                success: true,
                httpStatus: 304,
                latencyMs,
                itemsCount: 0,
                itemsAccepted: 0,
                itemsRejected: 0,
                etag,
                lastModified
            });
            continue;
        }

        if (!success) {
            failedFeeds++;
            console.warn(`  [FAILED] ${source.name} (${sourceId}) - ${error}`);
            recordCollectionResult(sourceId, {
                success: false,
                httpStatus, // Real status (null on network/timeout, NEVER fabricated 500!)
                latencyMs,
                itemsCount: 0,
                itemsAccepted: 0,
                itemsRejected: 0,
                error,
                errorCategory,
                retryAfterMs
            });
            continue;
        }

        successfulFeeds++;
        lastSuccessfulFetch = new Date().toISOString();
        const rawItems = feed?.items || [];
        totalReceived += rawItems.length;

        let feedAccepted = 0;
        let feedRejected = 0;
        let latestPubDate = null;

        for (const raw of rawItems.slice(0, limitArg)) {
            if (!raw || !raw.link || !raw.title) {
                feedRejected++;
                rejectionReasons.missing_required_fields++;
                continue;
            }

            if (!canonicalArticleUrl(raw.link)) {
                feedRejected++;
                rejectionReasons.missing_required_fields++;
                continue;
            }

            // Deduplication check
            if (existingLinks.has(canonicalArticleUrl(raw.link))) {
                feedRejected++;
                rejectionReasons.duplicate_link++;
                continue;
            }

            // Normalization
            const title = String(raw.title).trim();
            const snippet = String(raw.contentSnippet || raw.content || '').slice(0, 1000).trim();
            const pubDate = parsePubDate(raw.pubDate);
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
                id: deriveArticleId(raw.link),
                title,
                link: raw.link,
                pubDate: pubDate, // null when missing — never fabricated
                pubDateMissing: pubDate === null,
                publishedAt: pubDate,
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

            const safeRecord = enforceContentRestrictions(record, sourceId);
            existingLinks.add(canonicalArticleUrl(raw.link));
            newItems.push(safeRecord);
            feedAccepted++;
            totalAccepted++;
        }

        totalRejected += feedRejected;

        if (etag || lastModified) {
            headerUpdates.push({ id: sourceId, etag, lastModified });
        }

        // Persist real telemetry for this source
        recordCollectionResult(sourceId, {
            success: true,
            httpStatus: httpStatus || 200,
            latencyMs,
            itemsCount: rawItems.length,
            itemsAccepted: feedAccepted,
            itemsRejected: feedRejected,
            latestPubDate,
            etag,
            lastModified
        });

        console.log(`  [OK] ${source.name}: ${feedAccepted} accepted, ${feedRejected} dupes/filtered (${latencyMs}ms)`);
    }

    if (!isDryRun && headerUpdates.length > 0) {
        updateRegistryEtags(headerUpdates);
    }

    console.log(`\n------------------------------------------------------`);
    console.log(`📊 Ingestion Summary:`);
    console.log(`Sources processed: ${allSources.length} (OK: ${successfulFeeds}, 304: ${notModifiedFeeds}, Failed: ${failedFeeds})`);
    console.log(`Items received:    ${totalReceived}`);
    console.log(`Items accepted:    ${totalAccepted}`);
    console.log(`Items filtered:    ${totalRejected}`);
    console.log(`Total duration:    ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`------------------------------------------------------\n`);

    if (newItems.length > 0 && !isDryRun) {
        const combined = [...newItems, ...existingNews].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        saveNews(combined);
        lastSuccessfulArticleWrite = new Date().toISOString();
        invalidateNewsCache();
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

    completeCollectionRun(runRecord.runId, {
        sources: {
            attempted: allSources.length,
            succeeded: successfulFeeds,
            notModified304: notModifiedFeeds,
            failed: failedFeeds,
            skipped: 0
        },
        entries: {
            parsed: totalReceived,
            accepted: totalAccepted,
            rejected: totalRejected,
            rejectionReasons,
            inserted: newItems.length,
            updated: 0,
            deduplicated: rejectionReasons.duplicate_link
        },
        lastSuccessfulFetch,
        lastSuccessfulArticleWrite: newItems.length > 0 ? lastSuccessfulArticleWrite : null
    });

    if (!isDryRun && hasDatabase()) {
        const articles = [...newItems, ...existingNews].sort((a, b) =>
            (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
        await publishSharedSnapshot(articles);
        console.log('[COLLECTOR] Published articles, feed health and run history to shared storage.');
    }
    clearTimeout(runWatchdog);
    releaseLock();
    await closeDb();
}

runCollector().catch(async (err) => {
    console.error(`[COLLECTOR] ❌ Fatal error:`, err);
    try { failCollectionRun(runRecord?.runId, err); } catch {}
    clearTimeout(runWatchdog);
    releaseLock();
    await closeDb();
    process.exitCode = 1;
});
