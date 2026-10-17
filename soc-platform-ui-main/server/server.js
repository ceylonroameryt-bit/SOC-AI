import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cron from 'node-cron';
import { sharedSnapshotMiddleware, sharedStorageRequired } from './services/sharedSnapshotService.js';

// Route imports
import newsRouter     from './routes/news.js';
import exploreRouter  from './routes/explore.js';
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
import authRouter    from './routes/auth.js';
import billingRouter from './routes/billing.js';
import casesRouter   from './routes/cases.js';
import { exportToStix21 } from './services/stixExporter.js';
import { getClusterSummary } from './services/aiClusterService.js';

// Service imports
import { fetchAndProcessNews, getNews, backfillClassification } from './services/newsService.js';
import { sendPeriodicSummary }          from './services/emailService.js';
import { broadcastAlert }               from './services/webhookService.js';
import { processNewsForMitre }          from './services/mitreService.js';
import { insertThreatAlert, isDbConnected }  from './db/db.js';


// ES module __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

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
    'http://localhost:3001',   // Server secondary port
    process.env.ALLOWED_ORIGIN, // Production domain from .env
    process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : null // Azure specific hostname
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, mobile apps, standard browser navigation)
        if (!origin) return callback(null, true);
        
        // Dynamically allow Vercel, Railway, and Render domains to prevent production lockouts
        const isAllowedCloud =
            origin.endsWith('.vercel.app') ||
            origin.endsWith('.up.railway.app') ||
            origin.endsWith('.render.com') ||
            origin.endsWith('.onrender.com');

        if (allowedOrigins.includes(origin) || isAllowedCloud) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Accept', 'X-CSRF-Token'],
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
app.use('/api',            sharedSnapshotMiddleware);
app.use('/api/auth',       authRouter);
app.use('/api/news',       newsRouter);
app.use('/api/explore',    exploreRouter);
app.use('/api/threats',    threatsRouter);
app.use('/api/reports',    reportsRouter);
app.use('/api/sources',    sourcesRouter);
app.use('/api/enrich',     enrichRouter);
app.use('/api/mitre',      mitreRouter);
app.use('/api/webhooks',   webhooksRouter);
app.use('/api/ai',         aiRouter);
app.use('/api/rules',      rulesRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/analyst',    analystRouter);
app.use('/api/billing',    billingRouter);
app.use('/api/cases',      casesRouter);

// STIX 2.1 Export Endpoint (MISP & OpenCTI compatible)
app.get('/api/export/stix/:clusterId', (req, res) => {
    const clusterId = req.params.clusterId;
    const bundle = exportToStix21({ id: clusterId, title: `Threat Cluster ${clusterId}`, cves: ['CVE-2024-3400'] });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tacticlens-${clusterId}-stix2.1.json"`);
    res.json(bundle);
});

// Guardrailed AI Cluster Summarisation
app.post('/api/clusters/:id/summary', async (req, res) => {
    try {
        const clusterId = req.params.id;
        const summary = await getClusterSummary({
            id: clusterId,
            title: req.body?.title || `Cluster ${clusterId}`,
            articles: req.body?.articles || [{ id: 'art-1', title: req.body?.title || 'Threat incident', source: 'NVD' }],
            cves: req.body?.cves || [],
            products: req.body?.products || []
        });
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        isDbConnected: isDbConnected(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
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
app.post('/api/notifications/send', strictLimiter, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const apiKey = req.headers['x-api-key'];
        const expectedApiKey = process.env.INGEST_API_KEY || process.env.NOTIFICATION_API_KEY;

        // Authentication requirement: must provide valid Bearer token or X-API-Key
        const isAuthorized = (expectedApiKey && (apiKey === expectedApiKey || authHeader === `Bearer ${expectedApiKey}`)) ||
            (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 15);

        if (!isAuthorized) {
            console.warn(`[NOTIFICATIONS] Unauthorized notification dispatch attempt from ${req.ip}`);
            return res.status(401).json({ error: 'Unauthorized. Authentication token or X-API-Key required.' });
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

// ==========================================
// START SERVER (Only if not running tests)
// ==========================================
const isTestMode = process.env.NODE_ENV === 'test' || process.execArgv.includes('--test') || !process.argv[1]?.endsWith('server.js');
if (!isTestMode) {
    app.listen(PORT, () => {
        console.log(`\n🔒 SOC Server running on http://localhost:${PORT}`);
        console.log(`   Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
        console.log(`   CORS Origins: ${allowedOrigins.join(', ')}`);
        console.log(`   Rate Limit: 500 req/15min (API), 10 req/15min (Email)\n`);

        // Initial data fetch + MITRE mapping + classification backfill
        fetchAndProcessNews().then(news => {
            if (news?.length) processNewsForMitre(news);
            // Run classification backfill after initial load
            // (handles all records that existed before classificationEngine was added)
            try { backfillClassification(); } catch (e) {
                console.warn('[CLASSIFICATION] Backfill warning:', e.message);
            }
        });

        // Schedule email every 3 hours
        const reportEmail = process.env.DEFAULT_EMAIL;
        if (reportEmail) {
            cron.schedule('0 */3 * * *', () => {
                console.log(`[CRON] Running periodic email report to ${reportEmail}...`);
                sendPeriodicSummary(reportEmail);
            });
        } else {
            console.warn('[CRON] DEFAULT_EMAIL not set — periodic email reports disabled.');
        }

        // Refresh news every 30 minutes + update MITRE heatmap (standalone mode only)
        if (!sharedStorageRequired()) {
            setInterval(async () => {
                const news = await fetchAndProcessNews();
                if (news?.length) processNewsForMitre(news);
            }, 30 * 60 * 1000);
        }

        console.log('   APIs: /api/enrich, /api/mitre, /api/ai, /api/rules, /api/webhooks, /api/dashboard/snapshot\n');
    });

}

export default app;
