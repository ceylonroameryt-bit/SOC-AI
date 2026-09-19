import React, { useState, useMemo, useEffect } from 'react';
import {
    Globe,
    Calendar,
    Bookmark,
    Search,
    ExternalLink,
    RefreshCw,
    Download,
    Check,
} from 'lucide-react';
import type { IntelligenceRecord } from './ReportDetailPanel';

interface GlobalLiveNewsProps {
    records: IntelligenceRecord[];
    isLoading: boolean;
    savedRecordsMap: Record<string, IntelligenceRecord>;
    onToggleSave: (record: IntelligenceRecord) => void;
    onSaveAllForDate: (dateLabel: string, items: IntelligenceRecord[]) => void;
    onSelectRecord: (record: IntelligenceRecord) => void;
    onRefresh: () => void;
}

export const GlobalLiveNews: React.FC<GlobalLiveNewsProps> = ({
    records,
    isLoading,
    savedRecordsMap,
    onToggleSave,
    onSaveAllForDate,
    onSelectRecord,
    onRefresh,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'yesterday' | '7d' | string>('all');
    const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const [justSavedDate, setJustSavedDate] = useState<string | null>(null);

    // Auto-polling every 60 seconds if enabled
    useEffect(() => {
        if (!autoRefreshEnabled) return;
        const interval = setInterval(() => {
            onRefresh();
        }, 60000);
        return () => clearInterval(interval);
    }, [autoRefreshEnabled, onRefresh]);

    // Format helper for calendar dates (YYYY-MM-DD)
    const getDateKey = (dateStr?: string): string => {
        if (!dateStr) return 'Undated';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Undated';
            return d.toISOString().split('T')[0];
        } catch {
            return 'Undated';
        }
    };

    // Format display date label (e.g., "Today, Sept 19, 2026")
    const formatDateHeader = (dateKey: string): string => {
        if (dateKey === 'Undated') return 'Unspecified Date';
        try {
            const [y, m, d] = dateKey.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const todayStr = new Date().toISOString().split('T')[0];
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (dateKey === todayStr) {
                return `Today — ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
            if (dateKey === yesterdayStr) {
                return `Yesterday — ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
            return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateKey;
        }
    };

    // Available unique calendar dates in dataset
    const availableDateKeys = useMemo(() => {
        const set = new Set<string>();
        records.forEach((r) => {
            const key = getDateKey(r.pubDate);
            if (key !== 'Undated') set.add(key);
        });
        return Array.from(set).sort().reverse();
    }, [records]);

    // Filter records without category restriction (Global Live Feed)
    const filteredRecords = useMemo(() => {
        let items = records;

        // 1. Date-based filter
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (selectedDateFilter === 'today') {
            items = items.filter((r) => getDateKey(r.pubDate) === todayStr);
        } else if (selectedDateFilter === 'yesterday') {
            items = items.filter((r) => getDateKey(r.pubDate) === yesterdayStr);
        } else if (selectedDateFilter === '7d') {
            const past7dCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
            items = items.filter((r) => {
                const t = new Date(r.pubDate || 0).getTime();
                return !isNaN(t) && t >= past7dCutoff;
            });
        } else if (selectedDateFilter !== 'all') {
            items = items.filter((r) => getDateKey(r.pubDate) === selectedDateFilter);
        }

        // 2. Severity filter if selected
        if (selectedSeverity !== 'all') {
            items = items.filter((r) =>
                (r.severity || '').toLowerCase().includes(selectedSeverity.toLowerCase())
            );
        }

        // 3. Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            items = items.filter((r) => {
                const titleMatch = (r.title || '').toLowerCase().includes(q);
                const sourceMatch = (r.source || '').toLowerCase().includes(q);
                const summaryMatch = (r.contentSnippet || r.content || '').toLowerCase().includes(q);
                const topicMatch = (r.secondaryTopics || []).some((t) => t.toLowerCase().includes(q));
                return titleMatch || sourceMatch || summaryMatch || topicMatch;
            });
        }

        // Sort strictly newest first
        return [...items].sort((a, b) => {
            const tA = new Date(a.pubDate || 0).getTime();
            const tB = new Date(b.pubDate || 0).getTime();
            return tB - tA;
        });
    }, [records, selectedDateFilter, selectedSeverity, searchQuery]);

    // Group filtered records by dateKey
    const groupedByDate = useMemo(() => {
        const groups: Record<string, IntelligenceRecord[]> = {};
        filteredRecords.forEach((item) => {
            const key = getDateKey(item.pubDate);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [filteredRecords]);

    const dateGroupKeys = Object.keys(groupedByDate);

    // Export date group to JSON
    const handleExportDateGroup = (dateKey: string, items: IntelligenceRecord[]) => {
        try {
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `no-entry-global-news-${dateKey}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export date news:', err);
        }
    };

    const handleSaveDateGroup = (dateKey: string, items: IntelligenceRecord[]) => {
        onSaveAllForDate(dateKey, items);
        setJustSavedDate(dateKey);
        setTimeout(() => setJustSavedDate(null), 2500);
    };

    return (
        <div className="flex flex-col space-y-5 w-full">
            {/* Control Bar: Live Status, Search, Date Filter, Severity & Auto-Refresh */}
            <div className="bg-white rounded-xl border border-[#E2EAF3] p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search in Global News */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search all live global news stories…"
                        className="w-full pl-9 pr-8 py-2 bg-[#F8FAFC] border border-[#E2EAF3] focus:border-[#147DFA] focus:bg-white rounded-lg text-xs text-[#14263F] placeholder-[#94A3B8] outline-none transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Date-Based Filter */}
                    <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2EAF3] rounded-lg px-2.5 py-1.5 text-xs text-[#14263F]">
                        <Calendar className="w-3.5 h-3.5 text-[#586C86]" />
                        <select
                            value={selectedDateFilter}
                            onChange={(e) => setSelectedDateFilter(e.target.value)}
                            className="bg-transparent text-xs text-[#14263F] font-medium outline-none cursor-pointer pr-1"
                            aria-label="Filter news by date"
                        >
                            <option value="all">All Dates ({records.length})</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="7d">Past 7 Days</option>
                            {availableDateKeys.slice(0, 10).map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Severity Filter */}
                    <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2EAF3] rounded-lg px-2.5 py-1.5 text-xs text-[#14263F]">
                        <select
                            value={selectedSeverity}
                            onChange={(e) => setSelectedSeverity(e.target.value)}
                            className="bg-transparent text-xs text-[#14263F] font-medium outline-none cursor-pointer pr-1"
                            aria-label="Filter news by severity"
                        >
                            <option value="all">All Severities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    {/* Auto-Refresh Toggle */}
                    <button
                        type="button"
                        onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                            autoRefreshEnabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-[#F8FAFC] text-[#586C86] border-[#E2EAF3]'
                        }`}
                        title="Auto-refresh news every 60s"
                    >
                        <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{autoRefreshEnabled ? 'Live Stream' : 'Paused'}</span>
                    </button>

                    {/* Instant Manual Refresh */}
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F8FAFC] text-[#586C86] hover:text-[#14263F] transition-colors focus:outline-none"
                        title="Fetch latest news"
                        aria-label="Fetch latest news"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#147DFA]' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Results Count Summary */}
            <div className="flex items-center justify-between text-xs text-[#586C86] px-1">
                <span>
                    Streaming{' '}
                    <strong className="text-[#14263F] font-semibold">{filteredRecords.length}</strong> live stories across all intelligence sources
                </span>
                {selectedDateFilter !== 'all' && (
                    <button
                        type="button"
                        onClick={() => setSelectedDateFilter('all')}
                        className="text-[#147DFA] hover:underline"
                    >
                        Reset date filter
                    </button>
                )}
            </div>

            {/* Grouped Date Stream */}
            {dateGroupKeys.length === 0 && !isLoading && (
                <div className="bg-white rounded-xl border border-[#E2EAF3] p-12 text-center text-[#14263F]">
                    <Globe className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-base font-bold">No global news stories found</h3>
                    <p className="text-xs text-[#586C86] mt-1">Try broadening your date filter or clearing search terms.</p>
                </div>
            )}

            {dateGroupKeys.map((dateKey) => {
                const items = groupedByDate[dateKey] || [];
                const headerLabel = formatDateHeader(dateKey);
                const allItemsSaved = items.every((i) => Boolean(savedRecordsMap[i.link || i.title]));

                return (
                    <section
                        key={dateKey}
                        aria-label={`News for ${headerLabel}`}
                        className="bg-white rounded-xl border border-[#E2EAF3] overflow-hidden shadow-2xs"
                    >
                        {/* Date Group Header with "Save All News" Action */}
                        <div className="bg-[#F8FAFC] border-b border-[#E2EAF3] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1 rounded bg-[#EAF2FF] text-[#147DFA] border border-[#BFDBFE]">
                                    <Calendar className="w-3.5 h-3.5" />
                                </div>
                                <h3 className="text-sm font-bold text-[#14263F]">{headerLabel}</h3>
                                <span className="text-xs font-medium text-[#586C86] bg-white px-2 py-0.5 rounded-full border border-[#E2EAF3]">
                                    {items.length} {items.length === 1 ? 'story' : 'stories'}
                                </span>
                            </div>

                            {/* Batch Actions for this Date: Save All & Export */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveDateGroup(dateKey, items)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
                                        allItemsSaved || justSavedDate === dateKey
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-white text-[#14263F] border-[#E2EAF3] hover:bg-[#F4F7FB]'
                                    }`}
                                    title="Save all news from this date to your saved collection"
                                >
                                    {allItemsSaved || justSavedDate === dateKey ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>All Saved</span>
                                        </>
                                    ) : (
                                        <>
                                            <Bookmark className="w-3.5 h-3.5 text-[#586C86]" />
                                            <span>Save all news ({items.length})</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleExportDateGroup(dateKey, items)}
                                    className="p-1 rounded-md bg-white border border-[#E2EAF3] hover:bg-[#F4F7FB] text-[#586C86] hover:text-[#14263F] transition-colors"
                                    title="Export news on this date to JSON"
                                    aria-label="Export news on this date to JSON"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* List of News Items on this Date */}
                        <div className="divide-y divide-[#E2EAF3]">
                            {items.map((record) => {
                                const recordId = record.link || record.title;
                                const isSaved = Boolean(savedRecordsMap[recordId]);
                                const timeStr = record.pubDate
                                    ? new Date(record.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : 'Live';

                                return (
                                    <article
                                        key={recordId}
                                        className="p-4 hover:bg-[#F8FAFC] transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4 group"
                                    >
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => onSelectRecord(record)}
                                        >
                                            <div className="flex items-center gap-2 flex-wrap text-xs text-[#586C86] mb-1.5">
                                                <span className="font-mono text-[11px] text-[#147DFA] bg-[#EAF2FF] px-1.5 py-0.5 rounded">
                                                    {timeStr}
                                                </span>
                                                <span className="font-semibold text-[#14263F]">
                                                    {record.source}
                                                </span>
                                                {record.severity && (
                                                    <span
                                                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                                                            record.severity.toLowerCase().includes('crit')
                                                                ? 'text-red-700 bg-red-50 border-red-200'
                                                                : record.severity.toLowerCase().includes('high')
                                                                ? 'text-orange-700 bg-orange-50 border-orange-200'
                                                                : 'text-slate-600 bg-slate-50 border-slate-200'
                                                        }`}
                                                    >
                                                        {record.severity}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-semibold text-[#14263F] group-hover:text-[#147DFA] transition-colors leading-snug">
                                                {record.title}
                                            </h4>

                                            {record.contentSnippet && (
                                                <p className="text-xs text-[#586C86] mt-1 line-clamp-2 leading-relaxed">
                                                    {record.contentSnippet.replace(/<[^>]*>?/gm, '')}
                                                </p>
                                            )}

                                            {/* Tags / CVEs */}
                                            {record.ioc?.cves && record.ioc.cves.length > 0 && (
                                                <div className="flex items-center gap-1.5 mt-2">
                                                    {record.ioc.cves.slice(0, 3).map((cve) => (
                                                        <span
                                                            key={cve}
                                                            className="text-[10px] font-mono font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded"
                                                        >
                                                            {cve}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions: Save & External Link */}
                                        <div className="flex items-center gap-1.5 shrink-0 self-start mt-1 md:mt-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleSave(record);
                                                }}
                                                className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 text-xs ${
                                                    isSaved
                                                        ? 'bg-[#EAF2FF] text-[#147DFA] border-[#BFDBFE]'
                                                        : 'bg-white text-[#586C86] border-[#E2EAF3] hover:text-[#14263F] hover:bg-[#F4F7FB]'
                                                }`}
                                                title={isSaved ? 'Remove from saved' : 'Save article'}
                                                aria-label={isSaved ? 'Remove from saved' : 'Save article'}
                                            >
                                                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                                                <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
                                            </button>

                                            {record.link && (
                                                <a
                                                    href={record.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F4F7FB] text-[#586C86] hover:text-[#14263F] transition-colors"
                                                    title="Open original source"
                                                    aria-label="Open original source"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};

export default GlobalLiveNews;
