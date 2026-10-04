/**
 * db.js
 * Authoritative PostgreSQL Database Layer for NO ENTRY / SOC-AI (Supabase / Neon / Render Postgres)
 * Supports connection pooling, automatic schema migrations, robust date validation,
 * and single-source-of-truth query abstractions across all serverless and containerized instances.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;
let isConnected = false;

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL;

if (DATABASE_URL) {
    try {
        const isCloudPg = process.env.NODE_ENV === 'production' || DATABASE_URL.includes('supabase') || DATABASE_URL.includes('neon') || DATABASE_URL.includes('pooler');
        const cleanConnectionString = isCloudPg
            ? DATABASE_URL.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
            : DATABASE_URL;

        pool = new Pool({
            connectionString: cleanConnectionString,
            ssl: isCloudPg ? { rejectUnauthorized: false } : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
        });

        // Initialize schema and migrations
        initDatabase();
    } catch (err) {
        console.warn('[DB] Failed to initialize PostgreSQL pool:', err.message);
    }
} else {
    console.warn('[DB] ⚠️  No DATABASE_URL / SUPABASE_DB_URL / POSTGRES_URL found in environment.');
    console.warn('[DB] ⚠️  Running in database-disconnected mode.');
}

async function initDatabase() {
    if (!pool) return;
    try {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT NOW()');
            isConnected = true;
            console.log(`[DB] ✅ Connected to PostgreSQL at: ${res.rows[0].now}`);

            // 1. Run base schema
            const schemaFile = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaFile)) {
                const schemaSql = fs.readFileSync(schemaFile, 'utf8');
                await client.query(schemaSql);
            }

            // 2. Run migrations in order
            const migrationsDir = path.join(__dirname, 'migrations');
            if (fs.existsSync(migrationsDir)) {
                const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
                for (const file of files) {
                    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                    await client.query(migrationSql);
                }
                console.log(`[DB] ✅ Applied ${files.length} schema migration scripts.`);
            }

            // 3. Synchronize canonical sources registry into PostgreSQL
            const registryFile = path.join(__dirname, '../data/sources_registry.json');
            if (fs.existsSync(registryFile)) {
                try {
                    const sources = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
                    for (const s of sources) {
                        const sUrl = s.feedUrl || s.url || `https://${s.publisherDomain || s.id}`;
                        await client.query(`
                            INSERT INTO sources (
                                id, name, url, feed_url, canonical_url, category, source_type,
                                publisher_domain, provenance, expected_interval_minutes, enabled, review_state, permission_outcome, updated_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                url = EXCLUDED.url,
                                feed_url = EXCLUDED.feed_url,
                                canonical_url = EXCLUDED.canonical_url,
                                category = EXCLUDED.category,
                                enabled = EXCLUDED.enabled,
                                review_state = EXCLUDED.review_state,
                                updated_at = NOW();
                        `, [
                            s.id,
                            s.name || s.id,
                            sUrl,
                            s.feedUrl || null,
                            s.canonicalUrl || s.feedUrl || null,
                            s.category || 'Threat Intelligence',
                            s.sourceType || 'Feed',
                            s.publisherDomain || null,
                            s.provenance || 'Publisher RSS/API',
                            s.expectedIntervalMinutes || 60,
                            s.enabled !== undefined ? s.enabled : true,
                            s.reviewState || 'approved',
                            s.permissionOutcome || 'pending'
                        ]);
                    }
                    console.log(`[DB] ✅ Synchronized ${sources.length} sources to database.`);
                } catch (err) {
                    console.warn(`[DB] ⚠️ Could not synchronize sources: ${err.message}`);
                }
            }
        } finally {
            client.release();
        }
    } catch (err) {
        console.warn(`[DB] ⚠️  PostgreSQL connection/migration failed: ${err.message} (code: ${err.code || 'N/A'})`);
        isConnected = false;
    }
}

export const isDbConnected = () => isConnected;

/**
 * Validate and sanitize publication date.
 * Phase 17 & 18:
 * - If missing or unparseable: return { date: null, isAnomaly: false } (NEVER Date.now())
 * - If date is > 24 hours into the future: return { date, isAnomaly: true }
 */
export const validatePublicationDate = (rawDate) => {
    if (!rawDate) return { date: null, isAnomaly: false };
    const d = new Date(rawDate);
    const ms = d.getTime();
    if (isNaN(ms)) return { date: null, isAnomaly: false };

    const now = Date.now();
    const toleranceMs = 24 * 60 * 60 * 1000; // 24 hours tolerance
    const isAnomaly = ms > now + toleranceMs;

    return {
        date: d.toISOString(),
        isAnomaly
    };
};

