/**
 * planFeatures.js — Server-Side Plan Feature Gating for TacticLens
 *
 * Implements CLAUDE.md §13 subscription tiers and feature flags:
 * - Free: £0 (1,000+ sources feed, severity/ATT&CK filters, 7-day history, BYOK)
 * - Pro: £19/user/mo (+ TQL Explorer, full history, stack matching & risk score, AI summaries, email alerts, CSV)
 * - Team: £59/user/mo, min 3 (+ Cases/SLA, ATT&CK coverage/gaps, Teams/Slack/webhook, STIX/MISP/OpenCTI, hunts, weekly brief)
 * - MSSP: Custom (+ multi-tenant, per-client stacks/SLAs, white-label reports, API, SSO, audit log)
 *
 * RULE: Plan features are checked strictly ON THE SERVER, never only in the UI.
 */

export const PLAN_TIERS = {
    FREE: 'free',
    PRO: 'pro',
    TEAM: 'team',
    MSSP: 'mssp'
};

export const PLAN_PRICING = {
    [PLAN_TIERS.FREE]: { priceMonthly: 0, priceAnnual: 0, minSeats: 1 },
    [PLAN_TIERS.PRO]: { priceMonthly: 19, priceAnnual: 190, minSeats: 1 }, // 2 months free on annual
    [PLAN_TIERS.TEAM]: { priceMonthly: 59, priceAnnual: 590, minSeats: 3 },
    [PLAN_TIERS.MSSP]: { priceMonthly: null, priceAnnual: null, minSeats: 10 }
};

export const PLAN_FEATURE_MAP = {
    [PLAN_TIERS.FREE]: {
        maxHistoryDays: 7,
        sourcesAccess: 1000,
        tqlExplorer: false,
        stackMatching: false,
        riskScoring: false,
        aiSummaries: false,
        emailAlerts: false,
        teamsSlackAlerts: false,
        webhookAlerts: false,
        caseManagement: false,
        slaTimers: false,
        attAndCkCoverageGaps: false,
        stixMispExport: false,
        weeklyBrief: false,
        byokReputation: true,
        multiTenantMssp: false,
        publicApi: false,
        sso: false
    },
    [PLAN_TIERS.PRO]: {
        maxHistoryDays: 365,
        sourcesAccess: 1000,
        tqlExplorer: true,
        stackMatching: true,
        riskScoring: true,
        aiSummaries: true,
        emailAlerts: true,
        teamsSlackAlerts: false,
        webhookAlerts: false,
        caseManagement: false,
        slaTimers: false,
        attAndCkCoverageGaps: false,
        stixMispExport: false,
        weeklyBrief: false,
        byokReputation: true,
        multiTenantMssp: false,
        publicApi: false,
        sso: false
    },
    [PLAN_TIERS.TEAM]: {
        maxHistoryDays: 730,
        sourcesAccess: 1000,
        tqlExplorer: true,
        stackMatching: true,
        riskScoring: true,
        aiSummaries: true,
        emailAlerts: true,
        teamsSlackAlerts: true,
        webhookAlerts: true,
        caseManagement: true,
        slaTimers: true,
        attAndCkCoverageGaps: true,
        stixMispExport: true,
        weeklyBrief: true,
        byokReputation: true,
        multiTenantMssp: false,
        publicApi: false,
        sso: false
    },
    [PLAN_TIERS.MSSP]: {
        maxHistoryDays: 1825, // 5 years
        sourcesAccess: 1000,
        tqlExplorer: true,
        stackMatching: true,
        riskScoring: true,
        aiSummaries: true,
        emailAlerts: true,
        teamsSlackAlerts: true,
        webhookAlerts: true,
        caseManagement: true,
        slaTimers: true,
        attAndCkCoverageGaps: true,
        stixMispExport: true,
        weeklyBrief: true,
        byokReputation: true,
        multiTenantMssp: true,
        publicApi: true,
        sso: true
    }
};

/**
 * Checks whether an organization with a given plan is permitted to access a specific feature.
 *
 * @param {string} plan - The organization's subscription plan tier ('free', 'pro', 'team', 'mssp')
 * @param {string} feature - The feature key to test
 * @returns {boolean} True if permitted, false otherwise
 */
export function hasFeatureAccess(plan = 'free', feature) {
    const normalizedPlan = (plan || 'free').toLowerCase();
    const planConfig = PLAN_FEATURE_MAP[normalizedPlan] || PLAN_FEATURE_MAP[PLAN_TIERS.FREE];
    return Boolean(planConfig[feature]);
}

/**
 * Express middleware that enforces a specific plan feature before allowing route execution.
 * Responds with HTTP 403 Forbidden with an upgrade payload if the tenant's plan lacks access.
 *
 * @param {string} feature
 */
export function requirePlanFeature(feature) {
    return (req, res, next) => {
        const tenantPlan = req.org?.plan || req.headers['x-tenant-plan'] || 'free';
        if (!hasFeatureAccess(tenantPlan, feature)) {
            return res.status(403).json({
                error: 'PLAN_UPGRADE_REQUIRED',
                message: `Feature '${feature}' requires an upgraded subscription plan. Current plan: ${tenantPlan}.`,
                feature,
                currentPlan: tenantPlan,
                upgradeUrl: 'https://tacticlens.co.uk/pricing'
            });
        }
        next();
    };
}
