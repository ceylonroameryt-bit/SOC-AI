/**
 * db.js — Authoritative PostgreSQL Database & DAO Layer
 * Supports connection pooling, automatic schema migration, and transaction safety.
 * Works seamlessly across Vercel Serverless instances, Node.js long-running services,
 * and test suites. When no database connection is configured, operates an in-memory
 * state store to prevent filesystem write reliance.
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

if (DATABASE_URL && !DATABASE_URL.includes('placeholder')) {
    try {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' || DATABASE_URL.includes('supabase') || DATABASE_URL.includes('neon')
                ? { rejectUnauthorized: false }
                : false,
            max: parseInt(process.env.PG_MAX_POOL || '10', 10),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('[DB] Unexpected idle client error:', err.message);
        });

        initDatabase();
    } catch (err) {
        console.warn('[DB] Failed to initialize PostgreSQL pool:', err.message);
    }
} else {
    console.warn('[DB] ℹ️  No external PostgreSQL DATABASE_URL found. Running with in-memory authoritative runtime store.');
}

/**
 * Execute schema initialization and migrations
 */
export async function initDatabase() {
    if (!pool) return false;
    try {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT NOW() as now');
            isConnected = true;
            console.log(`[DB] ✅ Connected to PostgreSQL at: ${res.rows[0].now}`);

            const schemaFile = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaFile)) {
                const schemaSql = fs.readFileSync(schemaFile, 'utf8');
                await client.query(schemaSql);
                console.log('[DB] ✅ Database schema verified/migrated successfully.');
            }
            return true;
        } finally {
            client.release();
        }
    } catch (err) {
        console.warn(`[DB] ⚠️  PostgreSQL connection failed: ${err.message}`);
        isConnected = false;
        return false;
    }
}

export const isDbConnected = () => isConnected;
export const getPool = () => pool;

/**
 * Execute raw parameterized query with graceful error handling
 */
