/**
 * cases.js — Incident Cases & SLA Management API
 *
 * Implements CLAUDE.md §11:
 * - List cases with computed live SLA statuses
 * - Create new cases (manual or auto-P1 from relevance engine)
 * - Update workflow stage with evidence timeline entry
 */

import express from 'express';
import { createCase, getOrgCases, updateCase, CASE_PRIORITIES } from '../services/caseService.js';

const router = express.Router();

/**
 * GET /api/cases
 * List all active and closed cases for organization
 */
router.get('/', (req, res) => {
    const orgId = req.headers['x-org-id'] || 'default';
    const cases = getOrgCases(orgId);
    res.json({
        total: cases.length,
        priorities: CASE_PRIORITIES,
        cases
    });
});

/**
 * POST /api/cases
 * Open a new incident response case
 */
router.post('/', (req, res) => {
    const orgId = req.headers['x-org-id'] || 'default';
    const { title, priority, clusterId, owner, tasks } = req.body || {};

    if (!title) {
        return res.status(400).json({ error: 'Case title is required' });
    }

    const newCase = createCase({
        orgId,
        title,
        priority: priority || 'P2',
        clusterId,
        owner: owner || 'Unassigned',
        tasks: tasks || []
    });

    res.status(201).json(newCase);
});

/**
 * PATCH /api/cases/:id
 * Advance workflow stage, change assignee, or update tasks
 */
router.patch('/:id', (req, res) => {
    const caseId = req.params.id;
    const updates = req.body || {};

    const updated = updateCase(caseId, updates);
    if (!updated) {
        return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    res.json(updated);
});

export default router;
