import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSigmaRule, generateQueryBundle } from '../services/siemQueryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const RULES_DIR  = path.join(__dirname, '../data/rules');

const router = express.Router();

// Caches with mtime-based invalidation — avoids reparsing on every request
let sigmaCache = { rules: null, mtime: 0 };
let yaraCache  = { rules: null, mtime: 0 };

// Parse the bundled YAML Sigma rules into individual objects
const parseSigmaRules = () => {
    try {
        const filePath = path.join(RULES_DIR, 'sigma_rules.yml');
        const mtime = fs.statSync(filePath).mtimeMs;
        if (sigmaCache.rules && sigmaCache.mtime === mtime) return sigmaCache.rules;

        const raw = fs.readFileSync(filePath, 'utf8');
        const blocks = raw.split(/^---$/m).map(b => b.trim()).filter(Boolean);

        const rules = blocks.map((block, idx) => {
            const getField = (field) => {
                const match = block.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
                return match ? match[1].trim() : null;
            };
            const getTags = () => {
                const tagsMatch = block.match(/^tags:\s*\n((?:\s+- .+\n?)+)/m);
                if (!tagsMatch) return [];
                return tagsMatch[1].match(/- (.+)/g)?.map(t => t.replace('- ', '').trim()) || [];
            };

            const ruleIdField = getField('id');
            const titleField = getField('title');
            // Use stable ID: prefer the rule's own id field, else sanitised title, else index
            const stableId = ruleIdField || (titleField ? titleField.replace(/\s+/g, '_').toLowerCase() : `sigma_${idx + 1}`);

            return {
                id: idx + 1,   // numeric index for backwards-compat API
                stableId,      // stable identifier unaffected by file order changes
                ruleId: ruleIdField,
                title: titleField,
                description: getField('description'),
                status: getField('status'),
                level: getField('level'),
                date: getField('date'),
                author: getField('author'),
                tags: getTags(),
                platform: block.includes('product: windows') ? 'Windows' : block.includes('category: network') ? 'Network' : 'Cross-Platform',
                raw: block,
            };
        });

        sigmaCache = { rules, mtime };
        return rules;
    } catch (err) {
        console.error('[RULES] Failed to parse Sigma rules:', err.message);
        return sigmaCache.rules || []; // return stale cache on error if available
    }
};

// Parse the YARA rules
const parseYARARules = () => {
    try {
        const filePath = path.join(RULES_DIR, 'yara_rules.yar');
        const mtime = fs.statSync(filePath).mtimeMs;
        if (yaraCache.rules && yaraCache.mtime === mtime) return yaraCache.rules;

        const raw = fs.readFileSync(filePath, 'utf8');
        const ruleBlocks = [...raw.matchAll(/rule\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];

        const rules = ruleBlocks.map((match, idx) => {
            const name = match[1];
            const body = match[2];
            const getMeta = (field) => {
                const m = body.match(new RegExp(`${field}\\s*=\\s*"([^"]+)"`, ''));
                return m ? m[1] : null;
            };
            const getTags = () => {
                const tagsRaw = getMeta('tags');
                return tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : [];
            };

            return {
                id: idx + 1,
                stableId: name, // rule name is already a stable identifier
                name,
                description: getMeta('description'),
                author: getMeta('author'),
                date: getMeta('date'),
                severity: getMeta('severity'),
                reference: getMeta('reference'),
                mitreTechnique: getMeta('mitre_attack'),
                tags: getTags(),
                platform: 'Cross-Platform',
                raw: `rule ${name} {${body}\n}`,
            };
        });

        yaraCache = { rules, mtime };
        return rules;
    } catch (err) {
        console.error('[RULES] Failed to parse YARA rules:', err.message);
        return yaraCache.rules || []; // return stale cache on error if available
    }
};

// GET /api/rules/sigma
router.get('/sigma', (req, res) => {
    const rules = parseSigmaRules();
    const { q, level, platform } = req.query;

    let filtered = rules;
    if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter(r =>
            r.title?.toLowerCase().includes(query) ||
            r.description?.toLowerCase().includes(query) ||
            r.tags.some(t => t.includes(query))
        );
    }
    if (level) filtered = filtered.filter(r => r.level?.toLowerCase() === level.toLowerCase());
    if (platform) filtered = filtered.filter(r => r.platform?.toLowerCase().includes(platform.toLowerCase()));

    res.json({ rules: filtered, total: filtered.length });
});

// GET /api/rules/sigma/:id — Download specific Sigma rule YAML
router.get('/sigma/:id', (req, res) => {
    const rules = parseSigmaRules();
    const idParam = req.params.id;
    const rule = rules.find(r => r.id === parseInt(idParam, 10) || r.stableId === idParam);
    if (!rule) return res.status(404).json({ error: 'Rule not found.' });

    const accept = req.headers.accept || '';
    if (accept.includes('application/yaml') || req.query.download === '1') {
        res.setHeader('Content-Type', 'text/yaml');
        res.setHeader('Content-Disposition', `attachment; filename="${rule.title?.replace(/\s+/g, '_') || 'rule'}.yml"`);
        return res.send(rule.raw);
    }
    res.json(rule);
});

// GET /api/rules/yara
router.get('/yara', (req, res) => {
    const rules = parseYARARules();
    const { q, severity } = req.query;

    let filtered = rules;
    if (q) {
        const query = q.toLowerCase();
        filtered = filtered.filter(r =>
            r.name?.toLowerCase().includes(query) ||
            r.description?.toLowerCase().includes(query) ||
            r.tags.some(t => t.includes(query))
        );
    }
    if (severity) filtered = filtered.filter(r => r.severity?.toLowerCase() === severity.toLowerCase());

    res.json({ rules: filtered, total: filtered.length });
});

// GET /api/rules/yara/:id — Download specific YARA rule
router.get('/yara/:id', (req, res) => {
    const rules = parseYARARules();
    const idParam = req.params.id;
    const rule = rules.find(r => r.id === parseInt(idParam, 10) || r.stableId === idParam);
    if (!rule) return res.status(404).json({ error: 'Rule not found.' });

    if (req.query.download === '1') {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${rule.name}.yar"`);
        return res.send(rule.raw);
    }
    res.json(rule);
});

// POST /api/rules/generate — Generate a Sigma rule for a custom IOC
router.post('/generate', (req, res) => {
    const { ioc, iocType, title, description, severity } = req.body;
    if (!ioc) return res.status(400).json({ error: '"ioc" field is required.' });

    const rule = generateSigmaRule(ioc, iocType || 'auto', { title, description, severity });
    const queries = generateQueryBundle(ioc, iocType || 'auto', { title, description });

    res.json({ rule, queries, generatedAt: new Date().toISOString() });
});

export default router;
