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
        <div className="flex items-center justify-center p-20 text-slate-500 animate-pulse">
            <ShieldAlert className="w-6 h-6 mr-3 opacity-50" />
            Initializing Secure Feed Connection...
        </div>
    );

    if (error) return (
        <div className="p-10 text-center border border-red-900/30 bg-red-950/10 rounded-xl">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-400 mb-2">Connection Error</h3>
            <p className="text-slate-400">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
                Retry Connection
            </button>
        </div>
    );

    if (threats.length === 0) return (
        <div className="p-10 text-center border border-slate-800 rounded-xl">
            <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No Active Threats Detected</h3>
            <p className="text-slate-500 mt-2">Global threat landscape appears stable.</p>
        </div>
    );

    return (
        <div className="h-full overflow-y-auto pr-4 -mr-4 custom-scrollbar">
            <div className="space-y-8 pb-10">
                <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-50 flex items-center tracking-tight">
                            <ShieldAlert className="w-10 h-10 text-red-500 mr-4" />
                            Active Threat Intelligence
                        </h2>
                        <p className="text-slate-400 mt-2 text-lg ml-14">
                            Daily SITREP for {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-4xl font-black text-slate-700">{threats.length}</div>
                        <div className="text-sm text-slate-500 uppercase tracking-widest font-bold">Active Threats</div>
                        <div className="flex gap-2 mt-2">
                            <a href={`${API_BASE}/api/reports/export/threats`} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors flex items-center gap-2">
                                <ShieldAlert className="w-3 h-3" /> Export Threats
                            </a>
                            <a href={`${API_BASE}/api/reports/export/news`} target="_blank" rel="noopener noreferrer"
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors flex items-center gap-2">
                                <Globe className="w-3 h-3" /> Export News
                            </a>
                        </div>
                    </div>
                </div>

                <div className="grid gap-8">
                    {threats.map((threat) => (
                        <div key={threat.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 relative overflow-hidden shadow-xl hover:border-slate-700 transition-colors group">

                            {/* Status Badge */}
                            <div className="absolute top-0 right-0 p-6">
                                <span className={`px-4 py-1.5 rounded-lg text-sm font-bold tracking-wide uppercase shadow-lg ${threat.severity === 'Critical' ? 'bg-red-500 text-white animate-pulse' :
                                    threat.severity === 'High' ? 'bg-orange-500 text-white' :
                                        'bg-yellow-500 text-slate-900'
                                    }`}>
                                    {threat.severity}
                                </span>
                            </div>

                            <div className="mb-6 pr-24">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="font-mono text-cyan-500 text-sm font-bold bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900/50">
                                        {threat.id}
                                    </span>
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${threat.type === 'Dark Web Leak' ? 'bg-purple-900/30 text-purple-400 border-purple-800' : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                        {threat.source || 'Intelligence Feed'}
                                    </span>
                                </div>

                                <h3 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-cyan-400 transition-colors">
                                    {threat.type}
                                </h3>
                                <p className="text-slate-300 text-lg leading-relaxed max-w-4xl border-l-4 border-slate-700 pl-4">
                                    {threat.description}
                                </p>
                                <div className="text-sm text-slate-500 mt-4 font-mono">
                                    Detected: {new Date(threat.timestamp).toLocaleString()}
                                </div>
                            </div>

                            {/* IOC Grid - Larger and clearer */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 bg-slate-950/80 p-6 rounded-xl border border-slate-800/80">
                                {threat.ioc?.ip_addresses && (
                                    <div className="space-y-3">
                                        <div className="flex items-center text-cyan-400 text-base font-bold uppercase tracking-wider">
                                            <Globe className="w-5 h-5 mr-2" /> Malicious IPs
                                        </div>
                                        <ul className="text-base text-slate-300 font-mono space-y-2">
                                            {threat.ioc.ip_addresses.map(ip => <li key={ip} className="bg-slate-900/50 px-2 py-1 rounded w-fit">{ip}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {threat.ioc?.domains && (
                                    <div className="space-y-3">
                                        <div className="flex items-center text-purple-400 text-base font-bold uppercase tracking-wider">
                                            <Globe className="w-5 h-5 mr-2" /> C2 Domains
                                        </div>
                                        <ul className="text-base text-slate-300 font-mono space-y-2">
                                            {threat.ioc.domains.map(d => <li key={d} className="bg-slate-900/50 px-2 py-1 rounded w-fit">{d}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {(threat.ioc?.md5 || threat.ioc?.sha256) && (
                                    <div className="space-y-3 col-span-1 lg:col-span-1">
                                        <div className="flex items-center text-emerald-400 text-base font-bold uppercase tracking-wider">
                                            <Hash className="w-5 h-5 mr-2" /> Indicators
                                        </div>
                                        <div className="space-y-3">
                                            {threat.ioc?.md5 && (
                                                <div>
                                                    <span className="text-xs text-slate-500 block font-bold mb-1">MD5 HASH</span>
                                                    <span className="text-sm text-slate-300 font-mono break-all bg-slate-900/50 px-2 py-1 rounded block">{threat.ioc.md5}</span>
                                                </div>
                                            )}
                                            {threat.ioc?.sha256 && (
                                                <div>
                                                    <span className="text-xs text-slate-500 block font-bold mb-1">SHA256 HASH</span>
                                                    <span className="text-sm text-slate-300 font-mono break-all bg-slate-900/50 px-2 py-1 rounded block">{threat.ioc.sha256}</span>
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
