import express from 'express';
import { broadcastAlert, getWebhookStatus } from '../services/webhookService.js';

const router = express.Router();

// GET /api/webhooks/config — Returns configured webhook platforms (masked URLs)
router.get('/config', (req, res) => {
    res.json(getWebhookStatus());
});

// POST /api/webhooks/test — Sends a test alert to all configured platforms
router.post('/test', async (req, res) => {
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
        const results = await broadcastAlert(testThreat);
        const anySuccess = Object.values(results).some(r => r.success);

        res.json({
            success: anySuccess,
            message: anySuccess ? 'Test alert sent to configured webhooks.' : 'No webhooks are configured.',
            results,
        });
    } catch (err) {
        res.status(500).json({ error: 'Webhook test failed.', details: err.message });
    }
});

export default router;