export async function query(text, params = []) {
    if (isConnected && pool) {
        const client = await pool.connect();
        try {
            return await client.query(text, params);
        } finally {
            client.release();
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY RUNTIME REPOSITORY (Fallback when PostgreSQL is not connected)
// Guarantees that runtime state NEVER writes to local JSON files in production
// ─────────────────────────────────────────────────────────────────────────────
const memStore = {
    sources: new Map(),
    sourceHealth: new Map(),
    articles: [],
    threatAlerts: [],
    collectionRuns: [],
    collectionResults: [],
    analystRecords: new Map(),
    analystActions: [],
    aiBriefs: [],
    systemState: new Map(),
};

/**
 * Helper to calculate start timestamp from timeRange string
 */
export function getTimeRangeBounds(timeRange = '24h') {
    const now = Date.now();
    switch (timeRange) {
        case '24h':
            return new Date(now - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case 'all':
        default:
            return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCES & PERMISSIONS DAO
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertSource(source) {
    if (!source || !source.id || !source.url) return null;

    if (isConnected && pool) {
        const text = `
            INSERT INTO intel_sources (
                id, name, url, category, source_type, provenance,
                expected_interval_minutes, is_enabled, permission_outcome, rules, requirements, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                url = EXCLUDED.url,
                category = EXCLUDED.category,
                source_type = EXCLUDED.source_type,
                is_enabled = EXCLUDED.is_enabled,
                permission_outcome = EXCLUDED.permission_outcome,
                rules = EXCLUDED.rules,
                requirements = EXCLUDED.requirements,
                updated_at = NOW()
            RETURNING *;
        `;
        const res = await query(text, [
            source.id,
            source.name,
            source.url,
            source.category || 'General',
            source.type || source.source_type || 'Feed',
            source.provenance || 'Publisher RSS/API',
            source.expectedIntervalMinutes || 60,
            source.isEnabled !== false,
            source.permissionOutcome || 'pending',
            JSON.stringify(source.rules || {}),
            JSON.stringify(source.requirements || {}),
        ]);
        return res?.rows?.[0] || null;
    }

    memStore.sources.set(source.id, {
        id: source.id,
        name: source.name,
        url: source.url,
        category: source.category || 'General',
        source_type: source.type || source.source_type || 'Feed',
        provenance: source.provenance || 'Publisher RSS/API',
        expected_interval_minutes: source.expectedIntervalMinutes || 60,
        is_enabled: source.isEnabled !== false,
        permission_outcome: source.permissionOutcome || 'pending',
        rules: source.rules || {},
        requirements: source.requirements || {},
        updated_at: new Date().toISOString()
    });
    return memStore.sources.get(source.id);
}

export async function getSources(filter = {}) {
    if (isConnected && pool) {
        let q = `
            SELECT s.*, 
                   sh.status as health_status,
                   sh.last_attempt_at,
                   sh.last_success_at,
                   sh.last_http_status,
                   sh.consecutive_failures,
                   sh.average_latency_ms,
                   sh.items_last_24h,
                   sh.last_error
            FROM intel_sources s
            LEFT JOIN source_health sh ON s.id = sh.source_id
            WHERE 1=1
        `;
        const params = [];
        if (filter.category) {
            params.push(filter.category);
            q += ` AND s.category = $${params.length}`;
        }
        if (filter.isEnabled !== undefined) {
            params.push(filter.isEnabled);
            q += ` AND s.is_enabled = $${params.length}`;
        }
        q += ` ORDER BY s.name ASC`;
        const res = await query(q, params);
        return res?.rows || [];
    }

    let list = Array.from(memStore.sources.values());
    if (filter.category) list = list.filter(s => s.category === filter.category);
    if (filter.isEnabled !== undefined) list = list.filter(s => s.is_enabled === filter.isEnabled);

    return list.map(s => {
        const h = memStore.sourceHealth.get(s.id) || { status: 'unknown' };
        return {
            ...s,
            health_status: h.status || 'unknown',
            last_attempt_at: h.last_attempt_at || null,
            last_success_at: h.last_success_at || null,
            last_http_status: h.last_http_status || null,
            consecutive_failures: h.consecutive_failures || 0,
            average_latency_ms: h.average_latency_ms || 0,
            items_last_24h: h.items_last_24h || 0,
            last_error: h.last_error || null
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE HEALTH DAO (Measured Telemetry Only)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordSourceHealth(sourceId, health) {
    if (!sourceId) return null;
    const now = new Date();

    if (isConnected && pool) {
        const text = `
            INSERT INTO source_health (
                source_id, status, last_attempt_at, last_success_at,
                last_http_status, consecutive_failures, consecutive_successes,
                average_latency_ms, items_last_24h, last_error, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (source_id) DO UPDATE SET
                status = EXCLUDED.status,
                last_attempt_at = EXCLUDED.last_attempt_at,
                last_success_at = COALESCE(EXCLUDED.last_success_at, source_health.last_success_at),
                last_http_status = EXCLUDED.last_http_status,
                consecutive_failures = EXCLUDED.consecutive_failures,
                consecutive_successes = EXCLUDED.consecutive_successes,
                average_latency_ms = EXCLUDED.average_latency_ms,
                items_last_24h = EXCLUDED.items_last_24h,
                last_error = EXCLUDED.last_error,
                updated_at = NOW()
            RETURNING *;
        `;
        const res = await query(text, [
            sourceId,
            health.status,
            health.lastAttemptAt || now,
            health.lastSuccessAt || null,
            health.lastHttpStatus || null,
            health.consecutiveFailures || 0,
            health.consecutiveSuccesses || 0,
            health.averageLatencyMs || 0,
            health.itemsLast24Hours || 0,
            health.lastError || null
        ]);
        return res?.rows?.[0] || null;
    }

    const prev = memStore.sourceHealth.get(sourceId) || {};
    const updated = {
        source_id: sourceId,
        status: health.status,
        last_attempt_at: health.lastAttemptAt || now.toISOString(),
        last_success_at: health.lastSuccessAt || prev.last_success_at || null,
        last_http_status: health.lastHttpStatus || null,
        consecutive_failures: health.consecutiveFailures || 0,
        consecutive_successes: health.consecutiveSuccesses || 0,
        average_latency_ms: health.averageLatencyMs || 0,
        items_last_24h: health.itemsLast24Hours || 0,
        last_error: health.lastError || null,
        updated_at: now.toISOString()
    };
    memStore.sourceHealth.set(sourceId, updated);
    return updated;
}

export async function getSourceHealthCounts() {
    if (isConnected && pool) {
        const text = `
            SELECT 
                COUNT(*) as total_registered,
                COUNT(*) FILTER (WHERE s.is_enabled = TRUE) as total_enabled,
                COUNT(*) FILTER (WHERE sh.status = 'healthy') as healthy,
                COUNT(*) FILTER (WHERE sh.status = 'degraded') as degraded,
                COUNT(*) FILTER (WHERE sh.status = 'failed') as failed,
                COUNT(*) FILTER (WHERE sh.status = 'stale') as stale,
                COUNT(*) FILTER (WHERE sh.status = 'disabled') as disabled,
                COUNT(*) FILTER (WHERE sh.status = 'unknown' OR sh.status IS NULL) as unknown
            FROM intel_sources s
            LEFT JOIN source_health sh ON s.id = sh.source_id;
        `;
        const res = await query(text);
        if (res?.rows?.[0]) {
            const r = res.rows[0];
            return {
                registered: parseInt(r.total_registered, 10) || 0,
                enabled: parseInt(r.total_enabled, 10) || 0,
                healthy: parseInt(r.healthy, 10) || 0,
                degraded: parseInt(r.degraded, 10) || 0,
                failed: parseInt(r.failed, 10) || 0,
                stale: parseInt(r.stale, 10) || 0,
                disabled: parseInt(r.disabled, 10) || 0,
                unknown: parseInt(r.unknown, 10) || 0,
            };
        }
    }

    const allSources = Array.from(memStore.sources.values());
    let healthy = 0, degraded = 0, failed = 0, stale = 0, disabled = 0, unknown = 0;

    for (const s of allSources) {
        if (!s.is_enabled) {
            disabled++;
            continue;
        }
        const h = memStore.sourceHealth.get(s.id);
        const st = h?.status || 'unknown';
        if (st === 'healthy') healthy++;
        else if (st === 'degraded') degraded++;
        else if (st === 'failed') failed++;
        else if (st === 'stale') stale++;
        else unknown++;
    }

    return {
        registered: allSources.length,
        enabled: allSources.filter(s => s.is_enabled).length,
        healthy,
        degraded,
        failed,
        stale,
        disabled,
        unknown,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEL ARTICLES DAO (Authoritative Ingestion & Reading)
// ─────────────────────────────────────────────────────────────────────────────

export async function insertArticle(article) {
    if (!article || !article.title || !article.link) return null;

    const canonicalUrl = article.link.trim();
    const now = new Date();
    let publishedAt = null;
    let dateAnomaly = false;

    if (article.pubDate) {
        const parsed = new Date(article.pubDate);
        if (!isNaN(parsed.getTime())) {
            // Check for future date anomaly (> 24 hours in the future)
            if (parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
                dateAnomaly = true;
                publishedAt = now; // Guard against future sorting skew while tracking anomaly
            } else {
                publishedAt = parsed;
            }
        }
    }

    const isSimulated = Boolean(article.isSimulated);
    const environment = article.environment || (isSimulated ? 'demo' : 'production');

    if (isConnected && pool) {
        const text = `
            INSERT INTO intel_articles (
                title, summary, content, source_id, source_name, source_url,
                canonical_url, category, source_category, intel_category,
                secondary_topics, content_type, evidence_status, severity,
                published_at, ingested_at, date_anomaly, classification_method,
                classification_confidence, classification_reason, taxonomy_version,
                is_simulated, environment, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, NOW()
            )
            ON CONFLICT (canonical_url) DO UPDATE SET
                title = EXCLUDED.title,
                summary = EXCLUDED.summary,
                severity = EXCLUDED.severity,
                intel_category = EXCLUDED.intel_category,
                evidence_status = EXCLUDED.evidence_status,
                updated_at = NOW()
            RETURNING id, (xmax = 0) AS is_inserted;
        `;
        const res = await query(text, [
            article.title,
            article.contentSnippet || article.summary || '',
            article.content || article.contentSnippet || '',
            article.sourceId || null,
            article.source || 'Threat Feed',
            article.sourceUrl || article.link,
            canonicalUrl,
            article.category || 'General',
            article.sourceCategory || article.category,
            article.intelCategory || 'needs-classification',
            article.secondaryTopics || [],
            article.contentType || 'unknown',
            article.evidenceStatus || 'unassessed',
            article.severity || 'Medium',
            publishedAt,
            now,
            dateAnomaly,
            article.classificationMethod || 'rule-based',
            article.classificationConfidence || 70,
            article.classificationReason || null,
            article.taxonomyVersion || 'v1.0',
            isSimulated,
            environment
        ]);

        const row = res?.rows?.[0];
        const articleId = row?.id;
        const isInserted = Boolean(row?.is_inserted);

        // Also sync backward-compatible threats table
        try {
            await query(`
                INSERT INTO threats (title, summary, content, source_name, source_url, category, severity, published_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (source_url) DO NOTHING;
            `, [
                article.title,
                article.contentSnippet || '',
                article.content || '',
                article.source || 'Threat Feed',
                canonicalUrl,
                article.category || 'General',
                article.severity || 'Medium',
                publishedAt || now
            ]);
        } catch {}

        return {
            id: articleId,
            isInserted,
            isDuplicate: !isInserted,
            isNew: isInserted,
            toString() { return articleId || ''; }
        };
    }

    // In-memory fallback
    const existingIdx = memStore.articles.findIndex(a => a.canonical_url === canonicalUrl);
    const isNew = existingIdx < 0;
    const item = {
        id: !isNew ? memStore.articles[existingIdx].id : `art-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: article.title,
        summary: article.contentSnippet || article.summary || '',
        content: article.content || article.contentSnippet || '',
        source_id: article.sourceId || null,
        source_name: article.source || 'Threat Feed',
        source_url: article.sourceUrl || article.link,
        canonical_url: canonicalUrl,
        link: canonicalUrl,
        category: article.category || 'General',
        source_category: article.sourceCategory || article.category,
        intel_category: article.intelCategory || 'needs-classification',
        intel_category_display: article.intelCategoryDisplay || article.category,
        secondary_topics: article.secondaryTopics || [],
        content_type: article.contentType || 'unknown',
        evidence_status: article.evidenceStatus || 'unassessed',
        severity: article.severity || 'Medium',
        published_at: publishedAt ? publishedAt.toISOString() : null,
        pubDate: publishedAt ? publishedAt.toISOString() : null,
        ingested_at: now.toISOString(),
        date_anomaly: dateAnomaly,
        classification_method: article.classificationMethod || 'rule-based',
        classification_confidence: article.classificationConfidence || 70,
        classification_reason: article.classificationReason || null,
        taxonomy_version: article.taxonomyVersion || 'v1.0',
        is_simulated: isSimulated,
        environment,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
    };

    if (!isNew) {
        memStore.articles[existingIdx] = { ...memStore.articles[existingIdx], ...item };
    } else {
        memStore.articles.unshift(item);
    }

    return {
        id: item.id,
        isInserted: isNew,
        isDuplicate: !isNew,
        isNew,
        toString() { return item.id; }
    };
}

/**
 * Batch insert extracted IOCs into the database to eliminate N+1 round-trips.
 */
export async function insertIocsBatch(articleId, extracted) {
    if (!articleId || !extracted) return;
    const rawId = typeof articleId === 'object' ? articleId.id : articleId;
    if (!rawId) return;

    const items = [];
    for (const ip of (extracted.ips || [])) items.push({ type: 'IPv4', value: ip });
    for (const cve of (extracted.cves || [])) items.push({ type: 'CVE', value: cve });
    for (const h of (extracted.hashes || [])) items.push({ type: 'SHA256', value: h });

    if (items.length === 0) return;

    if (isConnected && pool) {
        try {
            const valuePlaceholders = [];
            const params = [rawId];
            let pIdx = 2;

            for (const item of items) {
                valuePlaceholders.push(`($1, $${pIdx}, $${pIdx + 1})`);
                params.push(item.type, item.value);
                pIdx += 2;
            }

            const text = `
                INSERT INTO iocs (article_id, type, value)
                VALUES ${valuePlaceholders.join(', ')}
                ON CONFLICT DO NOTHING;
            `;
            await query(text, params);
        } catch (e) {
            console.debug('Failed to batch insert IOCs:', e.message);
        }
    }
}

export async function getArticles({
    limit = 50,
    offset = 0,
    severity = null,
    category = null,
    intelCategory = null,
    timeRange = '24h',
    q = null,
    isDemoEnabled = false
} = {}) {
    const timeBound = getTimeRangeBounds(timeRange);

    if (isConnected && pool) {
        let sql = `
            SELECT 
                id, title, summary as "contentSnippet", content, source_name as source,
                canonical_url as link, category, source_category as "sourceCategory",
                intel_category as "intelCategory", secondary_topics as "secondaryTopics",
                content_type as "contentType", evidence_status as "evidenceStatus",
                severity, published_at as "pubDate", ingested_at as "ingestedAt",
                date_anomaly as "dateAnomaly", classification_method as "classificationMethod",
                classification_confidence as "classificationConfidence",
                classification_reason as "classificationReason",
                is_simulated as "isSimulated", environment
            FROM intel_articles
            WHERE 1=1
        `;
        const params = [];

        if (!isDemoEnabled) {
            sql += ` AND is_simulated = FALSE AND environment = 'production'`;
        }

        if (timeBound) {
            params.push(timeBound);
            sql += ` AND (published_at >= $${params.length} OR (published_at IS NULL AND ingested_at >= $${params.length}))`;
        }

        if (severity && severity !== 'all') {
            params.push(severity);
            sql += ` AND LOWER(severity) = LOWER($${params.length})`;
        }

        if (category && category !== 'all') {
            params.push(category);
            sql += ` AND LOWER(category) = LOWER($${params.length})`;
        }

        if (intelCategory && intelCategory !== 'all') {
            params.push(intelCategory);
            sql += ` AND intel_category = $${params.length}`;
        }

        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR summary ILIKE $${params.length} OR source_name ILIKE $${params.length})`;
        }

        sql += ` ORDER BY COALESCE(published_at, ingested_at) DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const res = await query(sql, params);
        return res?.rows || [];
    }

    // In-memory fallback
    let items = memStore.articles;
    if (!isDemoEnabled) {
        items = items.filter(a => !a.is_simulated && a.environment !== 'demo');
    }

    if (timeBound) {
        const boundMs = timeBound.getTime();
        items = items.filter(a => {
            const t = new Date(a.published_at || a.ingested_at || 0).getTime();
            return !isNaN(t) && t >= boundMs;
        });
    }

    if (severity && severity !== 'all') {
        items = items.filter(a => (a.severity || '').toLowerCase() === severity.toLowerCase());
    }

    if (category && category !== 'all') {
        items = items.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
    }

    if (intelCategory && intelCategory !== 'all') {
        items = items.filter(a => (a.intel_category || 'needs-classification') === intelCategory);
    }

    if (q && q.trim()) {
        const queryTerm = q.toLowerCase();
        items = items.filter(a =>
            (a.title || '').toLowerCase().includes(queryTerm) ||
            (a.summary || '').toLowerCase().includes(queryTerm) ||
            (a.source_name || '').toLowerCase().includes(queryTerm)
        );
    }

    return items.slice(offset, offset + limit).map(a => ({
        id: a.id,
        title: a.title,
        contentSnippet: a.summary,
        content: a.content,
        source: a.source_name,
        link: a.canonical_url,
        category: a.category,
        sourceCategory: a.source_category,
        intelCategory: a.intel_category,
        intelCategoryDisplay: a.intel_category_display,
        secondaryTopics: a.secondary_topics,
        contentType: a.content_type,
        evidenceStatus: a.evidence_status,
        severity: a.severity,
        pubDate: a.published_at,
        ingestedAt: a.ingested_at,
        dateAnomaly: a.date_anomaly,
        classificationMethod: a.classification_method,
        classificationConfidence: a.classification_confidence,
        classificationReason: a.classification_reason,
        isSimulated: a.is_simulated,
        environment: a.environment
    }));
}

export async function getArticleStats(timeRange = '24h', isDemoEnabled = false) {
    const timeBound = getTimeRangeBounds(timeRange);

    if (isConnected && pool) {
        let sql = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE LOWER(severity) = 'critical') as critical,
                COUNT(*) FILTER (WHERE LOWER(severity) = 'high') as high,
                COUNT(*) FILTER (WHERE LOWER(severity) = 'medium') as medium,
                COUNT(*) FILTER (WHERE LOWER(severity) = 'low') as low,
                COUNT(*) FILTER (WHERE LOWER(severity) = 'informational') as informational,
                MAX(ingested_at) as latest_ingestion,
                MAX(published_at) as latest_publication
            FROM intel_articles
            WHERE 1=1
        `;
        const params = [];
        if (!isDemoEnabled) {
            sql += ` AND is_simulated = FALSE AND environment = 'production'`;
        }
        if (timeBound) {
            params.push(timeBound);
            sql += ` AND (published_at >= $${params.length} OR (published_at IS NULL AND ingested_at >= $${params.length}))`;
        }
        const res = await query(sql, params);
        if (res?.rows?.[0]) {
            const r = res.rows[0];
            return {
                total: parseInt(r.total, 10) || 0,
                critical: parseInt(r.critical, 10) || 0,
                high: parseInt(r.high, 10) || 0,
                medium: parseInt(r.medium, 10) || 0,
                low: parseInt(r.low, 10) || 0,
                informational: parseInt(r.informational, 10) || 0,
                latestIngestion: r.latest_ingestion || null,
                latestPublication: r.latest_publication || null
            };
        }
    }

    let items = memStore.articles;
    if (!isDemoEnabled) {
        items = items.filter(a => !a.is_simulated && a.environment !== 'demo');
    }
    if (timeBound) {
        const boundMs = timeBound.getTime();
        items = items.filter(a => {
            const t = new Date(a.published_at || a.ingested_at || 0).getTime();
            return !isNaN(t) && t >= boundMs;
        });
    }

    const counts = { total: items.length, critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    let latestIngestion = null;
    let latestPublication = null;

    for (const a of items) {
        const sev = (a.severity || 'low').toLowerCase();
        if (sev in counts) counts[sev]++;
        if (!latestIngestion || new Date(a.ingested_at) > new Date(latestIngestion)) {
            latestIngestion = a.ingested_at;
        }
        if (a.published_at && (!latestPublication || new Date(a.published_at) > new Date(latestPublication))) {
            latestPublication = a.published_at;
        }
    }

    return {
        ...counts,
        latestIngestion,
        latestPublication
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION RUNS TELEMETRY DAO
// ─────────────────────────────────────────────────────────────────────────────

export async function createCollectionRun(runData) {
    const startedAt = runData.startedAt || new Date();
    const trigger = runData.trigger || 'scheduled';

    if (isConnected && pool) {
        const text = `
            INSERT INTO collection_runs (
                trigger, started_at, state, sources_attempted
            ) VALUES ($1, $2, 'running', $3)
            RETURNING run_id;
        `;
        const res = await query(text, [trigger, startedAt, runData.sourcesAttempted || 0]);
        return res?.rows?.[0]?.run_id || null;
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const run = {
        run_id: runId,
        trigger,
        started_at: startedAt instanceof Date ? startedAt.toISOString() : startedAt,
        completed_at: null,
        duration_ms: null,
        state: 'running',
        sources_attempted: runData.sourcesAttempted || 0,
        sources_succeeded: 0,
        sources_failed: 0,
        sources_skipped: 0,
        http_304_count: 0,
        articles_parsed: 0,
        articles_accepted: 0,
        articles_rejected: 0,
        articles_deduplicated: 0,
        last_successful_fetch: null,
        last_successful_article_write: null,
        error: null,
        created_at: new Date().toISOString()
    };
    memStore.collectionRuns.unshift(run);
    return runId;
}

export async function completeCollectionRun(runId, results) {
    if (!runId) return null;
    const completedAt = new Date();

    if (isConnected && pool) {
        const text = `
            UPDATE collection_runs SET
                completed_at = $1,
                duration_ms = $2,
                state = $3,
                sources_attempted = $4,
                sources_succeeded = $5,
                sources_failed = $6,
                sources_skipped = $7,
                http_304_count = $8,
                articles_parsed = $9,
                articles_accepted = $10,
                articles_rejected = $11,
                articles_deduplicated = $12,
                last_successful_fetch = $13,
                last_successful_article_write = $14,
                error = $15
            WHERE run_id = $16
            RETURNING *;
        `;
        const res = await query(text, [
            completedAt,
            results.durationMs || 0,
            results.state || 'success',
            results.sourcesAttempted || 0,
            results.sourcesSucceeded || 0,
            results.sourcesFailed || 0,
            results.sourcesSkipped || 0,
            results.http304Count || 0,
            results.articlesParsed || 0,
            results.articlesAccepted || 0,
            results.articlesRejected || 0,
            results.articlesDeduplicated || 0,
            results.lastSuccessfulFetch || null,
            results.lastSuccessfulArticleWrite || null,
            results.error || null,
            runId
        ]);
        return res?.rows?.[0] || null;
    }

    const run = memStore.collectionRuns.find(r => r.run_id === runId);
    if (run) {
        run.completed_at = completedAt.toISOString();
        run.duration_ms = results.durationMs || 0;
        run.state = results.state || 'success';
        run.sources_attempted = results.sourcesAttempted || run.sources_attempted;
        run.sources_succeeded = results.sourcesSucceeded || 0;
        run.sources_failed = results.sourcesFailed || 0;
        run.sources_skipped = results.sourcesSkipped || 0;
        run.http_304_count = results.http304Count || 0;
        run.articles_parsed = results.articlesParsed || 0;
        run.articles_accepted = results.articlesAccepted || 0;
        run.articles_rejected = results.articlesRejected || 0;
        run.articles_deduplicated = results.articlesDeduplicated || 0;
        run.last_successful_fetch = results.lastSuccessfulFetch || null;
        run.last_successful_article_write = results.lastSuccessfulArticleWrite || null;
        run.error = results.error || null;
    }
    return run;
}

export async function getLatestCollectionRun() {
    if (isConnected && pool) {
        const res = await query(`
            SELECT * FROM collection_runs
            ORDER BY started_at DESC LIMIT 1;
        `);
        return res?.rows?.[0] || null;
    }
    return memStore.collectionRuns[0] || null;
}

export async function getCollectionRuns(limit = 20) {
    if (isConnected && pool) {
        const res = await query(`
            SELECT * FROM collection_runs
            ORDER BY started_at DESC LIMIT $1;
        `, [limit]);
        return res?.rows || [];
    }
    return memStore.collectionRuns.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYST WORKFLOW & AUDIT ACTIONS DAO
// ─────────────────────────────────────────────────────────────────────────────

export async function getAnalystStates() {
    if (isConnected && pool) {
        const recordsRes = await query(`SELECT * FROM analyst_records`);
        const actionsRes = await query(`SELECT * FROM analyst_actions ORDER BY created_at DESC`);

        const map = {};
        for (const r of (recordsRes?.rows || [])) {
            map[r.record_id] = {
                recordId: r.record_id,
                status: r.status,
                notes: r.notes || '',
                assignee: r.assignee || null,
                dismissedReason: r.dismissed_reason || null,
                createdBy: r.created_by,
                updatedBy: r.updated_by,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                history: []
            };
        }
        for (const a of (actionsRes?.rows || [])) {
            if (map[a.record_id]) {
                map[a.record_id].history.push({
                    actionId: a.action_id,
                    actionType: a.action_type,
                    previousValue: a.previous_value,
                    newValue: a.new_value,
                    analystId: a.analyst_id,
                    comment: a.comment,
                    timestamp: a.created_at
                });
            }
        }
        return map;
    }

    return Object.fromEntries(memStore.analystRecords.entries());
}

export async function recordAnalystAction({
    recordId,
    actionType,
    value,
    comment,
    analystId = 'analyst-1'
}) {
    if (!recordId || !actionType) throw new Error('recordId and actionType required');

    const now = new Date();

    if (isConnected && pool) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            let rec = await client.query(`SELECT * FROM analyst_records WHERE record_id = $1`, [recordId]);
            let previousValue = null;

            if (rec.rows.length === 0) {
                await client.query(`
                    INSERT INTO analyst_records (record_id, status, notes, assignee, dismissed_reason, created_by, updated_by, created_at, updated_at)
                    VALUES ($1, 'new', '', NULL, NULL, $2, $2, $3, $3)
                `, [recordId, analystId, now]);
            } else {
                const current = rec.rows[0];
                previousValue = actionType === 'status_change' ? current.status
                    : actionType === 'note_added' ? current.notes
                    : current.assignee;
            }

            if (actionType === 'status_change') {
                await client.query(`UPDATE analyst_records SET status = $1, updated_by = $2, updated_at = $3 WHERE record_id = $4`, [value, analystId, now, recordId]);
            } else if (actionType === 'note_added') {
                await client.query(`UPDATE analyst_records SET notes = $1, updated_by = $2, updated_at = $3 WHERE record_id = $4`, [value, analystId, now, recordId]);
            } else if (actionType === 'assignee_changed') {
                await client.query(`UPDATE analyst_records SET assignee = $1, updated_by = $2, updated_at = $3 WHERE record_id = $4`, [value, analystId, now, recordId]);
            } else if (actionType === 'dismissed') {
                await client.query(`UPDATE analyst_records SET status = 'closed', dismissed_reason = $1, updated_by = $2, updated_at = $3 WHERE record_id = $4`, [value || 'Dismissed by analyst', analystId, now, recordId]);
            }

            const actionRes = await client.query(`
                INSERT INTO analyst_actions (record_id, action_type, previous_value, new_value, analyst_id, comment, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *;
            `, [recordId, actionType, previousValue, value, analystId, comment || null, now]);

            await client.query('COMMIT');
            return actionRes.rows[0];
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    let state = memStore.analystRecords.get(recordId);
    if (!state) {
        state = {
            recordId,
            status: 'new',
            notes: '',
            assignee: null,
            dismissedReason: null,
            createdBy: analystId,
            updatedBy: analystId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            history: []
        };
        memStore.analystRecords.set(recordId, state);
    }

    const previousValue = actionType === 'status_change' ? state.status
        : actionType === 'note_added' ? state.notes
        : state.assignee;

    if (actionType === 'status_change') state.status = value;
    else if (actionType === 'note_added') state.notes = value;
    else if (actionType === 'assignee_changed') state.assignee = value;
    else if (actionType === 'dismissed') {
        state.status = 'closed';
        state.dismissedReason = value || 'Dismissed by analyst';
    }

    state.updatedBy = analystId;
    state.updatedAt = now.toISOString();

    const entry = {
        actionId: `act-${Date.now()}`,
        recordId,
        actionType,
        previousValue,
        newValue: value,
        analystId,
        comment: comment || null,
        timestamp: now.toISOString()
    };
    state.history.unshift(entry);
    return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI BRIEFS DAO (Controlled Caching & Background Synthesis)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLatestAiBrief(timeRange = '24h') {
    if (isConnected && pool) {
        const res = await query(`
            SELECT * FROM ai_briefs
            WHERE time_range = $1
            ORDER BY generated_at DESC LIMIT 1;
        `, [timeRange]);
        if (res?.rows?.[0]) {
            const b = res.rows[0];
            return {
                id: b.id,
                timeRange: b.time_range,
                headline: b.headline,
                summary: b.summary,
                keyThreats: b.key_threats,
                criticalVulnerabilities: b.critical_vulnerabilities,
                recommendedActions: b.recommended_actions,
                sourcesCount: b.sources_count,
                sourcesUsed: b.sources_used,
                generationMethod: b.generation_method,
                isAiGenerated: b.is_ai_generated,
                generatedAt: b.generated_at
            };
        }
    }

    const match = memStore.aiBriefs.find(b => b.timeRange === timeRange);
    return match || null;
}

export async function saveAiBrief(brief) {
    const now = new Date();
    if (isConnected && pool) {
        const text = `
            INSERT INTO ai_briefs (
                time_range, headline, summary, key_threats, critical_vulnerabilities,
                recommended_actions, sources_count, sources_used, generation_method,
                is_ai_generated, generated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id;
        `;
        const res = await query(text, [
            brief.timeRange || '24h',
            brief.headline,
            brief.summary,
            JSON.stringify(brief.keyThreats || []),
            JSON.stringify(brief.criticalVulnerabilities || []),
            JSON.stringify(brief.recommendedActions || []),
            brief.sourcesCount || 0,
            JSON.stringify(brief.sourcesUsed || []),
            brief.generationMethod || 'rule-based',
            brief.isAiGenerated !== false,
            now
        ]);
        return res?.rows?.[0]?.id;
    }

    const item = {
        id: `brief-${Date.now()}`,
        timeRange: brief.timeRange || '24h',
        headline: brief.headline,
        summary: brief.summary,
        keyThreats: brief.keyThreats || [],
        criticalVulnerabilities: brief.criticalVulnerabilities || [],
        recommendedActions: brief.recommendedActions || [],
        sourcesCount: brief.sourcesCount || 0,
        sourcesUsed: brief.sourcesUsed || [],
        generationMethod: brief.generationMethod || 'rule-based',
        isAiGenerated: brief.isAiGenerated !== false,
        generatedAt: now.toISOString()
    };
    memStore.aiBriefs.unshift(item);
    return item.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// THREAT ALERTS DAO (SIEM & Detection Ingestion)
// ─────────────────────────────────────────────────────────────────────────────

export const insertThreat = (alert) => insertThreatAlert(alert);

export async function insertThreatAlert(alert) {
    if (!alert || !alert.id) return null;
    const now = new Date();

    if (isConnected && pool) {
        const text = `
            INSERT INTO threat_alerts (
                id, type, severity, source, description, ioc,
                first_seen, last_seen, ingested_at, is_simulated, environment
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
                last_seen = EXCLUDED.last_seen,
                severity = EXCLUDED.severity,
                description = EXCLUDED.description
            RETURNING id;
        `;
        const res = await query(text, [
            alert.id,
            alert.type || 'Generic Threat',
            alert.severity || 'Medium',
            alert.source || 'External Alert',
            alert.description || '',
            JSON.stringify(alert.ioc || {}),
            alert.firstSeen || now,
            alert.lastSeen || now,
            now,
            Boolean(alert.isSimulated),
            alert.environment || 'production'
        ]);
        return res?.rows?.[0]?.id;
    }

    const existingIdx = memStore.threatAlerts.findIndex(t => t.id === alert.id);
    const item = {
        id: alert.id,
        type: alert.type || 'Generic Threat',
        severity: alert.severity || 'Medium',
        source: alert.source || 'External Alert',
        description: alert.description || '',
        ioc: alert.ioc || {},
        firstSeen: alert.firstSeen || now.toISOString(),
        lastSeen: alert.lastSeen || now.toISOString(),
        ingestedAt: now.toISOString(),
        isSimulated: Boolean(alert.isSimulated),
        environment: alert.environment || 'production'
    };
    if (existingIdx >= 0) memStore.threatAlerts[existingIdx] = item;
    else memStore.threatAlerts.unshift(item);
    return item.id;
}

export async function getThreatAlerts(isDemoEnabled = false) {
    if (isConnected && pool) {
        let sql = `SELECT * FROM threat_alerts WHERE 1=1`;
        if (!isDemoEnabled) {
            sql += ` AND is_simulated = FALSE AND environment = 'production'`;
        }
        sql += ` ORDER BY last_seen DESC LIMIT 100`;
        const res = await query(sql);
        return res?.rows || [];
    }

    let items = memStore.threatAlerts;
    if (!isDemoEnabled) {
        items = items.filter(t => !t.isSimulated && t.environment !== 'demo');
    }
    return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATE DAO
// ─────────────────────────────────────────────────────────────────────────────

export async function getSystemState(key) {
    if (isConnected && pool) {
        const res = await query(`SELECT value FROM system_state WHERE key = $1`, [key]);
        return res?.rows?.[0]?.value || null;
    }
    return memStore.systemState.get(key) || null;
}

export async function setSystemState(key, value) {
    if (isConnected && pool) {
        await query(`
            INSERT INTO system_state (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        `, [key, JSON.stringify(value)]);
        return value;
    }
    memStore.systemState.set(key, value);
    return value;
}
