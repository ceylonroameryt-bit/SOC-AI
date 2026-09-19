/**
 * classificationEngine.js
 * Evidence-based threat intelligence categorisation engine.
 *
 * Rules:
 *  - Classification is based on combined title + contentSnippet, NOT title alone.
 *  - Ambiguous records receive `needs-classification`, never a forced category.
 *  - Analyst overrides are respected and preserved.
 *  - Vulnerability disclosures (CVE/advisory) are routed to `vuln-disclosure`
 *    (handled by the Vulnerabilities section, not the Intelligence table).
 *  - sourceCategory (original raw value) is always preserved.
 *  - taxonomyVersion is included in every classification result.
 *  - confidence is null when evidence is insufficient.
 *  - Dark-web sourcing alone does NOT raise severity or force a threat category.
 */

export const TAXONOMY_VERSION = 'v1.0';

// Stable category IDs → display names for the intelligence table
export const INTEL_CATEGORIES = {
    'ransomware-extortion':         'Ransomware & Extortion',
    'malware':                      'Malware',
    'phishing-social-engineering':  'Phishing & Social Engineering',
    'threat-actors-campaigns':      'Threat Actors & Campaigns',
    'breaches-data-exposure':       'Breaches & Data Exposure',
    'cloud-identity-attacks':       'Cloud & Identity Attacks',
    'supply-chain-attacks':         'Supply Chain Attacks',
    'ddos-service-disruption':      'DDoS & Service Disruption',
    'general-security-news':        'General Security News',
    'needs-classification':         'Needs Classification',
    // Routing token for Vulnerabilities section (not shown in Intel table by default)
    'vuln-disclosure':              'Vulnerability Disclosure',
};

export const CATEGORY_DISPLAY_NAMES = INTEL_CATEGORIES;

// Evidence signal sets — must match multiple signals or a high-confidence single signal
// DO NOT use single-word title keywords as the sole basis for classification.

const RANSOMWARE_SIGNALS = [
    'ransomware', 'ransom payment', 'ransom demand', 'encrypted files',
    'data encrypted', 'extortion portal', 'leak site', 'victim published',
    'lockbit', 'akira', 'blackcat', 'alphv', 'clop', 'play ransomware',
    'royal ransomware', 'rhysida', 'hunter ransomware', 'ragnar locker',
    'ransomware group', 'ransomware gang', 'ransomware attack confirmed',
    'double extortion', 'triple extortion', 'ransom note',
];

const MALWARE_SIGNALS = [
    'malware campaign', 'trojan', 'backdoor', 'infostealer', 'stealer',
    'rat deployed', 'remote access trojan', 'loader malware', 'dropper',
    'botnet', 'command and control', 'c2 server', 'c&c server',
    'malicious payload', 'malware family', 'malware strain',
    'redline', 'raccoon stealer', 'formbook', 'agent tesla',
    'qakbot', 'emotet', 'trickbot', 'cobalt strike beacon',
    'rootkit', 'wiper malware', 'worm spreading',
];

const PHISHING_SIGNALS = [
    'phishing campaign', 'spear phishing', 'credential harvesting',
    'phishing kit', 'phishing page', 'phishing email', 'phishing attack',
    'business email compromise', 'bec attack', 'vishing', 'smishing',
    'social engineering', 'fake login', 'credential theft',
    'typosquatting domain', 'lookalike domain used to',
];

const THREAT_ACTOR_SIGNALS = [
    'apt group', 'apt28', 'apt29', 'apt41', 'lazarus group', 'kimsuky',
    'volt typhoon', 'sandworm', 'cozy bear', 'fancy bear', 'scattered spider',
    'unc2452', 'fin7', 'fin8', 'threat actor', 'threat group',
    'nation-state actor', 'state-sponsored', 'threat campaign',
    'chinese hackers', 'russian hackers', 'north korean hackers',
    'iranian hackers', 'cyber espionage campaign',
    'targeted attack campaign', 'operation ', // "Operation X" pattern
];

const BREACH_SIGNALS = [
    'data breach', 'data leak', 'database exposed', 'records leaked',
    'personal data exposed', 'breach notification', 'data theft confirmed',
    'stolen data published', 'credentials dumped', 'millions of records',
    'user accounts exposed', 'sensitive data stolen', 'customer data exposed',
    'insider leak', 'accidental exposure', 'misconfigured bucket exposed',
    'pii exposed', 'medical records leaked', 'financial records stolen',
];

const CLOUD_IDENTITY_SIGNALS = [
    'cloud misconfiguration', 'cloud security', 'aws breach', 's3 bucket exposed',
    'azure attack', 'google cloud', 'cloud storage exposed',
    'identity attack', 'identity theft', 'oauth abuse',
    'saml attack', 'mfa bypass', 'multi-factor bypass',
    'token theft', 'session hijacking', 'privilege escalation via cloud',
    'identity provider compromised', 'okta breach', 'entra id',
    'active directory attack', 'ldap attack',
];

