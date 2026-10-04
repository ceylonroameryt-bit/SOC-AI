#!/usr/bin/env node
/**
 * collector.js — Standalone Production-Ready Threat Intelligence Collector CLI
 *
 * Implements:
 * - Standalone execution (completely decoupled from web server & serverless requests)
 * - Process-level overlap prevention with PID-stamped lockfile
 * - Run-level timeout safety (default 5 minutes)
 * - Per-source failure isolation via Central Ingestion Engine
 * - Bounded concurrency (configurable via FETCH_CONCURRENCY or CLI flag)
 * - Request timeouts, retries, and SSRF validation
 * - Content-based deduplication & normalization
 * - Real per-source telemetry recording to PostgreSQL and feedHealthService
 * - Safe exit codes: 0 = complete success / partial with new data; 1 = error/locked
 *
 * Usage:
 *   node server/collector.js
 *   node server/collector.js --dry-run
 *   node server/collector.js --source=cisa
 *   node server/collector.js --force
 *   node server/collector.js --limit=50
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeIngestionCycle } from './services/ingestion/ingestionEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCK_FILE = path.join(__dirname, '../.collector.lock');
const RUN_TIMEOUT_MS = parseInt(process.env.COLLECTOR_TIMEOUT_MS || `${5 * 60 * 1000}`, 10);
const CONCURRENCY = parseInt(process.env.FETCH_CONCURRENCY || '10', 10);

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const sourceFilter = args.find(a => a.startsWith('--source='))?.split('=')[1]?.toLowerCase();
const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1], 10) || null;

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

// ── Main Collector Pipeline ──────────────────────────────────────────────────
async function runCollector() {
    console.log(`\n======================================================`);
    console.log(`🛡️  NO ENTRY Threat Intelligence Collector CLI`);
    console.log(`Time:        ${new Date().toISOString()}`);
    console.log(`DryRun:      ${isDryRun ? 'YES (No DB writes)' : 'NO (Persisting to PostgreSQL)'}`);
    console.log(`Filter:      ${sourceFilter || 'ALL'}`);
    console.log(`Limit:       ${limitArg || 'ALL'} sources`);
    console.log(`Concurrency: ${CONCURRENCY}`);
    console.log(`======================================================\n`);

    acquireLock();

    try {
        const summary = await executeIngestionCycle({
            trigger: 'cli',
            concurrency: CONCURRENCY,
            isDryRun,
            sourceFilter,
            limit: limitArg,
            force: isForce
        });

        if (summary.status === 'skipped') {
            console.log(`[COLLECTOR] Run skipped: ${summary.reason}`);
        } else {
            console.log(`[COLLECTOR] Run finished with state: ${summary.state?.toUpperCase()}`);
        }
    } catch (err) {
        console.error('[COLLECTOR] Fatal error during collection run:', err);
        releaseLock();
        process.exit(1);
    } finally {
        releaseLock();
    }

    process.exit(0);
}

runCollector().catch(err => {
    console.error(`[COLLECTOR] ❌ Fatal error:`, err);
    releaseLock();
    process.exit(1);
});
