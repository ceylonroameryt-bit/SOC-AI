import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

interface Technique {
    techniqueId: string;
    name: string;
    tacticId: string;
    tacticName: string;
    hitCount: number;
    linkedItems: string[];
}

interface Tactic {
    id: string;
    name: string;
    shortName: string;
    techniques: Technique[];
}

interface HeatmapData {
    tactics: Tactic[];
    totalTechniques: number;
    activeTechniques: number;
    lastUpdated: string;
}

const getHeatColor = (hitCount: number, maxHits: number): string => {
    if (hitCount === 0 || maxHits === 0) return 'bg-gray-800/60 border-gray-700/40 text-gray-500';
    const ratio = hitCount / maxHits;
    if (ratio >= 0.75) return 'bg-red-600/90 border-red-500/80 text-white shadow-red-500/30 shadow-md';
    if (ratio >= 0.50) return 'bg-orange-500/85 border-orange-400/70 text-white shadow-orange-500/20 shadow-sm';
    if (ratio >= 0.25) return 'bg-yellow-500/80 border-yellow-400/60 text-gray-900 shadow-yellow-500/20 shadow-sm';
    return 'bg-yellow-700/50 border-yellow-600/40 text-yellow-200';
};

const getHeatIntensity = (hitCount: number): string => {
    if (hitCount === 0) return '';
    if (hitCount >= 20) return '🔴';
    if (hitCount >= 10) return '🟠';
    if (hitCount >= 5)  return '🟡';
    return '🟢';
};

