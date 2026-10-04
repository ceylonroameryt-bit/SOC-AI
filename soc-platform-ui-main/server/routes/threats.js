import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/threats.json');

const router = express.Router();

/**
 * Curated Demo Threat Records (zero-state: no fabricated or simulated threat records)
 */
export const DEMO_THREATS = [];

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

import { getThreatsFromDb, isDbConnected } from '../db/db.js';

router.get('/', async (req, res) => {
    try {
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        let rawThreats = [];

        if (isDbConnected()) {
            try {
                rawThreats = await getThreatsFromDb({ limit: 1000 });
            } catch (err) {
                console.warn('[THREATS] DB query failed, falling back to disk cache:', err.message);
                rawThreats = loadThreats();
            }
        } else {
            rawThreats = loadThreats();
        }

        // Clean any old corrupted or mock random threats with empty sha256
        const validRaw = (rawThreats || []).filter(t => {
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
    } catch (err) {
        console.error('[THREATS ROUTE ERROR]', err);
        res.status(500).json({ error: 'Failed to retrieve threats' });
    }
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

router.get('/:id', async (req, res) => {
    try {
        const isDemoEnabled = process.env.ENABLE_DEMO_DATA === 'true';
        let all = [];

        if (isDbConnected()) {
            try {
                all = await getThreatsFromDb({ limit: 1000 });
            } catch {
                all = loadThreats();
            }
        } else {
            all = loadThreats();
        }

        const candidatePool = isDemoEnabled
            ? [...all, ...DEMO_THREATS]
            : all.filter(t => !t.isSimulated && t.environment !== 'demo');

        const threat = candidatePool.find(t => t.id === req.params.id);
        if (threat) {
            res.json(threat);
        } else {
            res.status(404).json({ error: 'Threat not found', id: req.params.id });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve threat' });
    }
});

export default router;
