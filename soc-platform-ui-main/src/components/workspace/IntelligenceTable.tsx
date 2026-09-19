import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, ArrowUpDown, Globe, CheckSquare, Square, MinusSquare } from 'lucide-react';
import SeverityBadge, { normalizeSeverity } from './SeverityBadge';
import type { IntelligenceRecord } from './ReportDetailPanel';

interface IntelligenceTableProps {
    records: IntelligenceRecord[];
    selectedRecord: IntelligenceRecord | null;
    onSelectRecord: (record: IntelligenceRecord) => void;
    currentFilter: string;
    onFilterChange: (severity: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    isLoading?: boolean;
}

const SEVERITY_ORDER: Record<string, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
    Informational: 0,
};

export const IntelligenceTable: React.FC<IntelligenceTableProps> = ({
    records,
    selectedRecord,
    onSelectRecord,
    currentFilter,
    onFilterChange,
    searchQuery,
    onSearchChange,
    isLoading = false
}) => {
    // Bulk selection state (independent from active detail record)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<'pubDate' | 'severity'>('pubDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 15;

    // Filter counts based on all raw records in the current dataset
    const counts = useMemo(() => {
        const c = {
            All: records.length,
            Critical: 0,
            High: 0,
            Medium: 0,
            Low: 0,
            Informational: 0
        };
        for (const r of records) {
            const level = normalizeSeverity(r.severity);
            c[level]++;
        }
        return c;
    }, [records]);

    // Filter by severity and search query
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (currentFilter !== 'All') {
                if (normalizeSeverity(r.severity) !== currentFilter) {
                    return false;
                }
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = (r.title || '').toLowerCase().includes(q);
                const sourceMatch = (r.source || '').toLowerCase().includes(q);
                const snippetMatch = (r.contentSnippet || '').toLowerCase().includes(q);
                return titleMatch || sourceMatch || snippetMatch;
            }
            return true;
        });
    }, [records, currentFilter, searchQuery]);

    // Sort records
    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            if (sortField === 'severity') {
                const orderA = SEVERITY_ORDER[normalizeSeverity(a.severity)] ?? 0;
                const orderB = SEVERITY_ORDER[normalizeSeverity(b.severity)] ?? 0;
                return sortDirection === 'desc' ? orderB - orderA : orderA - orderB;
            }
            // Sort by pubDate
            const dateA = new Date(a.pubDate || 0).getTime();
            const dateB = new Date(b.pubDate || 0).getTime();
            return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
    }, [filteredRecords, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return sortedRecords.slice(start, start + pageSize);
    }, [sortedRecords, currentPage, pageSize]);

    // Checkbox bulk selection handlers
    const isAllPageSelected = paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.has(r.link || r.title));
    const isSomePageSelected = paginatedRecords.some(r => selectedIds.has(r.link || r.title)) && !isAllPageSelected;

    const handleSelectAllPage = () => {
        const next = new Set(selectedIds);
        if (isAllPageSelected) {
            paginatedRecords.forEach(r => next.delete(r.link || r.title));
        } else {
            paginatedRecords.forEach(r => next.add(r.link || r.title));
        }
        setSelectedIds(next);
    };

    const handleToggleRowSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // prevent opening the report detail panel
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleSort = (field: 'pubDate' | 'severity') => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const formatRelativeTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return dateStr || '—';
        }
    };

    const filterOptions: Array<{ label: string; key: string }> = [
        { label: 'All items', key: 'All' },
        { label: 'Critical', key: 'Critical' },
        { label: 'High', key: 'High' },
        { label: 'Medium', key: 'Medium' },
        { label: 'Low', key: 'Low' },
        { label: 'Informational', key: 'Informational' }
    ];

    return (
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col h-full overflow-hidden">
            {/* Toolbar: Priority Tabs & Search Filter */}
            <div className="p-3 sm:p-4 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
                {/* Severity Priority Tabs */}
                <div
                    role="tablist"
                    aria-label="Filter intelligence records by severity"
                    className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 md:pb-0 text-xs"
                >
                    {filterOptions.map(opt => {
                        const count = counts[opt.key as keyof typeof counts] ?? 0;
                        const isSelected = currentFilter === opt.key;
                        return (
                            <button
                                key={opt.key}
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => {
                                    onFilterChange(opt.key);
                                    setCurrentPage(1);
                                }}
                                className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#0665F9] ${
                                    isSelected
                                        ? 'bg-[#0665F9] text-white shadow-xs'
                                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                                }`}
                            >
                                <span>{opt.label}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                        isSelected ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Search / Filter Input */}
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Filter table..."
                            value={searchQuery}
                            onChange={(e) => {
                                onSearchChange(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0665F9] rounded-md text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Bulk Selection Notification Bar (when rows are selected) */}
            {selectedIds.size > 0 && (
                <div className="px-4 py-2 bg-[#EAF2FF] border-b border-[#BFDBFE] text-xs text-[#1E40AF] flex items-center justify-between">
                    <span>
                        <strong>{selectedIds.size}</strong> record{selectedIds.size > 1 ? 's' : ''} selected across the active view
                    </span>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-xs text-[#0665F9] hover:underline font-semibold"
                    >
                        Clear selection
                    </button>
                </div>
            )}

            {/* Semantic Intelligence Table */}
            <div className="flex-1 overflow-auto custom-scrollbar relative min-h-[350px]">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#F8FAFC] text-[#64748B] font-medium border-b border-[#E2E8F0] sticky top-0 z-10 select-none">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-2.5 text-center">
                                <button
                                    onClick={handleSelectAllPage}
                                    title={isAllPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                                    className="p-1 rounded hover:bg-slate-200/60 text-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#0665F9]"
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
                            <th scope="col" className="px-4 py-2.5 min-w-[280px]">
                                Intelligence
                            </th>
                            <th scope="col" className="w-36 px-3 py-2.5">
                                Source
                            </th>
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
                                    <td className="px-3 py-3"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                                    <td className="px-3 py-3"><div className="w-12 h-3 bg-slate-200 rounded" /></td>
                                    <td className="px-2 py-3"><div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto" /></td>
                                </tr>
                            ))
                        ) : paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-16 text-[#64748B] text-xs">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-sm text-[#0F172A]">No threat intelligence found</p>
                                        <p>No records matched the selected priority filter or search query.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => {
                                const rowKey = record.link || record.title;
                                const isSelectedRow = selectedRecord?.title === record.title && selectedRecord?.link === record.link;
                                const isChecked = selectedIds.has(rowKey);

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
                                        {/* Checkbox (independent of row click) */}
                                        <td className="px-3 py-3 text-center" onClick={(e) => handleToggleRowSelect(e, rowKey)}>
                                            <button
                                                className="p-1 rounded text-[#94A3B8] hover:text-[#0665F9] focus:outline-none"
                                                aria-label={`Select record ${record.title}`}
                                            >
                                                {isChecked ? (
                                                    <CheckSquare className="w-3.5 h-3.5 text-[#0665F9]" />
                                                ) : (
                                                    <Square className="w-3.5 h-3.5 text-[#CBD5E1]" />
                                                )}
                                            </button>
                                        </td>

                                        {/* Priority */}
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <SeverityBadge severity={record.severity} size="sm" />
                                        </td>

                                        {/* Intelligence: Title & Summary */}
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

                                        {/* Source */}
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-[#334155] font-medium text-xs truncate max-w-[140px]">
                                                <Globe className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                                                <span className="truncate">{record.source}</span>
                                            </div>
                                        </td>

                                        {/* Published */}
                                        <td className="px-3 py-3 whitespace-nowrap text-[#64748B] text-xs">
                                            {formatRelativeTime(record.pubDate)}
                                        </td>

                                        {/* Open Details Affordance */}
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

            {/* Pagination Bottom Bar */}
            <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
                <span>
                    Showing {paginatedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                    {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} records
                </span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-2.5 py-1 rounded border border-[#E2E8F0] bg-white text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                        Previous
                    </button>
                    <span className="px-2 font-mono">
                        {currentPage} / {totalPages}
                    </span>
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
