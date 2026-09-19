import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronRight, ArrowUpDown, Globe, CheckSquare, Square, MinusSquare, ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import SeverityBadge, { normalizeSeverity } from './SeverityBadge';
import type { IntelligenceRecord } from './ReportDetailPanel';

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export const INTEL_CATEGORY_LABELS: Record<string, string> = {
    'ransomware-extortion':         'Ransomware & Extortion',
    'malware':                      'Malware',
    'phishing-social-engineering':  'Phishing & Social Engineering',
    'threat-actors-campaigns':      'Threat Actors & Campaigns',
    'breaches-data-exposure':       'Breaches & Data Exposure',
    'cloud-identity-attacks':       'Cloud & Identity Attacks',
    'supply-chain-attacks':         'Supply Chain Attacks',
    'ddos-service-disruption':      'DDoS & Service Disruption',
    'general-security-news':        'General Security News',
    'needs-classification':         'Needs Classification',
    'vuln-disclosure':              'Vulnerability Disclosure',
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
    'verified':         'Verified',
    'unverified-claim': 'Unverified claim',
    'advisory':         'Advisory',
    'unassessed':       'Unassessed',
};

const EVIDENCE_STATUS_STYLES: Record<string, string> = {
    'verified':         'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'unverified-claim': 'bg-amber-50 text-amber-700 border border-amber-200',
    'advisory':         'bg-blue-50 text-blue-700 border border-blue-200',
    'unassessed':       'bg-slate-100 text-slate-600 border border-slate-200',
};

export type TimeRange = '24h' | '7d' | '30d' | 'all';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    '24h': 'Last 24 Hours',
    '7d':  'Last 7 Days',
    '30d': 'Last 30 Days',
    'all': 'All Time',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryCount {
    id: string;
    displayName: string;
    count: number;
}

export interface IntelligenceTableProps {
    records: IntelligenceRecord[];
    selectedRecord: IntelligenceRecord | null;
    onSelectRecord: (record: IntelligenceRecord) => void;
    currentFilter: string;             // severity filter (e.g. 'All', 'Critical')
    onFilterChange: (severity: string) => void;
    categoryFilter: string;            // intelCategory filter
    onCategoryFilterChange: (cat: string) => void;
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    categoryCounts?: CategoryCount[];  // live counts from /api/categories/counts
    isLoading?: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
    Critical: 4, High: 3, Medium: 2, Low: 1, Informational: 0,
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function timeRangeStart(range: TimeRange): Date | null {
    const now = new Date();
    if (range === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (range === '7d')  return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return null;
}

function formatRelativeTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        const diffMs = Date.now() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 1)   return 'Just now';
        if (diffHours < 24)  return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7)    return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return dateStr || '—';
    }
}

// ─── Generic dropdown component ───────────────────────────────────────────────

