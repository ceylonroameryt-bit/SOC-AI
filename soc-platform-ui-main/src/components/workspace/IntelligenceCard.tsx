import React from 'react';
import {
    ShieldAlert,
    Bug,
    Mail,
    Terminal,
    Cloud,
    Database,
    Link2,
    Zap,
    Newspaper,
    Bookmark,
    Clock,
} from 'lucide-react';
import type { IntelligenceRecord } from './ReportDetailPanel';

interface IntelligenceCardProps {
    record: IntelligenceRecord;
    isSelected?: boolean;
    isSaved?: boolean;
    onSelect: (record: IntelligenceRecord) => void;
    onToggleSave?: (record: IntelligenceRecord, e: React.MouseEvent) => void;
    onTopicClick?: (topic: string, e: React.MouseEvent) => void;
}

// Category styling and metadata mapping
interface CategoryStyle {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    textClass: string;
    borderClass: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
    'ransomware-extortion': {
        label: 'Ransomware',
        icon: ShieldAlert,
        bgClass: 'bg-red-50',
        textClass: 'text-red-700',
        borderClass: 'border-red-200',
    },
    'vuln-disclosure': {
        label: 'Vulnerabilities',
        icon: Bug,
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
    },
    'phishing-social-engineering': {
        label: 'Phishing',
        icon: Mail,
        bgClass: 'bg-purple-50',
        textClass: 'text-purple-700',
        borderClass: 'border-purple-200',
    },
    'malware': {
        label: 'Malware',
        icon: Terminal,
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
    },
    'cloud-identity-attacks': {
        label: 'Cloud & Identity',
        icon: Cloud,
        bgClass: 'bg-cyan-50',
        textClass: 'text-cyan-700',
        borderClass: 'border-cyan-200',
    },
    'breaches-data-exposure': {
        label: 'Data breaches',
        icon: Database,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
    },
    'supply-chain-attacks': {
        label: 'Supply chain',
        icon: Link2,
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
    },
    'ddos-service-disruption': {
        label: 'DDoS & disruption',
        icon: Zap,
        bgClass: 'bg-orange-50',
        textClass: 'text-orange-700',
        borderClass: 'border-orange-200',
    },
    'general-security-news': {
        label: 'General security',
        icon: Newspaper,
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-200',
    },
};

const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
    label: 'Security Update',
    icon: Newspaper,
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
};

// Derive semantic content type honestly without inventing metrics
function getContentType(record: IntelligenceRecord): string {
    const text = `${record.title || ''} ${record.source || ''}`.toLowerCase();
    if (text.includes('advisory') || text.includes('alert') || text.includes('cisa') || text.includes('cert')) {
        return 'Advisory';
    }
    if (text.includes('research') || text.includes('analysis') || text.includes('deep dive') || text.includes('report')) {
        return 'Research';
    }
    if (text.includes('incident') || text.includes('breach') || text.includes('victim') || text.includes('ransomware') || text.includes('compromise')) {
        return 'Incident report';
    }
    return 'Industry news';
}