/**
 * Insert or update threat article into PostgreSQL with strict date semantics:
 * - publisher publication date -> published_at (null if absent or invalid)
 * - collection timestamp -> ingested_at
 * - database row creation -> created_at
 */
export const insertThreat = async (threat) => {
    if (!isConnected || !pool) return null;

    const rawPub = threat.pubDate || threat.published_at || null;
    const { date: validatedPubDate, isAnomaly } = validatePublicationDate(rawPub);
    const ingestedAt = threat.ingestedAt || threat.ingested_at || new Date().toISOString();
    const isSimulated = Boolean(threat.isSimulated || threat.environment === 'demo');
    const env = isSimulated ? 'demo' : (process.env.APP_MODE || 'production');

    const canonicalUrl = threat.canonicalUrl || threat.link || threat.source_url || threat.url;

    const query = `
        INSERT INTO threats (
            title, summary, content, source_name, source_url, canonical_url,
            category, intel_category, severity, risk_score, published_at,
            ingested_at, date_anomaly, is_simulated, environment, raw_metadata, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            canonical_url = EXCLUDED.canonical_url,
            category = EXCLUDED.category,
            intel_category = EXCLUDED.intel_category,
            severity = EXCLUDED.severity,
            risk_score = EXCLUDED.risk_score,
            published_at = EXCLUDED.published_at,
            date_anomaly = EXCLUDED.date_anomaly,
            updated_at = NOW()
        RETURNING id;
    `;

    try {
        const res = await pool.query(query, [
            threat.title,
            threat.contentSnippet || threat.summary || threat.snippet || '',
            threat.content || threat.contentSnippet || '',
            threat.source || threat.source_name || 'Threat Feed',
            threat.link || threat.source_url,
            canonicalUrl,
            threat.category || 'General',
            threat.intelCategory || 'needs-classification',
            threat.severity || 'Medium',
            threat.riskScore || threat.risk_score || 0,
            validatedPubDate,
            ingestedAt,
            isAnomaly,
            isSimulated,
            env,
            JSON.stringify(threat.metadata || threat.raw_metadata || {})
        ]);
        return res.rows[0]?.id;
    } catch (err) {
        console.error('[DB] Error inserting threat:', err.message);
        return null;
    }
};

/**
 * Bulk insert IOCs linked to a threat
 */
export const insertIOCs = async (threatId, iocsObj) => {
    if (!isConnected || !pool || !threatId || !iocsObj) return;

    const queries = [];
    const mapping = [
        { type: 'IPv4', items: iocsObj.ips || [] },
        { type: 'Domain', items: iocsObj.domains || [] },
        { type: 'CVE', items: iocsObj.cves || [] },
        { type: 'SHA256', items: iocsObj.hashes || [] },
    ];

    for (const group of mapping) {
        for (const val of group.items) {
            queries.push(
                pool.query(
                    `INSERT INTO iocs (threat_id, type, value)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (threat_id, type, value) DO NOTHING`,
                    [threatId, group.type, val]
                ).catch(e => console.warn(`[DB] Failed to insert IOC ${val}:`, e.message))
            );
        }
    }

    await Promise.allSettled(queries);
};

/**
 * Query threats with range, pagination & search from authoritative database
 */
