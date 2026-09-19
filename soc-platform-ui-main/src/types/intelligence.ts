export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type TimeRange = '24h' | '7d' | '30d' | 'all';

export const normalizeSeverity = (sev?: string | null): SeverityLevel => {
    if (!sev) return 'Informational';
    const s = sev.toLowerCase().trim();
    if (s.includes('crit')) return 'Critical';
    if (s.includes('high')) return 'High';
    if (s.includes('med')) return 'Medium';
    if (s.includes('low')) return 'Low';
    return 'Informational';
};

export const INTEL_CATEGORY_LABELS: Record<string, string> = {
    'ransomware-extortion': 'Ransomware & Extortion',
    'malware': 'Malware',
    'phishing-social-engineering': 'Phishing & Social Engineering',
    'threat-actors-campaigns': 'Threat Actors & Campaigns',
    'breaches-data-exposure': 'Breaches & Data Exposure',
    'cloud-identity-attacks': 'Cloud & Identity Attacks',
    'supply-chain-attacks': 'Supply Chain Attacks',
    'ddos-service-disruption': 'DDoS & Service Disruption',
    'general-security-news': 'General Security News',
    'needs-classification': 'Needs Classification',
    'vuln-disclosure': 'Vulnerability Disclosure',
};
