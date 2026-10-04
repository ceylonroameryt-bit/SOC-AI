import { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink, ArrowUpRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface CveItem {
    id: string;
    description: string;
    cvss: number;
    epss: number;
    vendor: string;
    isKEV: boolean;
    dateAdded: string;
}

const FEATURED_CVES: CveItem[] = [
    {
        id: 'CVE-2024-3400',
        description: 'Palo Alto PAN-OS Command Injection in GlobalProtect',
        cvss: 10.0,
        epss: 0.943,
        vendor: 'Palo Alto',
        isKEV: true,
        dateAdded: 'Active Zero-Day',
    },
    {
        id: 'CVE-2023-46805',
        description: 'Ivanti Connect Secure Authentication Bypass',
        cvss: 8.2,
        epss: 0.884,
        vendor: 'Ivanti',
        isKEV: true,
        dateAdded: 'Exploited in Wild',
    },
    {
        id: 'CVE-2024-21887',
        description: 'Ivanti Policy Secure Remote Command Execution',
        cvss: 9.1,
        epss: 0.912,
        vendor: 'Ivanti',
        isKEV: true,
        dateAdded: 'Ransomware Chained',
    },
    {
        id: 'CVE-2023-38831',
        description: 'WinRAR Remote Code Execution via ZIP Spoofing',
        cvss: 7.8,
        epss: 0.765,
        vendor: 'RARLAB',
        isKEV: true,
        dateAdded: 'Phishing Weaponized',
    },
    {
        id: 'CVE-2021-44228',
        description: 'Apache Log4j Log4Shell Remote Code Execution',
        cvss: 10.0,
        epss: 0.975,
        vendor: 'Apache',
        isKEV: true,
        dateAdded: 'Active Perimeter Scans',
    },
];

interface KevCatalogInfo {
    count?: number;
    lastUpdated?: string;
    cacheRefreshed?: string;
    status?: string;
}

const CveTrackerWidget = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [cves, setCves] = useState<CveItem[]>(FEATURED_CVES);
    const [kevInfo, setKevInfo] = useState<KevCatalogInfo>({
        count: 1180,
        lastUpdated: 'Recently',
        cacheRefreshed: 'Synced',
        status: 'Fresh'
    });

    useEffect(() => {
        fetch(`${API_BASE}/api/dashboard/snapshot`)
            .then(res => (res.ok ? res.json() : null))
            .then(snapshot => {
                if (snapshot?.kev) {
                    if (Array.isArray(snapshot.kev.featured) && snapshot.kev.featured.length > 0) {
                        setCves(snapshot.kev.featured);
                    }
                    if (snapshot.kev.catalogInfo) {
                        setKevInfo(snapshot.kev.catalogInfo);
                    } else if (snapshot.kev.total) {
                        setKevInfo(prev => ({ ...prev, count: snapshot.kev.total }));
                    }
                }
            })
            .catch(() => {});
    }, []);

    const formatTimestamp = (raw?: string) => {
        if (!raw || raw === 'Recently') return 'Catalog active';
        try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return raw;
            return `Updated ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        } catch {
            return raw;
        }
    };

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
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-display text-sm font-bold text-slate-900 leading-tight">
                                CISA KEV Catalog
                            </h3>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                {kevInfo.status || 'Fresh'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                            {kevInfo.count ? `${kevInfo.count.toLocaleString()} Cataloged Exploits` : 'Actively exploited vulnerabilities under radar'} · {formatTimestamp(kevInfo.lastUpdated)}
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
                {filteredCves.map((cve) => {
                    const hasCvss = typeof cve.cvss === 'number' && cve.cvss > 0;
                    const hasEpss = typeof cve.epss === 'number' && cve.epss > 0;

                    return (
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
                                    {hasCvss ? (
                                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                            CVSS {cve.cvss}
                                        </span>
                                    ) : (
                                        <span className="font-mono text-slate-400 text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                                            CVSS not available
                                        </span>
                                    )}
                                    {hasEpss ? (
                                        <span className="font-mono text-slate-500 text-[10px]" title="Exploit Prediction Scoring System">
                                            EPSS {(cve.epss * 100).toFixed(0)}%
                                        </span>
                                    ) : (
                                        <span className="font-mono text-slate-400 text-[10px]">
                                            EPSS not available
                                        </span>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-slate-700 font-medium line-clamp-1">
                                {cve.description}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                <span>Vendor: <strong className="text-slate-700 font-semibold">{cve.vendor}</strong></span>
                                <div className="flex items-center gap-2">
                                    <span className="text-red-600 font-medium">{cve.dateAdded}</span>
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
                    );
                })}
            </div>
        </div>
    );
};

export default CveTrackerWidget;
