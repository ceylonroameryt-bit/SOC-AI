import { useEffect, useState } from 'react';
import { ShieldAlert, Globe, Hash } from 'lucide-react';
import { API_BASE } from '../config/api';

interface Threat {
    id: string;
    type: string;
    severity: string;
    source: string;
    description: string;
    ioc: {
        md5?: string;
        sha1?: string;
        sha256?: string;
        ip_addresses?: string[];
        domains?: string[];
    };
    timestamp: string;
}

const Threats = () => {
    const [threats, setThreats] = useState<Threat[]>([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/threats`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch threat intelligence');
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setThreats(data);
                } else {
                    console.error('Invalid threat data format:', data);
                    setError('Received invalid data from threat feed');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching threats:', err);
                setError('Unable to connect to Threat Intelligence Network');
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center p-20 text-slate-500 animate-pulse bg-[#090D16] h-full">
            <ShieldAlert className="w-6 h-6 mr-3 text-emerald-400 opacity-70" />
            <span className="font-medium text-slate-300">Initializing Calm Resilience Intelligence Feed...</span>
        </div>
    );

    if (error) return (
        <div className="p-10 text-center border border-amber-500/30 bg-[#0D1527] rounded-2xl m-6">
            <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold font-display text-white mb-2">Connection Notice</h3>
            <p className="text-slate-400">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-all"
            >
                Retry Connection
            </button>
        </div>
    );

    if (threats.length === 0) return (
        <div className="p-12 text-center border border-emerald-500/15 rounded-2xl bg-[#0D1527] m-6">
            <Globe className="w-12 h-12 text-emerald-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-display text-white">No Active Threats Detected</h3>
            <p className="text-slate-400 mt-2">Global threat landscape appears stable.</p>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto px-6 py-6 custom-scrollbar bg-[#090D16]">
            <div className="space-y-6 pb-12 max-w-7xl mx-auto">
                {/* Header Strip */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-emerald-500/10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="section-label">Active Surveillance</span>
                            <span className="availability-chip">
                                <span className="chip-dot"></span>
                                Live Feed Connected
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold font-display text-white flex items-center tracking-tight gap-3">
                            <ShieldAlert className="w-8 h-8 text-emerald-400" />
                            Active Threat Intelligence
                        </h1>
                        <p className="text-slate-400 mt-1 text-sm">
                            Daily SITREP for {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <a
                            href={`${API_BASE}/api/reports/export/threats`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#0D1527] hover:bg-white/5 border border-emerald-500/20 text-white px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> Export Threats
                        </a>
                        <a
                            href={`${API_BASE}/api/reports/export/news`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs"
                        >
                            <Globe className="w-3.5 h-3.5" /> Export News
                        </a>
                    </div>
                </div>

                {/* Editorial Stats Strip */}
                <div className="bg-[#0D1527] border border-emerald-500/15 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex flex-col">
                            <div className="text-2xl font-bold font-display text-white">{threats.length}<span className="text-emerald-400 text-sm ml-1">ACT</span></div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Active Threats</div>
                            <div className="text-[11px] text-slate-500">Monitored in current cycle</div>
                        </div>
                        <div className="w-[1px] h-9 bg-emerald-500/10 hidden md:block" />
                        <div className="flex flex-col">
                            <div className="text-2xl font-bold font-display text-amber-400">
                                {threats.filter(t => t.severity === 'Critical').length}
                                <span className="text-amber-400/80 text-sm ml-1">CRIT</span>
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Guarded Queue</div>
                            <div className="text-[11px] text-slate-500">Mitigated priority tier</div>
                        </div>
                        <div className="w-[1px] h-9 bg-emerald-500/10 hidden md:block" />
                        <div className="flex flex-col">
                            <div className="text-2xl font-bold font-display text-sky-400">
                                {threats.filter(t => t.severity === 'High').length}
                                <span className="text-sky-400/80 text-sm ml-1">HIGH</span>
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">High Priority</div>
                            <div className="text-[11px] text-slate-500">Targeted enterprise vectors</div>
                        </div>
                        <div className="w-[1px] h-9 bg-emerald-500/10 hidden md:block" />
                        <div className="flex flex-col">
                            <div className="text-2xl font-bold font-display text-emerald-400">
                                99.9<span className="text-emerald-400 text-sm ml-1">%</span>
                            </div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">Feed Integrity</div>
                            <div className="text-[11px] text-slate-500">Real-time normalization</div>
                        </div>
                    </div>
                </div>

                {/* Threat Cards Grid */}
                <div className="grid gap-6">
                    {threats.map((threat) => (
                        <div
                            key={threat.id}
                            className="bg-[#0D1527] border border-emerald-500/15 rounded-2xl p-6 shadow-xs relative overflow-hidden"
                        >
                            {/* Top Status and Metadata */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-emerald-400 bg-white/5 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                        {threat.id}
                                    </span>
                                    <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border bg-white/5 text-slate-300 border-white/10">
                                        {threat.source || 'Intelligence Feed'}
                                    </span>
                                </div>

                                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                                    threat.severity === 'Critical'
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        : threat.severity === 'High'
                                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                    {threat.severity}
                                </span>
                            </div>

                            {/* Threat Description */}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold font-display text-white mb-2">
                                    {threat.type}
                                </h3>
                                <p className="text-slate-300 text-base leading-relaxed border-l-2 border-emerald-500 pl-4 bg-white/5 py-2.5 rounded-r-lg">
                                    {threat.description}
                                </p>
                                <div className="text-xs text-slate-500 mt-3 font-mono">
                                    Detected: {new Date(threat.timestamp).toLocaleString()}
                                </div>
                            </div>

                            {/* IOC Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t border-emerald-500/10 bg-[#070A12] p-4 rounded-xl border border-emerald-500/10">
                                {threat.ioc?.ip_addresses && threat.ioc.ip_addresses.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <Globe className="w-4 h-4 mr-1.5 text-emerald-400" /> Malicious IPs
                                        </div>
                                        <ul className="text-xs font-mono space-y-1.5">
                                            {threat.ioc.ip_addresses.map(ip => (
                                                <li key={ip} className="bg-[#0D1527] px-2.5 py-1 rounded border border-emerald-500/20 text-slate-300 w-fit">
                                                    {ip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {threat.ioc?.domains && threat.ioc.domains.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <Globe className="w-4 h-4 mr-1.5 text-sky-400" /> C2 Domains
                                        </div>
                                        <ul className="text-xs font-mono space-y-1.5">
                                            {threat.ioc.domains.map(d => (
                                                <li key={d} className="bg-[#0D1527] px-2.5 py-1 rounded border border-emerald-500/20 text-slate-300 w-fit break-all">
                                                    {d}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {(threat.ioc?.md5 || threat.ioc?.sha256) && (
                                    <div className="space-y-2 col-span-1 lg:col-span-1">
                                        <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            <Hash className="w-4 h-4 mr-1.5 text-teal-400" /> File Hashes
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            {threat.ioc?.md5 && (
                                                <div>
                                                    <span className="text-[10px] text-slate-500 font-bold block">MD5</span>
                                                    <span className="text-xs text-slate-300 font-mono break-all bg-[#0D1527] px-2 py-1 rounded border border-emerald-500/20 block">
                                                        {threat.ioc.md5}
                                                    </span>
                                                </div>
                                            )}
                                            {threat.ioc?.sha256 && (
                                                <div>
                                                    <span className="text-[10px] text-slate-500 font-bold block">SHA256</span>
                                                    <span className="text-xs text-slate-300 font-mono break-all bg-[#0D1527] px-2 py-1 rounded border border-emerald-500/20 block">
                                                        {threat.ioc.sha256}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Threats;
