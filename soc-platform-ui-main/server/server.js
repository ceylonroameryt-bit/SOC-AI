import 'dotenv/config';
import { sharedSnapshotMiddleware, sharedStorageRequired } from './services/sharedSnapshotService.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cron from 'node-cron';
import { requireApiKey, requireApiKeyMiddleware } from './utils/auth.js';

// Route imports
import newsRouter     from './routes/news.js';
import threatsRouter  from './routes/threats.js';
import reportsRouter  from './routes/reports.js';
import sourcesRouter  from './routes/sources.js';
import enrichRouter   from './routes/enrich.js';
import mitreRouter    from './routes/mitre.js';
import webhooksRouter from './routes/webhooks.js';
import aiRouter       from './routes/ai.js';
import rulesRouter    from './routes/rules.js';
import dashboardRouter from './routes/dashboard.js';
import categoriesRouter from './routes/categories.js';
import analystRouter from './routes/analyst.js';
import exploreRouter from './routes/explore.js';

// Service imports
import { fetchAndProcessNews, getNews, backfillClassification } from './services/newsService.js';
import { sendPeriodicSummary }          from './services/emailService.js';
import { broadcastAlert }               from './services/webhookService.js';
import { processNewsForMitre }          from './services/mitreService.js';
import { insertThreat, isDbConnected }  from './db/db.js';


// ES module __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
// Treat an unset NODE_ENV as production (P0 item 22)
const isDev = process.env.NODE_ENV === 'development';

// Trust first proxy hop so rate limiter gets real client IP (P0 item 5)
app.set('trust proxy', 1);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// 1. Compression
app.use(compression());

// 2. Helmet - Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "http://localhost:*", "https:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
}));

// 3. Custom Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.removeHeader('X-Powered-By');
    next();
});

// 4. CORS - Strict Origin Allowlist
const allowedOrigins = [
    'http://localhost:5173',   // Vite dev server (primary)
    'http://localhost:5174',   // Vite dev server (fallback)
    'http://localhost:5175',   // Vite dev server (fallback)
    'http://localhost:5176',   // Vite dev server (fallback)
    'http://localhost:4173',   // Vite preview
    'http://localhost:3000',   // Server itself
    process.env.ALLOWED_ORIGIN, // Production domain from .env
    process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : null // Azure specific hostname
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, mobile apps, standard browser navigation)
        if (!origin) return callback(null, true);

        // P0 item 4: Strict allowlist only — no blanket *.up.railway.app wildcard
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
}));

// 5. Body Parser with Size Limit (prevent payload bombs)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 6. Rate Limiting - Tiered
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,  // Return rate limit info in headers
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Very strict for sensitive endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for this action.' }
});

app.use('/api', apiLimiter);

// 7. Request Logging (Security Audit Trail)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api')) {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms - ${req.ip}`);
        }
    });
    next();
});

