/**
 * Explore.tsx — Date-based Cybersecurity Report Explorer
 *
 * Features:
 *  - Today as default view with timezone-aware boundaries
 *  - Date presets: Today / Yesterday / Last 7 days / Last 30 days
 *  - Custom date range picker (start/end)
 *  - Keyword, source, category, severity, MITRE tactic/technique, mapped-only filters
 *  - Server-side filtering and pagination (not in-browser)
 *  - Full URL query-parameter state (shareable / back-forward safe)
 *  - Report detail slide-in panel with mapping provenance
 *  - Honest empty, loading, and error states
 *  - Archive date coverage banner
 */

import {
    useState, useEffect, useCallback, useRef, useMemo, type FormEvent
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search, Calendar, CalendarDays, X, ExternalLink, Shield,
    ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Clock,
    Info, Tag, Globe, Layers, Filter, RotateCcw
} from 'lucide-react';
import { API_BASE } from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MitreTechnique {
    id: string;
    name: string;
    tacticId: string;
    tacticName: string;
    tacticColor?: string;
    tacticIcon?: string;
    mitreUrl: string;
}

interface MitreTactic {
    id: string;
    name: string;
    shortName: string;
    icon: string;
    color: string;
}

interface Article {
    id: string;
    title: string;
    link: string;
    pubDate: string | null;
    pubDateMissing?: boolean;
    ingestedAt: string | null;
    contentSnippet: string;
    source: string;
    severity: string;
    category: string;
    intelCategory?: string;
    mitreTechniques: MitreTechnique[];
    mitreTactics: MitreTactic[];
    isMitreCategorized: boolean;
    mappingMethod: string | null;
    mappingTimestamp?: string;
}

interface ArchiveCoverage {
    oldest: string | null;
    newest: string | null;
    total: number;
}

interface ExploreResponse {
    records: Article[];
    total: number;
    page: number;
    totalPages: number;
    resolvedWindow: {
        preset: string | null;
        dateFrom: string | null;
        dateTo: string | null;
        tz: string;
    };
    archiveCoverage: ArchiveCoverage;
}

interface Meta {
    sources: string[];
    categories: string[];
    tactics: MitreTactic[];
    severities: string[];
    sortOptions: { value: string; label: string }[];
}

interface RelatedReport {
    id: string;
    title: string;
    link: string;
    pubDate: string | null;
    source: string;
    severity: string;
    category?: string;
    score?: number;
    relationReason: string;
    mitreTechniques?: MitreTechnique[];
}

