import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Bug, ShieldAlert, Newspaper, AlertTriangle, ExternalLink, RefreshCw, Search, ChevronRight, ArrowUpDown } from 'lucide-react';
import { API_BASE } from '../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VulnRecord {
    id: string;           // CVE ID or advisory ID
    title: string;
    link: string;
    source: string;
    pubDate: string;
    contentSnippet?: string;
    severity?: string;
    cvss?: number;
    cvssVersion?: string;
    cvssSource?: string;
    epss?: number;
    isKEV: boolean;
    kevDateAdded?: string;
    isZeroDay: boolean;
    zeroDayEvidence?: string;
    isPatchAdvisory: boolean;
    vendor?: string;
    product?: string;
    evidenceStatus?: string;
    intelCategory?: string;
}

type VulnFilter = 'all' | 'kev' | 'recent' | 'advisory' | 'zerodday';
const FILTER_LABELS: Record<VulnFilter, string> = {
    all:      'All Vulnerabilities',
    kev:      'Known Exploited (KEV)',
    recent:   'Recently Disclosed',
    advisory: 'Patch Advisories',
    zerodday: 'Reported Zero-Day',
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
}

function formatRelativeTime(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    try {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days < 1) return 'Today';
        if (days < 7) return `${days}d ago`;
        return formatDate(dateStr);
    } catch { return dateStr; }
}

function cvssColour(cvss: number | undefined): string {
    if (!cvss) return 'text-[#64748B]';
    if (cvss >= 9.0) return 'text-[#B42318] font-bold';
    if (cvss >= 7.0) return 'text-[#B96B00] font-bold';
    if (cvss >= 4.0) return 'text-[#D97706]';
    return 'text-[#138A68]';
}

// ─── Extract vulnerability-like records from news items ───────────────────────

