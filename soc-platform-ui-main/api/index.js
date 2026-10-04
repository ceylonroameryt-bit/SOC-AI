/**
 * api/index.js — Unified Vercel Serverless Function Entrypoint
 * Re-exports the authoritative Express 5 application from ../server/server.js.
 * Ensures 100% parity between local development, dedicated server, and Vercel Serverless deployments.
 */

export { default } from '../server/server.js';
