import React from 'react';
import {
    Layers,
    ShieldAlert,
    Bug,
    Mail,
    Terminal,
    Cloud,
    Database,
    Link2,
    Zap,
    Newspaper,
} from 'lucide-react';

export interface CategoryItem {
    id: string;
    displayName: string;
    shortName: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}

export const CATEGORY_DEFINITIONS: CategoryItem[] = [
    {
        id: 'all',
        displayName: 'All intelligence',
        shortName: 'All Intel',
        icon: Layers,
        description: 'Comprehensive cross-category threat intelligence coverage and multi-source telemetry.',
    },
    {
        id: 'ransomware-extortion',
        displayName: 'Ransomware',
        shortName: 'Ransomware',
        icon: ShieldAlert,
        description: 'Extortion operations, victim publications, ransomware variants, and double-extortion campaigns.',
    },
    {
        id: 'vuln-disclosure',
        displayName: 'Vulnerabilities',
        shortName: 'Vulnerabilities',
        icon: Bug,
        description: 'Zero-day exploits, CISA KEV entries, critical security advisories, and patch disclosures.',
    },
    {
        id: 'phishing-social-engineering',
        displayName: 'Phishing',
        shortName: 'Phishing',
        icon: Mail,
        description: 'Adversary-in-the-Middle (AiTM), credential harvesting, business email compromise, and social engineering.',
    },
    {
        id: 'malware',
        displayName: 'Malware',
        shortName: 'Malware',
        icon: Terminal,
        description: 'Infostealers, loaders, rootkits, botnets, and emerging commodity malware families.',
    },
    {
        id: 'cloud-identity-attacks',
        displayName: 'Cloud & Identity',
        shortName: 'Cloud & Identity',
        icon: Cloud,
        description: 'IAM token compromises, cloud infrastructure misconfigurations, and SaaS persistence techniques.',
    },
    {
        id: 'breaches-data-exposure',
        displayName: 'Data breaches',
        shortName: 'Data breaches',
        icon: Database,
        description: 'Exposed databases, customer record leaks, credential dumps, and unauthorized exfiltration.',
    },
    {
        id: 'supply-chain-attacks',
        displayName: 'Supply chain',
        shortName: 'Supply chain',
        icon: Link2,
        description: 'Open-source package tampering, third-party vendor compromises, and build pipeline attacks.',
    },
    {
        id: 'ddos-service-disruption',
        displayName: 'DDoS & disruption',
        shortName: 'DDoS & disruption',
        icon: Zap,
        description: 'Volumetric distributed denial-of-service, DNS amplification, and critical infrastructure disruption.',
    },
    {
        id: 'general-security-news',
        displayName: 'General security',
        shortName: 'General security',
        icon: Newspaper,
        description: 'Industry developments, defensive research, regulatory directives, and global cyber diplomacy.',
    },
];
