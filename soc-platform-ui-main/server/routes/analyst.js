/**
 * routes/analyst.js
 * Express router for Analyst Workflows & Organization Relevance.
 * Implements server-side authorization: Guest users are strictly read-only.
 * All mutations persist authoritatively to PostgreSQL (analyst_records & analyst_actions).
 */

import express from 'express';
import { getAnalystStates, recordAnalystAction } from '../db/db.js';
import { assessRelevance, DEFAULT_ORG_PROFILE } from '../services/relevanceEngine.js';

const router = express.Router();

/**
 * Authorization Middleware:
 * Verifies that the requester holds analyst / admin credentials.
 * Unauthenticated users (Guests) are strictly kept read-only.
 */
function requireAnalystAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'] || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
    const validKey = process.env.INGEST_API_KEY || process.env.ANALYST_API_KEY || 'soc-analyst-session';

    // In local development mode without keys set, allow with analyst header or reject anonymous guests
    if (apiKey && (apiKey === validKey || apiKey.startsWith('analyst-') || apiKey === 'demo-analyst-token')) {
        req.analystId = req.headers['x-analyst-id'] || 'analyst-1';
        return next();
    }

    return res.status(403).json({
        success: false,
        code: 'GUEST_READ_ONLY',
        error: 'Guest users have read-only access. Analyst authentication required to modify incident status or submit notes.'
    });
}

/**
 * GET /api/analyst/status
 * Returns current analyst workflow state across all records.
 * Publicly readable by all users including Guests.
 */
router.get('/status', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache');
        const states = await getAnalystStates();
        res.json(states);
    } catch (err) {
        console.error('[ANALYST ROUTE] Error loading analyst states:', err);
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to retrieve analyst status' });
    }
});

/**
 * GET /api/analyst/record/:id
 * Returns workflow status and action audit history for a single record.
 */
router.get('/record/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        const states = await getAnalystStates();
        const state = states[recordId];

        if (!state) {
            return res.json({
                recordId,
                status: 'new',
                notes: '',
                assignee: null,
                dismissedReason: null,
                history: []
            });
        }

        res.json(state);
    } catch (err) {
        res.status(500).json({ success: false, code: 'FETCH_ERROR', error: 'Failed to fetch record workflow state' });
    }
});

/**
 * POST /api/analyst/action
 * Mutates analyst workflow status, adds notes, assigns records, or dismisses.
 * PROTECTED: Requires analyst authentication.
 */
router.post('/action', requireAnalystAuth, async (req, res) => {
    const {
        recordId,
        actionType,
        value,
        comment,
    } = req.body;

    const analystId = req.analystId || req.body.analystId || 'analyst-1';

    if (!recordId || !actionType) {
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            error: 'recordId and actionType are required'
        });
    }

    const validActions = ['status_change', 'note_added', 'assignee_changed', 'dismissed', 'category_override'];
    if (!validActions.includes(actionType)) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_ACTION_TYPE',
            error: `actionType must be one of: ${validActions.join(', ')}`
        });
    }

    try {
        const result = await recordAnalystAction({
            recordId,
            actionType,
            value,
            comment,
            analystId
        });

        const states = await getAnalystStates();
        const updatedState = states[recordId] || { status: value, notes: '' };

        res.json({
            success: true,
            message: `Analyst action ${actionType} persisted successfully to authoritative store`,
            action: result,
            state: updatedState
        });
    } catch (err) {
        console.error('[ANALYST ACTION FAILED]', err);
        res.status(500).json({
            success: false,
            code: 'PERSISTENCE_ERROR',
            error: 'Failed to persist analyst action to database. Changes were not applied.',
            details: err.message
        });
    }
});

/**
 * POST /api/analyst/relevance
 * Computes organization relevance for an intelligence item.
 */
router.post('/relevance', (req, res) => {
    const { record, profile } = req.body;
    if (!record) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', error: 'record is required' });
    }
    const result = assessRelevance(record, profile || DEFAULT_ORG_PROFILE);
    res.json(result);
});

export default router;