export const getThreatsFromDb = async (options = {}) => {
    if (!isConnected || !pool) return null;

    const {
        limit = 50,
        offset = 0,
        severity,
        category,
        intelCategory,
        search,
        range,
        includeSimulated = false
    } = options;

    const conditions = [];
    const values = [];
    let idx = 1;

    // Filter simulated data out of production unless explicitly enabled
    if (!includeSimulated) {
        conditions.push(`is_simulated = false`);
    }

    // Time range filter based on published_at or ingested_at
    if (range && range !== 'all') {
        let interval = '24 hours';
        if (range === '7d') interval = '7 days';
        if (range === '30d') interval = '30 days';
        conditions.push(`COALESCE(published_at, ingested_at) >= NOW() - INTERVAL '${interval}'`);
    }

    if (severity && severity !== 'all') {
        const sevs = severity.split(',').map(s => s.trim().toLowerCase());
        conditions.push(`LOWER(severity) = ANY($${idx++})`);
        values.push(sevs);
    }

    if (category && category !== 'all') {
        conditions.push(`LOWER(category) = LOWER($${idx++})`);
        values.push(category);
    }

    if (intelCategory && intelCategory !== 'all') {
        conditions.push(`intel_category = $${idx++}`);
        values.push(intelCategory);
    }

    if (search && search.trim()) {
        conditions.push(`(title ILIKE $${idx} OR summary ILIKE $${idx} OR source_name ILIKE $${idx})`);
        values.push(`%${search.trim()}%`);
        idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT 
            id, title, summary AS "contentSnippet", content, source_name AS source,
            source_url AS link, canonical_url AS "canonicalUrl", category, intel_category AS "intelCategory",
            severity, risk_score AS "riskScore", published_at AS "pubDate", ingested_at AS "ingestedAt",
            created_at AS "createdAt", date_anomaly AS "dateAnomaly", is_simulated AS "isSimulated"
        FROM threats
        ${whereClause}
        ORDER BY COALESCE(published_at, ingested_at) DESC
        LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);

    try {
        const res = await pool.query(query, values);
        return res.rows;
    } catch (err) {
        console.error('[DB] Error querying threats:', err.message);
        return null;
    }
};

/**
 * Count total threats in database matching criteria
 */
