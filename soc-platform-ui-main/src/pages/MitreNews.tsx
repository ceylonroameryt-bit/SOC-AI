import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config/api';
import {
    Shield,
    ExternalLink,
    Search,
    Layers,
    ListFilter,
    Calendar,
    Radio,
    Sparkles,
    ChevronRight,
    ChevronDown,
    Zap,
    Target
} from 'lucide-react';

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
    description: string;
    color: string;
    articleCount?: number;
    topTechniques?: Array<{ id: string; name: string; count: number }>;
}

interface ExtractedIOCs {
    ips: string[];
    hashes: string[];
    cves: string[];
    domains: string[];
}

interface NewsItem {
    id: string;
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    category: string;
    mitreTechniques: MitreTechnique[];
    mitreTactics: MitreTactic[];
    isMitreCategorized: boolean;
    extractedIOCs: ExtractedIOCs;
}

interface NewsApiResponse {
    articles: NewsItem[];
    tacticsSummary: MitreTactic[];
    totalCategorized: number;
    totalArticles: number;
    pagination: {
        page: number;
        limit: number;
        totalPages: number;
        totalCount: number;
    };
    coverageStats: {
        totalTactics: number;
        activeTactics: number;
        coveragePercent: number;
    };
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    Critical: {
        bg: 'bg-red-950/60',
        text: 'text-red-400',
        border: 'border-red-600/50',
        glow: 'shadow-red-500/20'
    },
    High: {
        bg: 'bg-orange-950/60',
        text: 'text-orange-400',
        border: 'border-orange-600/50',
        glow: 'shadow-orange-500/20'
    },
    Medium: {
        bg: 'bg-yellow-950/60',
        text: 'text-yellow-400',
        border: 'border-yellow-600/50',
        glow: 'shadow-yellow-500/20'
    },
    Low: {
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-400',
        border: 'border-emerald-600/50',
        glow: 'shadow-emerald-500/20'
    },
};

