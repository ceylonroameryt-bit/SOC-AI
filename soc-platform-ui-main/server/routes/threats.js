import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/threats.json');

const router = express.Router();

/**
 * Curated Demo Threat Records (strictly labeled with isSimulated: true and fixed timestamps)
 */
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
        firstSeen: '2026-09-12T09:15:00Z',
        lastSeen: '2026-09-18T20:00:00Z',
        ingestedAt: '2026-09-12T09:15:00Z',
        timestamp: '2026-09-18T20:00:00Z',
        isSimulated: true,
        environment: 'demo'
    }
];

// Helper to load threats from disk
export const loadThreats = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        if (!raw || !raw.trim()) return [];
        return JSON.parse(raw);
    } catch {
        return [];
    }
};

// Helper to save threats
export const saveThreats = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

router.get('/', (req, res) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const rawThreats = loadThreats();

    // Clean any old corrupted or mock random threats with empty sha256
    const validRaw = rawThreats.filter(t => {
        const hash = t.ioc?.sha256;
        return hash !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    });

    let threatsToReturn;
    if (isDemoEnabled) {
        // Return demo threats combined with real threats
        threatsToReturn = [...validRaw.filter(t => !t.isSimulated), ...DEMO_THREATS];
    } else {
        // Production: return ONLY real non-simulated operational threats
        threatsToReturn = validRaw.filter(t => !t.isSimulated && t.environment !== 'demo');
    }

    res.json(threatsToReturn);
});

router.get('/status', (req, res) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const appMode = process.env.APP_MODE || 'production';
    res.json({
        appMode,
        isDemoEnabled,
        demoRecordCount: isDemoEnabled ? DEMO_THREATS.length : 0,
    });
});

router.get('/:id', (req, res) => {
    const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
    const all = isDemoEnabled
        ? [...loadThreats(), ...DEMO_THREATS]
        : loadThreats().filter(t => !t.isSimulated);

    const threat = all.find(t => t.id === req.params.id);
    if (threat) {
        res.json(threat);
    } else {
        res.status(404).json({ error: 'Threat not found', id: req.params.id });
    }
});

export default router;
