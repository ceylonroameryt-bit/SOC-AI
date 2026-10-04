import { useEffect, useState, useCallback } from 'react';
import { Radio, AlertTriangle, ShieldCheck, Activity, Target, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface TelemetryData {
    totalIntel: number | null;
    criticalCount: number | null;
    highCount: number | null;
    activeTechniques: number | null;
    kevCount: number | null;
    sourcesConfigured: number | null;
    sourcesHealthy: number | null;
    sourcesDegraded: number | null;
    isStale: boolean;
}

interface TelemetryCardsProps {
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const TelemetryCards = ({ onRefresh, isRefreshing }: TelemetryCardsProps) => {
    const [stats, setStats] = useState<TelemetryData>({
        totalIntel: null,
        criticalCount: null,
        highCount: null,
        activeTechniques: null,
        kevCount: null,
        sourcesConfigured: null,
        sourcesHealthy: null,
        sourcesDegraded: null,
        isStale: false,
    });
    const [lastUpdated, setLastUpdated] = useState<string>('Syncing...');
    const [hasError, setHasError] = useState<boolean>(false);

    const fetchStats = useCallback(() => {
        fetch(`${API_BASE}/api/dashboard/snapshot`)
            .then(res => {
                if (!res.ok) throw new Error(`Snapshot failed: ${res.status}`);
                return res.json();
            })
            .then(snapshot => {
                setStats({
                    totalIntel: snapshot.news?.total24h ?? null,
                    criticalCount: snapshot.news?.critical ?? null,
                    highCount: snapshot.news?.high ?? null,
                    activeTechniques: snapshot.mitre?.activeTechniques ?? null,
                    kevCount: snapshot.kev?.total ?? null,
                    sourcesConfigured: snapshot.sources?.configured ?? null,
                    sourcesHealthy: snapshot.sources?.healthy ?? null,
                    sourcesDegraded: snapshot.sources?.degraded ?? null,
                    isStale: Boolean(snapshot.isStale),
                });
                setHasError(false);
                const syncTime = snapshot.generatedAt 
                    ? new Date(snapshot.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setLastUpdated(syncTime);
            })
            .catch(err => {
                console.warn('Dashboard snapshot telemetry unavailable:', err);
                setHasError(true);
            });
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatValue = (val: number | null, fallbackLabel = 'Unavailable') => {
        if (val === null || val === undefined) return fallbackLabel;
        return val.toLocaleString();
    };

    const cards = [
        {
            title: 'Critical Threat Radar',
            value: formatValue(stats.criticalCount),
            sub: stats.highCount !== null ? `${stats.highCount} High Priority Alerts` : 'Telemetry pending',
            icon: AlertTriangle,
            tag: 'SLA Response < 15m',
            color: 'from-rose-500/10 to-red-500/5',
            border: 'border-red-200/80',
            badgeBg: 'bg-red-50 text-red-700 border-red-200',
            accent: 'text-red-600',
            ping: (stats.criticalCount ?? 0) > 0,
        },
        {
            title: 'Total Ingested Intel',
            value: formatValue(stats.totalIntel),
            sub: stats.sourcesConfigured !== null ? `Across ${stats.sourcesConfigured} Monitored Feeds` : 'Verifying sources...',
            icon: Activity,
            tag: stats.isStale ? 'Stale Snapshot' : 'Validated Telemetry',
            color: 'from-blue-500/10 to-indigo-500/5',
            border: 'border-blue-200/80',
            badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
            accent: 'text-blue-600',
            ping: false,
        },
        {
            title: 'ATT&CK Techniques',
            value: formatValue(stats.activeTechniques),
            sub: 'Active Tactics Correlated',
            icon: Target,
            tag: 'v16 ATT&CK Framework',
            color: 'from-purple-500/10 to-violet-500/5',
            border: 'border-purple-200/80',
            badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
            accent: 'text-purple-600',
            ping: false,
        },
        {
            title: 'CISA KEV Database',
            value: formatValue(stats.kevCount),
            sub: 'Known Exploited Vulnerabilities',
            icon: ShieldCheck,
            tag: 'CISA Catalog Verified',
            color: 'from-emerald-500/10 to-teal-500/5',
            border: 'border-emerald-200/80',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            accent: 'text-emerald-600',
            ping: false,
        },
        {
            title: 'Ingestion Pipeline',
            value: stats.sourcesConfigured !== null ? `${stats.sourcesHealthy ?? 0}/${stats.sourcesConfigured}` : 'Unavailable',
            sub: stats.sourcesDegraded ? `${stats.sourcesDegraded} degraded feeds` : 'Measured source health',
            icon: Radio,
            tag: stats.sourcesHealthy && stats.sourcesConfigured && stats.sourcesHealthy === stats.sourcesConfigured 
                ? 'Healthy' 
                : (stats.sourcesHealthy ?? 0) > 0 ? 'Measured Collection' : 'Offline',
            color: 'from-amber-500/10 to-yellow-500/5',
            border: 'border-amber-200/80',
            badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
            accent: 'text-amber-600',
            ping: false,
        },
    ];

    return (
        <div className="space-y-2.5">
            {/* Telemetry Stale or Error Alert */}
            {(hasError || stats.isStale) && (
                <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                            {hasError
                                ? "Unable to retrieve current telemetry. Showing data from the last successful snapshot."
                                : "Telemetry snapshot is currently cached or stale. Background refresh queued."}
                        </span>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Top Bar with Live Telemetry Ticker & Fast Sync */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                    <span className="section-label">SOC Telemetry</span>
                    <div className="availability-chip text-[11px] py-0.5 px-2.5">
                        <span className="chip-dot"></span>
                        <span className="font-semibold text-emerald-800">
                            {stats.isStale ? "Cached Snapshot Active" : "Live Telemetry Active"}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                    <span>Synced: {lastUpdated}</span>
                    <button
                        onClick={() => {
                            fetchStats();
                            onRefresh?.();
                        }}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-medium transition-all text-xs"
                        title="Force refresh all telemetry"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* 5-Column High Density Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={idx}
                            className={`glass-card p-3.5 sm:p-4 flex flex-col justify-between bg-gradient-to-br ${card.color} ${card.border} relative overflow-hidden`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider line-clamp-1 font-sans">
                                    {card.title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {card.ping && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                    )}
                                    <div className={`p-1.5 rounded-lg bg-white/80 border border-slate-200/60 shadow-2xs ${card.accent}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="my-1">
                                <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                                    {card.value}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                                    {card.sub}
                                </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-md border ${card.badgeBg}`}>
                                    {card.tag}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TelemetryCards;
