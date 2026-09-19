import React, { useState, useRef, useEffect } from 'react';
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
    ChevronDown,
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

interface CategoryNavigationProps {
    selectedCategoryId: string;
    onSelectCategory: (categoryId: string) => void;
    countsByCategory: Record<string, number>;
    totalRecordsCount?: number;
}

export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
    selectedCategoryId,
    onSelectCategory,
    countsByCategory,
    totalRecordsCount = countsByCategory['all'] || 0,
}) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial 6 visible categories (including "All intelligence")
    const primaryCategories = CATEGORY_DEFINITIONS.slice(0, 6);
    // Remaining categories in the "More categories" menu
    const moreCategories = CATEGORY_DEFINITIONS.slice(6);

    const isSelectedInMore = moreCategories.some(c => c.id === selectedCategoryId);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getCount = (id: string) => {
        if (id === 'all') return totalRecordsCount;
        return countsByCategory[id] || 0;
    };

    return (
        <div className="w-full" role="tablist" aria-label="Threat Categories Navigation">
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                {primaryCategories.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategoryId === cat.id;
                    const count = getCount(cat.id);

                    return (
                        <button
                            key={cat.id}
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => onSelectCategory(cat.id)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex-shrink-0 cursor-pointer ${
                                isSelected
                                    ? 'bg-[#147DFA] text-white shadow-xs font-semibold'
                                    : 'bg-white text-[#14263F] border border-[#E2EAF3] hover:border-[#CBD5E1] hover:bg-slate-50/80'
                            }`}
                        >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#586C86]'}`} />
                            <span className="whitespace-nowrap">{cat.displayName}</span>
                            <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                    isSelected
                                        ? 'bg-white/25 text-white'
                                        : 'bg-[#F1F5F9] text-[#586C86]'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}

                {/* More Categories Dropdown */}
                <div className="relative flex-shrink-0" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setMoreOpen(!moreOpen)}
                        aria-expanded={moreOpen}
                        aria-haspopup="true"
                        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                            isSelectedInMore
                                ? 'bg-[#147DFA] text-white shadow-xs font-semibold'
                                : 'bg-white text-[#14263F] border border-[#E2EAF3] hover:border-[#CBD5E1] hover:bg-slate-50/80'
                        }`}
                    >
                        <span className="whitespace-nowrap">
                            {isSelectedInMore
                                ? moreCategories.find(c => c.id === selectedCategoryId)?.displayName || 'More'
                                : 'More categories'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {moreOpen && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E2EAF3] rounded-xl shadow-lg p-1.5 z-40 space-y-0.5"
                        >
                            {moreCategories.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategoryId === cat.id;
                                const count = getCount(cat.id);

                                return (
                                    <button
                                        key={cat.id}
                                        role="menuitem"
                                        onClick={() => {
                                            onSelectCategory(cat.id);
                                            setMoreOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                            isSelected
                                                ? 'bg-[#147DFA] text-white font-semibold'
                                                : 'text-[#14263F] hover:bg-[#F8FAFC]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate pr-2">
                                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#586C86]'}`} />
                                            <span className="truncate">{cat.displayName}</span>
                                        </div>
                                        <span
                                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold ${
                                                isSelected ? 'bg-white/25 text-white' : 'bg-[#F1F5F9] text-[#586C86]'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoryNavigation;
