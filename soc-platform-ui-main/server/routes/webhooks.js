import express from 'express';
import { broadcastAlert, getWebhookStatus } from '../services/webhookService.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

import { requireApiKey } from '../utils/auth.js';

const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded for webhook test.'
        });
    }
});

// GET /api/webhooks/config — Returns configured webhook platforms (masked URLs)
router.get('/config', (req, res) => {
    res.json(getWebhookStatus());
});

// POST /api/webhooks/test — Sends a test alert to all configured platforms (auth required)
// Phase 10: structured response codes (TEST_SUCCESSFUL, NO_WEBHOOK_CONFIGURED, AUTH_REQUIRED, DELIVERY_FAILED, RATE_LIMITED)
router.post('/test', webhookLimiter, async (req, res) => {
    // Check API Key authentication
    const authResult = requireApiKey(req, 'INGEST_API_KEY');
    if (!authResult.ok) {
        return res.status(authResult.status || 401).json({
            success: false,
            code: 'AUTH_REQUIRED',
            message: 'Authentication required. Webhook test dispatch requires valid administrative credentials.'
        });
    }

    const testThreat = {
        id: 'TEST-0001',
        type: 'Test Alert',
        severity: 'High',
        source: 'NO ENTRY SOC Platform',
        description: '✅ This is a test alert from the NO ENTRY SOC webhook system. If you received this, your webhook is correctly configured!',
        ioc: {
            ip_addresses: ['198.51.100.1'],
            domains: ['test-malicious.example.com'],
        },
        timestamp: new Date().toISOString(),
    };

    try {
        const status = getWebhookStatus();
        const hasAnyConfigured = Object.values(status).some(v => v && v.configured);
        if (!hasAnyConfigured) {
            return res.status(503).json({
                success: false,
                code: 'NO_WEBHOOK_CONFIGURED',
                message: 'No webhook configured. Set SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or DISCORD_WEBHOOK_URL.',
                results: {}
            });
        }

        const results = await broadcastAlert(testThreat);
        const anySuccess = Object.values(results).some(r => r.success);

        if (!anySuccess) {
            return res.status(502).json({
                success: false,
                code: 'DELIVERY_FAILED',
                message: 'Webhook delivery failed — check webhook URLs and connectivity.',
                results
            });
        }

        res.json({
            success: true,
            code: 'TEST_SUCCESSFUL',
            message: 'Test alert sent successfully to configured webhooks.',
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Webhook test failed.', details: err.message });
    }
});

export default router;
