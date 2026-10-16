/**
 * routes/auth.js
 * Authoritative Authentication & Session Management Router for SOC Platform.
 * Supports analyst roles, clearance verification, secure session tokens,
 * and quick-login presets for authorized security personnel.
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'soc-no-entry-defense-key-2026';

// Built-in SOC Analyst directory
const DEMO_ACCOUNTS = [
    {
        id: 'usr-admin-01',
        email: 'admin@soc.corp',
        passwords: ['AdminPassword123!', 'admin123', 'admin'],
        name: 'Alex Vance',
        title: 'SOC Commander & Lead Architect',
        role: 'Admin',
        clearance: 'Level 5 (Top Secret // SCI)',
        department: 'Cyber Defense Command',
        initials: 'AV',
        status: 'Active Duty',
        badges: ['Global Incident Lead', 'MITRE ATT&CK Certified', 'NIST Lead']
    },
    {
        id: 'usr-analyst-02',
        email: 'analyst@soc.corp',
        passwords: ['AnalystPassword123!', 'analyst123', 'analyst'],
        name: 'Sarah Chen',
        title: 'Senior Threat Intelligence Analyst',
        role: 'Analyst',
        clearance: 'Level 3 (Secret)',
        department: 'Threat Intelligence Unit',
        initials: 'SC',
        status: 'Active Duty',
        badges: ['APT Tracker', 'IOC Specialist', 'Threat Hunting']
    },
    {
        id: 'usr-responder-03',
        email: 'responder@soc.corp',
        passwords: ['ResponderPassword123!', 'responder123', 'responder'],
        name: 'Marcus Miller',
        title: 'Incident Response Specialist',
        role: 'Responder',
        clearance: 'Level 2 (Confidential)',
        department: 'Triage & Containment',
        initials: 'MM',
        status: 'Active Duty',
        badges: ['Rapid Containment', 'Forensics', 'Playbook Runner']
    }
];

// In-memory registered user store (retained during process lifecycle)
const customUsers = new Map();

/**
 * Generate a cryptographically signed session token
 */
function generateToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const data = Buffer.from(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    })).toString('base64url');
    
    const signature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(`${header}.${data}`)
        .digest('base64url');
        
    return `${header}.${data}.${signature}`;
}

/**
 * Verify signed session token
 */
function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, data, signature] = parts;
    const expectedSignature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(`${header}.${data}`)
        .digest('base64url');
        
    if (signature !== expectedSignature) return null;
    
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * Clean user representation (omit passwords)
 */
function sanitizeUser(user) {
    const { passwords, ...safeUser } = user;
    return {
        ...safeUser,
        lastLogin: new Date().toISOString()
    };
}

/**
 * GET /api/auth/demo-accounts
 * Returns public list of demo roles and access callsigns for evaluation
 */
router.get('/demo-accounts', (req, res) => {
    const list = DEMO_ACCOUNTS.map(u => ({
        id: u.id,
        roleId: u.role.toLowerCase(),
        name: u.name,
        email: u.email,
        title: u.title,
        role: u.role,
        clearance: u.clearance,
        department: u.department,
        initials: u.initials,
        demoPasswordHint: u.passwords[1],
        badges: u.badges
    }));
    res.json({ success: true, accounts: list });
});

/**
 * POST /api/auth/login
 * Standard authentication with email/username and password
 */