export default function MitreHeatmap() {
    const navigate = useNavigate();
    const [data, setData] = useState<HeatmapData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
    const [filter, setFilter] = useState<'all' | 'active'>('all');

    const fetchHeatmap = async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/mitre/heatmap`);
            const json = await resp.json();
            setData(json);
        } catch (err) {
            console.error('Failed to fetch MITRE heatmap:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchHeatmap(); }, []);

    const maxHits = data
        ? Math.max(...data.tactics.flatMap(t => t.techniques.map(te => te.hitCount)), 1)
        : 1;

    const totalActive = data?.activeTechniques ?? 0;

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <span className="text-2xl sm:text-3xl">🛡️</span>
                        MITRE ATT&amp;CK Heatmap
                    </h1>
                    <p className="text-gray-400 mt-1 text-xs sm:text-sm">
                        Live threat activity mapped across 14 enterprise tactics &amp; techniques
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => navigate('/mitre-news')}
                        className="px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
                    >
                        <span>📰</span> ATT&amp;CK News Matrix
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                            filter === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                        }`}
                    >
                        All Techniques
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                            filter === 'active' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                        }`}
                    >
                        Active Only ({totalActive})
                    </button>
                    <button
                        onClick={fetchHeatmap}
                        className="px-3 sm:px-4 py-2 bg-slate-800 text-gray-400 hover:bg-slate-700 rounded-xl text-xs sm:text-sm transition-all"
                    >
                        ↺
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Techniques', value: data.totalTechniques, color: 'text-cyan-400' },
                        { label: 'Active Techniques', value: data.activeTechniques, color: 'text-orange-400' },
                        { label: 'Tactics Covered', value: data.tactics.length, color: 'text-purple-400' },
                        { label: 'Max Hits (single)', value: maxHits, color: 'text-red-400' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 sm:p-4 text-center">
                            <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-gray-500 text-[11px] sm:text-xs mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-gray-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
                <span className="font-semibold text-slate-300">Heat Intensity:</span>
                {[
                    { label: 'None (0)', cls: 'bg-gray-700' },
                    { label: 'Low', cls: 'bg-yellow-700' },
                    { label: 'Medium', cls: 'bg-yellow-500' },
                    { label: 'High', cls: 'bg-orange-500' },
                    { label: 'Critical', cls: 'bg-red-600' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded ${item.cls}`}></div>
                        <span className="text-[11px]">{item.label}</span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                /* Matrix Horizontal Scroll Container */
                <div className="overflow-x-auto pb-4 custom-scrollbar rounded-2xl border border-slate-800 p-4 bg-slate-900/40">
                    <div className="flex gap-2.5 min-w-max">
                        {data?.tactics.map(tactic => {
                            const techniques = filter === 'active'
                                ? tactic.techniques.filter(t => t.hitCount > 0)
                                : tactic.techniques;

                            if (filter === 'active' && techniques.length === 0) return null;

                            return (
                                <div key={tactic.id} className="flex flex-col gap-1.5" style={{ minWidth: '140px', maxWidth: '160px' }}>
                                    {/* Tactic header */}
                                    <div className="bg-cyan-950/60 border border-cyan-700/50 rounded-xl p-2.5 text-center mb-1">
                                        <p className="text-cyan-300 font-bold text-xs leading-tight truncate">{tactic.name}</p>
                                        <p className="text-cyan-500 text-[10px] mt-0.5 font-mono">{tactic.id}</p>
                                    </div>

                                    {/* Technique cells */}
                                    {techniques.map(tech => (
                                        <button
                                            key={tech.techniqueId}
                                            onClick={() => setSelectedTechnique(selectedTechnique?.techniqueId === tech.techniqueId ? null : tech)}
                                            className={`rounded-xl border px-2.5 py-2 text-left transition-all hover:scale-[1.02] cursor-pointer ${getHeatColor(tech.hitCount, maxHits)} ${
                                                selectedTechnique?.techniqueId === tech.techniqueId ? 'ring-2 ring-white/80 shadow-lg' : ''
                                            }`}
                                        >
                                            <p className="text-[10px] font-mono opacity-80">{tech.techniqueId}</p>
                                            <p className="text-[11px] font-medium leading-snug mt-0.5 line-clamp-2">{tech.name}</p>
                                            {tech.hitCount > 0 && (
                                                <p className="text-[10px] mt-1 font-bold">
                                                    {getHeatIntensity(tech.hitCount)} {tech.hitCount} hit{tech.hitCount !== 1 ? 's' : ''}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Technique Detail Drawer Modal (Mobile responsive full-width or right slide-in) */}
            {selectedTechnique && (
                <>
                    {/* Backdrop on mobile */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
                        onClick={() => setSelectedTechnique(null)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-gray-950 border-l border-gray-800 shadow-2xl z-50 overflow-y-auto animate-slide-in-right custom-scrollbar">
                        <div className="p-5 sm:p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-2 py-0.5 rounded-md">
                                        {selectedTechnique.techniqueId}
                                    </span>
                                    <h2 className="text-lg sm:text-xl font-bold text-white mt-2 leading-snug">{selectedTechnique.name}</h2>
                                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Tactic: {selectedTechnique.tacticName}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedTechnique(null)}
                                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-2xl leading-none"
                                >×</button>
                            </div>

                            <div className="bg-gray-900/70 rounded-xl p-4 border border-gray-800">
                                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1.5 font-semibold">Activity Count</p>
                                <div className="flex items-center gap-3">
                                    <p className="text-3xl font-bold text-orange-400">{selectedTechnique.hitCount}</p>
                                    <p className="text-gray-400 text-xs sm:text-sm">news reports referencing this technique</p>
                                </div>
                                <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-red-500 rounded-full transition-all"
                                        style={{ width: `${maxHits > 0 ? (selectedTechnique.hitCount / maxHits) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {selectedTechnique.hitCount > 0 && (
                                <button
                                    onClick={() => navigate(`/mitre-news?technique=${selectedTechnique.techniqueId}`)}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 active:scale-95"
                                >
                                    <span>📰</span> View News Tagged with {selectedTechnique.techniqueId} ({selectedTechnique.hitCount})
                                </button>
                            )}

                            <a
                                href={`https://attack.mitre.org/techniques/${selectedTechnique.techniqueId}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-800/60 rounded-xl p-4 transition-all group"
                            >
                                <span className="text-cyan-400 text-xl">🔗</span>
                                <div>
                                    <p className="text-cyan-300 font-semibold text-xs sm:text-sm group-hover:underline">
                                        View on MITRE ATT&amp;CK Documentation
                                    </p>
                                    <p className="text-gray-500 text-[11px] mt-0.5">attack.mitre.org</p>
                                </div>
                            </a>

                            {selectedTechnique.hitCount === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p className="text-3xl mb-2">📭</p>
                                    <p className="text-xs sm:text-sm">No activity detected yet for this technique.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