const SUPPLY_CHAIN_SIGNALS = [
    'supply chain attack', 'software supply chain', 'dependency confusion',
    'typosquatting package', 'malicious npm', 'malicious pypi',
    'poisoned package', 'compromised dependency',
    'upstream compromise', 'third-party vendor breach',
    'solarwinds', 'codecov attack', 'xz utils',
    'build pipeline attack', 'ci/cd compromise',
    'software update hijacked', 'malicious plugin',
];

const DDOS_SIGNALS = [
    'ddos attack', 'distributed denial of service', 'denial of service',
    'service disruption', 'website taken down', 'outage caused by attack',
    'volumetric attack', 'layer 7 attack', 'amplification attack',
    'botnet ddos', 'killnet', 'anonymous sudan',
    'ddos campaign', 'infrastructure disruption',
];

// Vulnerability indicators — route to vuln-disclosure, not the intel table
const VULN_SIGNALS = [
    'cve-20', 'vulnerability disclosed', 'vulnerability discovered',
    'security advisory', 'patch advisory', 'patch released for',
    'zero-day vulnerability', 'zero day flaw', 'security flaw in',
    'unpatched vulnerability', 'cvss score', 'proof of concept exploit',
    'poc released', 'remote code execution in', 'buffer overflow in',
    'injection vulnerability in', 'memory corruption in',
    'security researchers found', 'researchers discovered a vulnerability',
];

// Non-threat content — should be general-security-news or informational
const NON_THREAT_SIGNALS = [
    'webinar', 'virtual event', 'register now', 'panel discussion',
    'podcast episode', 'fireside chat', 'sponsored', 'press release',
    'product of the year', 'gartner magic quadrant', 'award winner',
    'named leader', 'market leader', 'buyer guide', 'whitepaper download',
    'top 10 tips', 'best practices for 2026', 'building a career',
    'why cybersecurity matters', 'opinion:', 'forrester wave',
    'vendor evaluation', 'how to get started with',
];

/**
 * Count how many signals from a signal list appear in the combined text.
 * Returns the count (not boolean) to allow confidence weighting.
 */
function countSignals(text, signals) {
    let count = 0;
    for (const signal of signals) {
        if (text.includes(signal)) count++;
    }
    return count;
}

/**
 * Classify a single intelligence record.
 *
 * @param {Object} item - { title, contentSnippet, source, category, analystCategory }
 * @returns {ClassificationResult}
 *
 * @typedef {Object} ClassificationResult
 * @property {string} intelCategory    - Stable category ID
 * @property {string} displayName      - Human-readable category name
 * @property {string[]} secondaryTopics - Zero or more additional topic tags
 * @property {string} method           - 'rule-based' | 'analyst-override' | 'legacy-mapping' | 'unclassified'
 * @property {number|null} confidence  - 0–100, or null when insufficient evidence
 * @property {string} reason           - Short classification explanation
 * @property {string} taxonomyVersion
 */
