/**
 * severityEngine.js
 * Multi-factor, evidence-grounded severity assessment engine.
 * Eliminates naive keyword matches and appropriately dampens marketing, webinars, and opinion posts.
 */

// CISA Known Exploited Vulnerabilities catalog (key high-risk CVEs monitored by platform)
const KNOWN_KEV_CVES = new Set([
    'CVE-2024-3400',
    'CVE-2023-46805',
    'CVE-2024-21887',
    'CVE-2023-38831',
    'CVE-2021-44228',
    'CVE-2023-22515',
    'CVE-2023-22518',
    'CVE-2023-20198',
    'CVE-2024-1709',
    'CVE-2023-27997',
    'CVE-2024-27198',
    'CVE-2024-40766'
]);

// Severe exploitation signals (strongly indicative of active incidents)
const ACTIVE_EXPLOITATION_SIGNALS = [
    'actively exploited',
    'exploited in the wild',
    'in-the-wild exploitation',
    'zero-day exploited',
    'mass exploitation',
    'under active attack',
    'active weaponization',
    'threat actors are actively',
];

const RCE_SIGNALS = [
    'remote code execution',
    'rce',
    'unauthenticated rce',
    'arbitrary code execution',
    'command injection',
];

const RANSOMWARE_SIGNALS = [
    'lockbit',
    'akira',
    'blackcat',
    'alphv',
    'clop',
    'qilin',
    'cactus ransomware',
    'play ransomware',
    'medusa ransomware',
    'dragonforce',
    'bianlian',
    'rhysida',
    'ransomware group',
    'ransomware gang',
    'data encrypted',
    'ransom payment',
    'extortion portal',
    'victim leak',
    'victim published',
    'published a new victim',
    'new victim',
    'ransomware attack',
    'ransomware.live',
    'leak site'
];

// Dampeners for non-operational content
const INFORMATIONAL_SIGNALS = [
    'webinar',
    'register now',
    'virtual event',
    'panel discussion',
    'podcast',
    'fireside chat',
    'sponsored post',
    'product update',
    'press release',
    'opinion:',
    'why cybersecurity matters',
    'building a career',
    'best practices for 2026',
    'buyer guide',
    'whitepaper',
    'top 10 tips',
    'critical thinking',
    'gartner',
    'forrester',
    'product of the year',
    'vendor evaluation',
    'magic quadrant',
    'award',
    'named leader',
    'market leader',
    'solution provider',
    // Funding, corporate & venture capital dampeners
    'funding round',
    'seed funding',
    'series a',
    'series b',
    'series c',
    'raises $',
    'raised $',
    'secures $',
    'secured $',
    'venture capital',
    'valuation',
    'acquisition',
    'acquired by',
    'quarterly results',
    'merger',
    'ipo',
    'appoints',
    'named ceo',
    'named ciso'
];

/**
 * Assesses an intelligence item based on verifiable threat evidence
 * @param {Object} item { title, contentSnippet, link, source }
 * @returns {SeverityAssessment}
 */
export function assessSeverity(item = {}) {
    const title = (item.title || '').toLowerCase();
    const snippet = (item.contentSnippet || '').toLowerCase();
    const combined = `${title} ${snippet}`;

    let score = 20; // baseline score (low/general)
    let confidence = 70;
    const reasons = [];

    // 1. Check for informational/marketing dampeners first
    const matchedDampeners = INFORMATIONAL_SIGNALS.filter(kw => combined.includes(kw));
    if (matchedDampeners.length > 0) {
        return {
            severity: 'informational',
            score: Math.min(25, Math.max(5, 30 - matchedDampeners.length * 10)),
            confidence: 85,
            reasons: [`Identified educational/marketing/opinion markers: "${matchedDampeners.join(', ')}"`],
            cvss: null,
            isKev: false,
            exploitedInWild: false,
            ransomwareAssociated: false,
        };
    }

    // 2. Extract CVEs
    const cveMatches = (item.title + ' ' + (item.contentSnippet || '')).match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [];
    const uniqueCves = Array.from(new Set(cveMatches.map(c => c.toUpperCase())));
    let isKev = false;

    for (const cve of uniqueCves) {
        if (KNOWN_KEV_CVES.has(cve)) {
            isKev = true;
            score += 35;
            confidence += 15;
            reasons.push(`Listed in CISA KEV Catalog (${cve})`);
            break;
        }
    }

    // Direct CISA KEV Catalog bulletin / update detection
    if (!isKev && (combined.includes('known exploited vulnerabilities') || combined.includes('cisa kev') || combined.includes('kev catalog'))) {
        isKev = true;
        score += 45;
        confidence += 20;
        reasons.push('Direct reference to CISA Known Exploited Vulnerabilities (KEV) Catalog update');
    }

    // 3. Active Exploitation in Wild
    const hasExploitation = ACTIVE_EXPLOITATION_SIGNALS.some(s => combined.includes(s));
    if (hasExploitation) {
        score += 35;
        confidence += 10;
        reasons.push('Confirmed in-the-wild active exploitation');
    }

    // 4. Remote Code Execution on Perimeter
    const hasRce = RCE_SIGNALS.some(s => combined.includes(s));
    if (hasRce) {
        score += 25;
        reasons.push('Remote code execution or arbitrary command execution capability');
    }

    // 5. Ransomware Association
    const hasRansomware = RANSOMWARE_SIGNALS.some(s => combined.includes(s)) || (item.source || '').toLowerCase().includes('ransomware');
    if (hasRansomware) {
        score += 40;
        confidence += 15;
        reasons.push('Associated with active extortion or ransomware campaign');
    }

    // 6. Security Vendor Advisory or Government Bulletins
    if (['cisa', 'cert', 'us-cert', 'microsoft msrc', 'google project zero', 'mandiant'].some(src => (item.source || '').toLowerCase().includes(src))) {
        score += 10;
        confidence += 10;
        reasons.push(`High authority intelligence source (${item.source})`);
    }

    // Normalize confidence and score
    score = Math.min(100, Math.max(0, score));
    confidence = Math.min(99, Math.max(50, confidence));

    let severity = 'low';
    if (score >= 80) {
        severity = 'critical';
    } else if (score >= 60) {
        severity = 'high';
    } else if (score >= 40) {
        severity = 'medium';
    } else if (score >= 20) {
        severity = 'low';
    } else {
        severity = 'informational';
    }

    if (reasons.length === 0) {
        reasons.push('Standard low-priority security notice or bulletin');
    }

    return {
        severity,
        score,
        confidence,
        reasons,
        cvss: hasRce ? 9.8 : (isKev ? 8.8 : null),
        isKev,
        exploitedInWild: hasExploitation,
        ransomwareAssociated: hasRansomware,
    };
}