interface DropdownOption { value: string; label: string; count?: number }
interface FilterDropdownProps {
    label: string;
    value: string;
    options: DropdownOption[];
    onChange: (v: string) => void;
    placeholder?: string;
    id: string;
}
const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, value, options, onChange, id }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isFiltered = value !== '' && value !== 'All' && value !== 'all';

    return (
        <div ref={ref} className="relative">
            <button
                id={id}
                onClick={() => setOpen(o => !o)}
                className={`h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9] ${
                    isFiltered
                        ? 'bg-[#EAF2FF] border-[#BFDBFE] text-[#0665F9]'
                        : 'bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F8FAFC]'
                }`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="text-[#94A3B8] text-[10px] uppercase tracking-wider font-semibold">{label}:</span>
                <span className="truncate max-w-[120px]">{selected?.label || 'All'}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E2E8F0] rounded-lg shadow-lg min-w-[200px] max-h-72 overflow-y-auto custom-scrollbar py-1">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            role="option"
                            aria-selected={value === opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-[#F8FAFC] transition-colors ${
                                value === opt.value ? 'text-[#0665F9] font-semibold' : 'text-[#334155]'
                            }`}
                        >
                            <span>{opt.label}</span>
                            {opt.count !== undefined && (
                                <span className="text-[10px] font-mono text-[#94A3B8] bg-[#F1F5F9] px-1.5 rounded">
                                    {opt.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Active Filter Chip ───────────────────────────────────────────────────────

interface FilterChipProps { label: string; onRemove: () => void }
const FilterChip: React.FC<FilterChipProps> = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full bg-[#EAF2FF] border border-[#BFDBFE] text-[#0665F9] text-[11px] font-medium">
        {label}
        <button
            onClick={onRemove}
            className="rounded-full hover:bg-[#BFDBFE] p-0.5 transition-colors"
            aria-label={`Remove ${label} filter`}
        >
            <X className="w-2.5 h-2.5" />
        </button>
    </span>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const IntelligenceTable: React.FC<IntelligenceTableProps> = ({
    records,
    selectedRecord,
    onSelectRecord,
    currentFilter,
    onFilterChange,
    categoryFilter,
    onCategoryFilterChange,
    timeRange,
    onTimeRangeChange,
    searchQuery,
    onSearchChange,
    categoryCounts = [],
    isLoading = false,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<'pubDate' | 'severity'>('pubDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 15;

    // Reset pagination when any filter changes
    useEffect(() => { setCurrentPage(1); }, [currentFilter, categoryFilter, timeRange, searchQuery]);

    // Severity filter options with counts (counts from ALL records, before any filter)
    const severityCounts = useMemo(() => {
        const c: Record<string, number> = { All: records.length, Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
        for (const r of records) { const lv = normalizeSeverity(r.severity); if (c[lv] !== undefined) c[lv]++; }
        return c;
    }, [records]);

    const severityOptions: DropdownOption[] = [
        { value: 'All',           label: 'All priorities', count: severityCounts.All },
        { value: 'Critical',      label: 'Critical',       count: severityCounts.Critical },
        { value: 'High',          label: 'High',           count: severityCounts.High },
        { value: 'Medium',        label: 'Medium',         count: severityCounts.Medium },
        { value: 'Low',           label: 'Low',            count: severityCounts.Low },
        { value: 'Informational', label: 'Informational',  count: severityCounts.Informational },
    ];

    // Category dropdown options (live counts from API)
    const categoryOptions: DropdownOption[] = [
        { value: 'all', label: 'All categories', count: records.length },
        ...categoryCounts
            .filter(c => c.count > 0)
            .map(c => ({ value: c.id, label: c.displayName, count: c.count })),
    ];

    // Time range options
    const timeRangeOptions: DropdownOption[] = (Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map(r => ({
        value: r, label: TIME_RANGE_LABELS[r],
    }));

    // Apply all filters
    const filteredRecords = useMemo(() => {
        const cutoff = timeRangeStart(timeRange);
        return records.filter(r => {
            // Severity filter
            if (currentFilter !== 'All' && normalizeSeverity(r.severity) !== currentFilter) return false;
            // Category filter
            if (categoryFilter && categoryFilter !== 'all') {
                const rCat = (r as any).intelCategory || 'needs-classification';
                if (rCat !== categoryFilter) return false;
            }
            // Time range filter
            if (cutoff) {
                const d = new Date((r as any).pubDate || 0);
                if (d < cutoff) return false;
            }
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                if (
                    !r.title?.toLowerCase().includes(q) &&
                    !r.source?.toLowerCase().includes(q) &&
                    !(r.contentSnippet || '').toLowerCase().includes(q)
                ) return false;
            }
            return true;
        });
    }, [records, currentFilter, categoryFilter, timeRange, searchQuery]);

    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            if (sortField === 'severity') {
                const oA = SEVERITY_ORDER[normalizeSeverity(a.severity)] ?? 0;
                const oB = SEVERITY_ORDER[normalizeSeverity(b.severity)] ?? 0;
                return sortDirection === 'desc' ? oB - oA : oA - oB;
            }
            const dA = new Date((a as any).pubDate || 0).getTime();
            const dB = new Date((b as any).pubDate || 0).getTime();
            return sortDirection === 'desc' ? dB - dA : dA - dB;
        });
    }, [filteredRecords, sortField, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedRecords.slice(start, start + pageSize);
    }, [sortedRecords, currentPage]);

    // Checkbox selection
    const isAllPageSelected = paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.has(r.link || r.title));
    const isSomePageSelected = paginatedRecords.some(r => selectedIds.has(r.link || r.title)) && !isAllPageSelected;

    const handleSelectAllPage = () => {
        const next = new Set(selectedIds);
        if (isAllPageSelected) paginatedRecords.forEach(r => next.delete(r.link || r.title));
        else paginatedRecords.forEach(r => next.add(r.link || r.title));
        setSelectedIds(next);
    };

    const handleToggleRowSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const toggleSort = (field: 'pubDate' | 'severity') => {
        if (sortField === field) setSortDirection(p => (p === 'desc' ? 'asc' : 'desc'));
        else { setSortField(field); setSortDirection('desc'); }
    };

    // Active filter chips
    const activeChips: { label: string; remove: () => void }[] = [];
    if (currentFilter !== 'All') activeChips.push({ label: `Priority: ${currentFilter}`, remove: () => onFilterChange('All') });
    if (categoryFilter && categoryFilter !== 'all') {
        const lbl = categoryCounts.find(c => c.id === categoryFilter)?.displayName || INTEL_CATEGORY_LABELS[categoryFilter] || categoryFilter;
        activeChips.push({ label: `Category: ${lbl}`, remove: () => onCategoryFilterChange('all') });
    }
    if (timeRange !== '24h') activeChips.push({ label: TIME_RANGE_LABELS[timeRange], remove: () => onTimeRangeChange('24h') });
    if (searchQuery.trim()) activeChips.push({ label: `"${searchQuery}"`, remove: () => onSearchChange('') });

    const clearAllFilters = () => {
        onFilterChange('All');
        onCategoryFilterChange('all');
        onTimeRangeChange('24h');
        onSearchChange('');
    };

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col h-full overflow-hidden">

            {/* ── Toolbar ─────────────────────────────────────────────────── */}
            <div className="p-3 border-b border-[#E2E8F0] bg-white space-y-2.5">
                {/* Row 1: Search + Dropdowns */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search intelligence..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 h-8 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0665F9] rounded-md text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none transition-colors"
                        />
                    </div>

                    {/* Category dropdown */}
                    <FilterDropdown
                        id="filter-category"
                        label="Category"
                        value={categoryFilter || 'all'}
                        options={categoryOptions}
                        onChange={onCategoryFilterChange}
                    />

                    {/* Priority dropdown */}
                    <FilterDropdown
                        id="filter-priority"
                        label="Priority"
                        value={currentFilter}
                        options={severityOptions}
                        onChange={onFilterChange}
                    />

                    {/* Time range dropdown */}
                    <FilterDropdown
                        id="filter-timerange"
                        label="Time"
                        value={timeRange}
                        options={timeRangeOptions}
                        onChange={(v) => onTimeRangeChange(v as TimeRange)}
                    />
                </div>

                {/* Row 2: Active filter chips + result count */}
                {(activeChips.length > 0 || true) && (
                    <div className="flex items-center justify-between gap-2 flex-wrap min-h-[20px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {activeChips.map((chip, i) => (
                                <FilterChip key={i} label={chip.label} onRemove={chip.remove} />
                            ))}
                            {activeChips.length > 1 && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-[11px] text-[#64748B] hover:text-[#0665F9] underline underline-offset-2 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        <span className="text-[11px] text-[#64748B] font-mono whitespace-nowrap">
                            {sortedRecords.length.toLocaleString()} record{sortedRecords.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Bulk selection bar */}
            {selectedIds.size > 0 && (
                <div className="px-4 py-2 bg-[#EAF2FF] border-b border-[#BFDBFE] text-xs text-[#1E40AF] flex items-center justify-between">
                    <span><strong>{selectedIds.size}</strong> record{selectedIds.size > 1 ? 's' : ''} selected</span>
                    <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#0665F9] hover:underline font-semibold">
                        Clear selection
                    </button>
                </div>
            )}

            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto custom-scrollbar relative min-h-[350px]">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F8FAFC] text-[#64748B] font-medium border-b border-[#E2E8F0] sticky top-0 z-10 select-none">
                        <tr>
                            {/* Checkbox */}
                            <th scope="col" className="w-10 px-3 py-2.5 text-center">
                                <button
                                    onClick={handleSelectAllPage}
                                    className="p-1 rounded hover:bg-slate-200/60 text-[#64748B] focus:outline-none"
                                    aria-label="Select all on current page"
                                >
                                    {isAllPageSelected ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-[#0665F9]" />
                                    ) : isSomePageSelected ? (
                                        <MinusSquare className="w-3.5 h-3.5 text-[#0665F9]" />
                                    ) : (
                                        <Square className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </th>
                            {/* Priority */}
                            <th
                                scope="col"
                                onClick={() => toggleSort('severity')}
                                className="w-24 px-3 py-2.5 cursor-pointer hover:text-[#0F172A] transition-colors"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Priority</span>
                                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                                </div>
                            </th>
                            {/* Title */}
                            <th scope="col" className="px-4 py-2.5 min-w-[240px]">Intelligence</th>
                            {/* Category — hidden on tablet/mobile */}
                            <th scope="col" className="hidden lg:table-cell w-40 px-3 py-2.5">Category</th>
                            {/* Evidence — hidden on tablet/mobile */}
                            <th scope="col" className="hidden lg:table-cell w-32 px-3 py-2.5">Evidence</th>
                            {/* Source */}
                            <th scope="col" className="hidden md:table-cell w-36 px-3 py-2.5">Source</th>
                            {/* Published */}
                            <th
                                scope="col"
                                onClick={() => toggleSort('pubDate')}
                                className="w-24 px-3 py-2.5 cursor-pointer hover:text-[#0F172A] transition-colors"
                            >
                                <div className="flex items-center gap-1">
                                    <span>Published</span>
                                    <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                                </div>
                            </th>
                            <th scope="col" className="w-10 px-2 py-2.5 text-center">
                                <span className="sr-only">Open details</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    <td className="px-3 py-3"><div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto" /></td>
                                    <td className="px-3 py-3"><div className="w-16 h-4 bg-slate-200 rounded" /></td>
                                    <td className="px-4 py-3 space-y-1.5">
                                        <div className="w-3/4 h-3.5 bg-slate-200 rounded" />
                                        <div className="w-1/2 h-2.5 bg-slate-100 rounded" />
                                    </td>
                                    <td className="hidden lg:table-cell px-3 py-3"><div className="w-24 h-4 bg-slate-200 rounded" /></td>
                                    <td className="hidden lg:table-cell px-3 py-3"><div className="w-20 h-4 bg-slate-200 rounded" /></td>
                                    <td className="hidden md:table-cell px-3 py-3"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                                    <td className="px-3 py-3"><div className="w-12 h-3 bg-slate-200 rounded" /></td>
                                    <td className="px-2 py-3"><div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto" /></td>
                                </tr>
                            ))
                        ) : paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-16 text-[#64748B] text-xs">
                                    <div className="space-y-3">
                                        <SlidersHorizontal className="w-8 h-8 text-[#CBD5E1] mx-auto" />
                                        <p className="font-semibold text-sm text-[#0F172A]">No records matched the active filters</p>
                                        <p>Try adjusting category, priority, time range, or search terms.</p>
                                        {activeChips.length > 0 && (
                                            <button
                                                onClick={clearAllFilters}
                                                className="mt-1 px-4 py-1.5 bg-[#0665F9] text-white rounded-md text-xs font-medium hover:bg-[#0554D4] transition-colors"
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => {
                                const rowKey = record.link || record.title;
                                const isSelectedRow = selectedRecord?.title === record.title && selectedRecord?.link === record.link;
                                const isChecked = selectedIds.has(rowKey);
                                const intelCat = (record as any).intelCategory || 'needs-classification';
                                const catLabel = INTEL_CATEGORY_LABELS[intelCat] || intelCat;
                                const evidenceStatus = (record as any).evidenceStatus || 'unassessed';
                                const evidenceLabel = EVIDENCE_STATUS_LABELS[evidenceStatus] || evidenceStatus;
                                const evidenceStyle = EVIDENCE_STATUS_STYLES[evidenceStatus] || EVIDENCE_STATUS_STYLES['unassessed'];

                                return (
                                    <tr
                                        key={rowKey}
                                        onClick={() => onSelectRecord(record)}
                                        className={`cursor-pointer transition-colors group ${
                                            isSelectedRow
                                                ? 'bg-[#EAF2FF] hover:bg-[#E2EDFF]'
                                                : 'hover:bg-[#F8FAFC]'
                                        }`}
                                    >
                                        {/* Checkbox */}
                                        <td className="px-3 py-3 text-center" onClick={(e) => handleToggleRowSelect(e, rowKey)}>
                                            <button
                                                className="p-1 rounded text-[#94A3B8] hover:text-[#0665F9] focus:outline-none"
                                                aria-label={`Select record ${record.title}`}
                                            >
                                                {isChecked
                                                    ? <CheckSquare className="w-3.5 h-3.5 text-[#0665F9]" />
                                                    : <Square className="w-3.5 h-3.5 text-[#CBD5E1]" />
                                                }
                                            </button>
                                        </td>

                                        {/* Priority */}
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <SeverityBadge severity={record.severity} size="sm" />
                                        </td>

                                        {/* Title + summary */}
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5 max-w-xl">
                                                <h4 className="font-medium text-[#0F172A] leading-snug line-clamp-1 group-hover:text-[#0665F9] transition-colors">
                                                    {record.title}
                                                </h4>
                                                {record.contentSnippet && (
                                                    <p className="text-[#64748B] text-[11px] line-clamp-1 font-normal">
                                                        {record.contentSnippet}
                                                    </p>
                                                )}
                                            </div>
                                        </td>

                                        {/* Category chip — neutral grey, NOT severity colour */}
                                        <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] truncate max-w-[150px]" title={catLabel}>
                                                {catLabel}
                                            </span>
                                        </td>

                                        {/* Evidence status */}
                                        <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${evidenceStyle}`}>
                                                {evidenceLabel}
                                            </span>
                                        </td>

                                        {/* Source */}
                                        <td className="hidden md:table-cell px-3 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-[#334155] font-medium text-xs truncate max-w-[140px]">
                                                <Globe className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                                                <span className="truncate">{record.source}</span>
                                            </div>
                                        </td>

                                        {/* Published */}
                                        <td className="px-3 py-3 whitespace-nowrap text-[#64748B] text-xs">
                                            {formatRelativeTime((record as any).pubDate)}
                                        </td>

                                        {/* Chevron */}
                                        <td className="px-2 py-3 text-center text-[#94A3B8] group-hover:text-[#0665F9] transition-colors">
                                            <ChevronRight className="w-4 h-4 mx-auto" aria-hidden="true" />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
                <span>
                    Showing {paginatedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
                    {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length.toLocaleString()} records
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-2.5 py-1 rounded border border-[#E2E8F0] bg-white text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-2 font-mono">{currentPage} / {totalPages}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-2.5 py-1 rounded border border-[#E2E8F0] bg-white text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IntelligenceTable;
