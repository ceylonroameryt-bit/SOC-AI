/**
 * routes/threats.js
 * Express router for Threat Ingestion & Alert Records.
 * Strictly separates demo simulation from production data.
 */

import express from 'express';
import { getThreatAlerts, getArticles } from '../db/db.js';

const router = express.Router();

export const DEMO_THREATS = [
    {
        id: 'DEMO-TRT-001',
        type: 'Ransomware',
        severity: 'Critical',
        source: 'Dark Web Monitor',
        description: 'LockBit 3.0 affiliate payload observed attempting volume shadow deletion via vssadmin.',
        ioc: {
            sha256: '8b668eb4f39e31d46b7eb81f8f17a94eeae4c6bc76be86fba65f9733ccfb8efc',
            ip_addresses: ['185.220.101.47'],
            domains: ['lockbit-affiliate-portal.onion']
        },
        firstSeen: '2026-09-01T08:00:00Z',
        lastSeen: '2026-09-18T14:30:00Z',
        ingestedAt: '2026-09-01T08:00:00Z',
        timestamp: '2026-09-18T14:30:00Z',
        isSimulated: true,
        environment: 'demo'
    },
    {
        id: 'DEMO-TRT-002',
        type: 'Zero-Day RCE',
        severity: 'Critical',
        source: 'CISA KEV Feed',
        description: 'Command injection vulnerability in perimeter VPN gateway (CVE-2024-3400) under active scanning.',
        ioc: {
            cves: ['CVE-2024-3400'],
            ip_addresses: ['45.142.212.100']
        },
        firstSeen: '2026-09-10T12:00:00Z',
        lastSeen: '2026-09-19T06:00:00Z',
        ingestedAt: '2026-09-10T12:00:00Z',
        timestamp: '2026-09-19T06:00:00Z',
        isSimulated: true,
        environment: 'demo'
    },
    {
        id: 'DEMO-TRT-003',
        type: 'C2 Beacon',
        severity: 'High',
        source: 'HoneyPot Network',
        description: 'Cobalt Strike malleable C2 HTTP profile observed polling external telemetry sensors.',
        ioc: {
            domains: ['c2-telemetry-beacon.org'],
            ip_addresses: ['194.165.16.11']
        },
        firstSeen: '2026-09-12T04:00:00Z',
        lastSeen: '2026-09-18T22:00:00Z',
        ingestedAt: '2026-09-12T04:00:00Z',
        timestamp: '2026-09-18T22:00:00Z',
        isSimulated: true,
        environment: 'demo'
    }
];

export const loadThreats = () => {
    return [];
};

/**
 * GET /api/threats
 * Returns active operational threats. In production, never injects demo records.
 */
router.get('/', async (req, res) => {
    try {
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        const alerts = await getThreatAlerts(isDemoEnabled);

        let threatsToReturn;
        if (isDemoEnabled) {
            threatsToReturn = [...alerts, ...DEMO_THREATS];
        } else {
            threatsToReturn = alerts.filter(t => !t.isSimulated && t.environment !== 'demo');
        }

        res.json(threatsToReturn);
    } catch (err) {
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to retrieve threats' });
    }
});

/**
 * GET /api/threats/status
 * Returns operational mode and demo status.
 */
router.get('/status', (req, res) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const appMode = process.env.APP_MODE || 'production';
    res.json({
        appMode,
        isDemoEnabled,
        demoRecordCount: isDemoEnabled ? DEMO_THREATS.length : 0,
    });
});

/**
 * GET /api/threats/:id
 * Lookup single threat
 */
router.get('/:id', async (req, res) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const alerts = await getThreatAlerts(isDemoEnabled);
    const all = isDemoEnabled ? [...alerts, ...DEMO_THREATS] : alerts;

    const threat = all.find(t => t.id === req.params.id);
    if (threat) {
        res.json(threat);
    } else {
        res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Threat not found', id: req.params.id });
    }
});

export default router;
