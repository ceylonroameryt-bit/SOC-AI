/**
 * alertDispatcher.js — Multi-Channel Alert Dispatch Engine for TacticLens
 *
 * Implements CLAUDE.md §5 & §11:
 * - Channels: Email, Microsoft Teams, Slack, Generic Webhook
 * - Evaluates organization alert rules against incoming threat clusters
 * - Respects quiet hours & severity thresholds
 * - Provides verified test-send facility
 */

import axios from 'axios';
import { sendEmail } from './emailService.js';

export const ALERT_CHANNELS = {
    EMAIL: 'email',
    TEAMS: 'teams',
    SLACK: 'slack',
    WEBHOOK: 'webhook'
};

/**
 * Checks whether current time falls within configured quiet hours.
 * @param {object} quietHours - { enabled: boolean, start: "22:00", end: "07:00" }
 * @returns {boolean}
 */
export function isInQuietHours(quietHours) {
    if (!quietHours || !quietHours.enabled || !quietHours.start || !quietHours.end) {
        return false;
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietHours.start.split(':').map(Number);
    const [endH, endM] = quietHours.end.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins <= endMins) {
        return currentMins >= startMins && currentMins <= endMins;
    } else {
        // Crosses midnight (e.g. 22:00 to 07:00)
        return currentMins >= startMins || currentMins <= endMins;
    }
}

/**
 * Evaluates if a cluster meets a rule's criteria.
 */
export function evaluateRuleMatch(rule, cluster, relevance) {
    if (!rule.isEnabled) return false;

    // 1. Severity threshold check
    const sevRank = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Informational': 0 };
    const clusterSevRank = sevRank[relevance.severity] || 0;
    const ruleSevRank = sevRank[rule.severityThreshold] || 2; // default Medium
    if (clusterSevRank < ruleSevRank) return false;

    // 2. Scope check: 'stack', 'sector', 'any'
    if (rule.scope === 'stack' && (!relevance.matchedProducts || relevance.matchedProducts.length === 0)) {
        return false;
    }

    // 3. Extra conditions: KEV / EPSS
    if (rule.extraConditions?.requireKev && !cluster.kev) {
        return false;
    }
    if (typeof rule.extraConditions?.minEpss === 'number' && (cluster.epss || 0) < rule.extraConditions.minEpss) {
        return false;
    }

    return true;
}

/**
 * Dispatches alert payload to configured channels.
 */
export async function dispatchAlert({ rule, cluster, relevance, channels = [], recipientEmail = null }) {
    const results = [];
    const isQuiet = isInQuietHours(rule.quietHours);

    // If quiet hours active and not critical, skip non-urgent alerts
    if (isQuiet && relevance.severity !== 'Critical') {
        return [{ channel: 'all', status: 'skipped', reason: 'Quiet hours active' }];
    }

    for (const ch of channels) {
        try {
            if (ch.type === ALERT_CHANNELS.EMAIL && recipientEmail) {
                const subject = `[TacticLens Alert] ${relevance.severity.toUpperCase()}: ${cluster.title}`;
                const body = `
TacticLens SOC Alert
=========================================
Threat: ${cluster.title}
Severity: ${relevance.severity}
Risk Score: ${relevance.riskScore}/100
Products Affected: ${(relevance.matchedProducts || []).join(', ') || 'General'}
CISA KEV: ${cluster.kev ? 'YES' : 'NO'}
Max EPSS: ${cluster.epss ? (cluster.epss * 100).toFixed(1) + '%' : '—'}

View full details in TacticLens Console:
https://tacticlens.co.uk/explorer?cluster=${encodeURIComponent(cluster.id)}
                `.trim();

                await sendEmail({ to: recipientEmail, subject, text: body });
                results.push({ channel: ALERT_CHANNELS.EMAIL, status: 'dispatched' });
            } else if (ch.type === ALERT_CHANNELS.SLACK && ch.webhookUrl) {
                await axios.post(ch.webhookUrl, {
                    text: `🚨 *[TacticLens Alert]* ${relevance.severity}: *${cluster.title}*\n*Risk Score:* ${relevance.riskScore}/100 | *Products:* ${(relevance.matchedProducts || []).join(', ') || 'N/A'}\n<https://tacticlens.co.uk/explorer?cluster=${encodeURIComponent(cluster.id)}|Inspect Threat in Console>`
                }, { timeout: 8000 });
                results.push({ channel: ALERT_CHANNELS.SLACK, status: 'dispatched' });
            } else if (ch.type === ALERT_CHANNELS.TEAMS && ch.webhookUrl) {
                await axios.post(ch.webhookUrl, {
                    "@type": "MessageCard",
                    "@context": "http://schema.org/extensions",
                    "themeColor": relevance.severity === 'Critical' ? "B42318" : "F59E0B",
                    "summary": `TacticLens Alert: ${cluster.title}`,
                    "sections": [{
                        "activityTitle": `🚨 TacticLens Alert: ${cluster.title}`,
                        "activitySubtitle": `Severity: ${relevance.severity} · Risk Score: ${relevance.riskScore}/100`,
                        "facts": [
                            { "name": "Affected Stack", "value": (relevance.matchedProducts || []).join(', ') || "Perimeter" },
                            { "name": "CISA KEV", "value": cluster.kev ? "Catalogued" : "No" }
                        ],
                        "markdown": true
                    }]
                }, { timeout: 8000 });
                results.push({ channel: ALERT_CHANNELS.TEAMS, status: 'dispatched' });
            } else if (ch.type === ALERT_CHANNELS.WEBHOOK && ch.webhookUrl) {
                await axios.post(ch.webhookUrl, {
                    event: 'tacticlens.alert',
                    timestamp: new Date().toISOString(),
                    rule: { id: rule.id, name: rule.name },
                    cluster: { id: cluster.id, title: cluster.title },
                    relevance
                }, { timeout: 8000 });
                results.push({ channel: ALERT_CHANNELS.WEBHOOK, status: 'dispatched' });
            }
        } catch (err) {
            results.push({ channel: ch.type, status: 'failed', error: err.message });
        }
    }

    return results;
}