export const countThreatsInDb = async (options = {}) => {
    if (!isConnected || !pool) return null;

    const { range, severity, includeSimulated = false } = options;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (!includeSimulated) {
        conditions.push(`is_simulated = false`);
    }

    if (range && range !== 'all') {
        let interval = '24 hours';
        if (range === '7d') interval = '7 days';
        if (range === '30d') interval = '30 days';
        conditions.push(`COALESCE(published_at, ingested_at) >= NOW() - INTERVAL '${interval}'`);
    }

    if (severity && severity !== 'all') {
        conditions.push(`LOWER(severity) = LOWER($${idx++})`);
        values.push(severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT COUNT(*)::int AS count FROM threats ${whereClause}`;

    try {
        const res = await pool.query(query, values);
        return res.rows[0]?.count ?? 0;
    } catch (err) {
        console.error('[DB] Error counting threats:', err.message);
        return null;
    }
};

/**
 * Query Severity Statistics View
 */
export const getDbSeverityStats = async (range = 'all') => {
    if (!isConnected || !pool) return null;

    let timeClause = '';
    if (range && range !== 'all') {
        let interval = '24 hours';
        if (range === '7d') interval = '7 days';
        if (range === '30d') interval = '30 days';
        timeClause = `AND COALESCE(published_at, ingested_at) >= NOW() - INTERVAL '${interval}'`;
    }

    const query = `
        SELECT severity AS name, COUNT(*)::int AS count
        FROM threats
        WHERE is_simulated = false ${timeClause}
        GROUP BY severity;
    `;

    try {
        const res = await pool.query(query);
        return res.rows;
    } catch (err) {
        console.error('[DB] Error querying severity stats:', err.message);
        return null;
    }
};

/**
 * Save Collection Run Telemetry to PostgreSQL
 */
export const saveCollectionRunToDb = async (run) => {
    if (!isConnected || !pool || !run) return null;

    const query = `
        INSERT INTO collection_runs (
            run_id, trigger, started_at, completed_at, duration_ms, state,
            sources_attempted, sources_succeeded, sources_failed, sources_skipped,
            http_304_count, articles_parsed, articles_accepted, articles_rejected,
            articles_deduplicated, last_successful_fetch, last_successful_article_write,
            error, created_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
        )
        ON CONFLICT (run_id) DO UPDATE SET
            completed_at = EXCLUDED.completed_at,
            duration_ms = EXCLUDED.duration_ms,
            state = EXCLUDED.state,
            sources_attempted = EXCLUDED.sources_attempted,
            sources_succeeded = EXCLUDED.sources_succeeded,
            sources_failed = EXCLUDED.sources_failed,
            sources_skipped = EXCLUDED.sources_skipped,
            http_304_count = EXCLUDED.http_304_count,
            articles_parsed = EXCLUDED.articles_parsed,
            articles_accepted = EXCLUDED.articles_accepted,
            articles_rejected = EXCLUDED.articles_rejected,
            articles_deduplicated = EXCLUDED.articles_deduplicated,
            last_successful_fetch = EXCLUDED.last_successful_fetch,
            last_successful_article_write = EXCLUDED.last_successful_article_write,
            error = EXCLUDED.error;
    `;

    try {
        await pool.query(query, [
            run.runId,
            run.trigger || 'scheduled',
            run.startedAt || new Date().toISOString(),
            run.completedAt || null,
            run.durationMs || null,
            run.state || 'running',
            run.sourcesAttempted || 0,
            run.sourcesSucceeded || 0,
            run.sourcesFailed || 0,
            run.sourcesSkipped || 0,
            run.http304Count || 0,
            run.articlesParsed || 0,
            run.articlesAccepted || 0,
            run.articlesRejected || 0,
            run.articlesDeduplicated || 0,
            run.lastSuccessfulFetch || null,
            run.lastSuccessfulArticleWrite || null,
            run.error || null
        ]);
        return true;
    } catch (err) {
        console.error('[DB] Error saving collection run:', err.message);
        return false;
    }
};

/**
 * Get Latest Collection Run from DB
 */
export const getLatestCollectionRunFromDb = async () => {
    if (!isConnected || !pool) return null;

    try {
        const res = await pool.query(`
            SELECT * FROM collection_runs 
            ORDER BY started_at DESC 
            LIMIT 1;
        `);
        return res.rows[0] || null;
    } catch (err) {
        console.error('[DB] Error getting latest collection run:', err.message);
        return null;
    }
};

/**
 * Save Source Health to DB
 */
export const saveSourceHealthToDb = async (health) => {
    if (!isConnected || !pool || !health?.sourceId) return null;

    const query = `
        INSERT INTO source_health (
            source_id, status, last_attempt_at, last_success_at, last_http_status,
            consecutive_failures, consecutive_successes, items_last_24h, items_total,
            average_latency_ms, latest_publication_at, last_error, error_category, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
        )
        ON CONFLICT (source_id) DO UPDATE SET
            status = EXCLUDED.status,
            last_attempt_at = EXCLUDED.last_attempt_at,
            last_success_at = EXCLUDED.last_success_at,
            last_http_status = EXCLUDED.last_http_status,
            consecutive_failures = EXCLUDED.consecutive_failures,
            consecutive_successes = EXCLUDED.consecutive_successes,
            items_last_24h = EXCLUDED.items_last_24h,
            items_total = EXCLUDED.items_total,
            average_latency_ms = EXCLUDED.average_latency_ms,
            latest_publication_at = EXCLUDED.latest_publication_at,
            last_error = EXCLUDED.last_error,
            error_category = EXCLUDED.error_category,
            updated_at = NOW();
    `;

    try {
        // Ensure source exists in sources table to satisfy foreign key constraint
        await pool.query(`
            INSERT INTO sources (id, name, url, feed_url, category, enabled, review_state)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING;
        `, [
            health.sourceId,
            health.name || health.sourceName || health.sourceId,
            health.url || health.feedUrl || `https://${health.sourceId}.feed`,
            health.feedUrl || health.url || null,
            health.category || 'Threat Intelligence',
            health.enabled !== undefined ? health.enabled : true,
            health.reviewState || 'approved'
        ]);

        const safeTimestamp = (val) => {
            if (!val) return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d.toISOString();
        };

        await pool.query(query, [
            health.sourceId,
            health.status || 'unknown',
            safeTimestamp(health.lastAttemptAt),
            safeTimestamp(health.lastSuccessAt),
            health.lastHttpStatus !== undefined ? health.lastHttpStatus : null,
            health.consecutiveFailures || 0,
            health.consecutiveSuccesses || 0,
            health.itemsLast24Hours || health.items_last_24h || 0,
            health.itemsTotal || health.items_total || 0,
            health.averageLatencyMs || null,
            safeTimestamp(health.latestPublicationAt),
            health.lastError || null,
            health.errorCategory || null
        ]);
        return true;
    } catch (err) {
        console.error('[DB] Error saving source health:', err.message);
        return false;
    }
};

/**
 * Save Analyst Record and Action
 */