export function classifyRecord(item = {}) {
    // 1. Respect analyst overrides — highest priority, always preserved
    if (item.analystCategory && INTEL_CATEGORIES[item.analystCategory]) {
        return {
            intelCategory: item.analystCategory,
            displayName: INTEL_CATEGORIES[item.analystCategory],
            secondaryTopics: item.analystSecondaryTopics || [],
            method: 'analyst-override',
            confidence: null,
            reason: 'Classification set by analyst override.',
            taxonomyVersion: TAXONOMY_VERSION,
        };
    }

    const title = (item.title || '').toLowerCase();
    const snippet = (item.contentSnippet || '').toLowerCase();
    const combined = `${title} ${snippet}`;

    // 2. Non-threat content check — marketing/educational/informational
    const nonThreatCount = countSignals(combined, NON_THREAT_SIGNALS);
    if (nonThreatCount >= 1) {
        return {
            intelCategory: 'general-security-news',
            displayName: INTEL_CATEGORIES['general-security-news'],
            secondaryTopics: ['informational'],
            method: 'rule-based',
            confidence: 80,
            reason: `Non-operational content markers detected: editorial, marketing, or educational material.`,
            taxonomyVersion: TAXONOMY_VERSION,
        };
    }

    // 3. Vulnerability disclosures — route to vuln-disclosure (Vulnerabilities section)
    const vulnCount = countSignals(combined, VULN_SIGNALS);
    // Only classify as vuln-disclosure if the PRIMARY event is a CVE/patch advisory,
    // not just an article that mentions a CVE in passing (require 2+ signals or CVE ID present)
    const hasCveId = /\bcve-\d{4}-\d{4,7}\b/i.test(combined);
    const isVulnPrimary = (vulnCount >= 2) || (hasCveId && vulnCount >= 1 && combined.includes('advisory'));
    if (isVulnPrimary) {
        return {
            intelCategory: 'vuln-disclosure',
            displayName: INTEL_CATEGORIES['vuln-disclosure'],
            secondaryTopics: hasCveId ? ['cve'] : [],
            method: 'rule-based',
            confidence: 75,
            reason: `Primary event is a vulnerability disclosure or patch advisory.`,
            taxonomyVersion: TAXONOMY_VERSION,
        };
    }

    // 4. Score each threat category
    const scores = {
        'ransomware-extortion':         countSignals(combined, RANSOMWARE_SIGNALS),
        'malware':                      countSignals(combined, MALWARE_SIGNALS),
        'phishing-social-engineering':  countSignals(combined, PHISHING_SIGNALS),
        'threat-actors-campaigns':      countSignals(combined, THREAT_ACTOR_SIGNALS),
        'breaches-data-exposure':       countSignals(combined, BREACH_SIGNALS),
        'cloud-identity-attacks':       countSignals(combined, CLOUD_IDENTITY_SIGNALS),
        'supply-chain-attacks':         countSignals(combined, SUPPLY_CHAIN_SIGNALS),
        'ddos-service-disruption':      countSignals(combined, DDOS_SIGNALS),
    };

    // Sort by score descending
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCategory, topScore] = ranked[0];
    const [, secondScore] = ranked[1] || [null, 0];

    // 5. Determine confidence and secondary topics
    if (topScore === 0) {
        // No signals at all — check if it's plausibly general security news
        const generalSecurityWords = ['security', 'hack', 'cyber', 'threat', 'attack', 'incident'];
        const hasGeneral = generalSecurityWords.some(w => combined.includes(w));
        if (hasGeneral) {
            return {
                intelCategory: 'general-security-news',
                displayName: INTEL_CATEGORIES['general-security-news'],
                secondaryTopics: [],
                method: 'rule-based',
                confidence: 55,
                reason: 'General security topic without specific threat category signals.',
                taxonomyVersion: TAXONOMY_VERSION,
            };
        }
        // Truly ambiguous
        return {
            intelCategory: 'needs-classification',
            displayName: INTEL_CATEGORIES['needs-classification'],
            secondaryTopics: [],
            method: 'unclassified',
            confidence: null,
            reason: 'Insufficient evidence to assign a primary category.',
            taxonomyVersion: TAXONOMY_VERSION,
        };
    }

    if (topScore === 1 && secondScore === 1) {
        // Tied at 1 signal each — ambiguous
        return {
            intelCategory: 'needs-classification',
            displayName: INTEL_CATEGORIES['needs-classification'],
            secondaryTopics: [],
            method: 'unclassified',
            confidence: null,
            reason: 'Ambiguous — equal evidence for multiple categories. Manual review recommended.',
            taxonomyVersion: TAXONOMY_VERSION,
        };
    }

    // 6. Compute secondary topics from other categories with score >= 1
    const secondaryTopics = ranked
        .slice(1)
        .filter(([, s]) => s >= 1)
        .map(([cat]) => INTEL_CATEGORIES[cat]);

    // 7. Confidence: based on signal count and separation from second-best
    const separation = topScore - secondScore;
    let confidence;
    if (topScore >= 3 && separation >= 2) {
        confidence = 90;
    } else if (topScore >= 2 && separation >= 1) {
        confidence = 75;
    } else if (topScore === 1 && secondScore === 0) {
        confidence = 60;
    } else {
        confidence = 55;
    }

    return {
        intelCategory: topCategory,
        displayName: INTEL_CATEGORIES[topCategory],
        secondaryTopics,
        method: 'rule-based',
        confidence,
        reason: `Primary category matched ${topScore} signal(s). ${secondaryTopics.length > 0 ? `Secondary topics: ${secondaryTopics.join(', ')}.` : ''}`,
        taxonomyVersion: TAXONOMY_VERSION,
    };
}

/**
 * Reversible legacy category mapping for existing records.
 * Maps the old `category` field values to the new taxonomy.
 * Preserves sourceCategory = original value.
 *
 * @param {string} legacyCategory
 * @returns {string} intelCategory ID
 */
export function mapLegacyCategory(legacyCategory) {
    const map = {
        'Ransomware':   'ransomware-extortion',
        'Malware':      'malware',
        'Phishing':     'phishing-social-engineering',
        'Data Breach':  'breaches-data-exposure',
        'Vulnerability': 'vuln-disclosure',
        'General Info': 'general-security-news',
        // Government and Dark Web require signal-based classification — return null to trigger engine
        'Government':   null,
        'Dark Web':     null,
    };
    return map[legacyCategory] ?? null;
}