function toVulnRecord(item: Record<string, unknown>): VulnRecord | null {
    const title = (item.title as string) || '';
    const snippet = (item.contentSnippet as string) || '';
    const combined = `${title} ${snippet}`.toLowerCase();

    // Only include vuln-disclosure or items with a CVE ID
    const hasCveId = /\bcve-\d{4}-\d{4,7}\b/i.test(combined);
    const isVulnCat = item.intelCategory === 'vuln-disclosure';
    if (!hasCveId && !isVulnCat) return null;

    // Extract first CVE ID as the record ID
    const cveMatch = combined.match(/\bcve-\d{4}-\d{4,7}\b/i);
    const id = cveMatch ? cveMatch[0].toUpperCase() : (item.link as string) || title;

    const isKEV = Boolean(
        combined.includes('known exploited') ||
        combined.includes('cisa kev') ||
        combined.includes('kev catalog') ||
        (item as Record<string, unknown>).isKEV
    );

    const isZeroDay = Boolean(
        combined.includes('zero-day') ||
        combined.includes('zero day') ||
        combined.includes('0-day') ||
        combined.includes('actively exploited') ||
        combined.includes('exploited in the wild')
    );

    const isPatchAdvisory = Boolean(
        combined.includes('patch') ||
        combined.includes('security advisory') ||
        combined.includes('security update') ||
        (item.evidenceStatus as string) === 'advisory'
    );

    // Only claim zero-day if there is supporting text evidence
    const zeroDayEvidence = isZeroDay
        ? (combined.includes('actively exploited') ? 'Active exploitation reported' :
           combined.includes('exploited in the wild') ? 'In-the-wild exploitation reported' :
           'Zero-day claim from article text — verify with primary source')
        : undefined;

    return {
        id,
        title,
        link: (item.link as string) || '',
        source: (item.source as string) || 'Unknown',
        pubDate: (item.pubDate as string) || '',
        contentSnippet: snippet || undefined,
        severity: (item.severity as string) || undefined,
        cvss: typeof item.cvss === 'number' ? item.cvss : undefined,
        cvssVersion: (item.cvssVersion as string) || undefined,
        cvssSource: (item.cvssSource as string) || undefined,
        epss: typeof item.epss === 'number' ? item.epss : undefined,
        isKEV,
        kevDateAdded: (item.kevDateAdded as string) || undefined,
        isZeroDay,
        zeroDayEvidence,
        isPatchAdvisory,
        vendor: (item.vendor as string) || undefined,
        product: (item.product as string) || undefined,
        evidenceStatus: (item.evidenceStatus as string) || 'unassessed',
        intelCategory: (item.intelCategory as string) || 'vuln-disclosure',
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VulnerabilitiesView: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const filterParam = (searchParams.get('filter') as VulnFilter) || 'all';
    const searchParam = searchParams.get('q') || '';

    const [records, setRecords]     = useState<VulnRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('Syncing...');
    const [kevFeatured, setKevFeatured] = useState<VulnRecord[]>([]);
    const [localSearch, setLocalSearch] = useState(searchParam);
    const [sortField, setSortField] = useState<'pubDate' | 'cvss'>('pubDate');
    const [sortDir, setSortDir]     = useState<'desc' | 'asc'>('desc');

    const updateUrl = (updates: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams);
        for (const [k, v] of Object.entries(updates)) {
            if (!v || v === 'all' || v === '') next.delete(k);
            else next.set(k, v);
        }
        setSearchParams(next, { replace: true });
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [newsRes, snapRes] = await Promise.allSettled([
                fetch(`${API_BASE}/api/news?limit=500`).then(r => r.ok ? r.json() : []),
                fetch(`${API_BASE}/api/dashboard/snapshot`).then(r => r.ok ? r.json() : null),
            ]);

            // Extract vuln records from news feed
            const news = (newsRes.status === 'fulfilled' ? newsRes.value : []) as Record<string, unknown>[];
            const vulnItems = news.flatMap(item => {
                const v = toVulnRecord(item);
                return v ? [v] : [];
            });

            // Deduplicate by CVE ID (keep first occurrence = most recent)
            const seen = new Set<string>();
            const deduped = vulnItems.filter(v => {
                if (seen.has(v.id)) return false;
                seen.add(v.id);
                return true;
            });
            setRecords(deduped);

            // Extract KEV featured from snapshot
            if (snapRes.status === 'fulfilled' && snapRes.value?.kev?.featured) {
                const kf: VulnRecord[] = (snapRes.value.kev.featured as Record<string, unknown>[]).map(k => ({
                    id: (k.id as string) || '',
                    title: (k.description as string) || (k.id as string) || '',
                    link: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`,
                    source: 'CISA KEV Catalog',
                    pubDate: (k.dateAdded as string) || new Date().toISOString(),
                    cvss: typeof k.cvss === 'number' ? k.cvss : undefined,
                    epss: typeof k.epss === 'number' ? k.epss : undefined,
                    isKEV: true,
                    kevDateAdded: k.dateAdded as string || undefined,
                    // KEV entries are confirmed exploited — but NOT necessarily current zero-days
                    isZeroDay: false,
                    isPatchAdvisory: false,
                    vendor: (k.vendor as string) || undefined,
                    evidenceStatus: 'verified',
                    intelCategory: 'vuln-disclosure',
                }));
                setKevFeatured(kf);
                setLastUpdated(
                    snapRes.value.kev.lastUpdated
                        ? new Date(snapRes.value.kev.lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                );
            }
        } catch (e) {
            console.error('VulnerabilitiesView fetch error:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Apply filter
    const filteredRecords = useMemo(() => {
        const query = localSearch.toLowerCase();
        let base = filterParam === 'kev'      ? records.filter(r => r.isKEV)
                 : filterParam === 'zerodday' ? records.filter(r => r.isZeroDay)
                 : filterParam === 'advisory' ? records.filter(r => r.isPatchAdvisory)
                 : filterParam === 'recent'   ? records.filter(r => {
                       const d = new Date(r.pubDate);
                       return !isNaN(d.getTime()) && (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
                   })
                 : records;

        if (query) {
            base = base.filter(r =>
                r.id.toLowerCase().includes(query) ||
                r.title.toLowerCase().includes(query) ||
                (r.contentSnippet || '').toLowerCase().includes(query) ||
                (r.vendor || '').toLowerCase().includes(query)
            );
        }
        return base;
    }, [records, filterParam, localSearch]);

    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            if (sortField === 'cvss') {
                const av = a.cvss ?? 0, bv = b.cvss ?? 0;
                return sortDir === 'desc' ? bv - av : av - bv;
            }
            const ad = new Date(a.pubDate || 0).getTime();
            const bd = new Date(b.pubDate || 0).getTime();
            return sortDir === 'desc' ? bd - ad : ad - bd;
        });
    }, [filteredRecords, sortField, sortDir]);

    const toggleSort = (field: 'pubDate' | 'cvss') => {
        if (sortField === field) setSortDir(p => p === 'desc' ? 'asc' : 'desc');
        else { setSortField(field); setSortDir('desc'); }
    };

    const counts: Record<VulnFilter, number> = useMemo(() => ({
        all:      records.length,
        kev:      records.filter(r => r.isKEV).length,
        zerodday: records.filter(r => r.isZeroDay).length,
        advisory: records.filter(r => r.isPatchAdvisory).length,
        recent:   records.filter(r => {
            const d = new Date(r.pubDate);
            return !isNaN(d.getTime()) && (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
        }).length,
    }), [records]);

    const filterTabs: VulnFilter[] = ['all', 'kev', 'recent', 'advisory', 'zerodday'];

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto w-full overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[#0665F9] uppercase tracking-wider bg-[#EAF2FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                            Vulnerabilities
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-[30px] font-bold text-[#0F172A] tracking-tight font-sans">
                        Vulnerability Intelligence
                    </h1>
                    <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">
                        Known exploited · Disclosed · Advisories — sourced from CISA KEV &amp; intelligence feeds
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#64748B] font-mono hidden sm:inline">Updated {lastUpdated}</span>
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-md bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-medium inline-flex items-center gap-1.5 shadow-2xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${isLoading ? 'animate-spin text-[#0665F9]' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* KEV Featured strip (only shown on 'all' and 'kev' views) */}
            {kevFeatured.length > 0 && (filterParam === 'all' || filterParam === 'kev') && (
                <section aria-label="CISA KEV Featured Vulnerabilities" className="space-y-2">
                    <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#B42318]" />
                        CISA Known Exploited Vulnerabilities — Featured
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                        {kevFeatured.slice(0, 5).map(kev => (
                            <a
                                key={kev.id}
                                href={kev.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white border border-[#E2E8F0] rounded-lg p-3 hover:border-[#0665F9]/30 hover:shadow-sm transition-all group block"
                            >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="font-mono text-[11px] font-bold text-[#0665F9]">{kev.id}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FEF3F2] text-[#B42318] border border-[#FECACA] font-semibold whitespace-nowrap">
                                        KEV
                                    </span>
                                </div>
                                <p className="text-[11px] text-[#0F172A] font-medium leading-snug line-clamp-2 mb-2">{kev.title}</p>
                                <div className="flex items-center justify-between">
                                    {kev.cvss !== undefined && (
                                        <span className={`text-[11px] font-mono ${cvssColour(kev.cvss)}`}>
                                            CVSS {kev.cvss.toFixed(1)}
                                        </span>
                                    )}
                                    {kev.epss !== undefined && (
                                        <span className="text-[10px] text-[#64748B]">
                                            EPSS {(kev.epss * 100).toFixed(1)}%
                                        </span>
                                    )}
                                    <ExternalLink className="w-3 h-3 text-[#94A3B8] group-hover:text-[#0665F9] transition-colors" />
                                </div>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* Main table */}
            <section className="bg-white border border-[#E2E8F0] rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col flex-1 overflow-hidden">
                {/* Toolbar */}
                <div className="p-3 border-b border-[#E2E8F0] space-y-2.5">
                    {/* Filter tabs */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div role="tablist" aria-label="Vulnerability filter" className="flex items-center gap-1 flex-wrap">
                            {filterTabs.map(f => (
                                <button
                                    key={f}
                                    role="tab"
                                    aria-selected={filterParam === f}
                                    onClick={() => updateUrl({ filter: f })}
                                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0665F9] ${
                                        filterParam === f
                                            ? 'bg-[#0665F9] text-white'
                                            : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                                    }`}
                                >
                                    {f === 'kev' && <ShieldAlert className="w-3 h-3" />}
                                    {f === 'zerodday' && <AlertTriangle className="w-3 h-3" />}
                                    {f === 'advisory' && <Newspaper className="w-3 h-3" />}
                                    <span>{FILTER_LABELS[f]}</span>
                                    <span className={`px-1.5 rounded-full text-[10px] font-mono ${filterParam === f ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                                        {counts[f]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
                            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search CVEs, keywords, vendor..."
                                value={localSearch}
                                onChange={e => setLocalSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 h-8 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0665F9] rounded-md text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[#94A3B8]">
                            {filterParam === 'kev' && (
                                <span>KEV membership and exploitation status shown only when supported by dated CISA source. </span>
                            )}
                            {filterParam === 'zerodday' && (
                                <span>Zero-day claims are from article text — verify with vendor advisory before acting. </span>
                            )}
                        </p>
                        <span className="text-[11px] text-[#64748B] font-mono">{sortedRecords.length.toLocaleString()} records</span>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#F8FAFC] text-[#64748B] font-medium border-b border-[#E2E8F0] sticky top-0 z-10">
                            <tr>
                                <th scope="col" className="w-36 px-4 py-2.5 font-mono">CVE ID</th>
                                <th scope="col" className="px-4 py-2.5 min-w-[240px]">Description</th>
                                <th
                                    scope="col"
                                    onClick={() => toggleSort('cvss')}
                                    className="w-20 px-3 py-2.5 cursor-pointer hover:text-[#0F172A] whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1">
                                        CVSS <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                                    </div>
                                </th>
                                <th scope="col" className="hidden md:table-cell w-20 px-3 py-2.5">EPSS</th>
                                <th scope="col" className="w-16 px-3 py-2.5 text-center">KEV</th>
                                <th scope="col" className="hidden sm:table-cell w-28 px-3 py-2.5">Vendor</th>
                                <th
                                    scope="col"
                                    onClick={() => toggleSort('pubDate')}
                                    className="w-28 px-3 py-2.5 cursor-pointer hover:text-[#0F172A] whitespace-nowrap"
                                >
                                    <div className="flex items-center gap-1">
                                        Disclosed <ArrowUpDown className="w-3 h-3 text-[#94A3B8]" />
                                    </div>
                                </th>
                                <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Open</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-4 py-3"><div className="w-28 h-4 bg-slate-200 rounded font-mono" /></td>
                                        <td className="px-4 py-3 space-y-1.5">
                                            <div className="w-3/4 h-3.5 bg-slate-200 rounded" />
                                            <div className="w-1/2 h-2.5 bg-slate-100 rounded" />
                                        </td>
                                        <td className="px-3 py-3"><div className="w-10 h-3.5 bg-slate-200 rounded" /></td>
                                        <td className="hidden md:table-cell px-3 py-3"><div className="w-12 h-3.5 bg-slate-200 rounded" /></td>
                                        <td className="px-3 py-3"><div className="w-8 h-4 bg-slate-200 rounded mx-auto" /></td>
                                        <td className="hidden sm:table-cell px-3 py-3"><div className="w-16 h-3 bg-slate-200 rounded" /></td>
                                        <td className="px-3 py-3"><div className="w-16 h-3 bg-slate-200 rounded" /></td>
                                        <td className="px-2 py-3"><div className="w-3.5 h-3.5 bg-slate-200 rounded mx-auto" /></td>
                                    </tr>
                                ))
                            ) : sortedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16 text-[#64748B] text-xs">
                                        <Bug className="w-8 h-8 text-[#CBD5E1] mx-auto mb-3" />
                                        <p className="font-semibold text-sm text-[#0F172A]">No vulnerability records matched this filter</p>
                                        <p className="mt-1">Try a different filter tab or clear the search.</p>
                                        {localSearch && (
                                            <button
                                                onClick={() => setLocalSearch('')}
                                                className="mt-3 px-4 py-1.5 bg-[#0665F9] text-white rounded-md text-xs font-medium hover:bg-[#0554D4]"
                                            >
                                                Clear search
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                sortedRecords.map(r => (
                                    <tr key={r.id + r.link} className="hover:bg-[#F8FAFC] transition-colors group">
                                        {/* CVE ID */}
                                        <td className="px-4 py-3">
                                            <a
                                                href={`/investigate?ioc=${encodeURIComponent(r.id)}`}
                                                onClick={e => { e.stopPropagation(); }}
                                                className="font-mono text-[11px] font-bold text-[#0665F9] hover:underline"
                                                title={`Investigate ${r.id}`}
                                            >
                                                {r.id}
                                            </a>
                                        </td>
                                        {/* Description */}
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5 max-w-xl">
                                                <p className="font-medium text-[#0F172A] leading-snug line-clamp-1">{r.title}</p>
                                                {r.contentSnippet && (
                                                    <p className="text-[#64748B] text-[10px] line-clamp-1">{r.contentSnippet}</p>
                                                )}
                                                <div className="flex gap-1.5 flex-wrap mt-0.5">
                                                    {r.isZeroDay && (
                                                        <span
                                                            title={r.zeroDayEvidence}
                                                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FEF3F2] text-[#B42318] border border-[#FECACA]"
                                                        >
                                                            Zero-day claim
                                                        </span>
                                                    )}
                                                    {r.isPatchAdvisory && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                            Patch advisory
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {/* CVSS */}
                                        <td className="px-3 py-3 whitespace-nowrap">
                                            {r.cvss !== undefined ? (
                                                <div>
                                                    <span className={`text-[12px] font-mono ${cvssColour(r.cvss)}`}>{r.cvss.toFixed(1)}</span>
                                                    {r.cvssVersion && (
                                                        <span className="block text-[9px] text-[#94A3B8]">{r.cvssVersion}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[#CBD5E1] text-xs">—</span>
                                            )}
                                        </td>
                                        {/* EPSS */}
                                        <td className="hidden md:table-cell px-3 py-3 whitespace-nowrap">
                                            {r.epss !== undefined ? (
                                                <span className="text-xs font-mono text-[#64748B]">{(r.epss * 100).toFixed(1)}%</span>
                                            ) : <span className="text-[#CBD5E1] text-xs">—</span>}
                                        </td>
                                        {/* KEV badge */}
                                        <td className="px-3 py-3 text-center">
                                            {r.isKEV ? (
                                                <span
                                                    title={r.kevDateAdded ? `Added to KEV: ${formatDate(r.kevDateAdded)}` : 'In CISA KEV catalog'}
                                                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECACA]"
                                                >
                                                    KEV
                                                </span>
                                            ) : <span className="text-[#CBD5E1] text-xs">—</span>}
                                        </td>
                                        {/* Vendor */}
                                        <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap text-[#64748B] text-xs truncate max-w-[110px]">
                                            {r.vendor || '—'}
                                        </td>
                                        {/* Disclosed */}
                                        <td className="px-3 py-3 whitespace-nowrap text-[#64748B] text-xs">
                                            {formatRelativeTime(r.pubDate)}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-2 py-3 text-center">
                                            <Link
                                                to={`/investigate?ioc=${encodeURIComponent(r.id)}`}
                                                className="text-[#94A3B8] group-hover:text-[#0665F9] transition-colors"
                                                title={`Investigate ${r.id}`}
                                            >
                                                <ChevronRight className="w-4 h-4 mx-auto" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer count */}
                {!isLoading && sortedRecords.length > 0 && (
                    <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B] flex items-center justify-between">
                        <span>
                            Showing <strong>{sortedRecords.length.toLocaleString()}</strong> vulnerability record{sortedRecords.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                            CVSS, EPSS and platform priority are kept as separate dimensions.
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
};

export default VulnerabilitiesView;