// Format relative or readable date with fallback
function formatPublicationDate(dateStr?: string): string {
    if (!dateStr) return 'Publication date unavailable';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Publication date unavailable';

        const now = Date.now();
        const diffHours = Math.floor((now - d.getTime()) / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffHours < 48) return 'Yesterday';
        if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;

        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return 'Publication date unavailable';
    }
}

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({
    record,
    isSelected = false,
    isSaved = false,
    onSelect,
    onToggleSave,
    onTopicClick,
}) => {
    const catKey = record.intelCategory || record.category || 'general-security-news';
    const catStyle = CATEGORY_STYLES[catKey] || {
        ...DEFAULT_CATEGORY_STYLE,
        label: record.intelCategoryDisplay || record.intelCategory || 'Unassessed Category',
    };
    const CategoryIcon = catStyle.icon;

    const formattedDate = formatPublicationDate(record.pubDate);
    const contentType = getContentType(record);

    // Summary fallback per specification
    const rawSummary = record.contentSnippet || record.content || '';
    const cleanSummary = rawSummary.replace(/<[^>]*>?/gm, '').trim();
    const displaySummary = cleanSummary || 'Summary unavailable.';

    // Tags compilation (up to 3, plus +N count)
    const allTags: string[] = [];
    if (record.ioc?.cves && record.ioc.cves.length > 0) {
        allTags.push(...record.ioc.cves);
    }
    if (record.secondaryTopics && record.secondaryTopics.length > 0) {
        allTags.push(...record.secondaryTopics);
    }
    if (record.mitreTechniques && record.mitreTechniques.length > 0) {
        allTags.push(...record.mitreTechniques.map(t => t.id));
    }

    const uniqueTags = Array.from(new Set(allTags)).slice(0, 10);
    const visibleTags = uniqueTags.slice(0, 3);
    const overflowTagCount = uniqueTags.length - visibleTags.length;

    // Honest evidence badge
    const evidence = record.evidenceStatus;
    const evidenceConfig = (() => {
        switch (evidence) {
            case 'verified':
                return { label: 'Verified', class: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
            case 'advisory':
                return { label: 'Advisory', class: 'text-blue-700 bg-blue-50 border-blue-200' };
            case 'unverified-claim':
                return { label: 'Claim', class: 'text-amber-700 bg-amber-50 border-amber-200' };
            default:
                return { label: 'Unassessed', class: 'text-slate-600 bg-slate-50 border-slate-200' };
        }
    })();

    return (
        <article
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(record)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(record);
                }
            }}
            className={`flex flex-col justify-between bg-white rounded-xl p-[18px] border transition-all duration-150 text-left min-w-[280px] h-full cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#147DFA] ${
                isSelected
                    ? 'border-[#147DFA] ring-2 ring-[#147DFA]/20 shadow-sm'
                    : 'border-[#E2EAF3] hover:border-[#BFDBFE] hover:shadow-sm'
            }`}
        >
            <div>
                {/* Top Row: Category Badge & Date & Actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary Category Badge */}
                        <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${catStyle.bgClass} ${catStyle.textClass} ${catStyle.borderClass}`}
                        >
                            <CategoryIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>{catStyle.label}</span>
                        </span>

                        {/* Relative Publication Date */}
                        <span
                            className="inline-flex items-center gap-1 text-[11px] text-[#586C86]"
                            title={record.pubDate ? new Date(record.pubDate).toLocaleString() : undefined}
                        >
                            <Clock className="w-3 h-3 text-[#94A3B8]" aria-hidden="true" />
                            <span>{formattedDate}</span>
                        </span>
                    </div>

                    {/* Bookmark / Save Action */}
                    {onToggleSave && (
                        <button
                            type="button"
                            onClick={(e) => onToggleSave(record, e)}
                            className={`p-1 rounded-md transition-colors ${
                                isSaved
                                    ? 'text-[#147DFA] hover:text-blue-700 bg-blue-50'
                                    : 'text-[#94A3B8] hover:text-[#14263F] hover:bg-[#F4F7FB]'
                            }`}
                            title={isSaved ? 'Remove from saved' : 'Save report'}
                            aria-label={isSaved ? 'Remove report from saved' : 'Save report for later'}
                        >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                        </button>
                    )}
                </div>

                {/* Body: Title (clamped 3 lines) */}
                <h3 className="text-base font-semibold text-[#14263F] leading-snug line-clamp-3 mb-2 group-hover:text-[#147DFA] transition-colors">
                    {record.title || 'Untitled Report'}
                </h3>

                {/* Body: Summary (clamped 3 lines) */}
                <p className="text-xs text-[#586C86] leading-relaxed line-clamp-3 mb-3">
                    {displaySummary}
                </p>

                {/* Body: Tags */}
                {visibleTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {visibleTags.map((tag) => (
                            <span
                                key={tag}
                                onClick={(e) => {
                                    if (onTopicClick) {
                                        e.stopPropagation();
                                        onTopicClick(tag, e);
                                    }
                                }}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-[#334155] bg-[#F1F5F9] hover:bg-[#E2E8F0] border border-[#E2EAF3] cursor-pointer transition-colors"
                                title={`Filter by tag: ${tag}`}
                            >
                                #{tag}
                            </span>
                        ))}
                        {overflowTagCount > 0 && (
                            <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono text-[#64748B] bg-[#F8FAFC] border border-[#E2EAF3]"
                                title={`${overflowTagCount} additional tags`}
                            >
                                +{overflowTagCount}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Aligned Footer */}
            <div className="pt-3 border-t border-[#E2EAF3] flex items-center justify-between text-xs text-[#586C86] gap-2 mt-auto">
                {/* Publisher / Source */}
                <span className="font-medium text-[#14263F] truncate max-w-[130px]" title={record.source}>
                    {record.source || 'Unknown Publisher'}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Content Type Pill */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F4F7FB] text-[#586C86] border border-[#E2EAF3]">
                        {contentType}
                    </span>

                    {/* Evidence Status Pill */}
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${evidenceConfig.class}`}>
                        {evidenceConfig.label}
                    </span>
                </div>
            </div>
        </article>
    );
};

export default IntelligenceCard;
