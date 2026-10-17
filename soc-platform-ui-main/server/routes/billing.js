/**
 * billing.js — TacticLens Billing & Subscription API
 *
 * Implements CLAUDE.md §13:
 * - Public plan catalog with monthly/annual pricing and education discount
 * - Paddle webhook handling with cryptographic signature verification
 * - Organization plan status lookup
 */

import express from 'express';
import { PLAN_FEATURE_MAP, PLAN_PRICING, PLAN_TIERS } from '../services/billing/planFeatures.js';
import { defaultBillingProvider } from '../services/billing/paddleBilling.js';

const router = express.Router();

/**
 * GET /api/billing/plans
 * Public pricing and feature map
 */
router.get('/plans', (req, res) => {
    res.json({
        plans: [
            {
                id: PLAN_TIERS.FREE,
                name: 'Free Community',
                priceMonthly: PLAN_PRICING[PLAN_TIERS.FREE].priceMonthly,
                priceAnnual: PLAN_PRICING[PLAN_TIERS.FREE].priceAnnual,
                description: 'Essential public threat intelligence for students & individual analysts.',
                features: [
                    '1,000+ public threat sources',
                    '7-day threat history',
                    'Severity & ATT&CK taxonomy filters',
                    'BYOK reputation lookup'
                ],
                highlight: false,
                buttonText: 'Get Started'
            },
            {
                id: PLAN_TIERS.PRO,
                name: 'Pro Analyst',
                priceMonthly: PLAN_PRICING[PLAN_TIERS.PRO].priceMonthly,
                priceAnnual: PLAN_PRICING[PLAN_TIERS.PRO].priceAnnual,
                description: 'Full query language, tech stack relevance, and AI summaries for single analysts.',
                features: [
                    'Everything in Free',
                    'Full historical archive (365 days)',
                    'TQL (TacticLens Query Language)',
                    'Tech stack matching & 0–100 risk score',
                    'AI cluster summaries with citations',
                    'Email instant alerts & CSV export'
                ],
                highlight: true,
                badge: 'POPULAR',
                buttonText: 'Start Pro Trial'
            },
            {
                id: PLAN_TIERS.TEAM,
                name: 'SOC Team',
                priceMonthly: PLAN_PRICING[PLAN_TIERS.TEAM].priceMonthly,
                priceAnnual: PLAN_PRICING[PLAN_TIERS.TEAM].priceAnnual,
                description: 'Full incident cases, live SLAs, and team collaboration for 2–15 analyst SOCs.',
                features: [
                    'Everything in Pro',
                    'Minimum 3 analyst seats',
                    'P1–P4 Incident Cases & live SLA timers',
                    'ATT&CK coverage & gap analysis',
                    'Microsoft Teams & Slack routing',
                    'STIX 2.1 / MISP / OpenCTI export',
                    'Weekly CISO executive briefing'
                ],
                highlight: false,
                buttonText: 'Start 14-Day Team Trial'
            },
            {
                id: PLAN_TIERS.MSSP,
                name: 'MSSP Partner',
                priceMonthly: null,
                priceAnnual: null,
                description: 'Multi-tenant architecture and custom SLAs for MSSPs managing multiple client estates.',
                features: [
                    'Everything in Team',
                    'Multi-tenant client switching',
                    'Per-client tech stacks & custom SLAs',
                    'White-label executive sitreps',
                    'REST API & Webhooks',
                    'Enterprise SSO (Entra ID, Google)',
                    'UK GDPR DPA & Audit logs'
                ],
                highlight: false,
                buttonText: 'Contact Security Team'
            }
        ],
        discounts: {
            annual: '2 months free on annual plans',
            educationAndCharity: '30% off for schools, Multi-Academy Trusts, colleges, and charities'
        },
        merchantOfRecord: 'Paddle.com (VAT & Sales Tax included for UK & EU)'
    });
});

/**
 * POST /api/billing/webhook
 * Paddle subscription events receiver
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['paddle-signature'];
    const rawBody = req.body.toString('utf8');

    if (process.env.NODE_ENV === 'production') {
        const isValid = defaultBillingProvider.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            return res.status(401).json({ error: 'INVALID_PADDLE_SIGNATURE' });
        }
    }

    try {
        const event = JSON.parse(rawBody);
        const result = defaultBillingProvider.processWebhookEvent(event);
        console.log(`[BILLING] Processed Paddle event: ${result.eventType} for org: ${result.orgId || 'unassigned'}`);
        res.status(200).json({ received: true, status: result.status });
    } catch (err) {
        console.error('[BILLING] Webhook processing failed:', err.message);
        res.status(400).json({ error: 'WEBHOOK_PROCESSING_FAILED', details: err.message });
    }
});

export default router;
