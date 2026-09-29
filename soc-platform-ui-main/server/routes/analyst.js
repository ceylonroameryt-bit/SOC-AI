/**
 * routes/analyst.js
 * Express router for Analyst Workflows & Organization Relevance.
 * Handles record status progression, notes, assignment, and dismissal reason tracking.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { assessRelevance, DEFAULT_ORG_PROFILE } from '../services/relevanceEngine.js';
import { requireApiKeyMiddleware } from '../utils/auth.js';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTIONS_FILE = path.join(__dirname, '../data/analyst_actions.json');

const router = express.Router();

// Allowed whitelisted values (P0 item 15)
const ALLOWED_ACTION_TYPES = new Set(['status_change', 'note_added', 'assignee_changed', 'dismissed']);
const ALLOWED_STATUSES = new Set(['new', 'reviewing', 'action_required', 'closed']);
const MAX_NOTE_LENGTH = 5000;
const MAX_HISTORY_LENGTH = 100;

// Rate limiter for mutation endpoints (P0 item 3)
const analystLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many analyst actions. Please slow down.' }
});

// In-memory cache of analyst states: recordId -> { status, notes, assignee, dismissedReason, updatedAt, history: [] }
const analystStates = new Map();

function loadActions() {
    if (fs.existsSync(ACTIONS_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
            for (const [id, state] of Object.entries(raw)) {
                analystStates.set(id, state);
            }
        } catch (err) {
            console.error('[ANALYST ROUTE] Error loading analyst actions:', err.message);
        }
    }
}

function persistActions() {
    try {
        const obj = Object.fromEntries(analystStates.entries());
        fs.writeFileSync(ACTIONS_FILE, JSON.stringify(obj, null, 2));
    } catch (err) {
        console.error('[ANALYST ROUTE] Error saving analyst actions:', err.message);
    }
}

loadActions();

/**
 * GET /api/analyst/status
 * Returns current analyst workflow state across all records.
 * P0 item 3: requires API key.
 */
router.get('/status', requireApiKeyMiddleware('INGEST_API_KEY'), (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json(Object.fromEntries(analystStates.entries()));
});

/**
 * GET /api/analyst/record/:id
 * Returns workflow status and action audit history for a single record.
 */
router.get('/record/:id', (req, res) => {
    const recordId = req.params.id;
    const state = analystStates.get(recordId) || {
        recordId,
        status: 'new', // 'new' | 'reviewing' | 'action_required' | 'closed'
        notes: '',
        assignee: null,
        dismissedReason: null,
        history: []
    };
    res.json(state);
});

/**
 * POST /api/analyst/action
 * Records an analyst action (status change, note added, assignment, dismissal).
 * P0 item 3: rate-limited and auth-required.
 * P0 item 15: whitelisted actionType/status, capped note, UUID action id.
 */
router.post('/action', analystLimiter, requireApiKeyMiddleware('INGEST_API_KEY'), (req, res) => {
    const {
        recordId,
        actionType, // must be one of ALLOWED_ACTION_TYPES
        value,
        comment,
    } = req.body;

    if (!recordId || typeof recordId !== 'string') {
        return res.status(400).json({ error: 'recordId is required and must be a string.' });
    }
    if (!actionType || !ALLOWED_ACTION_TYPES.has(actionType)) {
        return res.status(400).json({
            error: `actionType must be one of: ${[...ALLOWED_ACTION_TYPES].join(', ')}`
        });
    }
    // Cap recordId length
    const safeRecordId = String(recordId).slice(0, 200);

    // Validate note (value for note_added)
    if (actionType === 'note_added') {
        if (value !== undefined && typeof value !== 'string') {
            return res.status(400).json({ error: 'note value must be a string.' });
        }
        if (value && value.length > MAX_NOTE_LENGTH) {
            return res.status(400).json({ error: `Note too long. Max ${MAX_NOTE_LENGTH} characters.` });
        }
    }
    // Validate status value
    if (actionType === 'status_change' && !ALLOWED_STATUSES.has(value)) {
        return res.status(400).json({
            error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`
        });
    }

    let state = analystStates.get(safeRecordId);
    if (!state) {
        state = {
            recordId: safeRecordId,
            status: 'new',
            notes: '',
            assignee: null,
            dismissedReason: null,
            history: []
        };
        analystStates.set(safeRecordId, state);
    }

    const previousValue = state[actionType === 'status_change' ? 'status' : actionType === 'note_added' ? 'notes' : 'assignee'];

    const actionEntry = {
        actionId: crypto.randomUUID(), // P0 item 15: use UUID not timestamp
        actionType,
        previousValue,
        newValue: value,
        comment: (comment && typeof comment === 'string') ? comment.slice(0, 2000) : null,
        // P0 item 15: take analystId from auth header, not from request body
        analystId: req.headers['x-api-key'] ? 'api-key-authenticated' : 'unknown',
        timestamp: new Date().toISOString()
    };

    if (actionType === 'status_change') {
        state.status = value;
    } else if (actionType === 'note_added') {
        state.notes = value ? value.slice(0, MAX_NOTE_LENGTH) : '';
    } else if (actionType === 'assignee_changed') {
        state.assignee = value ? String(value).slice(0, 200) : null;
    } else if (actionType === 'dismissed') {
        state.status = 'closed';
        state.dismissedReason = value ? String(value).slice(0, 500) : 'Not applicable to current organizational threat model';
    }

    state.updatedAt = new Date().toISOString();
    state.history.unshift(actionEntry);
    // P0 item 15: cap history length to prevent unbounded growth
    if (state.history.length > MAX_HISTORY_LENGTH) {
        state.history = state.history.slice(0, MAX_HISTORY_LENGTH);
    }

    persistActions();

    res.json({
        success: true,
        message: `Analyst action ${actionType} recorded successfully`,
        state
    });
});

/**
 * POST /api/analyst/relevance
 * Computes organization relevance for an intelligence item.
 */
router.post('/relevance', (req, res) => {
    const { record, profile } = req.body;
    if (!record) {
        return res.status(400).json({ error: 'record is required' });
    }
    const result = assessRelevance(record, profile || DEFAULT_ORG_PROFILE);
    res.json(result);
});

export default router;