// ==========================================
// API ROUTES (Must come before static/SPA catch-all)
// ==========================================
app.use('/api', sharedSnapshotMiddleware);
app.use('/api/news',      newsRouter);
app.use('/api/threats',   threatsRouter);
app.use('/api/reports',   reportsRouter);
app.use('/api/sources',   sourcesRouter);
app.use('/api/enrich',    enrichRouter);
app.use('/api/mitre',     mitreRouter);
app.use('/api/webhooks',  webhooksRouter);
app.use('/api/ai',        aiRouter);
app.use('/api/rules',     rulesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analyst',    analystRouter);
app.use('/api/explore',    exploreRouter);

// Health check endpoint — P0 item 9: return only {status, timestamp}, no internal config
app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// STATIC FILES (production)
// ==========================================
// __dirname-relative path is always correct; cwd() varies on Azure iisnode
const distPathFromDirname = path.join(__dirname, '../dist');
const distPathFromCwd = path.join(process.cwd(), 'dist');
const resolvedDistPath = fs.existsSync(distPathFromDirname) ? distPathFromDirname : distPathFromCwd;
console.log(`[STATIC] __dirname dist: ${distPathFromDirname} (exists: ${fs.existsSync(distPathFromDirname)})`);
console.log(`[STATIC] cwd dist: ${distPathFromCwd} (exists: ${fs.existsSync(distPathFromCwd)})`);
console.log(`[STATIC] Using: ${resolvedDistPath}`);

// Serve static files from dist/
app.use(express.static(resolvedDistPath, {
    dotfiles: 'deny',
    etag: true,
    maxAge: isDev ? 0 : '1d',
    index: 'index.html',
    setHeaders: (res, filePath) => {
        // Ensure correct MIME types for Azure/IIS compatibility
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
        if (filePath.endsWith('.woff2')) res.setHeader('Content-Type', 'font/woff2');
        if (filePath.endsWith('.woff')) res.setHeader('Content-Type', 'font/woff');
        // Cache hashed assets for 1 year, others no-cache
        if (filePath.includes('/assets/') && /\.[a-zA-Z0-9]{8,}\./.test(path.basename(filePath))) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// ==========================================
// SIEM INGESTION ENDPOINT — POST /api/v1/alerts
// Accepts alerts from Wazuh, Snort, Suricata, etc.
// Authentication: X-API-Key header (P0 items 1 & 2)
// Fails CLOSED — rejects all requests when INGEST_API_KEY is unset.
// ==========================================
app.post('/api/v1/alerts', async (req, res) => {
    // P0 item 2: fail closed — always require a configured key
    const authResult = requireApiKey(req, 'INGEST_API_KEY');
    if (!authResult.ok) {
        if (authResult.status !== 503) {
            console.warn(`[INGEST] Unauthorized alert push attempt from ${req.ip}`);
        }
        return res.status(authResult.status).json({ error: authResult.error });
    }

    // P0 item 2: return 400 (not 500) for missing or non-JSON body
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const { type, severity, description, source, ioc } = req.body;

    // Validate required fields and types
    if (!type || typeof type !== 'string') {
        return res.status(400).json({ error: '"type" is required and must be a string.' });
    }
    if (!severity || typeof severity !== 'string') {
        return res.status(400).json({ error: '"severity" is required and must be a string.' });
    }
    const allowedSeverities = ['Critical', 'High', 'Medium', 'Low'];
    if (!allowedSeverities.includes(severity)) {
        return res.status(400).json({ error: `Invalid severity. Must be one of: ${allowedSeverities.join(', ')}` });
    }
    // P0 item 2: validate max lengths
    if (type.length > 100) {
        return res.status(400).json({ error: '"type" must be at most 100 characters.' });
    }
    if (description && typeof description !== 'string') {
        return res.status(400).json({ error: '"description" must be a string.' });
    }
    if (description && description.length > 2000) {
        return res.status(400).json({ error: '"description" must be at most 2000 characters.' });
    }
    if (ioc !== undefined && (typeof ioc !== 'object' || Array.isArray(ioc))) {
        return res.status(400).json({ error: '"ioc" must be an object.' });
    }

    const newAlert = {
        id: `EXT-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        type: type.slice(0, 100),
        severity,
        source: (source && typeof source === 'string') ? source.slice(0, 200) : 'External SIEM',
        description: description ? description.slice(0, 2000) : `External ${severity} alert: ${type}`,
        ioc: ioc || {},
        timestamp: new Date().toISOString(),
        externalIngestion: true,
    };

    // Persist to threats.json
    try {
        const threatsPath = path.join(__dirname, 'data/threats.json');
        const existing = fs.existsSync(threatsPath)
            ? JSON.parse(fs.readFileSync(threatsPath, 'utf8'))
            : [];
        existing.unshift(newAlert);
        fs.writeFileSync(threatsPath, JSON.stringify(existing.slice(0, 200), null, 2));
        console.log(`[INGEST] New external alert ingested: ${newAlert.id} (${severity} ${type})`);

        // Also persist to PostgreSQL if connected
        if (isDbConnected()) {
            insertThreat({
                title: newAlert.description || `${severity} ${type} Alert`,
                contentSnippet: newAlert.description || '',
                source: newAlert.source,
                source_url: `alert://${newAlert.id}`,
                link: `alert://${newAlert.id}`,
                category: type,
                severity: newAlert.severity,
                pubDate: newAlert.timestamp,
            }).catch(err => console.error('[INGEST] DB persist failed:', err.message));
        }

        // Broadcast to ChatOps if Critical or High
        if (severity === 'Critical' || severity === 'High') {
            broadcastAlert(newAlert).catch(err => console.error('[INGEST] Webhook broadcast failed:', err.message));
        }

        res.status(201).json({ success: true, alertId: newAlert.id, message: 'Alert ingested successfully.' });
    } catch (err) {
        console.error('[INGEST] Failed to save alert.');
        res.status(500).json({ error: 'Failed to persist alert.' });
    }
});

// Debug endpoint - shows file paths (DEVELOPMENT ONLY — never expose in production)
if (isDev) {
    app.get('/api/debug/paths', (req, res) => {
        const listDir = (dir) => {
            try {
                return fs.readdirSync(dir).map(f => {
                    const fullPath = path.join(dir, f);
                    const stat = fs.statSync(fullPath);
                    return {
                        name: f,
                        isDir: stat.isDirectory(),
                        size: stat.size,
                        children: stat.isDirectory() && f !== 'node_modules' && f !== '.git' ? listDir(fullPath) : undefined
                    };
                });
            } catch (e) {
                return { error: e.message };
            }
        };

        res.json({
            cwd: process.cwd(),
            nodeEnv: process.env.NODE_ENV || 'development',
            distPathFromDirname,
            distPathFromCwd,
            resolvedDistPath,
            fsTree: {
                dirname: listDir(__dirname),
                cwd: listDir(process.cwd()),
                distInCwd: listDir(path.join(process.cwd(), 'dist')),
                distInRoot: listDir(path.join(process.cwd(), '..', 'dist')),
            }
        });
    });
}


// Manual Email Trigger (protected with auth, strict rate limit, recipient authorization)
// P0 item 1: use constant-time key comparison, check NOTIFICATION_API_KEY first
app.post('/api/notifications/send', strictLimiter, async (req, res) => {
    try {
        // Try NOTIFICATION_API_KEY first, fall back to INGEST_API_KEY
        const envKey = process.env.NOTIFICATION_API_KEY ? 'NOTIFICATION_API_KEY' : 'INGEST_API_KEY';
        const authResult = requireApiKey(req, envKey);
        if (!authResult.ok) {
            if (authResult.status !== 503) {
                console.warn(`[NOTIFICATIONS] Unauthorized notification dispatch attempt from ${req.ip}`);
            }
            return res.status(authResult.status).json({ error: authResult.error });
        }

        const { email } = req.body || {};
        const defaultEmail = process.env.DEFAULT_EMAIL;
        const targetEmail = email || defaultEmail;

        if (!targetEmail) {
            return res.status(400).json({ error: 'No email address provided and DEFAULT_EMAIL is not configured.' });
        }

        // Validate recipient against allowed domain or address
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(targetEmail)) {
            return res.status(400).json({ error: 'Invalid email address format.' });
        }

        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
        if (allowedDomain && !targetEmail.endsWith(`@${allowedDomain}`)) {
            return res.status(403).json({ error: 'Target email recipient is not in the authorized domain list.' });
        }

        // In test or non-production environment without SMTP, log and mock success
        if (process.env.NODE_ENV === 'test' || !process.env.SMTP_HOST) {
            console.log(`[EMAIL AUDIT] Mock dispatch to ${targetEmail} (Audit logged)`);
            return res.json({ success: true, message: 'Report dispatch accepted (mock delivery in test/dev).' });
        }

        console.log(`[EMAIL AUDIT] Sending report to ${targetEmail}...`);
        const result = await sendPeriodicSummary(targetEmail);

        if (result.success) {
            res.json({ success: true, message: 'Report sent successfully.' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to send email. Try again later.' });
        }
    } catch (err) {
        console.error('[EMAIL ERROR]', err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});


// ==========================================
// SPA FALLBACK (Serves index.html for frontend routing)
// ==========================================
// SPA catch-all — uses Express 5 path-to-regexp v8 wildcard syntax ({*path})
// This requires Express >= 5.x on all deployment targets (Railway, Azure, etc.)
app.get('{*path}', (req, res, next) => {
    // If request starts with /api, pass to 404 / error handler
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
    }
    res.sendFile(path.join(resolvedDistPath, 'index.html'));
});

// ==========================================
// GLOBAL ERROR HANDLER (prevents stack trace leaks)
// ==========================================
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    // CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Origin not allowed.' });
    }

    // JSON parse errors
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request payload too large.' });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Malformed JSON in request body.' });
    }

    // Generic error (never leak stack traces in production)
    res.status(err.status || 500).json({
        error: isDev ? err.message : 'Internal server error.'
    });
});

