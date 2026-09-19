import React from 'react';

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

interface SeverityBadgeProps {
    severity?: string | null;
    size?: 'sm' | 'md';
    className?: string;
}

export const normalizeSeverity = (sev?: string | null): SeverityLevel => {
    if (!sev) return 'Informational';
    const s = sev.toLowerCase().trim();
    if (s.includes('crit')) return 'Critical';
    if (s.includes('high')) return 'High';
    if (s.includes('med')) return 'Medium';
    if (s.includes('low')) return 'Low';
    return 'Informational';
};

const SEVERITY_STYLES: Record<SeverityLevel, { bg: string; text: string; border: string; dot: string }> = {
    Critical: {
        bg: 'bg-[#FEF3F2]',
        text: 'text-[#B42318]',
        border: 'border-[#FECDCA]',
        dot: 'bg-[#B42318]'
    },
    High: {
        bg: 'bg-[#FFFAEB]',
        text: 'text-[#B96B00]',
        border: 'border-[#FEDF89]',
        dot: 'bg-[#B96B00]'
    },
    Medium: {
        bg: 'bg-[#FFFBEB]',
        text: 'text-[#D97706]',
        border: 'border-[#FDE68A]',
        dot: 'bg-[#D97706]'
    },
    Low: {
        bg: 'bg-[#ECFDF5]',
        text: 'text-[#138A68]',
        border: 'border-[#A7F3D0]',
        dot: 'bg-[#138A68]'
    },
    Informational: {
        bg: 'bg-[#F8FAFC]',
        text: 'text-[#475467]',
        border: 'border-[#E2E8F0]',
        dot: 'bg-[#64748B]'
    }
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md', className = '' }) => {
    const level = normalizeSeverity(severity);
    const style = SEVERITY_STYLES[level];

    const sizeClasses = size === 'sm' 
        ? 'px-2 py-0.5 text-[11px]' 
        : 'px-2.5 py-0.5 text-xs';

    return (
        <span
            className={`inline-flex items-center gap-1.5 font-medium rounded-md border font-sans tracking-tight select-none ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
            role="status"
            aria-label={`Severity: ${level}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} aria-hidden="true" />
            <span>{level}</span>
        </span>
    );
};

export default SeverityBadge;
