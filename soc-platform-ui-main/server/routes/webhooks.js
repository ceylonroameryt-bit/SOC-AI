import express from 'express';
import { broadcastAlert, getWebhookStatus } from '../services/webhookService.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for webhook test.' }
});

// GET /api/webhooks/config — Returns configured webhook platforms (masked URLs)
router.get('/config', (req, res) => {
    res.json(getWebhookStatus());
});

// POST /api/webhooks/test — Sends a test alert to all configured platforms (auth required)
// P0 item 3: require API key. P1 item 14: return real error when no webhooks configured.
router.post('/test', webhookLimiter, requireApiKeyMiddleware('INGEST_API_KEY'), async (req, res) => {
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
                error: 'No webhooks are configured. Set SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or DISCORD_WEBHOOK_URL.',
                results: {}
            });
        }

        const results = await broadcastAlert(testThreat);
        const anySuccess = Object.values(results).some(r => r.success);

        res.json({
            success: anySuccess,
            message: anySuccess ? 'Test alert sent to configured webhooks.' : 'Webhook delivery failed — check webhook URLs and connectivity.',
            results,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Webhook test failed.', details: err.message });
    }
});

export default router;