interface ArticleDetail extends Article {
    mappingProvenance?: string;
    relatedReports?: RelatedReport[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESETS = [
    { value: 'today',     label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7',     label: 'Last 7 days' },
    { value: 'last30',    label: 'Last 30 days' },
] as const;

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    Critical: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
    High:     { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
    Medium:   { bg: 'bg-yellow-50',  text: 'text-yellow-800', border: 'border-yellow-200' },
    Low:      { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200' },
};

const formatPubDate = (pubDate: string | null | undefined, pubDateMissing?: boolean, tz = 'UTC') => {
    if (!pubDate || pubDateMissing) return { display: 'Publication date unknown', isUnknown: true };
    try {
        const d = new Date(pubDate);
        if (isNaN(d.getTime())) return { display: 'Invalid date', isUnknown: true };
        const display = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        }).format(d);
        return { display, isUnknown: false };
    } catch {
        return { display: pubDate, isUnknown: false };
    }
};

const formatIngestedAt = (ingestedAt: string | null | undefined) => {
    if (!ingestedAt) return null;
    try {
        return new Date(ingestedAt).toLocaleString();
    } catch { return ingestedAt; }
};

/** Detect the browser timezone safely. */
const getBrowserTimezone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
};

// Common IANA timezone options for the selector
const COMMON_TZ = [
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Explore() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Read URL params (these are the source of truth)
    const presetParam     = searchParams.get('preset') || 'today';
    const dateFromParam   = searchParams.get('dateFrom') || '';
    const dateToParam     = searchParams.get('dateTo') || '';
    const tzParam         = searchParams.get('tz') || getBrowserTimezone();
    const qParam          = searchParams.get('q') || '';
    const sourceParam     = searchParams.get('source') || '';
    const categoryParam   = searchParams.get('category') || '';
    const severityParam   = searchParams.get('severity') || '';
    const tacticParam     = searchParams.get('tactic') || '';
    const techniqueParam  = searchParams.get('technique') || '';
    const mappedOnlyParam = searchParams.get('mappedOnly') || '';
    const sortParam       = searchParams.get('sort') || 'pub_desc';
    const pageParam       = parseInt(searchParams.get('page') || '1', 10);

    // Local state
    const [data, setData]         = useState<ExploreResponse | null>(null);
    const [meta, setMeta]         = useState<Meta | null>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(qParam);
    const [customFrom, setCustomFrom]   = useState(dateFromParam);
    const [customTo,   setCustomTo]     = useState(dateToParam);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
    const [articleLoading, setArticleLoading]   = useState(false);

    // Abort controller ref so outdated requests don't overwrite fresh results
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch meta once ──────────────────────────────────────────────────────
    useEffect(() => {
        fetch(`${API_BASE}/api/explore/meta`)
            .then(r => r.json())
            .then((m: Meta) => setMeta(m))
            .catch(() => {}); // non-fatal; filters still show
    }, []);

    // ── Fetch results ────────────────────────────────────────────────────────
    const fetchResults = useCallback(async () => {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            // Date window
            if (presetParam && !dateFromParam) {
                params.set('preset', presetParam);
            } else {
                if (dateFromParam) params.set('dateFrom', dateFromParam);
                if (dateToParam)   params.set('dateTo',   dateToParam);
            }
            params.set('tz', tzParam);
            if (qParam)          params.set('q',         qParam);
            if (sourceParam)     params.set('source',    sourceParam);
            if (categoryParam)   params.set('category',  categoryParam);
            if (severityParam)   params.set('severity',  severityParam);
            if (tacticParam)     params.set('tacticId',  tacticParam);
            if (techniqueParam)  params.set('techniqueId', techniqueParam);
            if (mappedOnlyParam) params.set('mappedOnly', mappedOnlyParam);
            params.set('sort', sortParam);
            params.set('page', pageParam.toString());
            params.set('limit', '25');

            const resp = await fetch(`${API_BASE}/api/explore?${params}`, {
                signal: abortRef.current.signal,
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ error: resp.statusText }));
                throw new Error(err.error || resp.statusText);
            }
            const json: ExploreResponse = await resp.json();
            setData(json);
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return; // stale request
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [presetParam, dateFromParam, dateToParam, tzParam, qParam, sourceParam, categoryParam,
        severityParam, tacticParam, techniqueParam, mappedOnlyParam, sortParam, pageParam]);

    useEffect(() => { fetchResults(); }, [fetchResults]);

