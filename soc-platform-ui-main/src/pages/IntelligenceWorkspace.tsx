import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
    Calendar,
    Search,
    AlertOctagon,
    RefreshCw,
    X,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    SlidersHorizontal,
    Globe,
    Bookmark,
    Layers,
} from 'lucide-react';
import { API_BASE } from '../config/api';
import type { TimeRange } from '../types/intelligence';
import ReportDetailPanel, { type IntelligenceRecord } from '../components/workspace/ReportDetailPanel';
import CategoryNavigation, { CATEGORY_DEFINITIONS } from '../components/workspace/CategoryNavigation';
import IntelligenceCard from '../components/workspace/IntelligenceCard';
import CategoryOverviewPanel from '../components/workspace/CategoryOverviewPanel';
import GlobalLiveNews from '../components/workspace/GlobalLiveNews';
import SavedNewsView from '../components/workspace/SavedNewsView';

const CARDS_PER_PAGE = 12;
const STORAGE_KEY_SAVED = 'no_entry_saved_reports';
const STORAGE_KEY_SAVED_STORE = 'no_entry_saved_articles_store';

export const IntelligenceWorkspace: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    // Determine initial view from route (/news, /global-news) or URL param
    const pathView = location.pathname.includes('news') ? 'global-news' : null;
    const urlView = (searchParams.get('view') as 'categories' | 'global-news' | 'saved') || pathView || 'categories';

    // URL State parameters
    const urlCategory = searchParams.get('category') || 'all';
    const urlTime = ((searchParams.get('time') || searchParams.get('range')) as TimeRange) || '24h';
    const urlQuery = searchParams.get('q') || '';
    const urlPage = parseInt(searchParams.get('page') || '1', 10);
    const urlSelectedId = searchParams.get('selected') || null;

    // Local data state
    const [records, setRecords] = useState<IntelligenceRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<IntelligenceRecord | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isStale, setIsStale] = useState<boolean>(false);
    const [isDemoEnabled, setIsDemoEnabled] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string>('Syncing...');
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Saved records store (full objects + IDs) persisted in localStorage
    const [savedRecordsMap, setSavedRecordsMap] = useState<Record<string, IntelligenceRecord>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_SAVED_STORE);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    // Mobile overview drawer toggle
    const [mobileOverviewOpen, setMobileOverviewOpen] = useState(false);

    // Synchronize URL helper
    const updateUrlParams = useCallback(
        (updates: Record<string, string | null>) => {
            const next = new URLSearchParams(searchParams);
            for (const [key, value] of Object.entries(updates)) {
                if (
                    value === null ||
                    value === '' ||
                    (key === 'category' && value === 'all') ||
                    (key === 'time' && value === '24h') ||
                    (key === 'page' && value === '1') ||
                    (key === 'view' && value === 'categories')
                ) {
                    next.delete(key);
                } else {
                    next.set(key, value);
                }
            }
            setSearchParams(next, { replace: false });
        },
        [searchParams, setSearchParams]
    );

    // Fetch live intelligence records and telemetry
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const [snapshotRes, newsRes] = await Promise.allSettled([
                fetch(`${API_BASE}/api/dashboard/snapshot`).then((r) => (r.ok ? r.json() : null)),
                fetch(`${API_BASE}/api/news?limit=500`).then((r) => (r.ok ? r.json() : null)),
            ]);

            let newsItems: IntelligenceRecord[] = [];
            if (newsRes.status === 'fulfilled' && newsRes.value) {
                newsItems = Array.isArray(newsRes.value)
                    ? newsRes.value
                    : Array.isArray(newsRes.value?.news)
                    ? newsRes.value.news
                    : [];
                setRecords(newsItems);
            } else if (newsRes.status === 'rejected') {
                throw new Error('Unable to communicate with threat intelligence service.');
            }

            if (snapshotRes.status === 'fulfilled' && snapshotRes.value) {
                const s = snapshotRes.value;
                setIsDemoEnabled(Boolean(s.environment?.isDemoEnabled));
                setIsStale(Boolean(s.isStale));
                if (s.generatedAt) {
                    setLastSyncTime(
                        new Date(s.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    );
                }
            }

            // Sync selected record from URL if exists
            if (urlSelectedId && newsItems.length > 0) {
                const found = newsItems.find(
                    (r) => r.link === urlSelectedId || r.title === urlSelectedId || r.id === urlSelectedId
                );
                if (found) setSelectedRecord(found);
            }
        } catch (err: any) {
            console.error('Failed to load intelligence workspace data:', err);
            setFetchError(err.message || 'Error loading intelligence data');
        } finally {
            setIsLoading(false);
        }
    }, [urlSelectedId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle escape key to close detail drawer or mobile overview
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedRecord) {
                    setSelectedRecord(null);
                    updateUrlParams({ selected: null });
                }
                if (mobileOverviewOpen) {
                    setMobileOverviewOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRecord, mobileOverviewOpen, updateUrlParams]);

    // 1. Authoritative Date Filtering
    const dateFilteredRecords = useMemo(() => {
        if (urlTime === 'all') return records;

        const now = Date.now();
        let cutoff = 0;
        if (urlTime === '24h') cutoff = now - 24 * 60 * 60 * 1000;
        else if (urlTime === '7d') cutoff = now - 7 * 24 * 60 * 60 * 1000;
        else if (urlTime === '30d') cutoff = now - 30 * 24 * 60 * 60 * 1000;

        return records.filter((r) => {
            if (!r.pubDate) return true;
            const time = new Date(r.pubDate).getTime();
            return isNaN(time) ? true : time >= cutoff;
        });
    }, [records, urlTime]);

    // 2. Real matching category counts based on authoritative date-filtered items
    const countsByCategory = useMemo(() => {
        const map: Record<string, number> = { all: dateFilteredRecords.length };
        CATEGORY_DEFINITIONS.forEach((cat) => {
            if (cat.id !== 'all') {
                map[cat.id] = 0;
            }
        });

        dateFilteredRecords.forEach((r) => {
            const catId = r.intelCategory || r.category || 'general-security-news';
            if (map[catId] !== undefined) {
                map[catId] += 1;
            } else {
                map['general-security-news'] = (map['general-security-news'] || 0) + 1;
            }
        });

        return map;
    }, [dateFilteredRecords]);

    // 3. Category & Search Filtering
    const fullyFilteredRecords = useMemo(() => {
        let result = dateFilteredRecords;

        // Apply Category
        if (urlCategory !== 'all') {
            result = result.filter(
                (r) => (r.intelCategory || r.category || 'general-security-news') === urlCategory
            );
        }

        // Apply Search query if present
        if (urlQuery.trim()) {
            const q = urlQuery.toLowerCase().trim();
            result = result.filter((r) => {
                const titleMatch = (r.title || '').toLowerCase().includes(q);
                const sourceMatch = (r.source || '').toLowerCase().includes(q);
                const summaryMatch = (r.contentSnippet || r.content || '').toLowerCase().includes(q);
                const topicMatch = (r.secondaryTopics || []).some((t) => t.toLowerCase().includes(q));
                const cveMatch = (r.ioc?.cves || []).some((c) => c.toLowerCase().includes(q));
                return titleMatch || sourceMatch || summaryMatch || topicMatch || cveMatch;
            });
        }

        return result;
    }, [dateFilteredRecords, urlCategory, urlQuery]);

    // 4. Pagination
    const totalPages = Math.max(1, Math.ceil(fullyFilteredRecords.length / CARDS_PER_PAGE));
    const currentPage = Math.min(Math.max(1, urlPage), totalPages);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * CARDS_PER_PAGE;
        return fullyFilteredRecords.slice(start, start + CARDS_PER_PAGE);
    }, [fullyFilteredRecords, currentPage]);

    // Handlers
    const handleCategorySelect = (categoryId: string) => {
        updateUrlParams({ category: categoryId, page: '1' });
    };

    const handleTimeChange = (time: TimeRange) => {
        updateUrlParams({ time, page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            updateUrlParams({ page: newPage.toString() });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSelectCard = (rec: IntelligenceRecord) => {
        setSelectedRecord(rec);
        updateUrlParams({ selected: rec.link || rec.title });
    };

    const handleCloseDetail = () => {
        setSelectedRecord(null);
        updateUrlParams({ selected: null });
    };

    // Save/Bookmark toggler
    const handleToggleSave = (rec: IntelligenceRecord, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const id = rec.link || rec.title;
        setSavedRecordsMap((prev) => {
            const next = { ...prev };
            if (next[id]) {
                delete next[id];
            } else {
                next[id] = rec;
            }
            try {
                localStorage.setItem(STORAGE_KEY_SAVED_STORE, JSON.stringify(next));
                localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(Object.keys(next)));
            } catch (err) {
                console.error('Failed to persist saved report:', err);
            }
            return next;
        });
    };

    // Save all news records for a specific date
    const handleSaveAllForDate = (_dateLabel: string, items: IntelligenceRecord[]) => {
        setSavedRecordsMap((prev) => {
            const next = { ...prev };
            items.forEach((item) => {
                const id = item.link || item.title;
                next[id] = item;
            });
            try {
                localStorage.setItem(STORAGE_KEY_SAVED_STORE, JSON.stringify(next));
                localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(Object.keys(next)));
            } catch (err) {
                console.error('Failed to save date items:', err);
            }
            return next;
        });
    };

    const handleClearAllSaved = () => {
        setSavedRecordsMap({});
        try {
            localStorage.removeItem(STORAGE_KEY_SAVED_STORE);
            localStorage.removeItem(STORAGE_KEY_SAVED);
        } catch {}
    };

    const handleTopicClick = (topic: string) => {
        updateUrlParams({ q: topic, page: '1' });
    };

    const handleClearFilters = () => {
        updateUrlParams({ category: 'all', q: null, time: '24h', page: '1' });
    };

    const savedCount = Object.keys(savedRecordsMap).length;

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 space-y-5 max-w-[1680px] mx-auto w-full overflow-y-auto custom-scrollbar bg-[#F4F7FB]">
            {/* Page Heading & Time Range Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-semibold text-[#147DFA] uppercase tracking-wider bg-[#EAF2FF] px-2.5 py-0.5 rounded border border-[#BFDBFE]">
                            Threat Operations
                        </span>
                        {isDemoEnabled && (
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <AlertOctagon className="w-3 h-3 text-amber-900" />
                                <span>DEMO DATA</span>
                            </span>
                        )}
                        {isStale && (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded">
                                Stale Telemetry (Last sync {lastSyncTime})
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-[30px] font-bold text-[#14263F] tracking-tight font-sans">
                        Threat Intelligence
                    </h1>
                    <p className="text-[#586C86] text-xs sm:text-sm mt-0.5 font-normal">
                        {urlView === 'global-news'
                            ? 'Live real-time stream of all intelligence reports without category restrictions, grouped by date.'
                            : urlView === 'saved'
                            ? 'Review and manage all intelligence articles saved to this device.'
                            : 'Explore the latest research and updates by threat category.'}
                    </p>
                </div>

                {/* Authoritative Date Range Selector & Actions (Shown on Categories view) */}
                {urlView === 'categories' && (
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="inline-flex items-center bg-white border border-[#E2EAF3] rounded-lg p-1 shadow-2xs">
                            <Calendar className="w-4 h-4 text-[#586C86] ml-2 mr-1 shrink-0" aria-hidden="true" />
                            {(['24h', '7d', '30d', 'all'] as TimeRange[]).map((t) => {
                                const labels: Record<TimeRange, string> = {
                                    '24h': 'Last 24 hours',
                                    '7d': 'Last 7 days',
                                    '30d': 'Last 30 days',
                                    'all': 'All time',
                                };
                                const isActive = urlTime === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => handleTimeChange(t)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                            isActive
                                                ? 'bg-[#147DFA] text-white shadow-xs'
                                                : 'text-[#586C86] hover:text-[#14263F] hover:bg-[#F4F7FB]'
                                        }`}
                                    >
                                        {labels[t]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile Overview Trigger */}
                        <button
                            type="button"
                            onClick={() => setMobileOverviewOpen(true)}
                            className="lg:hidden px-3 py-2 rounded-lg bg-white border border-[#E2EAF3] text-xs font-medium text-[#14263F] hover:bg-[#F4F7FB] inline-flex items-center gap-1.5 shadow-2xs"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#586C86]" />
                            <span>Category Overview</span>
                        </button>

                        {/* Refresh Data */}
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="px-3 py-2 rounded-lg bg-white border border-[#E2EAF3] hover:bg-[#F4F7FB] text-[#14263F] text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#147DFA]"
                            title="Refresh intelligence feeds"
                            aria-label="Refresh intelligence feeds"
                        >
                            <RefreshCw
                                className={`w-3.5 h-3.5 text-[#586C86] ${isLoading ? 'animate-spin text-[#147DFA]' : ''}`}
                            />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                    </div>
                )}
            </div>

            {/* View Mode Switcher Tabs: Threat Categories | Global Live News | Saved News */}
            <div className="flex items-center gap-2 border-b border-[#E2EAF3] py-2 overflow-x-auto min-h-[48px]">
                <button
                    type="button"
                    onClick={() => updateUrlParams({ view: 'categories' })}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#147DFA] ${
                        urlView === 'categories'
                            ? 'bg-white text-[#147DFA] shadow-2xs border border-[#BFDBFE]'
                            : 'text-[#586C86] hover:text-[#14263F] hover:bg-white/60 border border-transparent'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>Threat Categories</span>
                </button>

                <button
                    type="button"
                    onClick={() => updateUrlParams({ view: 'global-news' })}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#147DFA] ${
                        urlView === 'global-news'
                            ? 'bg-white text-[#147DFA] shadow-2xs border border-[#BFDBFE]'
                            : 'text-[#586C86] hover:text-[#14263F] hover:bg-white/60 border border-transparent'
                    }`}
                >
                    <Globe className="w-4 h-4 text-[#147DFA]" />
                    <span>Global Live News</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </button>

                <button
                    type="button"
                    onClick={() => updateUrlParams({ view: 'saved' })}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#147DFA] ${
                        urlView === 'saved'
                            ? 'bg-white text-[#147DFA] shadow-2xs border border-[#BFDBFE]'
                            : 'text-[#586C86] hover:text-[#14263F] hover:bg-white/60 border border-transparent'
                    }`}
                >
                    <Bookmark className="w-4 h-4" />
                    <span>Saved News</span>
                    {savedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#EAF2FF] text-[#147DFA] border border-[#BFDBFE]">
                            {savedCount}
                        </span>
                    )}
                </button>
            </div>

            {/* VIEW 1: GLOBAL LIVE NEWS (All news, without category, date-based streaming, save all news on date) */}
            {urlView === 'global-news' && (
                <GlobalLiveNews
                    records={records}
                    isLoading={isLoading}
                    savedRecordsMap={savedRecordsMap}
                    onToggleSave={handleToggleSave}
                    onSaveAllForDate={handleSaveAllForDate}
                    onSelectRecord={handleSelectCard}
                    onRefresh={fetchData}
                />
            )}

            {/* VIEW 2: SAVED NEWS (Preserved on this device, search, export) */}
            {urlView === 'saved' && (
                <SavedNewsView
                    savedRecordsMap={savedRecordsMap}
                    onRemoveSaved={handleToggleSave}
                    onClearAllSaved={handleClearAllSaved}
                    onSelectRecord={handleSelectCard}
                    onSwitchToGlobalNews={() => updateUrlParams({ view: 'global-news' })}
                />
            )}

            {/* VIEW 3: CATEGORIES WORKSPACE */}
            {urlView === 'categories' && (
                <>
                    {/* Horizontal Category Navigation Tiles */}
                    <section aria-label="Category Selection">
                        <CategoryNavigation
                            selectedCategoryId={urlCategory}
                            onSelectCategory={handleCategorySelect}
                            countsByCategory={countsByCategory}
                        />
                    </section>

                    {/* Active Filters Bar (When search query or active category is applied) */}
                    {(urlCategory !== 'all' || urlQuery) && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-[#E2EAF3] text-xs text-[#586C86]">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-[#14263F]">Active filters:</span>
                                {urlCategory !== 'all' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF2FF] text-[#147DFA] border border-[#BFDBFE] font-medium">
                                        Category: {CATEGORY_DEFINITIONS.find((c) => c.id === urlCategory)?.displayName || urlCategory}
                                        <button
                                            type="button"
                                            onClick={() => handleCategorySelect('all')}
                                            className="hover:text-blue-900"
                                            aria-label="Remove category filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                {urlQuery && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] border border-[#E2EAF3] font-medium">
                                        Query: "{urlQuery}"
                                        <button
                                            type="button"
                                            onClick={() => updateUrlParams({ q: null, page: '1' })}
                                            className="hover:text-slate-900"
                                            aria-label="Remove search query filter"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                                <span>
                                    Showing {fullyFilteredRecords.length} matching {fullyFilteredRecords.length === 1 ? 'report' : 'reports'}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="text-xs font-medium text-[#147DFA] hover:text-blue-800 hover:underline shrink-0"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}

                    {/* Main Content Layout: Card Grid + Right Overview Panel */}
                    <div className="flex flex-col lg:flex-row items-start gap-6">
                        {/* Left/Center Area: Intelligence Card Grid */}
                        <main className="flex-1 w-full min-w-0">
                            {/* Error State with Retry */}
                            {fetchError && (
                                <div
                                    role="alert"
                                    className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 my-4"
                                >
                                    <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                                    <h3 className="text-base font-bold">Failed to load intelligence records</h3>
                                    <p className="text-xs text-red-600 mt-1 max-w-md mx-auto">{fetchError}</p>
                                    <button
                                        onClick={fetchData}
                                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            )}

                            {/* Skeleton Loading State */}
                            {isLoading && !fetchError && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-xl border border-[#E2EAF3] p-5 h-64 animate-pulse flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="h-5 w-24 bg-slate-200 rounded-full" />
                                                    <div className="h-4 w-16 bg-slate-200 rounded" />
                                                </div>
                                                <div className="h-5 w-full bg-slate-200 rounded mb-2" />
                                                <div className="h-5 w-3/4 bg-slate-200 rounded mb-4" />
                                                <div className="h-4 w-full bg-slate-100 rounded mb-2" />
                                                <div className="h-4 w-5/6 bg-slate-100 rounded" />
                                            </div>
                                            <div className="pt-3 border-t border-[#E2EAF3] flex justify-between">
                                                <div className="h-4 w-20 bg-slate-200 rounded" />
                                                <div className="h-4 w-24 bg-slate-200 rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Empty State: No Matching Reports */}
                            {!isLoading && !fetchError && fullyFilteredRecords.length === 0 && (
                                <div className="bg-white rounded-xl border border-[#E2EAF3] p-12 text-center text-[#14263F]">
                                    <div className="w-12 h-12 rounded-full bg-[#F4F7FB] border border-[#E2EAF3] text-[#586C86] flex items-center justify-center mx-auto mb-3">
                                        <Search className="w-6 h-6 text-[#94A3B8]" />
                                    </div>
                                    <h3 className="text-base font-bold text-[#14263F]">No matching intelligence reports</h3>
                                    <p className="text-xs text-[#586C86] mt-1 max-w-sm mx-auto">
                                        We couldn't find any threat reports matching your current category, search, and date filters.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleClearFilters}
                                        className="mt-4 px-4 py-2 bg-[#147DFA] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                                    >
                                        Clear all filters
                                    </button>
                                </div>
                            )}

                            {/* 3-Column Intelligence Card Grid */}
                            {!isLoading && !fetchError && fullyFilteredRecords.length > 0 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                        {paginatedRecords.map((record) => {
                                            const recordId = record.link || record.title;
                                            const isSelected = selectedRecord?.link === record.link || selectedRecord?.title === record.title;
                                            const isSaved = Boolean(savedRecordsMap[recordId]);

                                            return (
                                                <IntelligenceCard
                                                    key={recordId}
                                                    record={record}
                                                    isSelected={isSelected}
                                                    isSaved={isSaved}
                                                    onSelect={handleSelectCard}
                                                    onToggleSave={handleToggleSave}
                                                    onTopicClick={handleTopicClick}
                                                />
                                            );
                                        })}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <nav
                                            aria-label="Intelligence reports pagination"
                                            className="flex items-center justify-between bg-white border border-[#E2EAF3] rounded-xl px-4 py-3 shadow-2xs text-xs text-[#586C86]"
                                        >
                                            <div>
                                                Showing{' '}
                                                <span className="font-semibold text-[#14263F]">
                                                    {(currentPage - 1) * CARDS_PER_PAGE + 1}
                                                </span>{' '}
                                                to{' '}
                                                <span className="font-semibold text-[#14263F]">
                                                    {Math.min(currentPage * CARDS_PER_PAGE, fullyFilteredRecords.length)}
                                                </span>{' '}
                                                of{' '}
                                                <span className="font-semibold text-[#14263F]">
                                                    {fullyFilteredRecords.length}
                                                </span>{' '}
                                                reports
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                    className="px-2.5 py-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F4F7FB] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 text-[#14263F]"
                                                    aria-label="Previous page"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                    <span>Previous</span>
                                                </button>

                                                <span className="px-3 py-1.5 text-xs font-semibold text-[#14263F]">
                                                    Page {currentPage} of {totalPages}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                    className="px-2.5 py-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F4F7FB] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 text-[#14263F]"
                                                    aria-label="Next page"
                                                >
                                                    <span>Next</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </nav>
                                    )}
                                </div>
                            )}
                        </main>

                        {/* Right Area: Category Overview Panel (Desktop: 290px sticky) */}
                        <div className="hidden lg:block">
                            <CategoryOverviewPanel
                                selectedCategoryId={urlCategory}
                                records={dateFilteredRecords}
                                timeRange={urlTime === '24h' ? '24h' : urlTime === '7d' ? '7d' : urlTime === '30d' ? '30d' : 'All'}
                                onSelectRecord={handleSelectCard}
                                onSelectTopic={handleTopicClick}
                                onViewAllReports={() => handleCategorySelect(urlCategory)}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Mobile Category Overview Drawer */}
            {mobileOverviewOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Category Overview Panel"
                >
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
                        onClick={() => setMobileOverviewOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="relative w-full max-w-sm bg-white h-full shadow-2xl p-4 overflow-y-auto z-10 flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E2EAF3] mb-3">
                            <span className="text-sm font-bold text-[#14263F]">Category Overview</span>
                            <button
                                type="button"
                                onClick={() => setMobileOverviewOpen(false)}
                                className="p-1 rounded text-[#586C86] hover:bg-[#F4F7FB]"
                                aria-label="Close overview"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <CategoryOverviewPanel
                            selectedCategoryId={urlCategory}
                            records={dateFilteredRecords}
                            timeRange={urlTime}
                            onSelectRecord={(r) => {
                                setMobileOverviewOpen(false);
                                handleSelectCard(r);
                            }}
                            onSelectTopic={(t) => {
                                setMobileOverviewOpen(false);
                                handleTopicClick(t);
                            }}
                            onViewAllReports={() => {
                                setMobileOverviewOpen(false);
                                handleCategorySelect(urlCategory);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Report Detail Slide-Over Overlay / Drawer */}
            {selectedRecord && (
                <div
                    className="fixed inset-0 z-50 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Report Detail Drawer"
                >
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150"
                        onClick={handleCloseDetail}
                        aria-hidden="true"
                    />

                    {/* Drawer Content (Right Slide-over, 600px wide on desktop) */}
                    <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-200 border-l border-[#E2EAF3]">
                        <ReportDetailPanel
                            record={selectedRecord}
                            onClose={handleCloseDetail}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntelligenceWorkspace;