// Second /api/health definition intentionally removed — the one above at line 167 is canonical.
// P0 item 9: Never expose internal config (databaseConnected, environment) in /api/health.

// ==========================================
// START SERVER (Only if direct CLI execution, not serverless or tests)
// ==========================================
// P0 item 22: Use NODE_ENV==='test' explicitly, not fragile execArgv check.
// Treat unset NODE_ENV as production (isDev already reflects this).
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isTestMode = process.env.NODE_ENV === 'test';
const isDirectEntry = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server.mjs'));

/**
 * Exported start() function for programmatic startup (e.g., integration tests).
 * Avoids the fragile isDirectEntry check and allows a clean shutdown handle.
 */
export function start(port = PORT) {
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`\n🔒 SOC Server running on http://localhost:${port}`);
            console.log(`   Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
            console.log(`   CORS Origins: ${allowedOrigins.join(', ')}`);
            console.log(`   Rate Limit: 500 req/15min (API), 10 req/15min (Email)\n`);

            // Initial data fetch + MITRE mapping + classification backfill
            if (!sharedStorageRequired()) fetchAndProcessNews().then(news => {
                if (news?.length) processNewsForMitre(news);
                try { backfillClassification(); } catch (e) {
                    console.warn('[CLASSIFICATION] Backfill warning:', e.message);
                }
            }).catch(err => console.error('[STARTUP] Initial news fetch failed:', err.message));

            // Schedule email every 3 hours
            const reportEmail = process.env.DEFAULT_EMAIL;
            if (reportEmail) {
                cron.schedule('0 */3 * * *', () => {
                    console.log(`[CRON] Running periodic email report to ${reportEmail}...`);
                    sendPeriodicSummary(reportEmail).catch(err =>
                        console.error('[CRON] Email report failed:', err.message));
                });
            } else {
                console.warn('[CRON] DEFAULT_EMAIL not set — periodic email reports disabled.');
            }

            // Refresh news every 30 minutes + update MITRE heatmap
            if (!sharedStorageRequired()) setInterval(() => {
                fetchAndProcessNews().then(news => {
                    if (news?.length) processNewsForMitre(news);
                }).catch(err => console.error('[REFRESH] News refresh failed:', err.message));
            }, 30 * 60 * 1000);

            resolve(server);
        });
    });
}

if (!isTestMode && !isServerless && isDirectEntry) {
    start(PORT);
}

export default app;
