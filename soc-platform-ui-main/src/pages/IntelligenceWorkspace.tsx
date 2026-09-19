import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Newspaper, ShieldAlert, Radio, AlertOctagon, RefreshCw } from 'lucide-react';
import MetricCard from '../components/workspace/MetricCard';
import IntelligenceTable, { type TimeRange } from '../components/workspace/IntelligenceTable';
import ReportDetailPanel, { type IntelligenceRecord } from '../components/workspace/ReportDetailPanel';
import { API_BASE } from '../config/api';

interface CategoryCount {
    id: string;
    displayName: string;
    count: number;
}

export const IntelligenceWorkspace: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // URL State parameters
    const urlSeverity      = searchParams.get('severity')  || 'All';
    const urlQuery         = searchParams.get('q')         || '';
    const urlSelectedId    = searchParams.get('selected')  || null;
    const urlCategory      = searchParams.get('category')  || 'all';
    const urlTimeRange     = (searchParams.get('time') as TimeRange) || '24h';

    // Local state
    const [records, setRecords]               = useState<IntelligenceRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<IntelligenceRecord | null>(null);
    const [isLoading, setIsLoading]           = useState<boolean>(true);
    const [isStale, setIsStale]               = useState<boolean>(false);
    const [isDemoEnabled, setIsDemoEnabled]   = useState<boolean>(false);
    const [snapshotTime, setSnapshotTime]     = useState<string>('Syncing...');
    const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);

    // Metrics state
    const [metrics, setMetrics] = useState<{
        priorityItems: number | null;
        newStories: number | null;
        exploitedCves: number | null;
        sourcesHealthy: number | null;
        sourcesConfigured: number | null;
    }>({
        priorityItems: null,
        newStories: null,
        exploitedCves: null,
        sourcesHealthy: null,
        sourcesConfigured: null,
    });

    // Update URL helper
    const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(updates)) {
            if (
                value === null ||
                value === '' ||
                (key === 'severity' && value === 'All') ||
                (key === 'category' && value === 'all') ||
                (key === 'time' && value === '24h')
            ) {
                next.delete(key);
            } else {
                next.set(key, value);
            }
        }
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    // Fetch snapshot, news, and category counts
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [snapshotRes, newsRes, catRes] = await Promise.allSettled([
                fetch(`${API_BASE}/api/dashboard/snapshot`).then(r => (r.ok ? r.json() : null)),
                fetch(`${API_BASE}/api/news?limit=500`).then(r => (r.ok ? r.json() : null)),
                fetch(`${API_BASE}/api/categories/counts`).then(r => (r.ok ? r.json() : null)),
            ]);

            let newsItems: IntelligenceRecord[] = [];
            if (newsRes.status === 'fulfilled' && newsRes.value) {
                newsItems = Array.isArray(newsRes.value)
                    ? newsRes.value
                    : (Array.isArray(newsRes.value?.news) ? newsRes.value.news : []);
                setRecords(newsItems);
            }

            if (catRes.status === 'fulfilled' && catRes.value?.categories) {
                setCategoryCounts(catRes.value.categories);
            }

            if (snapshotRes.status === 'fulfilled' && snapshotRes.value) {
                const s = snapshotRes.value;
                setIsDemoEnabled(Boolean(s.environment?.isDemoEnabled));
                setIsStale(Boolean(s.isStale));
                if (s.generatedAt) {
                    setSnapshotTime(new Date(s.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }

                const criticalCount = s.news?.critical ?? 0;
                const highCount     = s.news?.high     ?? 0;

                setMetrics({
                    priorityItems:     criticalCount + highCount,
                    newStories:        s.news?.unique24h ?? (newsItems.length || 0),
                    exploitedCves:     s.kev?.total ?? null,
                    sourcesHealthy:    s.sources?.healthy ?? null,
                    sourcesConfigured: s.sources?.configured ?? null,
                });
            } else {
                // Fallback metrics from real items
                const crit = newsItems.filter(i => (i.severity || '').toLowerCase().includes('crit')).length;
                const high = newsItems.filter(i => (i.severity || '').toLowerCase().includes('high')).length;
                setMetrics({
                    priorityItems:     crit + high,
                    newStories:        newsItems.length,
                    exploitedCves:     null,
                    sourcesHealthy:    null,
                    sourcesConfigured: null,
                });
            }

            // Sync selected record from URL
            if (urlSelectedId && newsItems.length > 0) {
                const found = newsItems.find(r => r.link === urlSelectedId || r.title === urlSelectedId);
                if (found) setSelectedRecord(found);
            } else if (!selectedRecord && newsItems.length > 0) {
                setSelectedRecord(newsItems[0]);
            }
        } catch (err) {
            console.error('Failed to load intelligence workspace telemetry:', err);
        } finally {
            setIsLoading(false);
        }
    }, [urlSelectedId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSelectRecord = (rec: IntelligenceRecord) => {
        setSelectedRecord(rec);
        updateUrlParams({ selected: rec.link || rec.title });
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setTimeout(() => {
                document.getElementById('report-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 80);
        }
    };

    const handleCloseDetail = () => {
        setSelectedRecord(null);
        updateUrlParams({ selected: null });
    };

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto w-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[#0665F9] uppercase tracking-wider bg-[#EAF2FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                            Threat Operations
                        </span>
                        {isDemoEnabled && (
                            <span className="text-[11px] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <AlertOctagon className="w-3 h-3 text-amber-900" />
                                <span>DEMO DATA</span>
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-[30px] font-bold text-[#0F172A] tracking-tight font-sans">
                        Intelligence workspace
                    </h1>
                    <p className="text-[#64748B] text-xs sm:text-sm mt-0.5 font-normal">
                        Prioritise. Investigate. Act.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#64748B] font-mono hidden sm:inline-block">
                        Updated {snapshotTime}
                    </span>
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-md bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                        title="Refresh intelligence workspace"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${isLoading ? 'animate-spin text-[#0665F9]' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Four Operational Metric Cards */}
            <section aria-label="Key Intelligence Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Priority items"
                    value={metrics.priorityItems}
                    subtitle="Critical & high severity in scope"
                    icon={AlertTriangle}
                    isLoading={isLoading}
                    isStale={isStale}
                    accentColor="text-[#B42318]"
                />
                <MetricCard
                    title="New stories"
                    value={metrics.newStories}
                    subtitle="Aggregated past 24 hours"
                    icon={Newspaper}
                    isLoading={isLoading}
                    isStale={isStale}
                    accentColor="text-[#0665F9]"
                />
                <MetricCard
                    title="Exploited CVEs"
                    value={metrics.exploitedCves}
                    subtitle="Cataloged in CISA KEV"
                    icon={ShieldAlert}
                    isLoading={isLoading}
                    isStale={isStale}
                    accentColor="text-[#B96B00]"
                />
                <MetricCard
                    title="Sources healthy"
                    value={
                        metrics.sourcesConfigured !== null && metrics.sourcesHealthy !== null
                            ? `${metrics.sourcesHealthy} / ${metrics.sourcesConfigured}`
                            : 'Unavailable'
                    }
                    subtitle="Verified collection feeds"
                    icon={Radio}
                    isLoading={isLoading}
                    isStale={isStale}
                    badge={
                        metrics.sourcesConfigured && metrics.sourcesHealthy
                            ? `${Math.round((metrics.sourcesHealthy / metrics.sourcesConfigured) * 100)}%`
                            : undefined
                    }
                    accentColor="text-[#138A68]"
                />
            </section>

            {/* Main Split View: Table (60%) + Detail Panel (40%) */}
            <section
                aria-label="Intelligence Investigation Split View"
                className="flex-1 flex flex-col lg:flex-row items-start gap-4 min-h-[500px]"
            >
                {/* Table */}
                <div className={`w-full transition-all duration-150 ${selectedRecord ? 'lg:w-[60%]' : 'lg:w-full'}`}>
                    <IntelligenceTable
                        records={records}
                        selectedRecord={selectedRecord}
                        onSelectRecord={handleSelectRecord}
                        currentFilter={urlSeverity}
                        onFilterChange={(s) => updateUrlParams({ severity: s })}
                        categoryFilter={urlCategory}
                        onCategoryFilterChange={(c) => updateUrlParams({ category: c })}
                        timeRange={urlTimeRange}
                        onTimeRangeChange={(t) => updateUrlParams({ time: t })}
                        searchQuery={urlQuery}
                        onSearchChange={(q) => updateUrlParams({ q })}
                        categoryCounts={categoryCounts}
                        isLoading={isLoading}
                    />
                </div>

                {/* Detail Panel */}
                {selectedRecord && (
                    <div className="w-full lg:w-[40%] lg:sticky lg:top-4 h-[650px] lg:h-[calc(100vh-220px)] transition-all duration-150">
                        <ReportDetailPanel
                            record={selectedRecord}
                            onClose={handleCloseDetail}
                        />
                    </div>
                )}
            </section>
        </div>
    );
};

export default IntelligenceWorkspace;
