/**
 * routes/analyst.js
 * Express router for Analyst Workflows & Organization Relevance.
 * Handles record status progression, notes, assignment, and dismissal reason tracking.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { assessRelevance, DEFAULT_ORG_PROFILE } from '../services/relevanceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTIONS_FILE = path.join(__dirname, '../data/analyst_actions.json');

const router = express.Router();

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
 */
router.get('/status', (req, res) => {
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
 */
router.post('/action', (req, res) => {
    const {
        recordId,
        actionType, // 'status_change' | 'note_added' | 'assignee_changed' | 'dismissed'
        value,
        comment,
        analystId = 'analyst-1'
    } = req.body;

    if (!recordId || !actionType) {
        return res.status(400).json({ error: 'recordId and actionType are required' });
    }

    let state = analystStates.get(recordId);
    if (!state) {
        state = {
            recordId,
            status: 'new',
            notes: '',
            assignee: null,
            dismissedReason: null,
            history: []
        };
        analystStates.set(recordId, state);
    }

    const previousValue = state[actionType === 'status_change' ? 'status' : actionType === 'note_added' ? 'notes' : 'assignee'];

    const actionEntry = {
        actionId: `act-${Date.now()}`,
        actionType,
        previousValue,
        newValue: value,
        comment: comment || null,
        analystId,
        timestamp: new Date().toISOString()
    };

    if (actionType === 'status_change') {
        state.status = value;
    } else if (actionType === 'note_added') {
        state.notes = value;
    } else if (actionType === 'assignee_changed') {
        state.assignee = value;
    } else if (actionType === 'dismissed') {
        state.status = 'closed';
        state.dismissedReason = value || 'Not applicable to current organizational threat model';
    }

    state.updatedAt = new Date().toISOString();
    state.history.unshift(actionEntry);

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
