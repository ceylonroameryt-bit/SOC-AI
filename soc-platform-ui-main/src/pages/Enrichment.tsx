import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config/api';

type IOCType = 'ip' | 'hash' | 'domain' | 'cve' | 'auto';

interface EnrichmentResult {
    ip?: string;
    hash?: string;
    cveId?: string;
    virustotal?: {
        maliciousEngines: number;
        totalEngines: number;
        maliciousnessScore: number;
        country?: string;
        asnOwner?: string;
        vtLink: string;
        error?: string;
    };
    abuseipdb?: {
        abuseConfidenceScore: number;
        totalReports: number;
        isp?: string;
        countryCode?: string;
        abuseLink: string;
        error?: string;
    };
    enrichment?: {
        epssScore?: number;
        epssPercentile?: number;
        isKEV: boolean;
        nvdLink: string;
        error?: string;
    };
    queries?: {
        queries?: {
            splunk: string;
            kql: string;
            sigma: string;
        };
        splunk?: string;
        kql?: string;
        sigma?: string;
        iocType?: string;
    };
    extracted?: { ips: string[]; hashes: string[]; cves: string[]; domains: string[] };
    enriched?: { ips: unknown[]; hashes: unknown[]; cves: unknown[] };
    error?: string;
}

const ScoreBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
    <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
            />
        </div>
        <span className="text-sm font-bold text-slate-900 w-16 text-right">
            {value}{typeof max === 'number' && max === 100 ? '%' : `/${max}`}
        </span>
    </div>
);

