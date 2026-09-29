import { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink, ArrowUpRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface CveItem {
    id: string;
    description: string;
    cvss: number | null;
    epss: number | null;
    vendor: string;
    isKEV: boolean;
    dateAdded: string;
}

const CveTrackerWidget = () => {
    const [catalogStatus, setCatalogStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [cves, setCves] = useState<CveItem[]>([]);

    useEffect(() => {
        fetch(`${API_BASE}/api/dashboard/snapshot`)
            .then(res => (res.ok ? res.json() : null))
            .then(snapshot => {
                if (snapshot?.kev?.featured && Array.isArray(snapshot.kev.featured)) {
                    setCves(snapshot.kev.featured);
                    setCatalogStatus(`${snapshot.kev.status || 'unknown'} · updated ${snapshot.kev.lastUpdated || 'unknown'}`);
                }
            })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    const filteredCves = cves.filter(
        cve =>
            cve.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cve.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cve.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="glass-card p-4 sm:p-5 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200">
                        <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="font-display text-sm font-bold text-slate-900 leading-tight">
                            CISA KEV Catalog
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            {catalogStatus || 'Known exploited vulnerabilities from CISA'}
                        </p>
                    </div>
                </div>
                <Link
                    to="/enrich"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 flex-shrink-0"
                >
                    <span>Enrich IOCs</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* Quick Search */}
            <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                    type="text"
                    placeholder="Filter CVEs, vendors, or exploits..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all font-sans"
                />
            </div>

            {/* High Density CVE List */}
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1 max-h-[320px]">
                {cves.length === 0 && <p role="status" className="text-xs text-slate-600 p-3">{loading ? 'Loading catalog…' : 'Verified catalog data is unavailable. No estimated scores are shown.'}</p>}
                {filteredCves.map((cve) => (
                    <div
                        key={cve.id}
                        className="p-2.5 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:bg-slate-50/70 transition-all flex flex-col gap-1.5"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <span className="ioc-code font-bold text-red-600 bg-red-50 border-red-200">
                                    {cve.id}
                                </span>
                                {cve.isKEV && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                                        CISA KEV
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                    CVSS {cve.cvss ?? 'N/A'}
                                </span>
                                <span className="font-mono text-slate-500 text-[10px]" title="Exploit Prediction Scoring System">
                                    EPSS {cve.epss === null ? 'N/A' : `${(cve.epss * 100).toFixed(0)}%`}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-700 font-medium line-clamp-1">
                            {cve.description}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Vendor: <strong className="text-slate-700 font-semibold">{cve.vendor}</strong></span>
                            <div className="flex items-center gap-2">
                                <span className="text-red-600 font-medium">Added {cve.dateAdded}</span>
                                <Link
                                    to={`/enrich?ioc=${cve.id}`}
                                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                                    title="Open IOC query"
                                >
                                    <span>Query</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CveTrackerWidget;
