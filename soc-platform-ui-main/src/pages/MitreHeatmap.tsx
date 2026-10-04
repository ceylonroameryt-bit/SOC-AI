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
    if (hitCount === 0 || maxHits === 0) return 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100/90';
    const ratio = hitCount / maxHits;
    if (ratio >= 0.75) return 'bg-red-50 border-red-300 text-red-800 shadow-sm font-semibold';
    if (ratio >= 0.50) return 'bg-orange-50 border-orange-300 text-orange-800 shadow-sm font-semibold';
    if (ratio >= 0.25) return 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm font-medium';
    return 'bg-blue-50 border-blue-200 text-blue-800 font-medium';
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
    const [error, setError] = useState<string | null>(null);
    const [selectedTechnique, setSelectedTechnique] = useState<Technique | null>(null);
    const [filter, setFilter] = useState<'all' | 'active'>('all');

    const fetchHeatmap = async () => {
        setError(null);
        setLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/mitre/heatmap`);
            if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
            const json = await resp.json();
            if (!json?.tactics) throw new Error('Invalid heatmap data received');
            setData(json);
        } catch (err: unknown) {
            console.error('Failed to fetch MITRE heatmap:', err);
            setError(err instanceof Error ? err.message : 'Failed to load MITRE heatmap data');
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
        <div className="p-6 space-y-6 max-w-7xl mx-auto bg-white min-h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="section-label">ATT&CK Matrix</span>
                        <span className="availability-chip">
                            <span className="chip-dot"></span>
                            14 Enterprise Tactics
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                        <span className="text-2xl">🛡️</span>
                        MITRE ATT&amp;CK Heatmap
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">
                        Live adversary tactics and technique coverage mapped against threat disclosures
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => navigate('/mitre-news')}
                        className="btn-accent px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
                    >
                        <span>📰</span> ATT&amp;CK News Matrix
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            filter === 'all' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        All Techniques
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                            filter === 'active' ? 'bg-[#1E3A8A] text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        Active Only ({totalActive})
                    </button>
                    <button
                        onClick={fetchHeatmap}
                        className="btn-secondary px-3 py-2 text-xs"
                        title="Refresh Heatmap"
                    >
                        ↺
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            {data && (
                <div className="stats-strip">
                    <div className="stats-strip-inner">
                        <div className="strip-stat">
                            <div className="strip-num">{data.totalTechniques}<span className="strip-sup">ALL</span></div>
                            <div className="strip-label">Total Techniques</div>
                            <div className="strip-sub">MITRE ATT&CK v14 catalog</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-orange-600">{data.activeTechniques}<span className="strip-sup text-orange-600">ACT</span></div>
                            <div className="strip-label">Active Techniques</div>
                            <div className="strip-sub">Observed in active intelligence</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-[#1E3A8A]">{data.tactics.length}<span className="strip-sup text-[#1E3A8A]">TAC</span></div>
                            <div className="strip-label">Tactics Covered</div>
                            <div className="strip-sub">Across full kill chain</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-red-600">{maxHits}<span className="strip-sup text-red-600">MAX</span></div>
                            <div className="strip-label">Max Technique Hits</div>
                            <div className="strip-sub">Single vector concentration</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800">Heat Intensity:</span>
                {[
                    { label: 'None (0)', cls: 'bg-slate-200 border border-slate-300' },
                    { label: 'Low', cls: 'bg-blue-200 border border-blue-300' },
                    { label: 'Medium', cls: 'bg-amber-200 border border-amber-300' },
                    { label: 'High', cls: 'bg-orange-300 border border-orange-400' },
                    { label: 'Critical', cls: 'bg-red-400 border border-red-500' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className={`w-3.5 h-3.5 rounded-md ${item.cls}`}></div>
                        <span className="text-xs font-medium">{item.label}</span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1E3A8A]"></div>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 bg-red-50 p-6 rounded-2xl border border-red-200">
                    <p className="text-4xl">⚠️</p>
                    <p className="text-red-700 font-bold font-display">Failed to load MITRE heatmap</p>
                    <p className="text-slate-600 text-sm text-center max-w-md">{error}</p>
                    <button onClick={fetchHeatmap} className="btn-accent px-4 py-2 text-xs font-medium">
                        ↺ Retry
                    </button>
                </div>
            ) : (
                /* Matrix Horizontal Scroll Container */
                <div className="overflow-x-auto pb-4 custom-scrollbar rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                    <div className="flex gap-2.5 min-w-max">
                        {data?.tactics.map(tactic => {
                            const techniques = filter === 'active'
                                ? tactic.techniques.filter(t => t.hitCount > 0)
                                : tactic.techniques;

                            if (filter === 'active' && techniques.length === 0) return null;

                            return (
                                <div key={tactic.id} className="flex flex-col gap-1.5" style={{ minWidth: '140px', maxWidth: '160px' }}>
                                    {/* Tactic header */}
                                    <div className="bg-white border border-[#CBD5E1] shadow-xs rounded-xl p-2.5 text-center mb-1">
                                        <p className="text-slate-900 font-bold text-xs leading-tight truncate">{tactic.name}</p>
                                        <p className="text-blue-900 text-[10px] mt-0.5 font-mono font-semibold">{tactic.id}</p>
                                    </div>

                                    {/* Technique cells */}
                                    {techniques.map(tech => (
                                        <button
                                            key={tech.techniqueId}
                                            onClick={() => setSelectedTechnique(selectedTechnique?.techniqueId === tech.techniqueId ? null : tech)}
                                            className={`rounded-xl border px-2.5 py-2 text-left transition-all hover:scale-[1.02] cursor-pointer ${getHeatColor(tech.hitCount, maxHits)} ${
                                                selectedTechnique?.techniqueId === tech.techniqueId ? 'ring-2 ring-[#1E3A8A] shadow-md' : ''
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

            {/* Technique Detail Drawer Modal */}
            {selectedTechnique && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40"
                        onClick={() => setSelectedTechnique(null)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto animate-slide-in-right custom-scrollbar">
                        <div className="p-6 space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="text-xs font-mono text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                                        {selectedTechnique.techniqueId}
                                    </span>
                                    <h2 className="text-xl font-bold font-display text-slate-900 mt-2 leading-snug">{selectedTechnique.name}</h2>
                                    <p className="text-slate-500 text-xs mt-1">Tactic: {selectedTechnique.tacticName}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedTechnique(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-2xl leading-none"
                                >×</button>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1 font-bold">Activity Count</p>
                                <div className="flex items-center gap-3">
                                    <p className="text-3xl font-extrabold font-display text-orange-600">{selectedTechnique.hitCount}</p>
                                    <p className="text-slate-600 text-xs">intelligence reports referencing this technique</p>
                                </div>
                                <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-red-600 rounded-full transition-all"
                                        style={{ width: `${maxHits > 0 ? (selectedTechnique.hitCount / maxHits) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {selectedTechnique.hitCount > 0 && (
                                <button
                                    onClick={() => navigate(`/mitre-news?technique=${selectedTechnique.techniqueId}`)}
                                    className="w-full py-2.5 px-4 btn-accent text-xs font-semibold flex items-center justify-center gap-2"
                                >
                                    <span>📰</span> View News Tagged with {selectedTechnique.techniqueId} ({selectedTechnique.hitCount})
                                </button>
                            )}

                            <a
                                href={`https://attack.mitre.org/techniques/${selectedTechnique.techniqueId}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-4 transition-all group"
                            >
                                <span className="text-xl text-blue-700">🔗</span>
                                <div>
                                    <p className="text-[#1E3A8A] font-bold text-xs group-hover:underline">
                                        View on MITRE ATT&amp;CK Documentation
                                    </p>
                                    <p className="text-slate-400 text-[11px] mt-0.5">attack.mitre.org</p>
                                </div>
                            </a>

                            {selectedTechnique.hitCount === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <p className="text-3xl mb-2">📭</p>
                                    <p className="text-xs">No activity detected yet for this technique.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
