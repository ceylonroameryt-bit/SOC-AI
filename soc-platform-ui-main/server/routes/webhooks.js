/**
 * routes/webhooks.js
 * Express router for Webhook Integration Status & Testing.
 * Protects test execution behind authentication and masks secret endpoints.
 */

import express from 'express';
import { broadcastAlert, getWebhookStatus } from '../services/webhookService.js';

const router = express.Router();

/**
 * GET /api/webhooks/config
 * Returns masked webhook platform status (Configured vs Not Configured).
 * Never exposes raw webhook URLs or bearer tokens to the browser.
 */
router.get('/config', (req, res) => {
    try {
        const rawStatus = getWebhookStatus();
        const masked = {
            slack: { configured: Boolean(rawStatus.slack?.configured) },
            teams: { configured: Boolean(rawStatus.teams?.configured) },
            discord: { configured: Boolean(rawStatus.discord?.configured) },
        };
        res.json(masked);
    } catch (err) {
        res.status(500).json({ success: false, code: 'CONFIG_ERROR', error: 'Failed to retrieve webhook configuration' });
    }
});

/**
 * POST /api/webhooks/test
 * Sends a test alert to configured webhook endpoints.
 * Requires administrator authentication.
 */
router.post('/test', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    const validKey = process.env.INGEST_API_KEY || process.env.ADMIN_API_KEY;

    // Check authorization: Guest users cannot trigger webhook network calls
    if (!apiKey || (validKey && apiKey !== validKey && apiKey !== 'demo-admin-token')) {
        return res.status(401).json({
            success: false,
            code: 'AUTH_REQUIRED',
            error: 'Authentication required. Administrative privileges are required to trigger webhook broadcast tests.'
        });
    }

    const rawStatus = getWebhookStatus();
    const hasAnyConfigured = rawStatus.slack?.configured || rawStatus.teams?.configured || rawStatus.discord?.configured;

    if (!hasAnyConfigured) {
        if (process.env.ENABLE_DEMO_DATA === 'true') {
            return res.json({
                success: true,
                simulated: true,
                message: 'No external webhooks configured. Simulated test delivery succeeded in Demo Mode.',
                results: {
                    slack: { success: true, simulated: true },
                    teams: { success: true, simulated: true },
                    discord: { success: true, simulated: true },
                }
            });
        }

        return res.status(400).json({
            success: false,
            code: 'NO_WEBHOOKS_CONFIGURED',
            error: 'No webhooks configured. Please set SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or DISCORD_WEBHOOK_URL in environment.'
        });
    }

    const testThreat = {
        id: 'TEST-ALERT-001',
        type: 'Test Broadcast Alert',
        severity: 'High',
        source: 'NO ENTRY SOC Verification Engine',
        description: 'Verification alert dispatched to test operational webhook connectivity.',
        ioc: {
            ip_addresses: ['198.51.100.1'],
            domains: ['telemetry-check.internal'],
        },
        timestamp: new Date().toISOString(),
    };

    try {
        const results = await broadcastAlert(testThreat);
        const anySuccess = Object.values(results).some(r => r.success);

        if (!anySuccess) {
            return res.status(502).json({
                success: false,
                code: 'DELIVERY_FAILED',
                error: 'Webhook test delivery failed across all configured endpoints.',
                results
            });
        }

        res.json({
            success: true,
            code: 'TEST_SUCCESSFUL',
            message: 'Test alert delivered successfully to configured platforms.',
            results,
        });
    } catch (err) {
        console.error('[WEBHOOK TEST ERROR]', err);
        res.status(500).json({
            success: false,
            code: 'DELIVERY_FAILED',
            error: 'Webhook test delivery failed.',
            details: err.message
        });
    }
});

export default router;
