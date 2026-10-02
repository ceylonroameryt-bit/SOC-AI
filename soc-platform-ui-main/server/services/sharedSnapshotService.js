import { deduplicateArticles } from './articleIdentity.js';
/** One atomic publication consumed by every API instance. No writes to Vercel disk. */
import { hasDatabase, queryDatabase } from '../db/db.js';
import { getNews, setSharedNews } from './newsService.js';
import { exportFeedHealth, replaceFeedHealth } from './feedHealthService.js';
import { getCollectionRunHistory, replaceCollectionRuns } from './collectionRunService.js';

export function validateSnapshot(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.articles) ||
        !Array.isArray(value.health) || !Array.isArray(value.runs) ||
        !Number.isFinite(Date.parse(value.publishedAt))) throw new Error('Invalid shared snapshot');
    if (value.articles.some(a => !a || typeof a.id !== 'string' || typeof a.title !== 'string' || typeof a.link !== 'string')) {
        throw new Error('Invalid article in shared snapshot');
    }
    return value;
}

export async function readSharedSnapshot() {
    const result = await queryDatabase("SELECT payload FROM intelligence_snapshot WHERE id = 'current'");
    if (!result.rows.length) throw new Error('No published collection available');
    return validateSnapshot(result.rows[0].payload);
}

export function applySharedSnapshot(snapshot) {
    validateSnapshot(snapshot);
    setSharedNews(snapshot.articles);
    replaceFeedHealth(snapshot.health);
    replaceCollectionRuns(snapshot.runs);
}

export async function publishSharedSnapshot(articles = getNews()) {
    const snapshot = validateSnapshot({ version: 1, publishedAt: new Date().toISOString(),
        articles: deduplicateArticles(articles).slice(0, 10000), health: exportFeedHealth(), runs: getCollectionRunHistory(100) });
    await queryDatabase(`CREATE TABLE IF NOT EXISTS intelligence_snapshot (
        id TEXT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    // Server-side access only; do not expose this through a public Supabase role.
    await queryDatabase('ALTER TABLE intelligence_snapshot ENABLE ROW LEVEL SECURITY');
    await queryDatabase(`INSERT INTO intelligence_snapshot (id, payload) VALUES ('current', $1::jsonb)
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, [JSON.stringify(snapshot)]);
    applySharedSnapshot(snapshot);
    return snapshot;
}

/** Single-flight refresh: concurrent page widgets share one database read. */
export function createSnapshotLoader({ read = readSharedSnapshot, apply = applySharedSnapshot,
    now = Date.now, ttlMs = 60000 } = {}) {
    let expiresAt = 0;
    let pending = null;
    let current = null;
    return async () => {
        if (current && now() < expiresAt) return current;
        if (!pending) pending = (async () => {
            const snapshot = validateSnapshot(await read());
            apply(snapshot);
            current = snapshot;
            expiresAt = now() + ttlMs;
            return snapshot;
        })().finally(() => { pending = null; });
        return pending;
    };
}
export const refreshSharedSnapshot = createSnapshotLoader();
export const sharedStorageRequired = () => hasDatabase() || Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export async function sharedSnapshotMiddleware(req, res, next) {
    if (req.method !== 'GET' || req.path === '/health' || !sharedStorageRequired()) return next();
    try {
        const snapshot = await refreshSharedSnapshot();
        res.setHeader('X-Data-Published-At', snapshot.publishedAt);
        next();
    } catch (error) {
        console.error('[SHARED DATA]', error.message);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '60');
        res.status(503).json({ error: 'Intelligence data is temporarily unavailable. Please retry shortly.', code: 'DATA_UNAVAILABLE' });
    }
}
