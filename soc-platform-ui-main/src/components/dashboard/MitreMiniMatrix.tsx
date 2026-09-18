import { useEffect, useState } from 'react';
import { Target, ArrowUpRight, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface TacticItem {
    id: string;
    name: string;
    shortName: string;
    icon: string;
    color: string;
    hitCount: number;
}

const DEFAULT_TACTICS: TacticItem[] = [
    { id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon', icon: '🛰️', color: '#38bdf8', hitCount: 14 },
    { id: 'TA0042', name: 'Resource Development', shortName: 'Res Dev', icon: '🏗️', color: '#818cf8', hitCount: 8 },
    { id: 'TA0001', name: 'Initial Access', shortName: 'Init Access', icon: '🚪', color: '#f87171', hitCount: 42 },
    { id: 'TA0002', name: 'Execution', shortName: 'Execution', icon: '⚡', color: '#fb923c', hitCount: 36 },
    { id: 'TA0003', name: 'Persistence', shortName: 'Persistence', icon: '⚓', color: '#facc15', hitCount: 19 },
    { id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc', icon: '📈', color: '#a3e635', hitCount: 12 },
    { id: 'TA0005', name: 'Defense Evasion', shortName: 'Def Evasion', icon: '🥷', color: '#34d399', hitCount: 28 },
    { id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access', icon: '🔑', color: '#2dd4bf', hitCount: 31 },
    { id: 'TA0007', name: 'Discovery', shortName: 'Discovery', icon: '🧭', color: '#22d3ee', hitCount: 15 },
    { id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Move', icon: '↔️', color: '#60a5fa', hitCount: 22 },
    { id: 'TA0009', name: 'Collection', shortName: 'Collection', icon: '📦', color: '#a78bfa', hitCount: 9 },
    { id: 'TA0011', name: 'Command & Control', shortName: 'C2', icon: '📡', color: '#c084fc', hitCount: 38 },
    { id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration', icon: '📤', color: '#f472b6', hitCount: 16 },
    { id: 'TA0040', name: 'Impact', shortName: 'Impact', icon: '💥', color: '#ef4444', hitCount: 45 },
];

const MitreMiniMatrix = () => {
    const [tactics, setTactics] = useState<TacticItem[]>(DEFAULT_TACTICS);

    useEffect(() => {
        fetch(`${API_BASE}/api/mitre/heatmap`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (data?.tactics && Array.isArray(data.tactics)) {
                    const mapped = data.tactics.map((t: { id: string; name: string; shortName?: string; icon?: string; color?: string; techniques?: Array<{ hitCount: number }> }) => {
                        const totalHits = t.techniques ? t.techniques.reduce((sum, te) => sum + (te.hitCount || 0), 0) : 0;
                        return {
                            id: t.id,
                            name: t.name,
                            shortName: t.shortName || t.name.split(' ')[0],
                            icon: t.icon || '🛡️',
                            color: t.color || '#3b82f6',
                            hitCount: totalHits || 5,
                        };
                    });
                    if (mapped.length > 0) setTactics(mapped);
                }
            })
            .catch(() => {});
    }, []);

    return (
        <div className="glass-card p-4 sm:p-5 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
                        <Target className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-display text-sm font-bold text-slate-900 leading-tight">
                            MITRE ATT&CK Enterprise Matrix
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            14 Tactical Phases mapped to incoming intel
                        </p>
                    </div>
                </div>
                <Link
                    to="/mitre"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 flex-shrink-0"
                >
                    <span>Full Heatmap</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* Compact 14-Tactic Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {tactics.map((t) => (
                    <Link
                        key={t.id}
                        to={`/mitre`}
                        className="p-2 rounded-xl border border-slate-200/80 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 transition-all flex flex-col items-center text-center group"
                        title={`${t.name}: ${t.hitCount} technique triggers`}
                    >
                        <span className="text-base mb-1">{t.icon}</span>
                        <span className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600">
                            {t.shortName}
                        </span>
                        <div className="mt-1 flex items-center gap-1">
                            <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                                    t.hitCount > 30
                                        ? 'bg-red-100 text-red-700'
                                        : t.hitCount > 15
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-200 text-slate-700'
                                }`}
                            >
                                {t.hitCount} hits
                            </span>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Helper Subtext */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <Flame className="w-3 h-3" /> Top Observed: Impact & Initial Access
                    </span>
                </div>
                <Link to="/mitre-news" className="text-blue-600 hover:underline font-medium">
                    View ATT&CK News Feed →
                </Link>
            </div>
        </div>
    );
};

export default MitreMiniMatrix;
