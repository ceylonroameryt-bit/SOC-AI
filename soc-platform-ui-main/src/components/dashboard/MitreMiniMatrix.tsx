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

const DEFAULT_TACTICS: TacticItem[] = [
    {
        id: 'TA0043', name: 'Reconnaissance', shortName: 'Recon', icon: '🛰️', color: '#38bdf8', hitCount: 207,
        techniques: [
            { techniqueId: 'T1595', name: 'Active Scanning', tacticId: 'TA0043', hitCount: 142 },
            { techniqueId: 'T1592', name: 'Gather Victim Host Information', tacticId: 'TA0043', hitCount: 65 }
        ]
    },
    {
        id: 'TA0042', name: 'Resource Development', shortName: 'Resource Dev', icon: '🏗️', color: '#818cf8', hitCount: 55,
        techniques: [
            { techniqueId: 'T1583', name: 'Acquire Infrastructure', tacticId: 'TA0042', hitCount: 38 },
            { techniqueId: 'T1588', name: 'Obtain Capabilities', tacticId: 'TA0042', hitCount: 17 }
        ]
    },
    {
        id: 'TA0001', name: 'Initial Access', shortName: 'Initial Access', icon: '🚪', color: '#f87171', hitCount: 2544,
        techniques: [
            { techniqueId: 'T1190', name: 'Exploit Public-Facing Application', tacticId: 'TA0001', hitCount: 2180 },
            { techniqueId: 'T1566', name: 'Phishing', tacticId: 'TA0001', hitCount: 245 },
            { techniqueId: 'T1078', name: 'Valid Accounts', tacticId: 'TA0001', hitCount: 119 }
        ]
    },
    {
        id: 'TA0002', name: 'Execution', shortName: 'Execution', icon: '⚡', color: '#fb923c', hitCount: 192,
        techniques: [
            { techniqueId: 'T1059', name: 'Command and Scripting Interpreter', tacticId: 'TA0002', hitCount: 134 },
            { techniqueId: 'T1204', name: 'User Execution', tacticId: 'TA0002', hitCount: 58 }
        ]
    },
    {
        id: 'TA0003', name: 'Persistence', shortName: 'Persistence', icon: '⚓', color: '#facc15', hitCount: 92,
        techniques: [
            { techniqueId: 'T1053', name: 'Scheduled Task/Job', tacticId: 'TA0003', hitCount: 54 },
            { techniqueId: 'T1547', name: 'Boot or Logon Autostart Execution', tacticId: 'TA0003', hitCount: 38 }
        ]
    },
    {
        id: 'TA0004', name: 'Privilege Escalation', shortName: 'Priv Esc', icon: '📈', color: '#a3e635', hitCount: 204,
        techniques: [
            { techniqueId: 'T1068', name: 'Exploitation for Privilege Escalation', tacticId: 'TA0004', hitCount: 168 },
            { techniqueId: 'T1548', name: 'Abuse Elevation Control Mechanism', tacticId: 'TA0004', hitCount: 36 }
        ]
    },
    {
        id: 'TA0005', name: 'Defense Evasion', shortName: 'Def Evasion', icon: '🥷', color: '#34d399', hitCount: 115,
        techniques: [
            { techniqueId: 'T1070', name: 'Indicator Removal', tacticId: 'TA0005', hitCount: 68 },
            { techniqueId: 'T1027', name: 'Obfuscated Files or Information', tacticId: 'TA0005', hitCount: 47 }
        ]
    },
    {
        id: 'TA0006', name: 'Credential Access', shortName: 'Cred Access', icon: '🔑', color: '#2dd4bf', hitCount: 109,
        techniques: [
            { techniqueId: 'T1110', name: 'Brute Force', tacticId: 'TA0006', hitCount: 64 },
            { techniqueId: 'T1555', name: 'Credentials from Password Stores', tacticId: 'TA0006', hitCount: 45 }
        ]
    },
    {
        id: 'TA0007', name: 'Discovery', shortName: 'Discovery', icon: '🧭', color: '#22d3ee', hitCount: 70,
        techniques: [
            { techniqueId: 'T1082', name: 'System Information Discovery', tacticId: 'TA0007', hitCount: 42 },
            { techniqueId: 'T1018', name: 'Remote System Discovery', tacticId: 'TA0007', hitCount: 28 }
        ]
    },
    {
        id: 'TA0008', name: 'Lateral Movement', shortName: 'Lateral Move', icon: '↔️', color: '#60a5fa', hitCount: 78,
        techniques: [
            { techniqueId: 'T1021', name: 'Remote Services', tacticId: 'TA0008', hitCount: 52 },
            { techniqueId: 'T1570', name: 'Lateral Tool Transfer', tacticId: 'TA0008', hitCount: 26 }
        ]
    },
    {
        id: 'TA0009', name: 'Collection', shortName: 'Collection', icon: '📦', color: '#a78bfa', hitCount: 70,
        techniques: [
            { techniqueId: 'T1560', name: 'Archive Collected Data', tacticId: 'TA0009', hitCount: 45 },
            { techniqueId: 'T1005', name: 'Data from Local System', tacticId: 'TA0009', hitCount: 25 }
        ]
    },
    {
        id: 'TA0011', name: 'Command & Control', shortName: 'C2', icon: '📡', color: '#c084fc', hitCount: 223,
        techniques: [
            { techniqueId: 'T1071', name: 'Application Layer Protocol', tacticId: 'TA0011', hitCount: 160 },
            { techniqueId: 'T1573', name: 'Encrypted Channel', tacticId: 'TA0011', hitCount: 63 }
        ]
    },
    {
        id: 'TA0010', name: 'Exfiltration', shortName: 'Exfiltration', icon: '📤', color: '#f472b6', hitCount: 130,
        techniques: [
            { techniqueId: 'T1041', name: 'Exfiltration Over C2 Channel', tacticId: 'TA0010', hitCount: 88 },
            { techniqueId: 'T1567', name: 'Exfiltration Over Web Service', tacticId: 'TA0010', hitCount: 42 }
        ]
    },
    {
        id: 'TA0040', name: 'Impact', shortName: 'Impact', icon: '💥', color: '#ef4444', hitCount: 593,
        techniques: [
            { techniqueId: 'T1486', name: 'Data Encrypted for Impact', tacticId: 'TA0040', hitCount: 472 },
            { techniqueId: 'T1489', name: 'Service Stop', tacticId: 'TA0040', hitCount: 71 },
            { techniqueId: 'T1485', name: 'Data Destruction', tacticId: 'TA0040', hitCount: 28 },
            { techniqueId: 'T1491', name: 'Defacement', tacticId: 'TA0040', hitCount: 22 }
        ]
    },
];

