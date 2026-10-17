/**
 * riskScore.js — Deterministic TacticLens Risk Scoring Engine
 *
 * Implements CLAUDE.md §8 exact risk formula:
 *
 *   base   = 35 * (cvss / 10)         # 0 if no CVE
 *          + 25 * kev                 # 1 if any CVE in CISA KEV
 *          + 15 * epss                # max EPSS probability 0–1
 *          + 15 * stack_match         # 1 if matches org tech_stack, 0.5 if sector match only
 *          + 10 * internet_facing     # 1 if a matched product is internet_facing
 *   bonus  = min(5, log2(article_count))
 *   risk   = clamp(round(base + bonus), 0, 100)
 *
 * Non-negotiable rules:
 * - AI NEVER sets severity or scores.
 * - CVSS from NVD, KEV from CISA KEV catalog, EPSS from FIRST.
 * - Severity labels derived from CVSS bands when CVE exists (Critical >= 9.0, High >= 7.0, Medium >= 4.0, Low < 4.0),
 *   otherwise from deterministic threat category rule table.
 * - Auto-case: opens P1 case when kev = 1 AND stack_match = 1 AND internet_facing = 1.
 */

export const SEVERITY_BANDS = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
    INFORMATIONAL: 'Informational'
};

/**
 * Deterministic fallback severity for threat records without a CVSS score.
 * AI never decides this.
 */
const CATEGORY_RULE_SEVERITY = {
    'Ransomware': SEVERITY_BANDS.HIGH,
    'Zero-Day Exploitation': SEVERITY_BANDS.HIGH,
    'Critical Infrastructure': SEVERITY_BANDS.HIGH,
    'Data Breach': SEVERITY_BANDS.MEDIUM,
    'Supply Chain Compromise': SEVERITY_BANDS.HIGH,
    'Nation-State / APT': SEVERITY_BANDS.HIGH,
    'Phishing & Social Engineering': SEVERITY_BANDS.MEDIUM,
    'Advisory': SEVERITY_BANDS.MEDIUM,
    'Malware Analysis': SEVERITY_BANDS.MEDIUM,
    'Cloud Security': SEVERITY_BANDS.MEDIUM,
    'Defense Evasion': SEVERITY_BANDS.MEDIUM,
    'Vulnerability Research': SEVERITY_BANDS.LOW,
    'General': SEVERITY_BANDS.LOW
};

/**
 * Calculates deterministic risk score (0-100) and transparent component breakdown.
 *
 * @param {object} params
 * @param {number|null} [params.cvss] - Max CVSS score (0.0 to 10.0) from NVD
 * @param {boolean} [params.isKev] - True if any CVE is listed in CISA KEV
 * @param {number} [params.epss] - Max EPSS probability (0.0 to 1.0) from FIRST
 * @param {number} [params.stackMatch] - 1.0 if direct product match, 0.5 if sector match, 0 if none
 * @param {boolean} [params.isInternetFacing] - True if matched asset is exposed to internet
 * @param {number} [params.articleCount] - Cluster article count (defaults to 1)
 * @param {string} [params.fallbackCategory] - Category if no CVE is present
 * @returns {object} { risk, reasons, severity, autoCaseP1 }
 */
export function calculateRiskScore({
    cvss = null,
    isKev = false,
    epss = 0,
    stackMatch = 0,
    isInternetFacing = false,
    articleCount = 1,
    fallbackCategory = 'General'
} = {}) {
    // 1. CVSS component (max 35)
    const validCvss = (typeof cvss === 'number' && !isNaN(cvss) && cvss >= 0) ? Math.min(10, Math.max(0, cvss)) : 0;
    const cvssComponent = Number((35 * (validCvss / 10)).toFixed(2));

    // 2. KEV component (max 25)
    const kevValue = Boolean(isKev) ? 1 : 0;
    const kevComponent = 25 * kevValue;

    // 3. EPSS component (max 15)
    const validEpss = (typeof epss === 'number' && !isNaN(epss) && epss >= 0) ? Math.min(1, Math.max(0, epss)) : 0;
    const epssComponent = Number((15 * validEpss).toFixed(2));

    // 4. Stack match component (max 15)
    // 1.0 = direct tech_stack match, 0.5 = sector match, 0 = none
    let stackMatchScore = 0;
    if (stackMatch >= 1) {
        stackMatchScore = 1.0;
    } else if (stackMatch >= 0.5) {
        stackMatchScore = 0.5;
    }
    const stackComponent = Number((15 * stackMatchScore).toFixed(2));

    // 5. Internet-facing component (max 10)
    const internetValue = Boolean(isInternetFacing && stackMatchScore > 0) ? 1 : 0;
    const internetComponent = 10 * internetValue;

    // 6. Article count volume bonus (max 5)
    const safeCount = Math.max(1, parseInt(articleCount, 10) || 1);
    const bonusComponent = Number(Math.min(5, Math.log2(safeCount)).toFixed(2));

    // Aggregate & clamp
    const rawTotal = cvssComponent + kevComponent + epssComponent + stackComponent + internetComponent + bonusComponent;
    const risk = Math.max(0, Math.min(100, Math.round(rawTotal)));

    // Transparent reasoning JSON
    const reasons = {
        cvss: {
            value: validCvss > 0 ? validCvss : null,
            points: cvssComponent,
            maxPoints: 35,
            source: validCvss > 0 ? 'NVD' : 'N/A'
        },
        kev: {
            inCatalog: kevValue === 1,
            points: kevComponent,
            maxPoints: 25,
            source: 'CISA KEV'
        },
        epss: {
            probability: validEpss,
            points: epssComponent,
            maxPoints: 15,
            source: 'FIRST.org'
        },
        stackMatch: {
            matchType: stackMatchScore === 1 ? 'direct_product' : (stackMatchScore === 0.5 ? 'sector_only' : 'none'),
            points: stackComponent,
            maxPoints: 15
        },
        internetFacing: {
            isExposed: internetValue === 1,
            points: internetComponent,
            maxPoints: 10
        },
        clusterVolume: {
            articleCount: safeCount,
            bonusPoints: bonusComponent,
            maxBonus: 5
        },
        rawTotal: Number(rawTotal.toFixed(2)),
        finalRisk: risk
    };

    // Severity Determination
    let severity;
    if (validCvss > 0) {
        if (validCvss >= 9.0) severity = SEVERITY_BANDS.CRITICAL;
        else if (validCvss >= 7.0) severity = SEVERITY_BANDS.HIGH;
        else if (validCvss >= 4.0) severity = SEVERITY_BANDS.MEDIUM;
        else severity = SEVERITY_BANDS.LOW;
    } else {
        severity = CATEGORY_RULE_SEVERITY[fallbackCategory] || SEVERITY_BANDS.LOW;
    }

    // Auto-case rule: open P1 case when kev = 1 AND stack_match = 1 AND internet_facing = 1
    const autoCaseP1 = (kevValue === 1 && stackMatchScore === 1.0 && internetValue === 1);

    return {
        risk,
        reasons,
        severity,
        autoCaseP1
    };
}