export default function MitreNews() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const selectedTacticParam = searchParams.get('tactic') || 'all';
    const selectedTechniqueParam = searchParams.get('technique') || 'all';
    const selectedSeverityParam = searchParams.get('severity') || 'all';
    const searchQueryParam = searchParams.get('q') || '';
    const pageParam = parseInt(searchParams.get('page') || '1');

    const [data, setData] = useState<NewsApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState(searchQueryParam);
    const [viewMode, setViewMode] = useState<'feed' | 'grouped'>('feed');
    const [collapsedTactics, setCollapsedTactics] = useState<Record<string, boolean>>({});

    const fetchNews = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedTacticParam !== 'all') params.set('tactic', selectedTacticParam);
            if (selectedTechniqueParam !== 'all') params.set('technique', selectedTechniqueParam);
            if (selectedSeverityParam !== 'all') params.set('severity', selectedSeverityParam);
            if (searchQueryParam) params.set('q', searchQueryParam);
            params.set('page', pageParam.toString());
            params.set('limit', '30');

            const resp = await fetch(`${API_BASE}/api/mitre/news?${params.toString()}`);
            if (!resp.ok) throw new Error('Failed to fetch categorized news');
            const json: NewsApiResponse = await resp.json();
            setData(json);
        } catch (err) {
            console.error('Error loading MITRE categorized news:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedTacticParam, selectedTechniqueParam, selectedSeverityParam, searchQueryParam, pageParam]);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    const updateFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value === 'all' || !value) {
            newParams.delete(key);
        } else {
            newParams.set(key, value);
        }
        newParams.set('page', '1'); // reset to page 1 on filter change
        setSearchParams(newParams);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilter('q', searchInput);
    };

    const handleClearFilters = () => {
        setSearchInput('');
        setSearchParams(new URLSearchParams());
    };

    const toggleTacticCollapse = (tacticId: string) => {
        setCollapsedTactics(prev => ({
            ...prev,
            [tacticId]: !prev[tacticId]
        }));
    };

    const activeTacticObj = data?.tacticsSummary.find(t => t.id === selectedTacticParam || t.shortName === selectedTacticParam);

    return (
        <div className="p-6 space-y-6 min-h-full max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                            <Target className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-slate-100 flex items-center gap-2">
                                MITRE ATT&CK <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">News Matrix</span>
                            </h1>
                            <p className="text-slate-400 text-sm">
                                Live threat intelligence categorized across 14 MITRE ATT&CK Enterprise Tactics &amp; Techniques
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => navigate('/mitre')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
                    >
                        <Layers className="w-4 h-4 text-cyan-400" />
                        Heatmap View
                    </button>
                    <button
                        onClick={() => navigate('/enrich')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium border border-slate-700 transition-all flex items-center gap-2"
                    >
                        <Zap className="w-4 h-4 text-amber-400" />
                        IOC Enrichment
                    </button>
                    <button
                        onClick={fetchNews}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-600/20"
                    >
                        ↺ Refresh Feed
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl lg:text-2xl font-bold text-slate-100">{data.totalCategorized}</p>
                            <p className="text-xs text-slate-400">MITRE Categorized</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl lg:text-2xl font-bold text-slate-100">
                                {data.coverageStats.activeTactics} <span className="text-xs font-normal text-slate-500">/ 14</span>
                            </p>
                            <p className="text-xs text-slate-400">Active Tactics</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl lg:text-2xl font-bold text-emerald-400">{data.coverageStats.coveragePercent}%</p>
                            <p className="text-xs text-slate-400">Matrix Coverage</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                            <Radio className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xl lg:text-2xl font-bold text-slate-100">{data.totalArticles}</p>
                            <p className="text-xs text-slate-400">Total Ingested Articles</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 14 MITRE Tactics Navigation Ribbon */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <span>🛡️</span> Filter by MITRE Tactic
                    </span>
                    {selectedTacticParam !== 'all' && (
                        <button
                            onClick={() => updateFilter('tactic', 'all')}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                        >
                            ✕ Reset Tactic
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    <button
                        onClick={() => updateFilter('tactic', 'all')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                            selectedTacticParam === 'all'
                                ? 'bg-cyan-500/20 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                                : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm">🌐</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                                {data?.totalCategorized ?? 0}
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-200 mt-1.5 truncate">All Tactics</p>
                        <p className="text-[10px] text-slate-500 truncate">Entire Feed</p>
                    </button>

                    {data?.tacticsSummary.map(tactic => {
                        const isSelected = selectedTacticParam === tactic.id || selectedTacticParam === tactic.shortName;
                        const count = tactic.articleCount || 0;

                        return (
                            <button
                                key={tactic.id}
                                onClick={() => updateFilter('tactic', isSelected ? 'all' : tactic.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                                    isSelected
                                        ? 'bg-slate-800 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div
                                    className="absolute top-0 left-0 right-0 h-0.5 transition-all opacity-80 group-hover:opacity-100"
                                    style={{ backgroundColor: tactic.color }}
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">{tactic.icon}</span>
                                    <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                            count > 0 ? 'bg-slate-900 text-slate-200 border border-slate-700' : 'text-slate-600'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-200 mt-1.5 truncate">{tactic.shortName}</p>
                                <p className="text-[10px] text-slate-500 truncate">{tactic.id}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Search box */}
                    <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search threat reports, CVEs, techniques (e.g. ransomware, powershell, CVE-2024)..."
                            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => { setSearchInput(''); updateFilter('q', ''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </form>

                    {/* Severity dropdown */}
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedSeverityParam}
                            onChange={(e) => updateFilter('severity', e.target.value)}
                            className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
                        >
                            <option value="all">All Severities</option>
                            <option value="Critical">🔴 Critical Only</option>
                            <option value="High">🟠 High Only</option>
                            <option value="Medium">🟡 Medium Only</option>
                            <option value="Low">🟢 Low Only</option>
                        </select>

                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                            <button
                                onClick={() => setViewMode('feed')}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    viewMode === 'feed' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Unified Feed View"
                            >
                                <ListFilter className="w-3.5 h-3.5" />
                                Feed
                            </button>
                            <button
                                onClick={() => setViewMode('grouped')}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                    viewMode === 'grouped' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                                }`}
                                title="Grouped by MITRE Tactic"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                Grouped
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active filter badges */}
                {(selectedTacticParam !== 'all' || selectedTechniqueParam !== 'all' || selectedSeverityParam !== 'all' || searchQueryParam) && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-500">Active Filters:</span>
                        {selectedTacticParam !== 'all' && (
                            <span className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-800 text-cyan-300 rounded-lg flex items-center gap-1.5">
                                Tactic: {activeTacticObj?.name || selectedTacticParam}
                                <button onClick={() => updateFilter('tactic', 'all')} className="hover:text-white font-bold">×</button>
                            </span>
                        )}
                        {selectedTechniqueParam !== 'all' && (
                            <span className="px-2.5 py-1 bg-purple-950/60 border border-purple-800 text-purple-300 rounded-lg flex items-center gap-1.5">
                                Technique: {selectedTechniqueParam}
                                <button onClick={() => updateFilter('technique', 'all')} className="hover:text-white font-bold">×</button>
                            </span>
                        )}
                        {selectedSeverityParam !== 'all' && (
                            <span className="px-2.5 py-1 bg-amber-950/60 border border-amber-800 text-amber-300 rounded-lg flex items-center gap-1.5">
                                Severity: {selectedSeverityParam}
                                <button onClick={() => updateFilter('severity', 'all')} className="hover:text-white font-bold">×</button>
                            </span>
                        )}
                        {searchQueryParam && (
                            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5">
                                Query: "{searchQueryParam}"
                                <button onClick={() => { setSearchInput(''); updateFilter('q', ''); }} className="hover:text-white font-bold">×</button>
                            </span>
                        )}
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-slate-400 hover:text-red-400 underline transition-colors ml-auto"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Content Display */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                    <p className="text-slate-400 text-sm">Mapping intelligence into MITRE ATT&amp;CK Matrix...</p>
                </div>
            ) : data?.articles.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                    <div className="text-4xl">🔍</div>
                    <h3 className="text-lg font-bold text-slate-200">No articles matched your MITRE criteria</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                        Try selecting another MITRE tactic, clearing search keywords, or selecting "All Tactics".
                    </p>
                    <button
                        onClick={handleClearFilters}
                        className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold"
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : viewMode === 'feed' ? (
                /* ── Standard Feed View ───────────────────────────────────────── */
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                        <span>
                            Showing {data?.articles.length} of {data?.pagination.totalCount} categorized threat reports
                        </span>
                        <span>
                            Page {data?.pagination.page} of {data?.pagination.totalPages || 1}
                        </span>
                    </div>

                    <div className="grid gap-4">
                        {data?.articles.map((item) => (
                            <NewsArticleCard
                                key={item.id}
                                item={item}
                                onSelectTechnique={(techId) => updateFilter('technique', techId)}
                                onSelectTactic={(tacId) => updateFilter('tactic', tacId)}
                                onEnrich={(ioc) => navigate(`/enrich?ioc=${encodeURIComponent(ioc)}`)}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {data && data.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button
                                disabled={data.pagination.page <= 1}
                                onClick={() => updateFilter('page', (data.pagination.page - 1).toString())}
                                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-slate-400 px-3">
                                Page {data.pagination.page} of {data.pagination.totalPages}
                            </span>
                            <button
                                disabled={data.pagination.page >= data.pagination.totalPages}
                                onClick={() => updateFilter('page', (data.pagination.page + 1).toString())}
                                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* ── Grouped View by 14 MITRE Tactics ─────────────────────────── */
                <div className="space-y-4">
                    {data?.tacticsSummary.map((tactic) => {
                        const matchingArticles = (data?.articles || []).filter(art =>
                            art.mitreTactics.some(t => t.id === tactic.id)
                        );
                        const isCollapsed = collapsedTactics[tactic.id];

                        if (selectedTacticParam !== 'all' && selectedTacticParam !== tactic.id && selectedTacticParam !== tactic.shortName) {
                            return null;
                        }

                        return (
                            <div
                                key={tactic.id}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
                            >
                                <button
                                    onClick={() => toggleTacticCollapse(tactic.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-2 h-8 rounded-full"
                                            style={{ backgroundColor: tactic.color }}
                                        />
                                        <span className="text-2xl">{tactic.icon}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-100 text-base">
                                                    {tactic.name}
                                                </h3>
                                                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                                                    {tactic.id}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs mt-0.5">
                                                {tactic.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-semibold">
                                            {matchingArticles.length} Article{matchingArticles.length !== 1 ? 's' : ''}
                                        </span>
                                        {isCollapsed ? (
                                            <ChevronRight className="w-5 h-5 text-slate-500" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-slate-500" />
                                        )}
                                    </div>
                                </button>

                                {!isCollapsed && (
                                    <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
                                        {matchingArticles.length === 0 ? (
                                            <p className="text-slate-500 text-xs italic py-2">
                                                No current articles tagged with {tactic.name}.
                                            </p>
                                        ) : (
                                            matchingArticles.map(item => (
                                                <NewsArticleCard
                                                    key={item.id}
                                                    item={item}
                                                    onSelectTechnique={(techId) => updateFilter('technique', techId)}
                                                    onSelectTactic={(tacId) => updateFilter('tactic', tacId)}
                                                    onEnrich={(ioc) => navigate(`/enrich?ioc=${encodeURIComponent(ioc)}`)}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Single Article Card Component ───────────────────────────────────────────────
function NewsArticleCard({
    item,
    onSelectTechnique,
    onSelectTactic,
    onEnrich,
}: {
    item: NewsItem;
    onSelectTechnique: (id: string) => void;
    onSelectTactic: (id: string) => void;
    onEnrich: (ioc: string) => void;
}) {
    const sev = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.Medium;
    const formattedDate = new Date(item.pubDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const allIOCs = [
        ...item.extractedIOCs.cves,
        ...item.extractedIOCs.ips,
        ...item.extractedIOCs.hashes,
    ];

    return (
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-md hover:shadow-xl space-y-3.5">
            {/* Top row: Severity, Category, Source, Date */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${sev.bg} ${sev.text} ${sev.border} ${sev.glow}`}>
                        {item.severity}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {item.category}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/60 px-2 py-0.5 rounded-md">
                        <Radio className="w-3 h-3 text-cyan-400" />
                        {item.source}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formattedDate}</span>
                </div>
            </div>

            {/* Title & Link */}
            <div>
                <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base lg:text-lg font-bold text-slate-100 hover:text-cyan-400 transition-colors inline-flex items-start gap-2 group leading-snug"
                >
                    <span>{item.title}</span>
                    <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity text-cyan-400" />
                </a>
            </div>

            {/* Snippet */}
            {item.contentSnippet && (
                <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                    {item.contentSnippet}
                </p>
            )}

            {/* MITRE Badges Section */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                        <Target className="w-3 h-3 text-cyan-400" /> MITRE ATT&CK:
                    </span>

                    {item.mitreTechniques.length === 0 ? (
                        <span className="text-xs text-slate-600 italic">General Threat Activity</span>
                    ) : (
                        item.mitreTechniques.map((tech) => (
                            <div
                                key={tech.id}
                                className="inline-flex items-center rounded-lg bg-slate-800/80 border border-slate-700/80 hover:border-cyan-500/60 text-xs overflow-hidden transition-all group"
                            >
                                <button
                                    onClick={() => onSelectTactic(tech.tacticId)}
                                    className="px-2 py-0.5 bg-slate-800 text-slate-300 group-hover:bg-cyan-950/80 group-hover:text-cyan-300 font-semibold border-r border-slate-700 transition-colors flex items-center gap-1"
                                    title={`Tactic: ${tech.tacticName}`}
                                >
                                    <span>{tech.tacticIcon || '🛡️'}</span>
                                    <span>{tech.id}</span>
                                </button>
                                <button
                                    onClick={() => onSelectTechnique(tech.id)}
                                    className="px-2 py-0.5 text-slate-300 hover:text-white font-medium transition-colors"
                                    title={tech.name}
                                >
                                    {tech.name}
                                </button>
                                <a
                                    href={tech.mitreUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 text-slate-500 hover:text-cyan-400 border-l border-slate-700 hover:bg-slate-700/50"
                                    title="View technique on MITRE site"
                                >
                                    ↗
                                </a>
                            </div>
                        ))
                    )}
                </div>

                {/* Extracted IOCs & Hunt Action */}
                {allIOCs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-400" /> Detected IOCs:
                        </span>
                        {allIOCs.slice(0, 5).map((ioc, idx) => (
                            <button
                                key={idx}
                                onClick={() => onEnrich(ioc)}
                                className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/50 hover:border-amber-500 text-amber-300 font-mono text-[11px] transition-colors flex items-center gap-1"
                                title="Click to auto-enrich indicator"
                            >
                                <span>{ioc}</span>
                                <span className="text-[9px] opacity-70">🔍</span>
                            </button>
                        ))}
                        {allIOCs.length > 5 && (
                            <span className="text-[10px] text-slate-500">+{allIOCs.length - 5} more</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
