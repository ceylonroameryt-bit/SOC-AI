/**
 * caseService.js — Incident Case Management and SLA Countdown Engine
 *
 * Implements CLAUDE.md §11 Case Specification:
 * - Priority bands P1–P4 with strict SLA deadlines:
 *   - P1 (Critical, auto-raised when KEV=1 & stack=1 & internet=1): 30m SLA
 *   - P2 (High): 2 hours SLA
 *   - P3 (Medium): 8 hours SLA
 *   - P4 (Low): 24 hours SLA
 * - Stages: new -> triage -> investigating -> contained -> closed
 * - Evidence timeline & response task tracking
 */

export const CASE_PRIORITIES = {
    P1: { code: 'P1', label: 'Critical', slaMinutes: 30, color: '#B42318' },
    P2: { code: 'P2', label: 'High', slaMinutes: 120, color: '#F8CFAE' },
    P3: { code: 'P3', label: 'Medium', slaMinutes: 480, color: '#FBE7A1' },
    P4: { code: 'P4', label: 'Low', slaMinutes: 1440, color: '#D6E6FA' }
};

export const CASE_STAGES = ['new', 'triage', 'investigating', 'contained', 'closed'];

// In-memory case repository for runtime
const casesStore = new Map();

/**
 * Calculates SLA due timestamp based on priority band.
 * @param {string} priority - 'P1' | 'P2' | 'P3' | 'P4'
 * @param {Date} [fromTime]
 * @returns {Date}
 */
export function calculateSlaDueAt(priority = 'P2', fromTime = new Date()) {
    const config = CASE_PRIORITIES[priority] || CASE_PRIORITIES.P3;
    return new Date(fromTime.getTime() + config.slaMinutes * 60 * 1000);
}

/**
 * Computes remaining SLA milliseconds and status.
 * @param {string|Date} slaDueAt
 * @returns {{ remainingMs: number, isBreached: boolean, label: string }}
 */
export function getSlaStatus(slaDueAt) {
    if (!slaDueAt) return { remainingMs: 0, isBreached: false, label: 'No SLA' };

    const due = new Date(slaDueAt).getTime();
    const now = Date.now();
    const diff = due - now;

    if (diff <= 0) {
        const breachedMins = Math.round(Math.abs(diff) / (60 * 1000));
        return {
            remainingMs: diff,
            isBreached: true,
            label: `Breached by ${breachedMins}m`
        };
    }

    const remainingMins = Math.round(diff / (60 * 1000));
    const hours = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    const label = hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;

    return {
        remainingMs: diff,
        isBreached: false,
        label
    };
}

/**
 * Creates a new case (manual or auto-P1 from risk engine).
 */
export function createCase({
    orgId = 'default',
    title,
    priority = 'P2',
    clusterId = null,
    owner = 'Unassigned',
    tasks = []
}) {
    const caseNum = casesStore.size + 1042;
    const caseId = `TL-${caseNum}`;
    const createdAt = new Date().toISOString();
    const slaDueAt = calculateSlaDueAt(priority, new Date()).toISOString();

    const initialTasks = tasks.length > 0 ? tasks : [
        { id: 'task-1', title: 'Verify perimeter telemetry in SIEM/EDR', completed: false },
        { id: 'task-2', title: 'Review affected tech stack product versions', completed: false },
        { id: 'task-3', title: 'Coordinate emergency patch or virtual mitigation', completed: false }
    ];

    const newCase = {
        id: caseId,
        orgId,
        title,
        priority,
        stage: 'new',
        owner,
        clusterId,
        createdAt,
        updatedAt: createdAt,
        slaDueAt,
        tasks: initialTasks,
        evidence: [
            {
                timestamp: createdAt,
                source: 'TacticLens Ingestion Engine',
                event: 'Case opened from threat cluster match',
                by: 'System'
            }
        ],
        notes: []
    };

    casesStore.set(caseId, newCase);
    return newCase;
}

/**
 * Retrieves all cases for an organization with live SLA statuses.
 */
export function getOrgCases(orgId = 'default') {
    return Array.from(casesStore.values())
        .filter(c => c.orgId === orgId)
        .map(c => ({
            ...c,
            sla: getSlaStatus(c.slaDueAt)
        }));
}

/**
 * Updates case workflow stage or owner.
 */
export function updateCase(caseId, updates = {}) {
    const existing = casesStore.get(caseId);
    if (!existing) return null;

    const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    if (updates.stage && updates.stage !== existing.stage) {
        updated.evidence.push({
            timestamp: new Date().toISOString(),
            source: 'Analyst Workflow',
            event: `Stage transition: ${existing.stage} → ${updates.stage}`,
            by: updates.updatedBy || 'Analyst'
        });
    }

    casesStore.set(caseId, updated);
    return updated;
}