    // Check for midnight rollover every 60 seconds if in 'today' preset
    useEffect(() => {
        if (presetParam !== 'today') return;
        let lastDate = '';
        try {
            lastDate = new Intl.DateTimeFormat('en-CA', { timeZone: tzParam }).format(new Date());
        } catch {
            lastDate = new Date().toISOString().slice(0, 10);
        }
        const interval = setInterval(() => {
            let currentDate = '';
            try {
                currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: tzParam }).format(new Date());
            } catch {
                currentDate = new Date().toISOString().slice(0, 10);
            }
            if (currentDate !== lastDate) {
                lastDate = currentDate;
                fetchResults();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [presetParam, tzParam, fetchResults]);
    const updateParam = (key: string, value: string) => {
        const p = new URLSearchParams(searchParams);
        if (!value || value === 'all') p.delete(key); else p.set(key, value);
        p.set('page', '1');
        setSearchParams(p, { replace: true });
    };

    const setPreset = (preset: string) => {
        const p = new URLSearchParams(searchParams);
        p.set('preset', preset);
        p.delete('dateFrom');
        p.delete('dateTo');
        p.set('page', '1');
        setCustomFrom('');
        setCustomTo('');
        setSearchParams(p, { replace: true });
    };

    const applyCustomRange = () => {
        if (!customFrom) return;
        const p = new URLSearchParams(searchParams);
        p.delete('preset');
        p.set('dateFrom', customFrom);
        if (customTo) p.set('dateTo', customTo);
        else p.delete('dateTo');
        p.set('page', '1');
        setSearchParams(p, { replace: true });
    };

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            updateParam('q', val);
        }, 400);
    };

    const clearAllFilters = () => {
        setSearchInput('');
        setCustomFrom('');
        setCustomTo('');
        const p = new URLSearchParams();
        p.set('preset', 'today');
        p.set('tz', tzParam);
        setSearchParams(p, { replace: true });
    };

    // ── Article detail ───────────────────────────────────────────────────────
    const openArticle = async (article: Article) => {
        if (!article.id) {
            setSelectedArticle({ ...article });
            return;
        }
        setArticleLoading(true);
        setSelectedArticle({ ...article }); // show immediately, update with full detail
        try {
            const resp = await fetch(`${API_BASE}/api/explore/article/${article.id}`);
            if (resp.ok) {
                const detail: ArticleDetail = await resp.json();
                setSelectedArticle(detail);
            }
        } catch { /* show what we have */ }
        finally { setArticleLoading(false); }
    };

    // ── Derived state ────────────────────────────────────────────────────────
    const isCustomMode  = !!dateFromParam;
    const activePreset  = isCustomMode ? null : presetParam;

    const activeFilterCount = [qParam, sourceParam, categoryParam, severityParam,
        tacticParam, techniqueParam, mappedOnlyParam].filter(Boolean).length;

    // Format the "Today" date in the selected tz for the heading
    const todayFormatted = useMemo(() => {
        const tz = tzParam || 'UTC';
        try {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }).format(new Date());
        } catch { return new Date().toLocaleDateString(); }
    }, [tzParam]);

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="h-full flex flex-col bg-[#F7F9FC] overflow-y-auto custom-scrollbar pb-20">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-white border-b border-[#E2E8F0] px-6 pt-6 pb-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="section-label">Cybersecurity Intelligence</span>
                                {data && (
                                    <span className="availability-chip">
                                        <span className="chip-dot" />
                                        {data.archiveCoverage.total.toLocaleString()} archived reports
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl">
                                    <CalendarDays className="w-7 h-7 text-[#1E3A8A]" />
                                </div>
                                Explore
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">
                                {activePreset === 'today'
                                    ? <><span className="font-semibold text-slate-700">{todayFormatted}</span> · Reports published today in {tzParam}</>
                                    : 'Historical cybersecurity report archive · Search by date, keyword, source, or MITRE ATT&CK mapping'}
                            </p>
                        </div>

                        {/* Timezone selector */}
                        <div className="flex items-center gap-2 shrink-0">
                            <label htmlFor="tz-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Timezone</label>
                            <select
                                id="tz-select"
                                value={tzParam}
                                onChange={e => updateParam('tz', e.target.value)}
                                className="text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-3 py-2 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] outline-none shadow-sm"
                            >
                                {COMMON_TZ.map(tz => (
                                    <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Date preset buttons */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {PRESETS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setPreset(p.value)}
                                className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all ${
                                    activePreset === p.value
                                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-sm'
                                        : 'bg-white text-slate-600 border-[#CBD5E1] hover:border-[#1E3A8A] hover:text-[#1E3A8A]'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}

                        {/* Custom date range */}
                        <div className="flex items-center gap-2 ml-2">
                            <input
                                type="date"
                                id="custom-from"
                                aria-label="Start date"
                                value={customFrom}
                                max={customTo || undefined}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-3 py-2 focus:border-[#1E3A8A] outline-none shadow-sm"
                            />
                            <span className="text-slate-400 text-sm">to</span>
                            <input
                                type="date"
                                id="custom-to"
                                aria-label="End date"
                                value={customTo}
                                min={customFrom || undefined}
                                onChange={e => setCustomTo(e.target.value)}
                                className="text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-3 py-2 focus:border-[#1E3A8A] outline-none shadow-sm"
                            />
                            <button
                                onClick={applyCustomRange}
                                disabled={!customFrom}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#1E3A8A] text-white disabled:opacity-40 hover:bg-[#163064] transition-colors shadow-sm"
                            >
                                Apply
                            </button>
                            {isCustomMode && (
                                <button
                                    onClick={() => setPreset('today')}
                                    className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                                    title="Clear custom range"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search bar */}
                    <div className="mt-3 flex items-center gap-3">
                        <form
                            className="relative flex-1 max-w-xl"
                            onSubmit={(e: FormEvent) => { e.preventDefault(); updateParam('q', searchInput); }}
                        >
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                aria-label="Search reports"
                                placeholder="Search titles, summaries, sources…"
                                value={searchInput}
                                onChange={e => handleSearchChange(e.target.value)}
                                className="w-full bg-white border border-[#CBD5E1] text-slate-800 text-sm rounded-xl pl-10 pr-10 py-2.5 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] outline-none shadow-sm"
                            />
                            {searchInput && (
                                <button type="button" onClick={() => handleSearchChange('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </form>

                        <button
                            onClick={() => setShowFilters(f => !f)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                                showFilters || activeFilterCount > 0
                                    ? 'bg-[#EAF2FF] border-[#1E3A8A] text-[#1E3A8A]'
                                    : 'bg-white border-[#CBD5E1] text-slate-600 hover:border-[#1E3A8A]'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="bg-[#1E3A8A] text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {activeFilterCount > 0 && (
                            <button onClick={clearAllFilters}
                                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
                                <RotateCcw className="w-3.5 h-3.5" />
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Expanded filter panel */}
                    {showFilters && meta && (
                        <div className="mt-3 p-4 bg-slate-50 border border-[#E2E8F0] rounded-2xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {/* Source */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Source</label>
                                <select value={sourceParam} onChange={e => updateParam('source', e.target.value)}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    <option value="">All sources</option>
                                    {meta.sources.slice(0, 150).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Category</label>
                                <select value={categoryParam} onChange={e => updateParam('category', e.target.value)}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    <option value="">All categories</option>
                                    {meta.categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Severity */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Severity</label>
                                <select value={severityParam} onChange={e => updateParam('severity', e.target.value)}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    <option value="">All severities</option>
                                    {meta.severities.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* MITRE Tactic */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">MITRE Tactic</label>
                                <select value={tacticParam} onChange={e => { updateParam('tactic', e.target.value); updateParam('technique', ''); }}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    <option value="">All tactics</option>
                                    {meta.tactics.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                                </select>
                            </div>

                            {/* MITRE Technique */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">MITRE Technique</label>
                                <input type="text" placeholder="e.g. T1566"
                                    value={techniqueParam}
                                    onChange={e => updateParam('technique', e.target.value.toUpperCase())}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none font-mono" />
                            </div>

                            {/* Mapped filter */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">MITRE Mapping</label>
                                <select value={mappedOnlyParam} onChange={e => updateParam('mappedOnly', e.target.value)}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    <option value="">All reports</option>
                                    <option value="true">Mapped only</option>
                                    <option value="false">Unmapped only</option>
                                </select>
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Sort by</label>
                                <select value={sortParam} onChange={e => updateParam('sort', e.target.value)}
                                    className="w-full text-sm bg-white border border-[#CBD5E1] text-slate-800 rounded-xl px-2.5 py-2 focus:border-[#1E3A8A] outline-none">
                                    {(meta.sortOptions || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Results area ─────────────────────────────────────────────── */}
            <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-4">

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {qParam && <FilterChip label={`"${qParam}"`} onRemove={() => updateParam('q', '')} />}
                        {sourceParam && <FilterChip label={`Source: ${sourceParam}`} onRemove={() => updateParam('source', '')} />}
                        {categoryParam && <FilterChip label={`Category: ${categoryParam}`} onRemove={() => updateParam('category', '')} />}
                        {severityParam && <FilterChip label={`Severity: ${severityParam}`} onRemove={() => updateParam('severity', '')} />}
                        {tacticParam && <FilterChip label={`Tactic: ${tacticParam}`} onRemove={() => { updateParam('tactic', ''); updateParam('technique', ''); }} />}
                        {techniqueParam && <FilterChip label={`Technique: ${techniqueParam}`} onRemove={() => updateParam('technique', '')} />}
                        {mappedOnlyParam === 'true' && <FilterChip label="MITRE mapped" onRemove={() => updateParam('mappedOnly', '')} />}
                        {mappedOnlyParam === 'false' && <FilterChip label="Not mapped" onRemove={() => updateParam('mappedOnly', '')} />}
                    </div>
                )}

                {/* Result count + archive coverage */}
                {data && !loading && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="text-sm text-slate-600">
                            <span className="font-bold text-slate-900">{data.total.toLocaleString()}</span> report{data.total !== 1 ? 's' : ''} matched
                            {data.resolvedWindow.dateFrom && (
                                <span className="text-slate-400 ml-1">
                                    · {new Date(data.resolvedWindow.dateFrom).toLocaleDateString()} – {data.resolvedWindow.dateTo ? new Date(data.resolvedWindow.dateTo).toLocaleDateString() : 'now'}
                                    {' '}({data.resolvedWindow.tz})
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Archive: {data.archiveCoverage.oldest
                                ? `${new Date(data.archiveCoverage.oldest).toLocaleDateString()} – ${new Date(data.archiveCoverage.newest!).toLocaleDateString()}`
                                : 'No dated records'}
                            {' '}· {data.archiveCoverage.total.toLocaleString()} total
                        </div>
                    </div>
                )}

                {/* ── Loading ── */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex items-center gap-3 text-slate-500">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1E3A8A]" />
                            <span>Searching archive…</span>
                        </div>
                    </div>
                )}

                {/* ── Error ── */}
                {!loading && error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-red-800">Search failed</p>
                            <p className="text-red-600 text-sm mt-1">{error}</p>
                            <button onClick={() => fetchResults()} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900">
                                <RefreshCw className="w-3.5 h-3.5" />Retry
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Empty state (Today) ── */}
                {!loading && !error && data?.records.length === 0 && activePreset === 'today' && (
                    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
                        <div className="inline-flex p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4">
                            <CalendarDays className="w-8 h-8 text-[#1E3A8A]" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No reports published today</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
                            The archive contains no articles with a publication date matching today
                            ({new Date().toLocaleDateString('en-GB')}){' '}in {tzParam}.
                            This does not include articles with unknown publication dates.
                        </p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setPreset('yesterday')}
                                className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#CBD5E1] text-slate-600 hover:border-[#1E3A8A] hover:text-[#1E3A8A] bg-white transition-colors">
                                View yesterday
                            </button>
                            <button onClick={() => setPreset('last7')}
                                className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#1E3A8A] text-white hover:bg-[#163064] transition-colors shadow-sm">
                                Last 7 days
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Empty state (other) ── */}
                {!loading && !error && data?.records.length === 0 && activePreset !== 'today' && (
                    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center">
                        <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No matching reports</h3>
                        <p className="text-slate-500 text-sm mb-4">Try widening the date range or removing some filters.</p>
                        <button onClick={clearAllFilters}
                            className="px-4 py-2 text-sm font-semibold rounded-xl border border-[#CBD5E1] text-slate-600 hover:border-[#1E3A8A] hover:text-[#1E3A8A] bg-white transition-colors">
                            Reset filters
                        </button>
                    </div>
                )}

                {/* ── Result list ── */}
                {!loading && !error && data && data.records.length > 0 && (
                    <div className="space-y-3">
                        {data.records.map(article => (
                            <ArticleCard
                                key={article.id || article.link}
                                article={article}
                                tz={tzParam}
                                onOpen={() => openArticle(article)}
                                onTacticClick={(tacticId) => { updateParam('tactic', tacticId); setShowFilters(true); }}
                                onTechniqueClick={(techId) => { updateParam('technique', techId); setShowFilters(true); }}
                            />
                        ))}
                    </div>
                )}

                {/* ── Pagination ── */}
                {data && data.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <button
                            onClick={() => updateParam('page', String(pageParam - 1))}
                            disabled={pageParam <= 1}
                            className="p-2 rounded-xl border border-[#CBD5E1] text-slate-600 disabled:opacity-40 hover:border-[#1E3A8A] hover:text-[#1E3A8A] bg-white transition-colors"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-slate-600">
                            Page {data.page} of {data.totalPages} · {data.total.toLocaleString()} reports
                        </span>
                        <button
                            onClick={() => updateParam('page', String(pageParam + 1))}
                            disabled={pageParam >= data.totalPages}
                            className="p-2 rounded-xl border border-[#CBD5E1] text-slate-600 disabled:opacity-40 hover:border-[#1E3A8A] hover:text-[#1E3A8A] bg-white transition-colors"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Article Detail Panel ────────────────────────────────────── */}
            {selectedArticle && (
                <ArticleDetailPanel
                    article={selectedArticle}
                    loading={articleLoading}
                    tz={tzParam}
                    onClose={() => setSelectedArticle(null)}
                    onTacticClick={(tacticId) => { setSelectedArticle(null); updateParam('tactic', tacticId); setShowFilters(true); }}
                    onTechniqueClick={(techId) => { setSelectedArticle(null); updateParam('technique', techId); setShowFilters(true); }}
                />
            )}
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-[#1E3A8A] text-xs font-semibold rounded-full">
            {label}
            <button onClick={onRemove} className="hover:text-red-600 transition-colors" aria-label={`Remove filter: ${label}`}>
                <X className="w-3.5 h-3.5" />
            </button>
        </span>
    );
}

function ArticleCard({
    article, tz, onOpen, onTacticClick, onTechniqueClick
}: {
    article: Article;
    tz: string;
    onOpen: () => void;
    onTacticClick: (id: string) => void;
    onTechniqueClick: (id: string) => void;
}) {
    const { display: pubDisplay, isUnknown } = formatPubDate(article.pubDate, article.pubDateMissing, tz);
    const sev = SEVERITY_STYLES[article.severity] || SEVERITY_STYLES.Low;

    return (
        <article
            className="bg-white border border-[#E2E8F0] rounded-2xl p-5 hover:border-[#1E3A8A] hover:shadow-md transition-all group cursor-pointer"
            onClick={onOpen}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-md border ${sev.bg} ${sev.text} ${sev.border}`}>
                            {article.severity}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{article.source}</span>
                        <span className="text-slate-300">·</span>
                        <span className={`text-xs flex items-center gap-1 ${isUnknown ? 'text-slate-400 italic' : 'text-slate-500'}`}>
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {pubDisplay}
                        </span>
                    </div>

                    <h3 className="font-semibold text-slate-900 text-base leading-snug group-hover:text-[#1E3A8A] transition-colors">
                        {article.title}
                    </h3>

                    {article.contentSnippet && (
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                            {article.contentSnippet}
                        </p>
                    )}

                    {/* MITRE tags */}
                    {article.mitreTechniques.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {article.mitreTactics.slice(0, 3).map(t => (
                                <button
                                    key={t.id}
                                    onClick={(e) => { e.stopPropagation(); onTacticClick(t.id); }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-50 border border-blue-200 text-[#1E3A8A] hover:bg-blue-100 transition-colors"
                                    title={`Filter by tactic: ${t.name}`}
                                >
                                    {t.icon} {t.shortName}
                                </button>
                            ))}
                            {article.mitreTechniques.slice(0, 4).map(t => (
                                <button
                                    key={t.id}
                                    onClick={(e) => { e.stopPropagation(); onTechniqueClick(t.id); }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors"
                                    title={`Filter by technique: ${t.name}`}
                                >
                                    {t.id}
                                </button>
                            ))}
                            {article.mitreTechniques.length > 4 && (
                                <span className="text-xs text-slate-400 self-center">+{article.mitreTechniques.length - 4} more</span>
                            )}
                        </div>
                    )}
                    {!article.isMitreCategorized && (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5" />
                            Not mapped to MITRE ATT&amp;CK
                        </div>
                    )}
                </div>

                {/* External link */}
                <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 p-2.5 rounded-xl text-slate-400 hover:text-[#1E3A8A] hover:bg-slate-100 transition-colors"
                    title="Open original article"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </article>
    );
}

function ArticleDetailPanel({
    article, loading, tz, onClose, onTacticClick, onTechniqueClick
}: {
    article: ArticleDetail;
    loading: boolean;
    tz: string;
    onClose: () => void;
    onTacticClick: (id: string) => void;
    onTechniqueClick: (id: string) => void;
}) {
    const { display: pubDisplay, isUnknown: pubUnknown } = formatPubDate(article.pubDate, article.pubDateMissing, tz);
    const ingestedDisplay = formatIngestedAt(article.ingestedAt);
    const sev = SEVERITY_STYLES[article.severity] || SEVERITY_STYLES.Low;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-[2px]"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Panel */}
            <div
                role="dialog"
                aria-label="Report detail"
                aria-modal="true"
                className="fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden border-l border-[#E2E8F0]"
            >
                {/* Panel header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-[#1E3A8A]" />
                        <span className="font-bold text-slate-900">Report Detail</span>
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1E3A8A]" />}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Close detail panel">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Panel body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
                    {/* Title + severity */}
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-md border ${sev.bg} ${sev.text} ${sev.border}`}>
                                {article.severity}
                            </span>
                            <span className="text-sm font-semibold text-slate-600">{article.source}</span>
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 font-display leading-snug">{article.title}</h2>
                    </div>

                    {/* Timestamps */}
                    <div className="bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-semibold text-slate-700">Publication date: </span>
                                <span className={pubUnknown ? 'text-slate-400 italic' : 'text-slate-700'}>{pubDisplay}</span>
                                {pubUnknown && (
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        The source feed did not provide a publication date for this article.
                                        Publication date was not substituted.
                                    </p>
                                )}
                            </div>
                        </div>
                        {ingestedDisplay && (
                            <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-slate-700">Ingested: </span>
                                    <span className="text-slate-600">{ingestedDisplay}</span>
                                    <span className="text-xs text-slate-400 ml-1.5">(when the collector fetched this article)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {article.contentSnippet && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Summary</h3>
                            <p className="text-sm text-slate-700 leading-relaxed">{article.contentSnippet}</p>
                        </div>
                    )}

                    {/* Category */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Category</h3>
                        <div className="flex flex-wrap gap-2">
                            {(article.intelCategory || article.category) && (
                                <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700 rounded-lg">
                                    <Tag className="w-3 h-3 inline-block mr-1 text-slate-400" />
                                    {article.intelCategory || article.category}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* MITRE Mapping */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">MITRE ATT&amp;CK Mapping</h3>
                        {article.isMitreCategorized ? (
                            <div className="space-y-3">
                                {/* Tactic tags */}
                                <div className="flex flex-wrap gap-2">
                                    {article.mitreTactics.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => onTacticClick(t.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 border border-blue-200 text-[#1E3A8A] hover:bg-blue-100 transition-colors"
                                        >
                                            {t.icon} {t.name}
                                        </button>
                                    ))}
                                </div>
                                {/* Technique rows */}
                                <div className="space-y-1.5">
                                    {article.mitreTechniques.map(tech => (
                                        <button
                                            key={tech.id}
                                            onClick={() => onTechniqueClick(tech.id)}
                                            className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                                        >
                                            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 shrink-0">
                                                {tech.id}
                                            </span>
                                            <span className="text-sm font-semibold text-slate-800">{tech.name}</span>
                                            <span className="text-xs text-slate-400 ml-auto shrink-0">{tech.tacticName}</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                                {/* Mapping provenance */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-800">
                                            Mapping method: {article.mappingMethod === 'keyword-heuristic' ? 'Keyword heuristic' : article.mappingMethod || 'Unknown'}
                                        </p>
                                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                            {article.mappingProvenance ||
                                                'Automatically mapped by keyword matching against the MITRE ATT\u0026CK technique catalogue. Not analyst-confirmed.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-600">Not mapped</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        No MITRE ATT&amp;CK technique keywords matched in this article's title or summary.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Defensible Related Reports */}
                    {article.relatedReports && article.relatedReports.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                                <span>Defensible Related Reports</span>
                                <span className="text-[10px] text-slate-400 font-normal">Shared MITRE / taxonomy criteria</span>
                            </h3>
                            <div className="space-y-2">
                                {article.relatedReports.map(rel => (
                                    <div
                                        key={rel.id}
                                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                                {rel.relationReason}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {rel.pubDate ? new Date(rel.pubDate).toLocaleDateString() : 'Unknown date'}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">{rel.title}</h4>
                                        <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                                            <span>{rel.source}</span>
                                            <a
                                                href={rel.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1"
                                            >
                                                <span>Source</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Source link */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Original Source</h3>
                        <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-[#1E3A8A] hover:text-[#163064] transition-colors break-all"
                        >
                            <Globe className="w-4 h-4 shrink-0" />
                            {article.link}
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
