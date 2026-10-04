import React, { useState, useMemo } from 'react';
import {
    Bookmark,
    Search,
    Download,
    Trash2,
    ExternalLink,
    ArrowRight,
} from 'lucide-react';
import type { IntelligenceRecord } from './ReportDetailPanel';

interface SavedNewsViewProps {
    savedRecordsMap: Record<string, IntelligenceRecord>;
    onRemoveSaved: (record: IntelligenceRecord) => void;
    onClearAllSaved: () => void;
    onSelectRecord: (record: IntelligenceRecord) => void;
    onSwitchToGlobalNews: () => void;
}

export const SavedNewsView: React.FC<SavedNewsViewProps> = ({
    savedRecordsMap,
    onRemoveSaved,
    onClearAllSaved,
    onSelectRecord,
    onSwitchToGlobalNews,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const savedList = useMemo(() => Object.values(savedRecordsMap), [savedRecordsMap]);

    const filteredSaved = useMemo(() => {
        if (!searchQuery.trim()) return savedList;
        const q = searchQuery.toLowerCase().trim();
        return savedList.filter((r) => {
            const titleMatch = (r.title || '').toLowerCase().includes(q);
            const sourceMatch = (r.source || '').toLowerCase().includes(q);
            const summaryMatch = (r.contentSnippet || r.content || '').toLowerCase().includes(q);
            return titleMatch || sourceMatch || summaryMatch;
        });
    }, [savedList, searchQuery]);

    const handleExportJson = () => {
        try {
            const blob = new Blob([JSON.stringify(savedList, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `no-entry-saved-intelligence-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export saved records:', err);
        }
    };

    return (
        <div className="flex flex-col space-y-5 w-full">
            {/* Header / Stats Bar */}
            <div className="bg-white rounded-xl border border-[#E2EAF3] p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] text-[#147DFA] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                        <Bookmark className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#14263F]">Saved Intelligence Articles</h2>
                        <span className="text-xs text-[#586C86]">
                            {savedList.length} {savedList.length === 1 ? 'article' : 'articles'} preserved on this device
                        </span>
                    </div>
                </div>

                {/* Actions & Search */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter saved articles…"
                            className="pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2EAF3] focus:border-[#147DFA] focus:bg-white rounded-lg text-xs text-[#14263F] outline-none"
                        />
                    </div>

                    {/* Export All */}
                    {savedList.length > 0 && (
                        <button
                            type="button"
                            onClick={handleExportJson}
                            className="px-3 py-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#14263F] inline-flex items-center gap-1.5 transition-colors"
                            title="Export saved articles to JSON"
                        >
                            <Download className="w-3.5 h-3.5 text-[#586C86]" />
                            <span>Export All</span>
                        </button>
                    )}

                    {/* Clear All */}
                    {savedList.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearAllSaved}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700 inline-flex items-center gap-1 transition-colors"
                            title="Clear all saved articles"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {savedList.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E2EAF3] p-12 text-center text-[#14263F]">
                    <div className="w-12 h-12 rounded-full bg-[#F4F7FB] border border-[#E2EAF3] text-[#586C86] flex items-center justify-center mx-auto mb-3">
                        <Bookmark className="w-6 h-6 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-base font-bold">No saved articles yet</h3>
                    <p className="text-xs text-[#586C86] mt-1 max-w-sm mx-auto">
                        Bookmark news items from Global Live News or category workspaces to review them here anytime.
                    </p>
                    <button
                        type="button"
                        onClick={onSwitchToGlobalNews}
                        className="mt-4 px-4 py-2 bg-[#147DFA] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-1.5"
                    >
                        <span>Browse Global Live News</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* List of Saved Articles */}
            {savedList.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E2EAF3] divide-y divide-[#E2EAF3] shadow-2xs overflow-hidden">
                    {filteredSaved.map((record) => {
                        const recordId = record.link || record.title;
                        const dateStr = record.pubDate
                            ? new Date(record.pubDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                              })
                            : 'Undated';

                        return (
                            <article
                                key={recordId}
                                className="p-4 hover:bg-[#F8FAFC] transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4 group"
                            >
                                <div
                                    className="flex-1 cursor-pointer"
                                    onClick={() => onSelectRecord(record)}
                                >
                                    <div className="flex items-center gap-2 flex-wrap text-xs text-[#586C86] mb-1">
                                        <span className="font-semibold text-[#14263F]">{record.source}</span>
                                        <span>•</span>
                                        <span>{dateStr}</span>
                                        {record.severity && (
                                            <span
                                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase border ${
                                                    record.severity.toLowerCase().includes('crit')
                                                        ? 'text-red-700 bg-red-50 border-red-200'
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
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-start">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveSaved(record);
                                        }}
                                        className="p-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors text-xs inline-flex items-center gap-1"
                                        title="Remove from saved"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Remove</span>
                                    </button>

                                    {record.link && (
                                        <a
                                            href={record.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 rounded-lg border border-[#E2EAF3] bg-white hover:bg-[#F4F7FB] text-[#586C86] hover:text-[#14263F] transition-colors"
                                            title="Open original source"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SavedNewsView;
