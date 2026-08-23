import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/threats.json');

const router = express.Router();

// Helper to load threats
const loadThreats = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
};

// Helper to save threats
const saveThreats = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const generateDailyThreats = () => {
    const threats = [];
    const types = ['Malware', 'Ransomware', 'Phishing', 'Botnet', 'Dark Web Leak', 'Zero-Day'];
    const severities = ['Critical', 'High', 'Medium', 'Low'];
    const sources = ['Dark Web Monitor', 'HoneyPot Network', 'Threat Intel Feed', 'Internal SOC'];

    const today = new Date();
    // Use simple random generation for "today's" new batch
    const count = 3 + Math.floor(Math.random() * 5); // 3-7 new threats

    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isDarkWeb = type === 'Dark Web Leak';
        const severity = isDarkWeb ? 'Critical' : severities[Math.floor(Math.random() * severities.length)];

        threats.push({
            id: `TRT-${today.getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            type: type,
            severity: severity,
            source: isDarkWeb ? 'Onion Forum Monitor' : sources[Math.floor(Math.random() * sources.length)],
            description: isDarkWeb
                ? `Credential dump detected on underground forum matching corporate domain patterns. Verify user accounts immediately.`
                : `Active ${type} campaign detected via network sensors. IOCs indicate targeting financial sector.`,
            ioc: {
                md5: Math.random() > 0.5 ? '5e884898da28047151d0e56f8dc62927' : undefined,
                sha256: Math.random() > 0.5 ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : undefined,
                ip_addresses: [`192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`],
                domains: isDarkWeb ? ['hidden-service.onion'] : [`malicious-${Math.floor(Math.random() * 1000)}.com`]
            },
            timestamp: new Date().toISOString()
        });
    }
    return threats;
};

router.get('/', (req, res) => {
    let allThreats = loadThreats();
    const todayStr = new Date().toDateString();

    // Check if we have threats for today
    const hasToday = allThreats.some(t => new Date(t.timestamp).toDateString() === todayStr);

    if (!hasToday) {
        console.log('Generating new daily threats...');
        const newThreats = generateDailyThreats();
        allThreats = [...newThreats, ...allThreats];

        // Keep file size manageable (last 100 items)
        if (allThreats.length > 100) {
            allThreats = allThreats.slice(0, 100);
        }

        saveThreats(allThreats);
    }

    res.json(allThreats);
});

router.get('/:id', (req, res) => {
    const threats = loadThreats();
    const threat = threats.find(t => t.id === req.params.id);
    if (threat) {
        res.json(threat);
    } else {
        res.status(404).json({ message: 'Threat not found' });
    }
});

export default router;
