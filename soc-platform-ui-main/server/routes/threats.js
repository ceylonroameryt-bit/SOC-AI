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

    // Realistic external IPs from threat intel ranges (never private RFC1918)
    const externalIPs = [
        '45.142.212.100', '185.220.101.47', '194.165.16.11', '77.91.100.255',
        '91.92.240.110', '141.98.10.204', '103.75.201.2', '5.188.206.14',
        '185.243.96.10', '89.187.191.12', '62.210.103.244', '144.172.73.15'
    ];

    const descriptions = {
        Ransomware: [
            'LockBit 3.0 affiliate campaign detected targeting healthcare sector. Encryption payload observed via phishing lure.',
            'BlackCat/ALPHV ransomware variant propagating via unpatched VPN appliances. Immediate patching required.',
        ],
        Phishing: [
            'Large-scale credential phishing campaign impersonating Microsoft 365 login. Targeting corporate email users.',
            'Quishing (QR code phishing) campaign targeting mobile users with fake DocuSign requests.',
        ],
        Malware: [
            'Emotet botnet loader detected in email attachments. Payload drops IcedID and Cobalt Strike beacons.',
            'Lumma Stealer infostealer distributed via malvertising on search engines. Targets browser credentials and crypto wallets.',
        ],
        Botnet: [
            'Mirai variant performing DDoS amplification attacks. C2 infrastructure tied to known bulletproof hosting.',
            'Qakbot botnet resurging with new persistence mechanism exploiting scheduled tasks.',
        ],
        'Dark Web Leak': [
            'Credential dump detected on underground forum matching corporate domain patterns. Verify user accounts immediately.',
            'Corporate VPN credentials listed for sale on RAMP forum. Source appears to be infostealer log.',
        ],
        'Zero-Day': [
            'Active exploitation of unpatched vulnerability in popular network appliance. Vendor patch not yet available.',
            'Zero-day in browser rendering engine being exploited in watering hole campaign against defense contractors.',
        ],
    };

    const today = new Date();
    const count = 3 + Math.floor(Math.random() * 5); // 3-7 new threats

    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const isDarkWeb = type === 'Dark Web Leak';
        const severity = isDarkWeb ? 'Critical' : severities[Math.floor(Math.random() * severities.length)];
        const descList = descriptions[type] || [`Active ${type} campaign detected via network sensors.`];
        const description = descList[Math.floor(Math.random() * descList.length)];

        const ip = externalIPs[Math.floor(Math.random() * externalIPs.length)];

        threats.push({
            id: `TRT-${today.getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            type,
            severity,
            source: isDarkWeb ? 'Onion Forum Monitor' : sources[Math.floor(Math.random() * sources.length)],
            description,
            ioc: {
                md5: Math.random() > 0.5 ? '5e884898da28047151d0e56f8dc62927' : undefined,
                sha256: Math.random() > 0.5 ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : undefined,
                ip_addresses: [ip],
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