export const saveAnalystActionToDb = async ({ recordId, actionType, value, comment, analystId }) => {
    if (!isConnected || !pool || !recordId) return false;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const noteVal = actionType === 'note_added' ? value : null;
        const dismissVal = actionType === 'dismissed' ? value : null;
        const newStatus = actionType === 'status_change' ? value : (actionType === 'dismissed' ? 'closed' : null);
        const assigneeVal = actionType === 'assignee_changed' ? value : null;

        await client.query(`
            INSERT INTO analyst_records (record_id, status, notes, assignee, dismissed_reason, updated_by, updated_at)
            VALUES ($1, COALESCE($2::text, 'new'), COALESCE($3::text, ''), $4::text, $5::text, $6::text, NOW())
            ON CONFLICT (record_id) DO UPDATE SET
                status = COALESCE($2::text, analyst_records.status),
                notes = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE analyst_records.notes END,
                assignee = CASE WHEN $4::text IS NOT NULL THEN $4::text ELSE analyst_records.assignee END,
                dismissed_reason = CASE WHEN $5::text IS NOT NULL THEN $5::text ELSE analyst_records.dismissed_reason END,
                updated_by = $6::text,
                updated_at = NOW();
        `, [
            recordId,
            newStatus,
            noteVal,
            assigneeVal,
            dismissVal,
            analystId || 'analyst'
        ]);

        // Insert audit action
        const insertActionQuery = `
            INSERT INTO analyst_actions (record_id, action_type, new_value, analyst_id, comment, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW());
        `;

        await client.query(insertActionQuery, [
            recordId,
            actionType,
            value ? String(value) : null,
            analystId || 'analyst',
            comment || null
        ]);

        await client.query('COMMIT');
        return true;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DB] Error saving analyst action:', err.message);
        return false;
    } finally {
        client.release();
    }
};

/**
 * Get Analyst Record with History from DB
 */
export const getAnalystRecordFromDb = async (recordId) => {
    if (!isConnected || !pool || !recordId) return null;

    try {
        const recRes = await pool.query('SELECT * FROM analyst_records WHERE record_id = $1', [recordId]);
        const record = recRes.rows[0];
        if (!record) return null;

        const histRes = await pool.query('SELECT * FROM analyst_actions WHERE record_id = $1 ORDER BY created_at DESC LIMIT 50', [recordId]);
        return {
            recordId: record.record_id,
            status: record.status,
            notes: record.notes,
            assignee: record.assignee,
            dismissedReason: record.dismissed_reason,
            updatedAt: record.updated_at,
            history: histRes.rows.map(h => ({
                actionId: h.id,
                actionType: h.action_type,
                previousValue: h.previous_value,
                newValue: h.new_value,
                comment: h.comment,
                analystId: h.analyst_id,
                timestamp: h.created_at
            }))
        };
    } catch (err) {
        console.error('[DB] Error getting analyst record:', err.message);
        return null;
    }
};

/**
 * Store AI Brief in Database
 */
export const saveAiBriefToDb = async (brief) => {
    if (!isConnected || !pool || !brief) return false;

    const query = `
        INSERT INTO ai_briefs (
            time_range, headline, content, sources_count, source_links,
            generation_method, is_ai_generated, generated_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id;
    `;

    try {
        await pool.query(query, [
            brief.timeRange || '24h',
            brief.headline || 'Intelligence Brief',
            brief.content || '',
            brief.sourcesCount || 0,
            JSON.stringify(brief.sourceLinks || []),
            brief.generationMethod || 'rule-based',
            Boolean(brief.isAiGenerated),
            brief.generatedAt || new Date().toISOString()
        ]);
        return true;
    } catch (err) {
        console.error('[DB] Error saving AI brief:', err.message);
        return false;
    }
};

/**
 * Get Latest AI Brief from Database
 */
export const getLatestAiBriefFromDb = async (range = '24h') => {
    if (!isConnected || !pool) return null;

    try {
        const res = await pool.query(`
            SELECT * FROM ai_briefs 
            WHERE time_range = $1 
            ORDER BY generated_at DESC 
            LIMIT 1;
        `, [range]);
        return res.rows[0] || null;
    } catch (err) {
        console.error('[DB] Error getting latest AI brief:', err.message);
        return null;
    }
};

export const closeDb = async () => {
    if (pool) {
        try {
            await pool.end();
            isConnected = false;
        } catch {}
    }
};

export default {
    isDbConnected,
    validatePublicationDate,
    insertThreat,
    insertIOCs,
    getThreatsFromDb,
    countThreatsInDb,
    getDbSeverityStats,
    saveCollectionRunToDb,
    getLatestCollectionRunFromDb,
    saveSourceHealthToDb,
    saveAnalystActionToDb,
    getAnalystRecordFromDb,
    saveAiBriefToDb,
    getLatestAiBriefFromDb,
    closeDb,
};
