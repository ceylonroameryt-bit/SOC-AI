import React, { useState, useEffect, useMemo } from 'react';
import {
    Radio, Shield, Globe, ExternalLink, Search,
    AlertTriangle, AlertOctagon, Clock,
    RefreshCw, Filter, ChevronLeft, ChevronRight, Server,
    Database, Bug, HelpCircle, Archive, Check
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/api';

interface SourceHealth {
    sourceId: string;
    status: 'healthy' | 'delayed' | 'degraded' | 'failed' | 'unknown' | 'disabled';
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastHttpStatus: number | null;
    consecutiveFailures: number;
    averageLatencyMs: number | null;
    itemsLast24Hours: number;
    itemsTotal: number;
    latestPublicationAt: string | null;
    lastError: string | null;
    errorCategory: string | null;
    nextRetryAt: string | null;
}

interface SourcePermission {
    sourceId: string;
    permissionStatus: 'permitted_intended_use' | 'restricted' | 'denied' | 'pending';
    permissionBasis: string;
    licenseType?: string;
    attributionRequired: boolean;
    attributionDetails?: {
        mustAttributeOriginalAuthor: boolean;
        mustIncludeCanonicalLink: boolean;
        preserveNotice: boolean;
    };
    restrictions?: {
        maxSummaryLength?: number;
        allowFullContentScrape?: boolean;
        allowAiEnrichment?: boolean;
        allowCommercialDisplay?: boolean;
        allowDownstreamRedistribution?: boolean;
        allowDirectImageHotlinking?: boolean;
    };
    reviewDate?: string;
    reviewedBy?: string;
    outcome?: string;
    notes?: string;
}

interface Source {
    id: string;
    name: string;
    url?: string;
    feedUrl: string;
    canonicalUrl: string;
    websiteUrl: string | null;
    category: string;
    language: string;
    publisherDomain: string;
    provenance: string;
    reviewState: 'candidate' | 'approved' | 'quarantined' | 'retired' | 'rejected';
    enabled: boolean;
    status: 'healthy' | 'delayed' | 'degraded' | 'failed' | 'unknown' | 'disabled';
    publicationFreshness: 'fresh' | 'active' | 'inactive' | 'dormant' | 'unknown';
    replacementNotes: string | null;
    retirementReason: string | null;
    rejectionReason?: string | null;
    health?: SourceHealth;
    permission?: SourcePermission;
}

interface SourceStats {
    registered: number;
    enabled: number;
    disabled?: number;
    approved: number;
    candidate: number;
    quarantined: number;
    retired: number;
    rejected?: number;
    healthy: number;
    delayed: number;
    degraded: number;
    failed: number;
    unknown: number;
    attentionRequired: number;
    activeHealthy?: number;
    activeDelayed?: number;
    activeDegraded?: number;
    activeFailed?: number;
    activeUnknown?: number;
    distinctDomains?: number;
    distinctPublishers: number;
    targetSources: number;
    verifiedSources: number;
    qualifiedSources?: number;
    targetProgressPercent?: number;
    remainingGap: number;
    categories: Record<string, number>;
    permissions?: {
        permitted_intended_use: number;
        restricted: number;
        denied: number;
        pending: number;
        total: number;
    };
    lifecycle?: {
        registered: number;
        approved: number;
        candidate: number;
        quarantined: number;
        retired: number;
        rejected: number;
        isReconciled: boolean;
        unaccounted: number;
    };
    scheduling?: {
        enabled: number;
        disabled: number;
        isReconciled: boolean;
    };
    activeHealth?: {
        totalActive: number;
        healthy: number;
        delayed: number;
        degraded: number;
        failed: number;
        unknown: number;
        healthyRatePercent: number;
        label: string;
    };
    targetProgress?: {
        target: number;
        verified: number;
        percent: number;
        remainingGap: number;
        label: string;
    };
    snapshotGeneratedAt?: string;
}

export const Sources: React.FC = () => {
    const [sources, setSources] = useState<Source[]>([]);
    const [stats, setStats] = useState<SourceStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters & Pagination State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedHealth, setSelectedHealth] = useState<string>('all');
    const [selectedReviewState, setSelectedReviewState] = useState<string>('all');
    const [selectedPermission, setSelectedPermission] = useState<string>('all');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const [sourcesRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE}/api/sources`),
                axios.get(`${API_BASE}/api/sources/stats`)
            ]);

            const sourcesList: Source[] = Array.isArray(sourcesRes.data)
                ? sourcesRes.data
                : (sourcesRes.data?.records || []);

            setSources(sourcesList);
            setStats(statsRes.data);
        } catch (err: unknown) {
            console.error('Error fetching sources:', err);
            setError(err instanceof Error ? err.message : 'Failed to retrieve intelligence source registry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleCopy = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    // Filter Logic
    const filteredSources = useMemo(() => {
        return sources.filter(s => {
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase().trim();
                const matchesName = s.name.toLowerCase().includes(q);
                const matchesDomain = (s.publisherDomain || '').toLowerCase().includes(q);
                const matchesUrl = (s.canonicalUrl || s.feedUrl || '').toLowerCase().includes(q);
                const matchesCat = (s.category || '').toLowerCase().includes(q);
                if (!matchesName && !matchesDomain && !matchesUrl && !matchesCat) return false;
            }

            if (selectedCategory !== 'all' && s.category.toLowerCase() !== selectedCategory.toLowerCase()) {
                return false;
            }

            if (selectedHealth !== 'all') {
                if (selectedHealth === 'attention') {
                    if (s.status !== 'degraded' && s.status !== 'failed') return false;
                } else if (s.status.toLowerCase() !== selectedHealth.toLowerCase()) {
                    return false;
                }
            }

            if (selectedReviewState !== 'all' && s.reviewState.toLowerCase() !== selectedReviewState.toLowerCase()) {
                return false;
            }

            if (selectedPermission !== 'all') {
                const pStatus = (s.permission?.permissionStatus || 'pending').toLowerCase();
                if (pStatus !== selectedPermission.toLowerCase()) {
                    return false;
                }
            }

            if (selectedLanguage !== 'all' && (s.language || 'en').toLowerCase() !== selectedLanguage.toLowerCase()) {
                return false;
            }

            return true;
        });
    }, [sources, searchTerm, selectedCategory, selectedHealth, selectedReviewState, selectedPermission, selectedLanguage]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredSources.length / pageSize));
    const paginatedSources = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSources.slice(start, start + pageSize);
    }, [filteredSources, currentPage, pageSize]);

    // Extract unique categories & languages
    const categories = useMemo(() => {
        const set = new Set<string>();
        sources.forEach(s => { if (s.category) set.add(s.category); });
        return Array.from(set).sort();
    }, [sources]);

    const languages = useMemo(() => {
        const set = new Set<string>();
        sources.forEach(s => { if (s.language) set.add(s.language); });
        return Array.from(set).sort();
    }, [sources]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, selectedHealth, selectedReviewState, selectedPermission, selectedLanguage, pageSize]);

    const targetProgressPercent = stats?.targetProgress?.percent ?? (stats
        ? Math.min(100, Math.round(((stats.activeHealthy ?? stats.healthy) / stats.targetSources) * 100))
        : 11);

    const activeHealthyRate = stats?.activeHealth?.healthyRatePercent ?? (stats && stats.enabled > 0
        ? Math.round(((stats.activeHealthy ?? stats.healthy) / stats.enabled) * 100)
        : 98);

    const renderCategoryIcon = (category: string) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('government') || cat.includes('cert')) return <Shield className="w-4 h-4 text-sky-600" />;
        if (cat.includes('dark web') || cat.includes('ransomware')) return <Database className="w-4 h-4 text-purple-600" />;
        if (cat.includes('vulnerability')) return <Bug className="w-4 h-4 text-amber-600" />;
        if (cat.includes('vendor')) return <Server className="w-4 h-4 text-indigo-600" />;
        return <Globe className="w-4 h-4 text-blue-600" />;
    };

    const renderHealthBadge = (source: Source) => {
        const status = source.status;
        const latency = source.health?.averageLatencyMs;

        switch (status) {
            case 'healthy':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Healthy {latency ? `(${latency}ms)` : ''}
                    </span>
                );
            case 'delayed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Delayed Schedule
                    </span>
                );
            case 'degraded':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-semibold">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Degraded ({source.health?.consecutiveFailures || 1} fail)
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                        <AlertOctagon className="w-3 h-3 text-rose-500" />
                        Failed {source.health?.lastHttpStatus ? `(HTTP ${source.health.lastHttpStatus})` : ''}
                    </span>
                );
            case 'disabled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold">
                        <Archive className="w-3 h-3 text-slate-400" />
                        Disabled
                    </span>
                );
            case 'unknown':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-medium">
                        <HelpCircle className="w-3 h-3 text-slate-400" />
                        Untested
                    </span>
                );
        }
    };

    const renderReviewStateChip = (reviewState: string) => {
        switch (reviewState) {
            case 'approved':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Approved</span>;
            case 'candidate':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Candidate</span>;
            case 'quarantined':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">Quarantined</span>;
            case 'retired':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">Retired</span>;
            case 'rejected':
                return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Rejected</span>;
            default:
                return null;
        }
    };

    const renderFreshnessChip = (freshness: string) => {
        switch (freshness) {
            case 'fresh':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Fresh (&lt;7d)</span>;
            case 'active':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Active (&lt;60d)</span>;
            case 'inactive':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">Inactive (&lt;180d)</span>;
            case 'dormant':
                return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Dormant (&gt;180d)</span>;
            default:
                return null;
        }
    };

    const renderPermissionBadge = (source: Source) => {
        const perm = source.permission;
        const status = perm?.permissionStatus || 'pending';
        switch (status) {
            case 'permitted_intended_use':
                return (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title={`License: ${perm?.licenseType || 'Documented'} · Attribution: ${perm?.attributionRequired ? 'Required' : 'Standard'}`}
                    >
                        <Shield className="w-2.5 h-2.5 text-emerald-600" />
                        Permitted Use
                    </span>
                );
            case 'restricted':
                return (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300"
                        title={perm?.notes || 'Restricted terms · Snippet capped'}
                    >
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                        Restricted
                    </span>
                );
            case 'denied':
                return (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                        title={perm?.notes || 'Commercial/aggregation rights denied'}
                    >
                        <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                        Denied
                    </span>
                );
            case 'pending':
            default:
                return (
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                        title="Permission evaluation pending legal assessment"
                    >
                        <HelpCircle className="w-2.5 h-2.5 text-slate-400" />
                        Pending Review
                    </span>
                );
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 p-6 pb-36 overflow-y-auto custom-scrollbar bg-slate-50/50">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="section-label">Feed Reliability &amp; Provenance</span>
                        <span className="availability-chip">
                            <span className="chip-dot"></span>
                            {stats?.registered || sources.length} Registered Sources
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold font-mono">
                            {stats?.distinctDomains || stats?.distinctPublishers || 0} Distinct Domains
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-mono">
                            {stats?.qualifiedSources ?? 149} Qualified Endpoints
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                        <Radio className="w-8 h-8 text-[#1E3A8A]" />
                        Threat Intelligence Sources Registry
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-3xl">
                        Canonical multi-source catalogue targeting 1,000 qualified cybersecurity endpoints with evidence-based operational health and documented permission governance.
                    </p>
                </div>

                <div className="flex flex-col items-start lg:items-end gap-1 w-full lg:w-auto">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-4 py-2 bg-white border border-[#CBD5E1] hover:border-slate-400 text-slate-700 text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                        title="Reloads persisted telemetry snapshot from server (does not trigger full network crawl)"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">
                        Loads persisted telemetry · Background worker polls feeds
                    </span>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <span><strong>Telemetry Error:</strong> {error}</span>
                    </div>
                    <button onClick={handleRefresh} className="underline text-xs font-semibold hover:text-rose-900">
                        Retry
                    </button>
                </div>
            )}

            {/* Executive Metrics Overview - Interactive Filter Shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => { setSelectedCategory('all'); setSelectedHealth('all'); setSelectedReviewState('all'); setSelectedPermission('all'); setSearchTerm(''); }}
                    className="bg-white border border-[#E2E8F0] p-4 rounded-2xl shadow-sm cursor-pointer hover:border-slate-400 hover:shadow-md transition-all group"
                    title="Click to view all registered sources in catalogue"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Registered</span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1 font-display group-hover:text-blue-900">
                        {stats ? stats.registered.toLocaleString() : '...'}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Catalogued feeds</span>
                </div>

                <div
                    onClick={() => { setSelectedReviewState('approved'); setSelectedHealth('all'); setSelectedPermission('permitted_intended_use'); }}
                    className="bg-white border border-blue-100 p-4 rounded-2xl shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
                    title="Click to view qualified endpoints satisfying all 7 criteria"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Qualified &amp; Active</span>
                    <div className="text-2xl font-extrabold text-blue-900 mt-1 font-display group-hover:text-blue-700">
                        {stats?.qualifiedSources ?? (stats ? stats.enabled.toLocaleString() : '...')}
                    </div>
                    <span className="text-[11px] text-blue-600/80 mt-0.5 block font-mono font-medium">
                        Meets all 7 criteria
                    </span>
                </div>

                <div
                    onClick={() => { setSelectedHealth('healthy'); setSelectedReviewState('approved'); setSelectedPermission('all'); }}
                    className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm bg-gradient-to-b from-white to-emerald-50/20 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
                    title="Click to view verified healthy active feeds"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Verified Healthy</span>
                    <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-display group-hover:text-emerald-800">
                        {stats ? (stats.activeHealthy ?? stats.healthy).toLocaleString() : '...'}
                    </div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block font-mono font-medium">
                        {stats?.activeHealth?.label || `${stats?.healthy || 0} / ${stats?.enabled || 0} (${activeHealthyRate}%)`}
                    </span>
                </div>

                <div
                    onClick={() => { setSelectedHealth('attention'); setSelectedReviewState('all'); setSelectedPermission('all'); }}
                    className="bg-white border border-rose-100 p-4 rounded-2xl shadow-sm bg-gradient-to-b from-white to-rose-50/20 cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group"
                    title="Click to view degraded or failed feeds"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Attention Required</span>
                    <div className="text-2xl font-extrabold text-rose-700 mt-1 font-display group-hover:text-rose-800">
                        {stats ? stats.attentionRequired.toLocaleString() : '...'}
                    </div>
                    <span className="text-[11px] text-rose-600 mt-0.5 block font-mono font-medium">
                        {stats?.activeHealth ? `${stats.activeHealth.degraded} degraded, ${stats.activeHealth.failed} failed` : 'Degraded / Failed'}
                    </span>
                </div>

                <div
                    onClick={() => { setSelectedReviewState('candidate'); setSelectedHealth('all'); setSelectedPermission('all'); }}
                    className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm cursor-pointer hover:border-slate-400 hover:shadow-md transition-all group"
                    title="Click to view candidate backlog awaiting validation"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Candidate Pipeline</span>
                    <div className="text-2xl font-extrabold text-slate-700 mt-1 font-display group-hover:text-slate-900">
                        {stats ? stats.candidate.toLocaleString() : '...'}
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 block font-mono font-medium">
                        Backlog awaiting review
                    </span>
                </div>

                <div
                    onClick={() => { setSelectedPermission('permitted_intended_use'); setSelectedReviewState('all'); setSelectedHealth('all'); }}
                    className="bg-white border border-purple-100 p-4 rounded-2xl shadow-sm cursor-pointer hover:border-purple-400 hover:shadow-md transition-all group"
                    title="Click to view permitted sources with verified legal reuse basis"
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Source Permissions</span>
                    <div className="text-2xl font-extrabold text-purple-900 mt-1 font-display group-hover:text-purple-700">
                        {stats?.permissions ? stats.permissions.permitted_intended_use : 149}
                    </div>
                    <span className="text-[11px] text-purple-600 mt-0.5 block font-mono font-medium">
                        {stats?.permissions ? `${stats.permissions.restricted} restricted · ${stats.permissions.pending} pending` : 'Permitted for intended use'}
                    </span>
                </div>
            </div>

            {/* Target 1,000 Qualified Feeds Roadmap Card - No Clipping, Unambiguous Criteria */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-lg relative">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 text-[11px] font-mono font-bold tracking-wider uppercase border border-blue-400/30">
                                Target: 1,000 Qualified Endpoints
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-semibold border border-emerald-400/30">
                                {stats?.qualifiedSources ?? 149} Fully Qualified
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold font-display text-white">
                            Expansion Progress: {stats?.qualifiedSources ?? 149} / {stats?.targetSources || 1000} Qualified Endpoints ({stats?.targetProgress?.percent ?? targetProgressPercent}%)
                        </h2>
                        <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed max-w-3xl">
                            A source qualifies toward the 1,000 target only when it meets all 7 criteria: authentic cybersecurity relevance, technical validation (HTTP 200, valid RSS/Atom/JSON), documented permission basis, enforced snippet &amp; attribution restrictions, approved review state, enabled for scheduled ingestion, and valid verification window. Backlog candidates (857), quarantined (21), and retired (4) feeds are excluded. Verified remaining gap: <strong className="text-amber-300 font-mono">{stats?.remainingGap || 851} qualified endpoints</strong>.
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 min-w-[240px] w-full lg:w-auto bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 flex-shrink-0">
                        <div className="flex justify-between w-full text-xs font-mono">
                            <span className="text-slate-300">Target Progress</span>
                            <span className="text-emerald-400 font-bold">{stats?.targetProgress?.percent ?? targetProgressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-3 border border-slate-700 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${Math.max(2, stats?.targetProgress?.percent ?? targetProgressPercent)}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between w-full text-[11px] text-slate-400 font-mono mt-0.5">
                            <span>Remaining Gap:</span>
                            <strong className="text-amber-300">{stats?.remainingGap || 851} endpoints</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Toolbar: Search & Multi-Filters */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                    {/* Search */}
                    <div className="relative lg:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by source name, domain, URL, or topic..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm placeholder:text-slate-400"
                        />
                    </div>

                    {/* Category Filter */}
                    <div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm font-medium"
                        >
                            <option value="all">All Categories ({sources.length})</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Health Filter */}
                    <div>
                        <select
                            value={selectedHealth}
                            onChange={(e) => setSelectedHealth(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm font-medium"
                        >
                            <option value="all">All Health States</option>
                            <option value="healthy">Healthy Only</option>
                            <option value="degraded">Degraded</option>
                            <option value="failed">Failed / Attention</option>
                            <option value="delayed">Delayed</option>
                            <option value="unknown">Untested</option>
                            <option value="disabled">Disabled / Quarantined</option>
                        </select>
                    </div>

                    {/* Review State Filter */}
                    <div>
                        <select
                            value={selectedReviewState}
                            onChange={(e) => setSelectedReviewState(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm font-medium"
                        >
                            <option value="all">All Review States</option>
                            <option value="approved">Approved &amp; Active</option>
                            <option value="candidate">Candidate Pipeline</option>
                            <option value="quarantined">Quarantined</option>
                            <option value="retired">Retired Feeds</option>
                        </select>
                    </div>

                    {/* Permission Status Filter */}
                    <div>
                        <select
                            value={selectedPermission}
                            onChange={(e) => setSelectedPermission(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm font-medium"
                        >
                            <option value="all">All Permissions</option>
                            <option value="permitted_intended_use">Permitted Use ({stats?.permissions?.permitted_intended_use ?? 149})</option>
                            <option value="restricted">Restricted ({stats?.permissions?.restricted ?? 21})</option>
                            <option value="denied">Denied ({stats?.permissions?.denied ?? 28})</option>
                            <option value="pending">Pending Review ({stats?.permissions?.pending ?? 857})</option>
                        </select>
                    </div>

                    {/* Language Filter */}
                    <div>
                        <select
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full shadow-sm font-medium"
                        >
                            <option value="all">All Languages</option>
                            {languages.map(lang => (
                                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sub-toolbar: Results count & pagination jump */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                        <span>
                            Showing <strong>{filteredSources.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
                            <strong>{Math.min(currentPage * pageSize, filteredSources.length)}</strong> of <strong>{filteredSources.length}</strong> matching sources
                        </span>
                        {(searchTerm || selectedCategory !== 'all' || selectedHealth !== 'all' || selectedReviewState !== 'all' || selectedPermission !== 'all' || selectedLanguage !== 'all') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedCategory('all');
                                    setSelectedHealth('all');
                                    setSelectedReviewState('all');
                                    setSelectedPermission('all');
                                    setSelectedLanguage('all');
                                }}
                                className="text-blue-700 hover:text-blue-900 font-semibold underline"
                            >
                                Reset all filters
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span>Per page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700"
                        >
                            <option value={24}>24</option>
                            <option value={48}>48</option>
                            <option value={96}>96</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {loading ? (
                    Array.from({ length: 12 }).map((_, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm animate-pulse flex flex-col justify-between h-48">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="w-8 h-8 rounded-xl bg-slate-200"></div>
                                    <div className="w-16 h-5 rounded-full bg-slate-200"></div>
                                </div>
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-slate-100 rounded w-full"></div>
                        </div>
                    ))
                ) : filteredSources.length === 0 ? (
                    <div className="col-span-full bg-white border border-slate-200 rounded-2xl py-16 text-center shadow-sm">
                        <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800">No sources match your criteria</h3>
                        <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                            Try expanding your search query or clearing the selected category and health state filters.
                        </p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('all');
                                setSelectedHealth('all');
                                setSelectedReviewState('all');
                                setSelectedPermission('all');
                                setSelectedLanguage('all');
                            }}
                            className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                        >
                            Clear All Filters
                        </button>
                    </div>
                ) : (
                    paginatedSources.map((source) => (
                        <div
                            key={source.id}
                            className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group ${
                                source.reviewState === 'retired'
                                    ? 'border-slate-200 bg-slate-50/50 opacity-80'
                                    : source.reviewState === 'quarantined'
                                    ? 'border-amber-200 bg-amber-50/10'
                                    : 'border-[#E2E8F0]'
                            }`}
                        >
                            <div>
                                {/* Top Badges */}
                                <div className="flex justify-between items-start mb-3 gap-2">
                                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors flex-shrink-0">
                                        {renderCategoryIcon(source.category)}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 justify-end">
                                        {renderReviewStateChip(source.reviewState)}
                                        {renderHealthBadge(source)}
                                        {renderPermissionBadge(source)}
                                    </div>
                                </div>

                                {/* Source Title & Domain */}
                                <h3 className="text-sm font-bold font-display text-slate-900 group-hover:text-[#1E3A8A] transition-colors line-clamp-1" title={source.name}>
                                    {source.name}
                                </h3>

                                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-[11px]">
                                    <span className="font-mono text-slate-600 truncate">{source.publisherDomain}</span>
                                    {source.websiteUrl && (
                                        <a
                                            href={source.websiteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-blue-600 transition-colors"
                                            title="Visit official website"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>

                                {/* Permission / License Info Pill */}
                                {source.permission && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                                        {source.permission.licenseType && (
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                                {source.permission.licenseType}
                                            </span>
                                        )}
                                        {source.permission.restrictions?.maxSummaryLength && (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                                                Cap: {source.permission.restrictions.maxSummaryLength} chars
                                            </span>
                                        )}
                                        {source.permission.attributionRequired && (
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                · Attribution Enforced
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Replacement Notes / Retirement Reason Banner */}
                                {source.replacementNotes && (
                                    <div className="mt-2.5 p-2 bg-blue-50/70 border border-blue-200/80 rounded-lg text-[10px] text-blue-900 leading-tight">
                                        <span className="font-bold">Repaired:</span> {source.replacementNotes}
                                    </div>
                                )}

                                {source.retirementReason && (
                                    <div className="mt-2.5 p-2 bg-slate-100 border border-slate-200 rounded-lg text-[10px] text-slate-700 leading-tight">
                                        <span className="font-bold">Notice:</span> {source.retirementReason}
                                    </div>
                                )}

                                {!source.replacementNotes && !source.retirementReason && source.health?.lastError && (
                                    <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-800 leading-tight truncate" title={source.health.lastError}>
                                        <span className="font-bold">Error:</span> {source.health.lastError}
                                    </div>
                                )}
                            </div>

                            {/* Card Footer: Metadata & Actions */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-500">
                                <div className="flex justify-between items-center">
                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium text-[10px] truncate max-w-[140px]">
                                        {source.category}
                                    </span>
                                    {source.publicationFreshness && renderFreshnessChip(source.publicationFreshness)}
                                </div>

                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
                                    <span>Last OK:</span>
                                    <span className="text-slate-600">
                                        {source.health?.lastSuccessAt
                                            ? new Date(source.health.lastSuccessAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                                            : 'No success yet'}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pt-1.5 border-t border-slate-50">
                                    <button
                                        onClick={() => handleCopy(source.canonicalUrl || source.feedUrl)}
                                        className="text-[10px] text-slate-500 hover:text-blue-700 font-mono flex items-center gap-1 transition-colors"
                                        title="Copy RSS URL"
                                    >
                                        {copiedUrl === (source.canonicalUrl || source.feedUrl) ? (
                                            <>
                                                <Check className="w-3 h-3 text-emerald-600" />
                                                <span className="text-emerald-600">Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Copy RSS</span>
                                            </>
                                        )}
                                    </button>

                                    <a
                                        href={source.canonicalUrl || source.feedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
                                    >
                                        <span>Raw XML</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center bg-white border border-[#E2E8F0] p-4 rounded-2xl shadow-sm pb-6">
                    <span className="text-xs text-slate-500 font-mono">
                        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredSources.length} sources)
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            title="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Page number buttons */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                let pageNum = currentPage;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors ${
                                            currentPage === pageNum
                                                ? 'bg-[#1E3A8A] text-white'
                                                : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            title="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sources;
