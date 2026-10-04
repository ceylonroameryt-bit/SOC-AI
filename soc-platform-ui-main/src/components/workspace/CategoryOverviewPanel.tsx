import React, { useMemo, useState } from 'react';
import {
    Bell,
    Check,
    Hash,
    ArrowRight,
    Users,
} from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../../types/categories';
import type { IntelligenceRecord } from './ReportDetailPanel';

interface CategoryOverviewPanelProps {
    selectedCategoryId: string;
    records: IntelligenceRecord[];
    timeRange: string;
    onSelectRecord: (record: IntelligenceRecord) => void;
    onSelectTopic: (topic: string) => void;
    onViewAllReports: () => void;
}

const STORAGE_KEY_FOLLOWED = 'no_entry_followed_categories';

export const CategoryOverviewPanel: React.FC<CategoryOverviewPanelProps> = ({
    selectedCategoryId,
    records,
    timeRange,
    onSelectRecord,
    onSelectTopic,
    onViewAllReports,
}) => {
    // Followed state persisted in localStorage
    const [followedCategories, setFollowedCategories] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_FOLLOWED);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const isFollowed = followedCategories.includes(selectedCategoryId);

    const toggleFollow = () => {
        const next = isFollowed
            ? followedCategories.filter((id) => id !== selectedCategoryId)
            : [...followedCategories, selectedCategoryId];
        setFollowedCategories(next);
        try {
            localStorage.setItem(STORAGE_KEY_FOLLOWED, JSON.stringify(next));
        } catch (err) {
            console.error('Failed to save followed categories:', err);
        }
    };

    // Find active category definition
    const activeCategory = useMemo(() => {
        return (
            CATEGORY_DEFINITIONS.find((c) => c.id === selectedCategoryId) ||
            CATEGORY_DEFINITIONS[0]
        );
    }, [selectedCategoryId]);

    // Matching records in active category
    const matchingRecords = useMemo(() => {
        if (selectedCategoryId === 'all') {
            return records;
        }
        return records.filter(
            (r) => (r.intelCategory || r.category || '') === selectedCategoryId
        );
    }, [records, selectedCategoryId]);

    // Calculate genuine distinct indicators & actors without fake data
    const { distinctIndicatorsCount, distinctActorsCount, topTopics, recentUpdates } =
        useMemo(() => {
            const indicatorSet = new Set<string>();
            const actorSet = new Set<string>();
            const topicCounts: Record<string, number> = {};

            matchingRecords.forEach((r) => {
                // Collect CVEs
                if (r.ioc?.cves) {
                    r.ioc.cves.forEach((cve) => {
                        indicatorSet.add(cve.toUpperCase());
                        topicCounts[cve] = (topicCounts[cve] || 0) + 1;
                    });
                }
                // Collect IPs
                if (r.ioc?.ip_addresses) {
                    r.ioc.ip_addresses.forEach((ip) => indicatorSet.add(ip));
                }
                // Collect Domains
                if (r.ioc?.domains) {
                    r.ioc.domains.forEach((dom) => indicatorSet.add(dom.toLowerCase()));
                }

                // Collect secondary topics
                if (r.secondaryTopics) {
                    r.secondaryTopics.forEach((topic) => {
                        const clean = topic.trim();
                        if (clean) {
                            topicCounts[clean] = (topicCounts[clean] || 0) + 1;
                            if (clean.toLowerCase().includes('apt') || clean.toLowerCase().includes('group') || clean.toLowerCase().includes('lazarus')) {
                                actorSet.add(clean);
                            }
                        }
                    });
                }

                // Check title/snippet for common threat actors
                const combined = `${r.title || ''} ${r.contentSnippet || ''}`;
                const actorMatches = combined.match(/\b(APT\d+|Volt Typhoon|Midnight Blizzard|LockBit|BlackCat|Scattered Spider|Lazarus|FIN\d+)\b/gi);
                if (actorMatches) {
                    actorMatches.forEach(m => actorSet.add(m.toUpperCase()));
                }
            });

            // Sort topics by frequency
            const sortedTopics = Object.entries(topicCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));

            // Take 4 most recent records
            const sortedRecords = [...matchingRecords].sort((a, b) => {
                const dateA = new Date(a.pubDate || 0).getTime();
                const dateB = new Date(b.pubDate || 0).getTime();
                return dateB - dateA;
            });

            const recents = sortedRecords.slice(0, 4);

            return {
                distinctIndicatorsCount: indicatorSet.size,
                distinctActorsCount: actorSet.size,
                topTopics: sortedTopics,
                recentUpdates: recents,
            };
        }, [matchingRecords]);

    const CategoryIcon = activeCategory.icon;
    const [currentTime] = useState(() => Date.now());

    // Relative date formatter
    const formatSmallDate = (dateStr?: string) => {
        if (!dateStr) return 'Date unavailable';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Date unavailable';
            const diffHours = Math.floor((currentTime - d.getTime()) / (1000 * 60 * 60));
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffHours < 48) return 'Yesterday';
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return 'Date unavailable';
        }
    };

    return (
        <aside
            aria-label="Category Overview and Insights"
            className="w-full lg:w-[290px] shrink-0 bg-white border border-[#E2EAF3] rounded-xl p-5 shadow-2xs lg:sticky lg:top-4 flex flex-col gap-5 text-[#14263F]"
        >
            {/* Category Header */}
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#F4F7FB] border border-[#E2EAF3] text-[#147DFA] flex items-center justify-center shrink-0">
                            <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#14263F] leading-tight">
                                {activeCategory.displayName}
                            </h2>
                            <span className="text-xs text-[#586C86]">
                                {matchingRecords.length} {matchingRecords.length === 1 ? 'report' : 'reports'}
                            </span>
                        </div>
                    </div>

                    {/* Follow / Following Button (not on 'all') */}
                    {selectedCategoryId !== 'all' && (
                        <button
                            type="button"
                            onClick={toggleFollow}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1 shrink-0 ${
                                isFollowed
                                    ? 'bg-[#EAF2FF] text-[#147DFA] border-[#BFDBFE]'
                                    : 'bg-white text-[#14263F] border-[#E2EAF3] hover:bg-[#F4F7FB]'
                            }`}
                            title={isFollowed ? 'Unfollow this category' : 'Follow category updates'}
                        >
                            {isFollowed ? (
                                <>
                                    <Check className="w-3 h-3" />
                                    <span>Following</span>
                                </>
                            ) : (
                                <>
                                    <Bell className="w-3 h-3 text-[#586C86]" />
                                    <span>Follow</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                <p className="text-xs text-[#586C86] leading-relaxed mt-2">
                    {activeCategory.description}
                </p>
            </div>

            {/* Section A: Key Insights */}
            <div className="pt-4 border-t border-[#E2EAF3]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#586C86] mb-3">
                    Key Insights
                </h3>

                <div className="grid grid-cols-2 gap-2">
                    {/* Filtered Reports Metric */}
                    <div className="bg-[#F4F7FB] border border-[#E2EAF3] rounded-lg p-2.5">
                        <span className="text-[11px] text-[#586C86] block">In Scope ({timeRange})</span>
                        <span className="text-lg font-bold text-[#14263F]">
                            {matchingRecords.length}
                        </span>
                    </div>

                    {/* Distinct Indicators */}
                    <div className="bg-[#F4F7FB] border border-[#E2EAF3] rounded-lg p-2.5">
                        <span className="text-[11px] text-[#586C86] block">Indicators</span>
                        <span className="text-lg font-bold text-[#14263F]">
                            {distinctIndicatorsCount}
                        </span>
                    </div>

                    {/* Tracked Actors (when present) */}
                    <div className="col-span-2 bg-[#F4F7FB] border border-[#E2EAF3] rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-[#586C86] block">Tracked Threat Actors</span>
                            <span className="text-xs font-semibold text-[#14263F]">
                                {distinctActorsCount > 0 ? `${distinctActorsCount} Identified` : 'None in scope'}
                            </span>
                        </div>
                        <Users className="w-4 h-4 text-[#94A3B8]" />
                    </div>
                </div>
            </div>

            {/* Section B: Top Topics */}
            <div className="pt-4 border-t border-[#E2EAF3]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#586C86] mb-2.5">
                    Top Topics
                </h3>

                {topTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {topTopics.map((topic) => (
                            <button
                                key={topic.name}
                                type="button"
                                onClick={() => onSelectTopic(topic.name)}
                                className="px-2 py-1 rounded text-xs text-[#14263F] bg-[#F4F7FB] hover:bg-[#EAF2FF] hover:text-[#147DFA] border border-[#E2EAF3] hover:border-[#BFDBFE] transition-colors inline-flex items-center gap-1.5"
                                title={`Filter by ${topic.name} (${topic.count} reports)`}
                            >
                                <Hash className="w-3 h-3 text-[#94A3B8]" />
                                <span className="font-medium">{topic.name}</span>
                                <span className="text-[10px] text-[#586C86] bg-white px-1 py-0.2 rounded border border-[#E2EAF3]">
                                    {topic.count}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[#586C86] italic">No active topics found in this range.</p>
                )}
            </div>

            {/* Section C: Recent Updates */}
            <div className="pt-4 border-t border-[#E2EAF3]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#586C86] mb-2.5">
                    Recent Updates
                </h3>

                {recentUpdates.length > 0 ? (
                    <div className="space-y-2">
                        {recentUpdates.map((rec) => (
                            <button
                                key={rec.link || rec.title}
                                type="button"
                                onClick={() => onSelectRecord(rec)}
                                className="w-full text-left p-2 rounded-lg hover:bg-[#F4F7FB] border border-transparent hover:border-[#E2EAF3] transition-colors group block"
                            >
                                <div className="flex items-center justify-between text-[11px] text-[#586C86] mb-1">
                                    <span className="truncate max-w-[170px] font-medium text-[#14263F]">
                                        {rec.source}
                                    </span>
                                    <span>{formatSmallDate(rec.pubDate)}</span>
                                </div>
                                <h4 className="text-xs font-medium text-[#14263F] group-hover:text-[#147DFA] line-clamp-2 leading-snug">
                                    {rec.title}
                                </h4>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[#586C86] italic">No reports available.</p>
                )}
            </div>

            {/* Section D: View All Reports */}
            <div className="pt-4 border-t border-[#E2EAF3]">
                <button
                    type="button"
                    onClick={onViewAllReports}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-[#147DFA] hover:text-white bg-[#EAF2FF] hover:bg-[#147DFA] border border-[#BFDBFE] hover:border-[#147DFA] transition-colors inline-flex items-center justify-center gap-1.5"
                >
                    <span>View all {activeCategory.displayName.toLowerCase()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </aside>
    );
};

export default CategoryOverviewPanel;