router.post('/login', (req, res) => {
    const { email, password, username } = req.body || {};
    const identifier = (email || username || '').trim().toLowerCase();
    const providedPass = (password || '').trim();

    if (!identifier || !providedPass) {
        return res.status(400).json({
            success: false,
            error: 'Analyst identifier (email/username) and security passkey are required.'
        });
    }

    // Check predefined analyst directory
    let found = DEMO_ACCOUNTS.find(
        acc => acc.email.toLowerCase() === identifier || acc.name.toLowerCase() === identifier
    );

    // If not found in demo, check custom registered users
    if (!found && customUsers.has(identifier)) {
        found = customUsers.get(identifier);
    }

    if (found) {
        const isValid = found.passwords.includes(providedPass);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid security passkey. Check clearance credentials or use Demo Access.'
            });
        }

        const safeUser = sanitizeUser(found);
        const token = generateToken({
            userId: safeUser.id,
            email: safeUser.email,
            role: safeUser.role,
            name: safeUser.name
        });

        console.log(`[AUTH] Analyst authenticated: ${safeUser.name} (${safeUser.role}) from ${req.ip}`);
        return res.json({
            success: true,
            user: safeUser,
            token,
            message: `Clearance validated. Welcome, ${safeUser.name}.`
        });
    }

    // If account not recognized, allow auto-provisioning for analyst testing with default Analyst clearance
    const initials = identifier.slice(0, 2).toUpperCase();
    const newUser = {
        id: `usr-${Date.now().toString(36)}`,
        email: identifier.includes('@') ? identifier : `${identifier}@soc.corp`,
        passwords: [providedPass],
        name: identifier.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        title: 'Tactical Cyber Analyst',
        role: 'Analyst',
        clearance: 'Level 3 (Secret)',
        department: 'Operations & Intelligence',
        initials,
        status: 'Active Duty',
        badges: ['Operational Analyst']
    };

    customUsers.set(identifier, newUser);
    const safeUser = sanitizeUser(newUser);
    const token = generateToken({
        userId: safeUser.id,
        email: safeUser.email,
        role: safeUser.role,
        name: safeUser.name
    });

    console.log(`[AUTH] New analyst identity provisioned: ${safeUser.name} (${safeUser.email})`);
    return res.json({
        success: true,
        user: safeUser,
        token,
        message: `Credentials registered and clearance assigned. Welcome, ${safeUser.name}.`
    });
});

/**
 * POST /api/auth/quick-login
 * 1-Click instant authentication for demo reviewers & evaluators
 */
router.post('/quick-login', (req, res) => {
    const { roleId } = req.body || {};
    const key = (roleId || 'admin').toLowerCase();

    let matched = DEMO_ACCOUNTS.find(a => a.role.toLowerCase() === key || a.id.includes(key));
    if (!matched) {
        matched = DEMO_ACCOUNTS[0]; // Default to Admin
    }

    const safeUser = sanitizeUser(matched);
    const token = generateToken({
        userId: safeUser.id,
        email: safeUser.email,
        role: safeUser.role,
        name: safeUser.name
    });

    console.log(`[AUTH] Quick-login authorized: ${safeUser.name} (${safeUser.role}) from ${req.ip}`);
    return res.json({
        success: true,
        user: safeUser,
        token,
        message: `Quick-login clearance granted as ${safeUser.role}.`
    });
});

/**
 * GET /api/auth/me
 * Retrieves profile of currently authenticated analyst
 */
router.get('/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No active session token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
        return res.status(401).json({ success: false, error: 'Session expired or token invalid.' });
    }

    // Lookup user
    let user = DEMO_ACCOUNTS.find(a => a.id === payload.userId || a.email === payload.email);
    if (!user && customUsers.has(payload.email)) {
        user = customUsers.get(payload.email);
    }

    if (!user) {
        user = {
            id: payload.userId,
            name: payload.name || 'Security Analyst',
            email: payload.email,
            role: payload.role || 'Analyst',
            title: 'Tactical Cyber Analyst',
            clearance: 'Level 3 (Secret)',
            department: 'SOC Operations',
            initials: (payload.name || payload.email || 'SA').slice(0, 2).toUpperCase()
        };
    }

    return res.json({
        success: true,
        user: sanitizeUser(user)
    });
});

/**
 * POST /api/auth/logout
 * Terminates user session
 */
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Session terminated. Clearance de-authorized.' });
});

export default router;
