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
        <div className="flex items-center justify-center p-20 text-slate-500 animate-pulse bg-white h-full">
            <ShieldAlert className="w-6 h-6 mr-3 text-blue-700 opacity-70" />
            <span className="font-medium text-slate-700">Initializing Secure Intelligence Feed...</span>
        </div>
    );

    if (error) return (
        <div className="p-10 text-center border border-red-200 bg-red-50/50 rounded-2xl m-6">
            <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold font-display text-red-900 mb-2">Connection Error</h3>
            <p className="text-slate-600">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-5 py-2.5 btn-accent text-sm"
            >
                Retry Connection
            </button>
        </div>
    );

    if (threats.length === 0) return (
        <div className="p-12 text-center border border-slate-200 rounded-2xl bg-white m-6">
            <Globe className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold font-display text-slate-800">No Active Threats Detected</h3>
            <p className="text-slate-500 mt-2">Global threat landscape appears stable.</p>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto px-6 py-6 custom-scrollbar bg-white">
            <div className="space-y-6 pb-12 max-w-7xl mx-auto">
                {/* Header Strip */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="section-label">Active Surveillance</span>
                            <span className="availability-chip">
                                <span className="chip-dot"></span>
                                Live Feed Connected
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center tracking-tight gap-3">
                            <ShieldAlert className="w-8 h-8 text-red-600" />
                            Active Threat Intelligence
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm">
                            Daily SITREP for {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <a
                            href={`${API_BASE}/api/reports/export/threats`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-3.5 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 text-blue-700" /> Export Threats
                        </a>
                        <a
                            href={`${API_BASE}/api/reports/export/news`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-accent px-3.5 py-2 text-xs font-semibold flex items-center gap-2"
                        >
                            <Globe className="w-3.5 h-3.5" /> Export News
                        </a>
                    </div>
                </div>

                {/* Editorial Stats Strip */}
                <div className="stats-strip">
                    <div className="stats-strip-inner">
                        <div className="strip-stat">
                            <div className="strip-num">{threats.length}<span className="strip-sup">ACT</span></div>
                            <div className="strip-label">Active Threats</div>
                            <div className="strip-sub">Monitored in current cycle</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-red-600">
                                {threats.filter(t => t.severity === 'Critical').length}
                                <span className="strip-sup text-red-600">CRIT</span>
                            </div>
                            <div className="strip-label">Critical Tier</div>
                            <div className="strip-sub">Immediate response required</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-orange-600">
                                {threats.filter(t => t.severity === 'High').length}
                                <span className="strip-sup text-orange-600">HIGH</span>
                            </div>
                            <div className="strip-label">High Priority</div>
                            <div className="strip-sub">Targeted enterprise vectors</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-emerald-600">
                                99.9<span className="strip-sup text-emerald-600">%</span>
                            </div>
                            <div className="strip-label">Feed Integrity</div>
                            <div className="strip-sub">Real-time normalization</div>
                        </div>
                    </div>
                </div>

                {/* Threat Cards Grid */}
                <div className="grid gap-6">
                    {threats.map((threat) => (
                        <div
                            key={threat.id}
                            className="metric-card relative overflow-hidden"
                        >
                            {/* Top Status and Metadata */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                                        {threat.id}
                                    </span>
                                    <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                        threat.type === 'Dark Web Leak'
                                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                        {threat.source || 'Intelligence Feed'}
                                    </span>
                                </div>

                                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                                    threat.severity === 'Critical'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : threat.severity === 'High'
                                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                                            : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                                }`}>
                                    {threat.severity}
                                </span>
                            </div>

                            {/* Threat Description */}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold font-display text-slate-900 mb-2">
                                    {threat.type}
                                </h3>
                                <p className="text-slate-700 text-base leading-relaxed border-l-3 border-[#1E3A8A] pl-4 bg-slate-50/70 py-2 rounded-r-lg">
                                    {threat.description}
                                </p>
                                <div className="text-xs text-slate-400 mt-3 font-mono">
                                    Detected: {new Date(threat.timestamp).toLocaleString()}
                                </div>
                            </div>

                            {/* IOC Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t border-[#E2E8F0] bg-slate-50/50 p-4 rounded-xl border">
                                {threat.ioc?.ip_addresses && threat.ioc.ip_addresses.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            <Globe className="w-4 h-4 mr-1.5 text-blue-700" /> Malicious IPs
                                        </div>
                                        <ul className="text-xs font-mono space-y-1.5">
                                            {threat.ioc.ip_addresses.map(ip => (
                                                <li key={ip} className="bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-800 w-fit">
                                                    {ip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {threat.ioc?.domains && threat.ioc.domains.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            <Globe className="w-4 h-4 mr-1.5 text-purple-700" /> C2 Domains
                                        </div>
                                        <ul className="text-xs font-mono space-y-1.5">
                                            {threat.ioc.domains.map(d => (
                                                <li key={d} className="bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-800 w-fit break-all">
                                                    {d}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {(threat.ioc?.md5 || threat.ioc?.sha256) && (
                                    <div className="space-y-2 col-span-1 lg:col-span-1">
                                        <div className="flex items-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            <Hash className="w-4 h-4 mr-1.5 text-emerald-700" /> File Hashes
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            {threat.ioc?.md5 && (
                                                <div>
                                                    <span className="text-[10px] text-slate-500 font-bold block">MD5</span>
                                                    <span className="text-xs text-slate-800 font-mono break-all bg-white px-2 py-1 rounded border border-slate-200 block">
                                                        {threat.ioc.md5}
                                                    </span>
                                                </div>
                                            )}
                                            {threat.ioc?.sha256 && (
                                                <div>
                                                    <span className="text-[10px] text-slate-500 font-bold block">SHA256</span>
                                                    <span className="text-xs text-slate-800 font-mono break-all bg-white px-2 py-1 rounded border border-slate-200 block">
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
