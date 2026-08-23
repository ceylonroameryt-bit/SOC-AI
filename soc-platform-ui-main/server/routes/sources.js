import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCES_FILE = path.join(__dirname, '../data/sources.json');

// Get all configured sources
router.get('/', (req, res) => {
    try {
        if (fs.existsSync(SOURCES_FILE)) {
            const data = fs.readFileSync(SOURCES_FILE, 'utf8');
            const sources = JSON.parse(data);
            res.json(sources);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error reading sources:', error);
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
});

// Get stats on sources (counts by category)
router.get('/stats', (req, res) => {
    try {
        if (fs.existsSync(SOURCES_FILE)) {
            const data = fs.readFileSync(SOURCES_FILE, 'utf8');
            const sources = JSON.parse(data);

            const stats = sources.reduce((acc, source) => {
                acc[source.category] = (acc[source.category] || 0) + 1;
                return acc;
            }, {});

            res.json({
                total: sources.length,
                categories: stats
            });
        } else {
            res.json({ total: 0, categories: {} });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch source stats' });
    }
});

export default router;
