/**
 * relevanceEngine.js
 * Evaluates threat intelligence records against organizational watched interests.
 *
 * Enforces strict separation between:
 * - Watched technology (mention in advisory)
 * - Possible relevance (organization uses product line)
 * - Verified affected version (organization uses matching vulnerable release)
 * - Confirmed exposure (perimeter scan or EDR confirms reachable vulnerable asset)
 *
 * NEVER invents confirmed exposure or customer compromise without telemetry.
 */

export const DEFAULT_ORG_PROFILE = {
    id: 'org-default',
    name: 'Enterprise SOC Operations',
    industry: 'Financial Services',
    regions: ['North America', 'Europe', 'Global'],
    watchedTechnologies: [
        'Palo Alto',
        'Ivanti',
        'Fortinet',
        'Cisco',
        'Microsoft Exchange',
        'Active Directory',
        'AWS',
        'Kubernetes',
        'Citrix NetScaler'
    ],
    watchedSuppliers: [
        'Okta',
        'CrowdStrike',
        'Salesforce',
        'SolarWinds',
        'GitHub'
    ],
    watchedActors: [
        'LockBit',
        'Akira',
        'Volt Typhoon',
        'Salt Typhoon',
        'Scattered Spider'
    ]
};

/**
 * Assesses an intelligence record against the organization's interest profile.
 *
 * @param {Object} record - The intelligence record { title, contentSnippet, intelCategory }
 * @param {Object} [profile=DEFAULT_ORG_PROFILE] - Organizational profile
 * @returns {Object} Relevance evaluation result
 */
export function assessRelevance(record, profile = DEFAULT_ORG_PROFILE) {
    const text = `${record.title || ''} ${record.contentSnippet || ''} ${record.summary || ''}`.toLowerCase();

    const matchedTech = [];
    for (const tech of profile.watchedTechnologies) {
        if (text.includes(tech.toLowerCase())) {
            matchedTech.push(tech);
        }
    }

    const matchedSuppliers = [];
    for (const sup of profile.watchedSuppliers) {
        if (text.includes(sup.toLowerCase())) {
            matchedSuppliers.push(sup);
        }
    }

    const matchedActors = [];
    for (const actor of profile.watchedActors) {
        if (text.includes(actor.toLowerCase())) {
            matchedActors.push(actor);
        }
    }

    // Determine highest match tier and explanation
    if (matchedTech.length > 0) {
        return {
            isRelevant: true,
            relevanceScore: 85,
            tier: 'watched-technology',
            matchedCategory: 'technology',
            matchedTerms: matchedTech,
            exposureStatus: 'possible-relevance', // Never 'confirmed-exposure' without asset telemetry
            exposureStatusLabel: 'Possible Relevance (Watched Technology)',
            reason: `Matches tracked perimeter/infrastructure technology: ${matchedTech.join(', ')}. Local asset version requires verification.`
        };
    }

    if (matchedSuppliers.length > 0) {
        return {
            isRelevant: true,
            relevanceScore: 75,
            tier: 'watched-supplier',
            matchedCategory: 'supplier',
            matchedTerms: matchedSuppliers,
            exposureStatus: 'possible-relevance',
            exposureStatusLabel: 'Third-Party / Supplier Risk',
            reason: `Discloses activity or vulnerability concerning key supplier: ${matchedSuppliers.join(', ')}. Audit third-party integration boundaries.`
        };
    }

    if (matchedActors.length > 0) {
        return {
            isRelevant: true,
            relevanceScore: 70,
            tier: 'watched-actor',
            matchedCategory: 'threat-actor',
            matchedTerms: matchedActors,
            exposureStatus: 'possible-relevance',
            exposureStatusLabel: 'Monitored Threat Group',
            reason: `Attributed to monitored threat actor: ${matchedActors.join(', ')}. Review EDR/SIEM telemetry for associated TTPs.`
        };
    }

    return {
        isRelevant: false,
        relevanceScore: 20,
        tier: 'general-interest',
        matchedCategory: 'none',
        matchedTerms: [],
        exposureStatus: 'unassessed',
        exposureStatusLabel: 'General Threat Landscape',
        reason: 'No direct match with monitored organizational perimeter technologies or suppliers.'
    };
}