const QueryBlock = ({ label, code }: { label: string; code: string }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                <span className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">{label}</span>
                <button
                    onClick={handleCopy}
                    className={`text-xs px-3 py-1 rounded-md transition-all font-semibold ${copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                    {copied ? '✓ Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 text-xs text-slate-800 bg-slate-50 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {code}
            </pre>
        </div>
    );
};

export default function Enrichment() {
    const [searchParams] = useSearchParams();
    const initialIoc = searchParams.get('ioc') || '';

    const [input, setInput] = useState(initialIoc);
    const [inputType, setInputType] = useState<IOCType>('auto');
    const [result, setResult] = useState<EnrichmentResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'splunk' | 'kql' | 'sigma'>('splunk');
    const [bulkText, setBulkText] = useState('');
    const [bulkResult, setBulkResult] = useState<EnrichmentResult | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [mode, setMode] = useState<'single' | 'bulk'>('single');

    const detectType = (v: string): IOCType => {
        if (/^CVE-\d{4}-\d{4,7}$/i.test(v)) return 'cve';
        if (/^[a-fA-F0-9]{32,64}$/.test(v)) return 'hash';
        if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(v)) return 'ip';
        return 'domain';
    };

    const runEnrich = useCallback(async (targetIoc: string, targetType: IOCType = 'auto') => {
        if (!targetIoc.trim()) return;
        setLoading(true);
        setResult(null);

        const ioc = targetIoc.trim();
        let url = '';

        const type = targetType !== 'auto' ? targetType : detectType(ioc);
        if (type === 'ip')     url = `${API_BASE}/api/enrich/ip/${encodeURIComponent(ioc)}`;
        else if (type === 'hash') url = `${API_BASE}/api/enrich/hash/${encodeURIComponent(ioc)}`;
        else if (type === 'cve')  url = `${API_BASE}/api/enrich/cve/${encodeURIComponent(ioc)}`;
        else                       url = `${API_BASE}/api/enrich/queries/${encodeURIComponent(ioc)}`;

        try {
            const resp = await fetch(url);
            const json = await resp.json();
            setResult(json);
        } catch {
            setResult({ error: 'Enrichment request failed. Is the server running?' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialIoc) {
            setInput(initialIoc);
            runEnrich(initialIoc, 'auto');
        }
    }, [initialIoc, runEnrich]);

    const enrich = () => runEnrich(input, inputType);

    const enrichBulk = useCallback(async () => {
        if (!bulkText.trim()) return;
        setBulkLoading(true);
        setBulkResult(null);
        try {
            const resp = await fetch(`${API_BASE}/api/enrich/iocs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: bulkText }),
            });
            setBulkResult(await resp.json());
        } catch {
            setBulkResult({ error: 'Bulk enrichment failed.' });
        } finally {
            setBulkLoading(false);
        }
    }, [bulkText]);

    const queries = result?.queries?.queries || (result?.queries?.splunk ? (result.queries as { splunk: string; kql: string; sigma: string }) : undefined);

    return (
        <div className="p-6 space-y-6 min-h-full bg-white max-w-7xl mx-auto">
            {/* Header */}
            <div className="pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="section-label">Indicator Intelligence</span>
                    <span className="availability-chip">
                        <span className="chip-dot"></span>
                        Multi-Source Cross-Check
                    </span>
                </div>
                <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                    <span>🔍</span> IOC Enrichment & SIEM Queries
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Enrich IPs, file hashes, domains, and CVEs with VirusTotal, AbuseIPDB, EPSS, and CISA KEV data.
                    Auto-generate Splunk / KQL / Sigma threat hunting queries.
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                {(['single', 'bulk'] as const).map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-5 py-2 rounded-xl font-semibold text-xs transition-all ${
                            mode === m
                                ? 'bg-[#1E3A8A] text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        {m === 'single' ? 'Single IOC Analysis' : '📄 Bulk Text Scanning'}
                    </button>
                ))}
            </div>

            {mode === 'single' ? (
                <>
                    {/* Single IOC Input */}
                    <div className="metric-card space-y-4">
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && enrich()}
                                placeholder="Enter IP, file hash (MD5/SHA256), CVE-ID, or domain..."
                                className="flex-1 bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1E3A8A] font-mono text-sm shadow-xs"
                            />
                            <select
                                value={inputType}
                                onChange={e => setInputType(e.target.value as IOCType)}
                                className="bg-white border border-[#CBD5E1] rounded-xl px-4 py-2.5 text-slate-700 focus:outline-none focus:border-[#1E3A8A] text-sm font-medium shadow-xs"
                            >
                                <option value="auto">Auto-detect</option>
                                <option value="ip">IP Address</option>
                                <option value="hash">File Hash</option>
                                <option value="cve">CVE ID</option>
                                <option value="domain">Domain</option>
                            </select>
                            <button
                                onClick={enrich}
                                disabled={loading || !input.trim()}
                                className="btn-accent px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                            >
                                {loading ? '⏳ Enriching...' : '🔍 Enrich Indicator'}
                            </button>
                        </div>

                        {/* Quick examples */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0]">
                            <span className="text-slate-400 text-xs font-medium">Try example:</span>
                            {['8.8.8.8', 'CVE-2021-44228', '5e884898da28047151d0e56f8dc62927', 'malicious.example.com'].map(ex => (
                                <button
                                    key={ex}
                                    onClick={() => { setInput(ex); setInputType('auto'); }}
                                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-900 text-slate-600 rounded-lg font-mono transition-colors border border-slate-200"
                                >
                                    {ex}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results */}
                    {result && (
                        <div className="space-y-4">
                            {result.error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm font-medium">
                                    ⚠️ {result.error}
                                </div>
                            )}

                            {/* VirusTotal Card */}
                            {result.virustotal && (
                                <div className="metric-card space-y-3">
                                    <h3 className="text-slate-900 font-bold font-display flex items-center gap-2 text-base">
                                        <span className="text-lg">🧬</span> VirusTotal Analysis
                                        {result.virustotal.error && <span className="text-xs text-amber-700 ml-2 font-medium">(API key needed)</span>}
                                    </h3>
                                    {!result.virustotal.error ? (
                                        <>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1.5">
                                                    <span className="text-slate-500 font-medium">Maliciousness Score</span>
                                                    <span className={`font-bold ${result.virustotal.maliciousEngines > 5 ? 'text-red-600' : result.virustotal.maliciousEngines > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {result.virustotal.maliciousEngines}/{result.virustotal.totalEngines} engines
                                                    </span>
                                                </div>
                                                <ScoreBar
                                                    value={result.virustotal.maliciousEngines}
                                                    max={result.virustotal.totalEngines || 70}
                                                    color={result.virustotal.maliciousEngines > 10 ? 'bg-red-500' : result.virustotal.maliciousEngines > 0 ? 'bg-orange-500' : 'bg-emerald-500'}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-[#E2E8F0]">
                                                {result.virustotal.country && <div><span className="text-slate-500">Country:</span> <span className="text-slate-900 font-semibold ml-2">{result.virustotal.country}</span></div>}
                                                {result.virustotal.asnOwner && <div><span className="text-slate-500">ASN:</span> <span className="text-slate-900 font-semibold ml-2 truncate">{result.virustotal.asnOwner}</span></div>}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Add VIRUSTOTAL_API_KEY to .env to enable live lookups.</p>
                                    )}
                                    <a
                                        href={result.virustotal.vtLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[#1E3A8A] font-semibold hover:underline text-xs"
                                    >
                                        View full analysis on VirusTotal →
                                    </a>
                                </div>
                            )}

                            {/* AbuseIPDB Card */}
                            {result.abuseipdb && (
                                <div className="metric-card space-y-3">
                                    <h3 className="text-slate-900 font-bold font-display flex items-center gap-2 text-base">
                                        <span className="text-lg">🚨</span> AbuseIPDB Confidence
                                        {result.abuseipdb.error && <span className="text-xs text-amber-700 ml-2 font-medium">(API key needed)</span>}
                                    </h3>
                                    {!result.abuseipdb.error ? (
                                        <>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1.5">
                                                    <span className="text-slate-500 font-medium">Abuse Confidence</span>
                                                    <span className={`font-bold ${result.abuseipdb.abuseConfidenceScore > 50 ? 'text-red-600' : result.abuseipdb.abuseConfidenceScore > 20 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                        {result.abuseipdb.abuseConfidenceScore}%
                                                    </span>
                                                </div>
                                                <ScoreBar
                                                    value={result.abuseipdb.abuseConfidenceScore}
                                                    max={100}
                                                    color={result.abuseipdb.abuseConfidenceScore > 50 ? 'bg-red-500' : result.abuseipdb.abuseConfidenceScore > 20 ? 'bg-orange-500' : 'bg-emerald-500'}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-[#E2E8F0]">
                                                <div><span className="text-slate-500">Reports:</span> <span className="text-slate-900 font-semibold ml-2">{result.abuseipdb.totalReports}</span></div>
                                                {result.abuseipdb.isp && <div><span className="text-slate-500">ISP:</span> <span className="text-slate-900 font-semibold ml-2 truncate">{result.abuseipdb.isp}</span></div>}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-slate-500 text-sm">Add ABUSEIPDB_API_KEY to .env to enable live lookups.</p>
                                    )}
                                    <a
                                        href={result.abuseipdb.abuseLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[#1E3A8A] font-semibold hover:underline text-xs"
                                    >
                                        Check reports on AbuseIPDB →
                                    </a>
                                </div>
                            )}

                            {/* CVE / EPSS / KEV Card */}
                            {result.enrichment && (
                                <div className="metric-card space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-slate-900 font-bold font-display flex items-center gap-2 text-base">
                                            <span className="text-lg">📋</span> CVE Exploitation Metrics
                                        </h3>
                                        {result.enrichment.isKEV && (
                                            <span className="px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-200 text-xs font-bold rounded-full">
                                                🔴 CISA KEV — ACTIVELY EXPLOITED
                                            </span>
                                        )}
                                    </div>
                                    {!result.enrichment.error ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                                                <p className="text-3xl font-extrabold font-display text-orange-600">
                                                    {result.enrichment.epssScore !== null
                                                        ? `${((result.enrichment.epssScore || 0) * 100).toFixed(1)}%`
                                                        : 'N/A'}
                                                </p>
                                                <p className="text-slate-500 text-xs mt-1">EPSS Exploitation Probability</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                                                <p className="text-3xl font-extrabold font-display text-[#1E3A8A]">
                                                    {result.enrichment.epssPercentile !== null
                                                        ? `${((result.enrichment.epssPercentile || 0) * 100).toFixed(0)}th`
                                                        : 'N/A'}
                                                </p>
                                                <p className="text-slate-500 text-xs mt-1">Threat Landscape Percentile</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm">EPSS data unavailable: {result.enrichment.error}</p>
                                    )}
                                    <a
                                        href={result.enrichment.nvdLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[#1E3A8A] font-semibold hover:underline text-xs"
                                    >
                                        View vulnerability on NVD →
                                    </a>
                                </div>
                            )}

                            {/* SIEM Query Generator */}
                            {queries && (
                                <div className="metric-card space-y-3">
                                    <h3 className="text-slate-900 font-bold font-display flex items-center gap-2 text-base">
                                        <span className="text-lg">⚡</span> Threat Hunting SIEM Queries
                                    </h3>
                                    <div className="flex gap-2">
                                        {(['splunk', 'kql', 'sigma'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setActiveTab(tab)}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                                                    activeTab === tab
                                                        ? 'bg-[#1E3A8A] text-white shadow-xs'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {tab === 'kql' ? 'Microsoft Sentinel KQL' : tab === 'sigma' ? 'Sigma Rule (YAML)' : 'Splunk SPL'}
                                            </button>
                                        ))}
                                    </div>
                                    <QueryBlock
                                        label={activeTab === 'kql' ? 'Microsoft Sentinel KQL' : activeTab === 'sigma' ? 'Sigma Rule (YAML)' : 'Splunk SPL'}
                                        code={queries[activeTab]}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                /* Bulk scan mode */
                <div className="space-y-4">
                    <div className="metric-card space-y-4">
                        <h3 className="text-slate-900 font-bold font-display text-base">Paste threat intel text, report, or log snippet:</h3>
                        <textarea
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            rows={8}
                            placeholder="Paste any text containing IPs, hashes, CVEs, or domains. The engine will extract and enrich all IOCs automatically..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1E3A8A] focus:bg-white font-mono text-sm resize-none transition-all shadow-xs"
                        />
                        <button
                            onClick={enrichBulk}
                            disabled={bulkLoading || !bulkText.trim()}
                            className="btn-accent px-6 py-2.5 disabled:opacity-50 text-xs font-semibold"
                        >
                            {bulkLoading ? '⏳ Scanning Text...' : '🔍 Extract & Enrich All IOCs'}
                        </button>
                    </div>

                    {bulkResult && (
                        <div className="metric-card space-y-4">
                            {bulkResult.error ? (
                                <p className="text-red-700 font-medium">{bulkResult.error}</p>
                            ) : (
                                <>
                                    <h3 className="text-slate-900 font-bold font-display text-lg">
                                        Extracted {(bulkResult as { summary?: { totalIOCs?: number } }).summary?.totalIOCs ?? 0} IOCs
                                    </h3>
                                    {(['ips', 'hashes', 'cves', 'domains'] as const).map(type => {
                                        const items = bulkResult.extracted?.[type] || [];
                                        if (!items.length) return null;
                                        const labels: Record<string, string> = { ips: '📡 IP Addresses', hashes: '🔑 File Hashes', cves: '📋 CVEs', domains: '🌐 Domains' };
                                        return (
                                            <div key={type} className="pt-2 border-t border-[#E2E8F0]">
                                                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-2">{labels[type]} ({items.length})</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {items.map((item: string) => (
                                                        <button
                                                            key={item}
                                                            onClick={() => { setInput(item); setMode('single'); }}
                                                            className="px-3 py-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-400 text-slate-800 hover:text-blue-900 rounded-lg font-mono text-xs transition-all shadow-2xs"
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
