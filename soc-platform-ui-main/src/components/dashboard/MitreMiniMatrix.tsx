import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Target, ArrowUpRight, Flame, Shield, ChevronRight, FileSearch, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

export interface TechniqueItem {
    techniqueId: string;
    name: string;
    tacticId: string;
    tacticName?: string;
    hitCount: number;
    linkedItems?: string[];
}

export interface TacticItem {
    id: string;
    name: string;
    shortName: string;
    icon: string;
    color: string;
    hitCount: number;
    techniques: TechniqueItem[];
}

const MitreMiniMatrix = () => {
    const [rangeParams] = useSearchParams();
    const range = rangeParams.get('time') || rangeParams.get('range') || '24h';
    const [error, setError] = useState(false);
    const [tactics, setTactics] = useState<TacticItem[]>([]);
    const [selectedTacticId, setSelectedTacticId] = useState<string>('TA0001');

    useEffect(() => {
        fetch(`${API_BASE}/api/mitre/heatmap?time=${encodeURIComponent(range)}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (data?.tactics && Array.isArray(data.tactics)) {
                    const mapped: TacticItem[] = data.tactics.map((t: {
                        id: string;
                        name: string;
                        shortName?: string;
                        icon?: string;
                        color?: string;
                        techniques?: Array<{
                            techniqueId: string;
                            name: string;
                            tacticId: string;
                            tacticName?: string;
                            hitCount: number;
                            linkedItems?: string[];
                        }>
                    }) => {
                        const rawTechniques = Array.isArray(t.techniques) ? t.techniques : [];
                        const totalHits = rawTechniques.reduce((sum, te) => sum + (te.hitCount || 0), 0);
                        
                        // Sort techniques by hitCount descending
                        const sortedTechniques: TechniqueItem[] = [...rawTechniques].sort(
                            (a, b) => (b.hitCount || 0) - (a.hitCount || 0)
                        );

                        return {
                            id: t.id,
                            name: t.name,
                            shortName: t.shortName || t.name.split(' ')[0],
                            icon: t.icon || '🛡️',
                            color: t.color || '#3b82f6',
                            hitCount: totalHits > 0 ? totalHits : 0,
                            techniques: sortedTechniques,
                        };
                    });

                    if (Array.isArray(mapped)) {
                        setTactics(mapped);
                        // Default to highest-hit tactic
                        const topTactic = [...mapped].sort((a, b) => b.hitCount - a.hitCount)[0];
                        if (topTactic) {
                            setSelectedTacticId(prev => (mapped.some(m => m.id === prev) ? prev : topTactic.id));
                        }
                    }
                }
            })
            .catch(() => setError(true));
    }, [range]);

    const selectedTactic = tactics.find(t => t.id === selectedTacticId) || tactics[0];

    const getHitBadgeClass = (count: number) => {
        if (count > 500) return 'bg-red-100 text-red-700 border-red-200';
        if (count > 100) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (count > 30)  return 'bg-amber-100 text-amber-700 border-amber-200';
        if (count > 10)  return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3.5 gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                        <Target className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 leading-tight">
                                MITRE ATT&CK Enterprise Matrix
                            </h3>
                            <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                14 Tactical Phases
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Automated keyword matches in collected reports; review source evidence before use
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                        to="/mitre-news"
                        className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-700 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        <span>ATT&CK Feed</span>
                    </Link>
                    <Link
                        to="/mitre"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 transition-colors"
                    >
                        <span>Full Heatmap</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>

            {/* 14-Tactic Grid Switcher */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {tactics.map((t) => {
                    const isSelected = t.id === selectedTacticId;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTacticId(t.id)}
                            aria-pressed={isSelected}
                            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                isSelected
                                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                                    : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                            }`}
                            title={`${t.name} (${t.id}): ${t.hitCount.toLocaleString()} detections, ${t.techniques.length} mapped techniques`}
                        >
                            <span className="text-base mb-1" aria-hidden="true">{t.icon}</span>
                            <span className={`text-[11px] font-bold line-clamp-1 leading-tight ${
                                isSelected ? 'text-blue-800 font-extrabold' : 'text-slate-800 group-hover:text-slate-900'
                            }`}>
                                {t.shortName}
                            </span>
                            <div className="mt-1.5 flex items-center">
                                <span
                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${getHitBadgeClass(t.hitCount)}`}
                                >
                                    {t.hitCount.toLocaleString()} report matches
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Selected Phase Techniques Detail Section (Replaces the empty void) */}
            {selectedTactic && (
                <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="text-base" aria-hidden="true">{selectedTactic.icon}</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 font-display">
                                        Observed Techniques: <span className="text-blue-700">{selectedTactic.name}</span>
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                        {selectedTactic.id}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                    {selectedTactic.techniques.length} technique{selectedTactic.techniques.length === 1 ? '' : 's'} identified across active threat reports
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 font-mono text-[11px]">
                                Phase Total: <strong className="text-slate-900 font-semibold">{selectedTactic.hitCount.toLocaleString()}</strong> report matches
                            </span>
                            <Link
                                to={`/mitre`}
                                className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 text-[11px]"
                            >
                                <span>Inspect Phase</span>
                                <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    {/* Techniques List Grid */}
                    {selectedTactic.techniques.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {selectedTactic.techniques.slice(0, 6).map((tech) => (
                                <div
                                    key={tech.techniqueId}
                                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all flex flex-col justify-between gap-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                    {tech.techniqueId}
                                                </span>
                                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${getHitBadgeClass(tech.hitCount)}`}>
                                                    {tech.hitCount.toLocaleString()} report matches
                                                </span>
                                            </div>
                                            <h5 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2" title={tech.name}>
                                                {tech.name}
                                            </h5>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                                        <span className="font-mono">ATT&CK Matrix</span>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to="/mitre-news"
                                                className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 hover:underline"
                                            >
                                                <FileSearch className="w-2.5 h-2.5" />
                                                <span>Intel</span>
                                            </Link>
                                            <span>•</span>
                                            <Link
                                                to="/rules"
                                                className="text-slate-600 hover:text-blue-700 font-semibold inline-flex items-center gap-0.5 hover:underline"
                                            >
                                                <Code2 className="w-2.5 h-2.5" />
                                                <span>Rules</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <Shield className="w-4 h-4 text-slate-400" />
                            <span>No active technique triggers detected for {selectedTactic.name} in current telemetry feed.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Helper Subtext */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-red-600 font-semibold mr-1">
                        <Flame className="w-3.5 h-3.5" /> Top Observed:
                    </span>
                    {[...tactics].filter(t => t.hitCount > 0).sort((a, b) => b.hitCount - a.hitCount).slice(0, 3).map(t => (
                        <button key={t.id} type="button" onClick={() => setSelectedTacticId(t.id)} className="px-2 py-0.5 rounded border border-slate-200">
                            {t.shortName} ({t.hitCount.toLocaleString()})
                        </button>
                    ))}
                    {tactics.length === 0 && <span>{error ? 'Mappings unavailable' : 'Loading mappings…'}</span>}
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/mitre-news" className="text-blue-600 hover:underline font-medium">
                        View ATT&CK News Feed →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default MitreMiniMatrix;
