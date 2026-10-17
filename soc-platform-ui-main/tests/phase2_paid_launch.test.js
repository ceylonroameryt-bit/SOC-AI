import test from 'node:test';
import assert from 'node:assert/strict';
import { hasFeatureAccess, PLAN_TIERS } from '../server/services/billing/planFeatures.js';
import { PaddleBillingProvider } from '../server/services/billing/paddleBilling.js';
import { getClusterSummary, validateClusterSummary } from '../server/services/aiClusterService.js';
import { createCase, getSlaStatus, calculateSlaDueAt, CASE_PRIORITIES } from '../server/services/caseService.js';
import { exportToStix21 } from '../server/services/stixExporter.js';

test('Phase 2 Paid Launch Verification Suite', async (t) => {
    // 1. Plan Feature Gating
    await t.test('1. Free plan is denied paid features (TQL, cases, AI summaries, Teams/Slack)', () => {
        assert.equal(hasFeatureAccess(PLAN_TIERS.FREE, 'tqlExplorer'), false);
        assert.equal(hasFeatureAccess(PLAN_TIERS.FREE, 'caseManagement'), false);
        assert.equal(hasFeatureAccess(PLAN_TIERS.FREE, 'aiSummaries'), false);
        assert.equal(hasFeatureAccess(PLAN_TIERS.FREE, 'teamsSlackAlerts'), false);
        // BYOK is allowed
        assert.equal(hasFeatureAccess(PLAN_TIERS.FREE, 'byokReputation'), true);
    });

    await t.test('2. Pro plan unlocks TQL, AI summaries, risk scoring, but not Teams/Cases', () => {
        assert.equal(hasFeatureAccess(PLAN_TIERS.PRO, 'tqlExplorer'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.PRO, 'aiSummaries'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.PRO, 'riskScoring'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.PRO, 'caseManagement'), false);
        assert.equal(hasFeatureAccess(PLAN_TIERS.PRO, 'teamsSlackAlerts'), false);
    });

    await t.test('3. Team plan unlocks Cases, SLAs, Teams/Slack, and STIX export', () => {
        assert.equal(hasFeatureAccess(PLAN_TIERS.TEAM, 'caseManagement'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.TEAM, 'slaTimers'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.TEAM, 'teamsSlackAlerts'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.TEAM, 'stixMispExport'), true);
        assert.equal(hasFeatureAccess(PLAN_TIERS.TEAM, 'multiTenantMssp'), false);
    });

    // 2. Paddle Billing Provider
    await t.test('4. Paddle billing processes subscription webhook events cleanly', () => {
        const provider = new PaddleBillingProvider({ isSandbox: true });
        const mockEvent = {
            event_type: 'subscription.created',
            data: {
                id: 'sub_12345',
                customer_id: 'ctm_6789',
                status: 'active',
                currency_code: 'GBP',
                custom_data: { org_id: 'org_acme', plan: 'team' },
                items: [{ quantity: 5 }]
            }
        };
        const record = provider.processWebhookEvent(mockEvent);
        assert.equal(record.subscriptionId, 'sub_12345');
        assert.equal(record.orgId, 'org_acme');
        assert.equal(record.plan, 'team');
        assert.equal(record.seatsCount, 5);
        assert.equal(record.currency, 'GBP');
    });

    // 3. AI Cluster Summarisation Guardrails
    await t.test('5. AI cluster summarisation requires article citations on every claim', () => {
        const validIds = new Set(['art-1', 'art-2']);
        
        // Invalid: missing citations
        const badSummary = {
            what: { text: 'Bad claim', citations: [] },
            who_affected: { text: 'All', citations: ['art-1'] },
            do_now: { text: 'Patch', citations: ['art-1'] }
        };
        const res = validateClusterSummary(badSummary, validIds);
        assert.equal(res.isValid, false);
        assert.ok(res.error?.includes('Guardrail violation'));

        // Valid: all fields cite verified articles
        const goodSummary = {
            what: { text: 'Verified claim', citations: ['art-1'] },
            who_affected: { text: 'Affected users', citations: ['art-2'] },
            do_now: { text: 'Apply patch', citations: ['art-1'] }
        };
        const goodRes = validateClusterSummary(goodSummary, validIds);
        assert.equal(goodRes.isValid, true);
    });

    await t.test('6. getClusterSummary caches results per cluster and carries AI badge', async () => {
        const cluster = {
            id: 'cluster-test-01',
            title: 'Critical Fortinet Authentication Bypass',
            articles: [
                { id: 'art-fgt-1', title: 'Fortinet Advisory FG-IR-24-01', source: 'Fortinet PSIRT' },
                { id: 'art-fgt-2', title: 'CISA KEV Addition', source: 'CISA' }
            ],
            cves: ['CVE-2024-21762'],
            products: ['FortiOS']
        };

        const result1 = await getClusterSummary(cluster);
        assert.equal(result1.isAiGenerated, true);
        assert.equal(result1.badge, 'AI');
        assert.ok(result1.summary.what.citations.length > 0);
        assert.ok(result1.summary.do_now.text.includes('CVE-2024-21762'));

        // Second call should return cached object instance
        const result2 = await getClusterSummary(cluster);
        assert.equal(result1.cachedAt, result2.cachedAt);
    });

    // 4. Case Management & SLAs
    await t.test('7. Case creation assigns P1 SLA (30m) and logs initial evidence event', () => {
        const c = createCase({
            title: 'Active Exploit Campaign on FortiOS',
            priority: 'P1',
            owner: 'Analyst Sarah'
        });

        assert.ok(c.id.startsWith('TL-'));
        assert.equal(c.priority, 'P1');
        assert.equal(c.stage, 'new');
        assert.equal(c.tasks.length, 3);
        assert.equal(c.evidence.length, 1);
        assert.ok(c.evidence[0].event.includes('opened'));

        // Check SLA status
        const sla = getSlaStatus(c.slaDueAt);
        assert.equal(sla.isBreached, false);
        assert.ok(sla.label.includes('remaining'));
    });

    // 5. STIX 2.1 Export
    await t.test('8. STIX 2.1 export generates valid OASIS bundle with indicators and vulnerabilities', () => {
        const bundle = exportToStix21(
            { id: 'cl-fortinet', title: 'Fortinet Campaign', cves: ['CVE-2024-21762'] },
            [{ type: 'IPv4', value: '198.51.100.45' }],
            [{ id: 'T1190', name: 'Exploit Public-Facing Application' }]
        );

        assert.equal(bundle.type, 'bundle');
        assert.ok(bundle.id.startsWith('bundle--'));
        assert.ok(bundle.objects.length >= 4);

        const types = bundle.objects.map(o => o.type);
        assert.ok(types.includes('identity'));
        assert.ok(types.includes('vulnerability'));
        assert.ok(types.includes('indicator'));
        assert.ok(types.includes('attack-pattern'));
        assert.ok(types.includes('report'));

        const indicator = bundle.objects.find(o => o.type === 'indicator');
        assert.equal(indicator.pattern, "[ipv4-addr:value = '198.51.100.45']");
    });
});
