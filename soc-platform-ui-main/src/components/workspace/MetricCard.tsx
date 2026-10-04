import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number | null;
    subtitle?: string;
    icon: LucideIcon;
    isLoading?: boolean;
    isStale?: boolean;
    badge?: string;
    accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    subtitle,
    icon: Icon,
    isLoading = false,
    isStale = false,
    badge,
    accentColor = 'text-[#0665F9]'
}) => {
    const renderValue = () => {
        if (isLoading) {
            return (
                <div className="h-8 w-20 bg-slate-200/70 rounded animate-pulse my-0.5" />
            );
        }
        if (value === null || value === undefined) {
            return <span className="text-slate-400 text-xl font-semibold">Unavailable</span>;
        }
        return (
            <span className="font-semibold text-2xl sm:text-[28px] text-[#0F172A] tracking-tight">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
        );
    };

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 sm:p-5 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#CBD5E1] transition-colors">
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-[#64748B] uppercase tracking-wider line-clamp-1">
                    {title}
                </span>
                <div className={`p-1.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] ${accentColor}`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
            </div>

            <div className="my-1">
                <div className="flex items-baseline gap-2">
                    {renderValue()}
                    {badge && (
                        <span className="text-[11px] font-medium text-[#138A68] bg-[#ECFDF5] border border-[#A7F3D0] px-1.5 py-0.5 rounded">
                            {badge}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-[#64748B] mt-1 font-normal line-clamp-1">
                        {subtitle}
                    </p>
                )}
            </div>

            {isStale && (
                <div className="mt-2 pt-2 border-t border-[#F1F5F9] text-[10px] text-amber-700 font-medium">
                    Cached snapshot
                </div>
            )}
        </div>
    );
};

export default MetricCard;
