import React, { useEffect, useState } from 'react';
import { Radio, Clock, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

export const CollectionStatusBar: React.FC = () => {
    const [statusData, setStatusData] = useState<{
        lastCollection: string | null;
        degradedCount: number;
        failedCount: number;
        healthyCount: number;
        totalConfigured: number;
        isStale: boolean;
        isDemoEnabled: boolean;
    }>({
        lastCollection: null,
        degradedCount: 0,
        failedCount: 0,
        healthyCount: 0,
        totalConfigured: 101,
        isStale: false,
        isDemoEnabled: false,
    });

    useEffect(() => {
        fetch(`${API_BASE}/api/dashboard/snapshot`)
            .then(res => (res.ok ? res.json() : null))
            .then(snapshot => {
                if (snapshot) {
                    setStatusData({
                        lastCollection: snapshot.lastSuccessfulIngestion || snapshot.generatedAt || null,
                        degradedCount: snapshot.sources?.degraded || 0,
                        failedCount: snapshot.sources?.failed || 0,
                        healthyCount: snapshot.sources?.healthy || 0,
                        totalConfigured: snapshot.sources?.configured || 101,
                        isStale: Boolean(snapshot.isStale),
                        isDemoEnabled: Boolean(snapshot.environment?.isDemoEnabled),
                    });
                }
            })
            .catch(() => {});
    }, []);

    const warningCount = statusData.degradedCount + statusData.failedCount;

    return (
        <footer
            aria-label="Collection Telemetry Status Bar"
            className="h-8 bg-[#07090E] border-t border-white/5 px-4 lg:px-6 flex items-center justify-between text-[11px] text-slate-400 font-sans flex-shrink-0 select-none z-10"
        >
            {/* Left: Last Collection & Freshness */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                    <span>
                        Last collection:{' '}
                        <strong className="text-white font-medium font-mono">
                            {statusData.lastCollection
                                ? new Date(statusData.lastCollection).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                : 'Syncing telemetry...'}
                        </strong>
                    </span>
                </div>

                {statusData.isStale && (
                    <span className="text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium text-[10px]">
                        Snapshot Cached
                    </span>
                )}
            </div>

            {/* Right: Measured Source Health & Link */}
            <div className="flex items-center gap-4">
                {statusData.isDemoEnabled && (
                    <span className="text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3 text-amber-400" />
                        <span>Simulated Data Enabled</span>
                    </span>
                )}

                <Link
                    to="/sources"
                    className="flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors group"
                    title="View detailed Feed Health metrics"
                >
                    <Radio className="w-3 h-3 text-amber-400 animate-pulse" aria-hidden="true" />
                    <span>
                        Feeds:{' '}
                        <span className="font-semibold text-white">
                            {statusData.healthyCount}/{statusData.totalConfigured} Healthy
                        </span>
                    </span>

                    {warningCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950/50 text-amber-300 border border-amber-500/40">
                            {warningCount} attention
                        </span>
                    )}
                </Link>
            </div>
        </footer>
    );
};

export default CollectionStatusBar;
