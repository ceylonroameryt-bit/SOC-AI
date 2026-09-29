/**
 * collectionRunService.js
 *
 * Tracks, persists, and exposes run-level telemetry for threat intelligence ingestion jobs.
 * Enforces Section 6 compliance:
 * - Unique Run ID and run state ('running' | 'completed' | 'failed')
 * - Start and end timestamps with duration
 * - Sources attempted, succeeded, failed, and skipped with skip reasons
 * - Entries parsed, rejected, inserted, updated, and deduplicated with rejection reasons
 * - Last successful fetch and article write timestamps
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNS_FILE = path.join(__dirname, '../data/collection_runs.json');
const MAX_RUN_HISTORY = 100;

let runsCache = null;

function loadRuns() {
    if (runsCache !== null) return runsCache;
    if (!fs.existsSync(RUNS_FILE)) {
        runsCache = [];
        return runsCache;
    }
    try {
        const raw = fs.readFileSync(RUNS_FILE, 'utf8');
        runsCache = JSON.parse(raw);
        if (!Array.isArray(runsCache)) runsCache = [];
    } catch (e) {
        console.warn('[COLLECTION RUNS] Warning reading collection_runs.json:', e.message);
        runsCache = [];
    }
    return runsCache;
}

function saveRuns(runs) {
    runsCache = runs.slice(0, MAX_RUN_HISTORY);
    const tmp = `${RUNS_FILE}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(runsCache, null, 2));
        fs.renameSync(tmp, RUNS_FILE);
    } catch (err) {
        try {
            fs.writeFileSync(RUNS_FILE, JSON.stringify(runsCache, null, 2));
        } catch (wErr) {
            console.error('[COLLECTION RUNS] Error persisting collection_runs.json:', wErr.message);
        }
        if (fs.existsSync(tmp)) try { fs.unlinkSync(tmp); } catch {}
    }
}

/**
 * Start a new ingestion collection run.
 * @param {string} trigger - 'scheduled' | 'manual' | 'cli'
 * @param {Object} [meta={}]
 * @returns {Object} initial run record
 */
export function startCollectionRun(trigger = 'scheduled', meta = {}) {
    const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const startedAt = new Date().toISOString();

    const runRecord = {
        runId,
        runState: 'running',
        trigger,
        startedAt,
        completedAt: null,
        durationMs: null,
        concurrency: meta.concurrency || 5,
        sourceFilter: meta.sourceFilter || null,
        sources: {
            attempted: 0,
            succeeded: 0,
            notModified304: 0,
            failed: 0,
            skipped: 0,
            skipReasons: {}
        },
        entries: {
            parsed: 0,
            accepted: 0,
            rejected: 0,
            rejectionReasons: {
                duplicate_link: 0,
                missing_required_fields: 0,
                content_policy_filtered: 0
            },
            inserted: 0,
            updated: 0,
            deduplicated: 0
        },
        lastSuccessfulFetch: null,
        lastSuccessfulArticleWrite: null,
        error: null
    };

    const runs = loadRuns();
    runs.unshift(runRecord);
    saveRuns(runs);

    return runRecord;
}

/**
 * Complete an ingestion collection run with final tallies.
 * @param {string} runId
 * @param {Object} metrics
 * @returns {Object|null} updated run record
 */
export function completeCollectionRun(runId, metrics = {}) {
    const runs = loadRuns();
    const run = runs.find(r => r.runId === runId);
    if (!run) return null;

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(run.startedAt).getTime();

    run.runState = 'completed';
    run.completedAt = completedAt;
    run.durationMs = durationMs;

    if (metrics.sources) {
        run.sources = {
            attempted: metrics.sources.attempted ?? run.sources.attempted,
            succeeded: metrics.sources.succeeded ?? run.sources.succeeded,
            notModified304: metrics.sources.notModified304 ?? run.sources.notModified304,
            failed: metrics.sources.failed ?? run.sources.failed,
            skipped: metrics.sources.skipped ?? run.sources.skipped,
            skipReasons: { ...run.sources.skipReasons, ...(metrics.sources.skipReasons || {}) }
        };
    }

    if (metrics.entries) {
        run.entries = {
            parsed: metrics.entries.parsed ?? run.entries.parsed,
            accepted: metrics.entries.accepted ?? run.entries.accepted,
            rejected: metrics.entries.rejected ?? run.entries.rejected,
            rejectionReasons: { ...run.entries.rejectionReasons, ...(metrics.entries.rejectionReasons || {}) },
            inserted: metrics.entries.inserted ?? run.entries.inserted,
            updated: metrics.entries.updated ?? run.entries.updated,
            deduplicated: metrics.entries.deduplicated ?? run.entries.deduplicated
        };
    }

    if (metrics.lastSuccessfulFetch) run.lastSuccessfulFetch = metrics.lastSuccessfulFetch;
    if (metrics.lastSuccessfulArticleWrite) run.lastSuccessfulArticleWrite = metrics.lastSuccessfulArticleWrite;

    saveRuns(runs);
    return run;
}

/**
 * Mark a collection run as failed.
 * @param {string} runId
 * @param {string|Error} error
 * @returns {Object|null}
 */
export function failCollectionRun(runId, error) {
    const runs = loadRuns();
    const run = runs.find(r => r.runId === runId);
    if (!run) return null;

    run.runState = 'failed';
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - new Date(run.startedAt).getTime();
    run.error = error instanceof Error ? error.message : String(error);

    saveRuns(runs);
    return run;
}

/**
 * Retrieve the most recent collection run.
 * @returns {Object|null}
 */
export function getLatestCollectionRun() {
    const runs = loadRuns();
    return runs.length > 0 ? runs[0] : null;
}

/**
 * Retrieve recent collection runs.
 * @param {number} [limit=20]
 * @returns {Object[]}
 */
export function getCollectionRunHistory(limit = 20) {
    const runs = loadRuns();
    return runs.slice(0, Math.max(1, Math.min(100, limit)));
}
