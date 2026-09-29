/**
 * api/index.js — Vercel Serverless Function Bridge
 *
 * Directs all incoming serverless API requests directly to the canonical Express
 * application defined in server/server.js.
 *
 * Ensures 100% parity across local development, CI/CD automated tests,
 * and production Vercel serverless deployments:
 * - /api/explore, /api/explore/meta, /api/explore/article/:id
 * - /api/sources, /api/sources/stats, /api/sources/permissions, /api/sources/runs, /api/sources/refresh
 * - /api/news, /api/categories, /api/mitre, /api/threats, /api/dashboard, /api/health
 */
import app from '../server/server.js';

export default function handler(req, res) {
    return app(req, res);
}