const MitreMiniMatrix = () => {
    const [tactics, setTactics] = useState<TacticItem[]>(DEFAULT_TACTICS);
    const [selectedTacticId, setSelectedTacticId] = useState<string>('TA0001');

    useEffect(() => {
        fetch(`${API_BASE}/api/mitre/heatmap`)
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

                    if (mapped.length > 0) {
                        setTactics(mapped);
                        // Default to highest-hit tactic
                        const topTactic = [...mapped].sort((a, b) => b.hitCount - a.hitCount)[0];
                        if (topTactic) {
                            setSelectedTacticId(prev => (mapped.some(m => m.id === prev) ? prev : topTactic.id));
                        }
                    }
                }
            })
            .catch(() => {});
    }, []);

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
                            Real-time technique extraction mapped across incoming adversary telemetry
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
                                    {t.hitCount.toLocaleString()} hits
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
                                Phase Total: <strong className="text-slate-900 font-semibold">{selectedTactic.hitCount.toLocaleString()}</strong> hits
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
                                                    {tech.hitCount.toLocaleString()} hits
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
                    <button
                        type="button"
                        onClick={() => setSelectedTacticId('TA0001')}
                        className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                        Initial Access (2,544)
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTacticId('TA0040')}
                        className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                        Impact (593)
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedTacticId('TA0011')}
                        className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                        C2 (223)
                    </button>
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
