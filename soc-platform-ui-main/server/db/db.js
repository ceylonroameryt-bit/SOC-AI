/**
 * db.js
 * PostgreSQL Database Layer for NO ENTRY (Supabase / Neon / Render Postgres)
 * Supports connection pooling, automatic schema migration, and transparent fallback
 * to local JSON cache when DATABASE_URL is not configured.
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
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' || DATABASE_URL.includes('supabase') || DATABASE_URL.includes('neon')
                ? { rejectUnauthorized: false }
                : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('[DB] Unexpected error on idle PostgreSQL client:', err.message);
        });

        // Initialize schema
        initDatabase();
    } catch (err) {
        console.warn('[DB] Failed to initialize PostgreSQL pool:', err.message);
    }
} else {
    console.warn('[DB] ⚠️  No DATABASE_URL / SUPABASE_DB_URL / POSTGRES_URL found in environment.');
    console.warn('[DB] ⚠️  All records will be saved to local JSON files only (no PostgreSQL persistence).');
    console.warn('[DB] ⚠️  To enable database saving: copy .env.example → .env and set DATABASE_URL.');
}

async function initDatabase() {
    if (!pool) return;
    try {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT NOW()');
            isConnected = true;
            console.log(`[DB] ✅ Connected to PostgreSQL (Supabase/Neon) at: ${res.rows[0].now}`);

            // Run schema if tables don't exist
            const schemaFile = path.join(__dirname, 'schema.sql');
            if (fs.existsSync(schemaFile)) {
                const schemaSql = fs.readFileSync(schemaFile, 'utf8');
                await client.query(schemaSql);
                console.log('[DB] ✅ Database schema verified/migrated successfully.');
            }
        } finally {
            client.release();
        }
    } catch (err) {
        console.warn(`[DB] ⚠️  PostgreSQL connection failed: ${err.message} (code: ${err.code || 'N/A'})`);
        console.warn('[DB] ⚠️  Check your DATABASE_URL in .env — ensure the password, host, and port are correct.');
        isConnected = false;
    }
}

export const isDbConnected = () => isConnected;

/**
 * Insert or update threat article into PostgreSQL
 */
export const insertThreat = async (threat) => {
    if (!isConnected || !pool) return null;
    const query = `
        INSERT INTO threats (
            title, summary, content, source_name, source_url, category, severity, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            severity = EXCLUDED.severity,
            category = EXCLUDED.category,
            updated_at = NOW()
        RETURNING id;
    `;

    try {
        const res = await pool.query(query, [
            threat.title,
            threat.contentSnippet || threat.summary || '',
            threat.content || threat.contentSnippet || '',
            threat.source || 'Threat Feed',
            threat.link || threat.source_url,
            threat.category || 'General',
            threat.severity || 'Medium',
            new Date(threat.pubDate || threat.published_at || Date.now())
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
 * Query threats with pagination & search
 */
export const getThreatsFromDb = async (options = {}) => {
    if (!isConnected || !pool) return null;

    const { limit = 50, offset = 0, severity, category, search } = options;
    const conditions = [];
    const values = [];
    let idx = 1;

    if (severity && severity !== 'all') {
        conditions.push(`severity = $${idx++}`);
        values.push(severity);
    }

    if (category && category !== 'all') {
        conditions.push(`category = $${idx++}`);
        values.push(category);
    }

    if (search && search.trim()) {
        conditions.push(`(title ILIKE $${idx} OR summary ILIKE $${idx})`);
        values.push(`%${search.trim()}%`);
        idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
        SELECT id, title, summary AS "contentSnippet", source_name AS source,
               source_url AS link, category, severity, published_at AS "pubDate", created_at
        FROM threats
        ${whereClause}
        ORDER BY published_at DESC
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
 * Query Severity Statistics View
 */
export const getDbSeverityStats = async () => {
    if (!isConnected || !pool) return null;
    try {
        const res = await pool.query('SELECT severity AS name, count::int FROM v_severity_stats');
        return res.rows;
    } catch (err) {
        console.error('[DB] Error querying severity stats:', err.message);
        return null;
    }
};

export default {
    isDbConnected,
    insertThreat,
    insertIOCs,
    getThreatsFromDb,
    getDbSeverityStats,
};
