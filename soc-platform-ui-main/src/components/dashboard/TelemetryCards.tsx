import { useEffect, useState, useCallback } from 'react';
import { Radio, AlertTriangle, ShieldCheck, Activity, Target, RefreshCw } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface TelemetryData {
    totalIntel: number | null;
    criticalCount: number | null;
    highCount: number | null;
    activeTechniques: number | null;
    kevCount: number | null;
    sourcesRegistered: number | null;
    sourcesConfigured: number | null;
    sourcesHealthy: number | null;
    sourcesDegraded: number | null;
    sourcesFailed: number | null;
    sourcesUnknown: number | null;
    pipelineStatus: 'LIVE' | 'DEGRADED' | 'STALE' | 'NO_DATA' | 'COLLECTION_FAILURE' | string;
    pipelineLabel: string;
    pipelineColor: string;
    isStale: boolean;
    lastCollectionAt?: string | null;
}

interface TelemetryCardsProps {
    timeRange?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const TelemetryCards = ({ timeRange = '24h', onRefresh, isRefreshing }: TelemetryCardsProps) => {
    const [stats, setStats] = useState<TelemetryData>({
        totalIntel: null,
        criticalCount: null,
        highCount: null,
        activeTechniques: null,
        kevCount: null,
        sourcesRegistered: null,
        sourcesConfigured: null,
        sourcesHealthy: null,
        sourcesDegraded: null,
        sourcesFailed: null,
        sourcesUnknown: null,
        pipelineStatus: 'NO_DATA',
        pipelineLabel: 'Checking Telemetry...',
        pipelineColor: 'slate',
        isStale: false,
    });
    const [lastUpdated, setLastUpdated] = useState<string>('Syncing...');
    const [hasError, setHasError] = useState<boolean>(false);

    const fetchStats = useCallback(() => {
        const queryParam = timeRange ? `?time=${encodeURIComponent(timeRange)}` : '';
        fetch(`${API_BASE}/api/dashboard/snapshot${queryParam}`)
            .then(res => {
                if (!res.ok) throw new Error(`Snapshot failed: ${res.status}`);
                return res.json();
            })
            .then(snapshot => {
                const pipe = snapshot.pipeline || {};
                setStats({
                    totalIntel: snapshot.news?.total24h ?? null,
                    criticalCount: snapshot.news?.critical ?? null,
                    highCount: snapshot.news?.high ?? null,
                    activeTechniques: snapshot.mitre?.activeTechniques ?? null,
                    kevCount: snapshot.kev?.total ?? null,
                    sourcesRegistered: snapshot.sources?.registered ?? null,
                    sourcesConfigured: snapshot.sources?.enabled ?? snapshot.sources?.configured ?? null,
                    sourcesHealthy: snapshot.sources?.healthy ?? 0,
                    sourcesDegraded: snapshot.sources?.degraded ?? 0,
                    sourcesFailed: snapshot.sources?.failed ?? 0,
                    sourcesUnknown: snapshot.sources?.unknown ?? 0,
                    pipelineStatus: pipe.status || (snapshot.news?.total24h > 0 ? 'LIVE' : 'NO_DATA'),
                    pipelineLabel: pipe.label || (snapshot.news?.total24h > 0 ? 'Live Telemetry Active' : 'No Intel Collected'),
                    pipelineColor: pipe.color || 'slate',
                    isStale: Boolean(snapshot.isStale),
                    lastCollectionAt: pipe.lastRunAt || null
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
    }, [timeRange]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const formatValue = (val: number | null, fallbackLabel = 'Unavailable') => {
        if (val === null || val === undefined) return fallbackLabel;
        return val.toLocaleString();
    };

    const timeWindowLabel = timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'All Time';

    const cards = [
        {
            title: 'Critical Threat Radar',
            value: formatValue(stats.criticalCount),
            sub: stats.highCount !== null ? `${stats.highCount} High Priority Alerts` : 'Telemetry pending',
            icon: AlertTriangle,
            tag: `${timeWindowLabel}`,
            color: 'from-amber-500/15 to-transparent',
            border: 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.10)]',
            badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
            accent: 'text-amber-400',
            ping: (stats.criticalCount ?? 0) > 0,
        },
        {
            title: 'Total Ingested Intel',
            value: formatValue(stats.totalIntel),
            sub: stats.sourcesConfigured !== null ? `Across ${stats.sourcesConfigured} Enabled Feeds` : 'Verifying sources...',
            icon: Activity,
            tag: stats.isStale ? 'Stale Snapshot' : `${timeWindowLabel}`,
            color: 'from-amber-600/10 to-transparent',
            border: 'border-white/10',
            badgeBg: 'bg-white/5 text-amber-300 border-white/10',
            accent: 'text-amber-400',
            ping: false,
        },
        {
            title: 'ATT&CK Techniques',
            value: formatValue(stats.activeTechniques),
            sub: 'Unique Tactics Correlated',
            icon: Target,
            tag: 'v16 ATT&CK Framework',
            color: 'from-white/5 to-transparent',
            border: 'border-white/10',
            badgeBg: 'bg-white/5 text-slate-300 border-white/10',
            accent: 'text-amber-300',
            ping: false,
        },
        {
            title: 'CISA KEV Database',
            value: formatValue(stats.kevCount),
            sub: 'Known Exploited Vulnerabilities',
            icon: ShieldCheck,
            tag: 'CISA Catalog Verified',
            color: 'from-amber-500/10 to-transparent',
            border: 'border-white/10',
            badgeBg: 'bg-white/5 text-amber-300 border-white/10',
            accent: 'text-amber-400',
            ping: false,
        },
        {
            title: 'Ingestion Pipeline',
            value: stats.sourcesHealthy !== null ? `${stats.sourcesHealthy} Healthy` : 'Unavailable',
            sub: `${stats.sourcesDegraded ?? 0} Degraded · ${stats.sourcesFailed ?? 0} Failed`,
            icon: Radio,
            tag: `${stats.sourcesConfigured ?? 0} Enabled (${stats.sourcesRegistered ?? 0} Reg)`,
            color: 'from-white/5 to-transparent',
            border: 'border-white/10',
            badgeBg: 'bg-white/5 text-slate-300 border-white/10',
            accent: 'text-amber-400',
            ping: false,
        },
    ];

    return (
        <div className="space-y-2.5">
            {/* Telemetry Stale or Error Alert */}
            {(hasError || stats.isStale) && (
                <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/60 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>
                            {hasError
                                ? "Unable to retrieve current telemetry. Showing data from the last successful snapshot."
                                : "Telemetry snapshot is currently cached or stale. Background refresh queued."}
                        </span>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors"
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
                        <span className="font-semibold text-amber-400">
                            {stats.pipelineLabel}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span>Synced: {lastUpdated}</span>
                    <button
                        onClick={() => {
                            fetchStats();
                            onRefresh?.();
                        }}
                        disabled={isRefreshing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0C0E14] hover:bg-[#12151E] border border-white/10 hover:border-amber-500/40 text-white font-sans font-medium transition-all text-xs"
                        title="Reload dashboard telemetry"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                        <span>Reload</span>
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
                            className={`p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between bg-[#0C0E14] bg-gradient-to-br ${card.color} border ${card.border} relative overflow-hidden shadow-xl`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider line-clamp-1 font-sans">
                                    {card.title}
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {card.ping && (
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                        </span>
                                    )}
                                    <div className={`p-1.5 rounded-lg bg-black/40 border border-white/10 shadow-2xs ${card.accent}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            <div className="my-1">
                                <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                                    {card.value}
                                </div>
                                <div className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-0.5">
                                    {card.sub}
                                </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
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
