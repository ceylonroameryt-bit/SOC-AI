import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

interface Cluster {
    id: string;
    headline: string;
    severity: string;
    category: string;
    itemCount: number;
    sources: string[];
    firstSeen: string;
    lastSeen: string;
    items: Array<{ title: string; link: string; source: string; severity: string; pubDate: string }>;
}

interface BriefData {
    content: string | null;
    fallback?: string;
    error?: string;
    cached?: boolean;
    generatedAt?: number;
}

interface ClustersData {
    clusters: Cluster[];
    totalArticles: number;
    clustersFound: number;
    deduplicationRate: number;
    generatedAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    Critical: 'text-red-700 bg-red-50 border-red-200',
    High:     'text-orange-700 bg-orange-50 border-orange-200',
    Medium:   'text-yellow-800 bg-yellow-50 border-yellow-200',
    Low:      'text-emerald-700 bg-emerald-50 border-emerald-200',
};

// Markdown-ish renderer for LLM output
const MarkdownText = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    const renderSpan = (str: string) => {
        const parts = str.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={idx} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="space-y-3 font-sans">
            {lines.map((line, i) => {
                if (line.startsWith('## ')) {
                    return <h3 key={i} className="text-[#1E3A8A] font-bold font-display text-lg mt-5 first:mt-0">{renderSpan(line.replace('## ', ''))}</h3>;
                }
                if (line.startsWith('- ') || line.match(/^\d+\./)) {
                    const content = line.replace(/^- /, '').replace(/^\d+\.\s/, '');
                    return (
                        <div key={i} className="flex gap-2 text-slate-700 text-sm leading-relaxed">
                            <span className="text-[#1E3A8A] font-bold mt-0.5 flex-shrink-0">▸</span>
                            <span>{renderSpan(content)}</span>
                        </div>
                    );
                }
                if (line.trim()) {
                    return <p key={i} className="text-slate-700 text-sm leading-relaxed">{renderSpan(line)}</p>;
                }
                return null;
            })}
        </div>
    );
};

export default function AIBrief() {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [clusters, setClusters] = useState<ClustersData | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);
    const [clustersLoading, setClustersLoading] = useState(false);
    const [clustersError, setClustersError] = useState<string | null>(null);
    const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

    const loadBrief = async () => {
        setBriefLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/ai/brief`);
            setBrief(await resp.json());
        } catch { setBrief({ content: null, error: 'Failed to connect to server.' }); }
        finally { setBriefLoading(false); }
    };

    const loadClusters = async () => {
        setClustersLoading(true);
        setClustersError(null);
        try {
            const resp = await fetch(`${API_BASE}/api/ai/clusters`);
            if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
            const data = await resp.json();
            setClusters(data);
        } catch (err: unknown) {
            console.error('Failed to load clusters:', err);
            setClustersError(err instanceof Error ? err.message : 'Failed to load incident clusters');
        } finally { setClustersLoading(false); }
    };

    useEffect(() => {
        loadBrief();
        loadClusters();
    }, []);

    const briefContent = brief?.content || brief?.fallback;

    return (
        <div className="p-6 space-y-8 min-h-full bg-white max-w-7xl mx-auto">
            {/* Header */}
            <div className="pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="section-label">AI Threat Synthesis</span>
                    <span className="availability-chip">
                        <span className="chip-dot"></span>
                        Automated Sitrep
                    </span>
                </div>
                <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                    <span>🤖</span> AI Intelligence Briefing
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    LLM-powered executive briefings, vector synthesis, and de-duplicated incident clusters from today's intelligence stream.
                </p>
            </div>

            {/* Executive Briefing */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                        <span>📋</span> Executive Intelligence Briefing
                        {brief?.cached && <span className="text-xs text-slate-400 font-normal">(cached snapshot)</span>}
                    </h2>
                    <button
                        onClick={loadBrief}
                        disabled={briefLoading}
                        className="btn-accent px-4 py-2 text-xs font-semibold flex items-center gap-2"
                    >
                        {briefLoading ? '⏳ Synthesizing...' : '↺ Regenerate Briefing'}
                    </button>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
                    {briefLoading ? (
                        <div className="flex flex-col items-center justify-center p-14 gap-4 bg-slate-50">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1E3A8A]"></div>
                            <p className="text-slate-600 text-sm font-medium">AI is normalizing and synthesizing threat landscape...</p>
                        </div>
                    ) : (
                        <>
                            <div className="proj-img-browser-bar flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="dot dot-red"></span>
                                    <span className="dot dot-yellow"></span>
                                    <span className="dot dot-green"></span>
                                    <span className="proj-img-url">AI Executive Summary Report</span>
                                </div>
                                <span className="text-slate-400 text-xs font-mono pr-2">
                                    {brief?.generatedAt ? new Date(brief.generatedAt).toLocaleString() : 'Live'}
                                </span>
                            </div>
                            <div className="p-6 bg-white">
                                {briefContent ? (
                                    <MarkdownText text={briefContent} />
                                ) : (
                                    <div className="text-center py-10 text-slate-500 space-y-3">
                                        <p className="text-4xl">🤖</p>
                                        <p className="font-bold text-slate-800">LLM Provider Not Configured</p>
                                        <p className="text-sm">Configure <code className="text-[#1E3A8A] font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">OPENAI_API_KEY</code> or <code className="text-[#1E3A8A] font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">OLLAMA_URL</code> in your environment.</p>
                                        <p className="text-xs text-slate-400">Navigate to Settings → Integration Settings to view configuration guides.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* De-duplication Stats */}
            {clusters && (
                <div className="stats-strip">
                    <div className="stats-strip-inner">
                        <div className="strip-stat">
                            <div className="strip-num">{clusters.totalArticles}<span className="strip-sup">ALL</span></div>
                            <div className="strip-label">Total Articles</div>
                            <div className="strip-sub">Ingested across feeds</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-[#1E3A8A]">{clusters.clustersFound}<span className="strip-sup text-[#1E3A8A]">CLUST</span></div>
                            <div className="strip-label">Incident Clusters</div>
                            <div className="strip-sub">Grouped event vectors</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-emerald-600">{clusters.deduplicationRate}<span className="strip-sup text-emerald-600">%</span></div>
                            <div className="strip-label">De-duplication Rate</div>
                            <div className="strip-sub">Noise reduction efficiency</div>
                        </div>
                        <div className="strip-divider hidden md:block" />
                        <div className="strip-stat">
                            <div className="strip-num text-orange-600">{clusters.totalArticles - clusters.clustersFound}<span className="strip-sup text-orange-600">SAVED</span></div>
                            <div className="strip-label">Duplicate Alerts Suppressed</div>
                            <div className="strip-sub">Analyst attention preserved</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Incident Clusters */}
            <section className="space-y-4 pb-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                        <span>🗂️</span> De-duplicated Incident Clusters
                    </h2>
                    <button
                        onClick={loadClusters}
                        disabled={clustersLoading}
                        className="btn-secondary px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5"
                    >
                        {clustersLoading ? '⏳' : '↺'} Refresh Clusters
                    </button>
                </div>

                {clustersLoading ? (
                    <div className="flex items-center justify-center h-32 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E3A8A]"></div>
                    </div>
                ) : clustersError ? (
                    <div className="text-center py-10 bg-red-50 rounded-2xl border border-red-200 space-y-3">
                        <p className="text-4xl">⚠️</p>
                        <p className="text-red-800 font-bold">Failed to load incident clusters</p>
                        <p className="text-slate-500 text-sm">{clustersError}</p>
                        <button onClick={loadClusters} className="btn-accent px-4 py-2 text-xs font-medium">
                            ↺ Retry
                        </button>
                    </div>
                ) : clusters?.clusters?.length ? (
                    <div className="space-y-3">
                        {clusters.clusters.slice(0, 30).map(cluster => (
                            <div key={cluster.id} className="metric-card p-0 overflow-hidden">
                                <button
                                    onClick={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
                                    className="w-full text-left p-5 hover:bg-slate-50/80 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${SEVERITY_COLORS[cluster.severity] || SEVERITY_COLORS.Low}`}>
                                                    {cluster.severity}
                                                </span>
                                                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200">
                                                    {cluster.category}
                                                </span>
                                                {cluster.itemCount > 1 && (
                                                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200">
                                                        {cluster.itemCount} related articles
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-900 font-bold font-display text-base leading-snug">{cluster.headline}</p>
                                            <p className="text-slate-500 text-xs mt-1.5 font-medium">
                                                Sources: {cluster.sources.slice(0, 3).join(', ')}{cluster.sources.length > 3 ? ` +${cluster.sources.length - 3} more` : ''}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-slate-400 text-sm font-semibold">
                                            {expandedCluster === cluster.id ? '▲' : '▼'}
                                        </div>
                                    </div>
                                </button>

                                {expandedCluster === cluster.id && (
                                    <div className="border-t border-[#E2E8F0] divide-y divide-slate-100 bg-slate-50/50">
                                        {cluster.items.map((item, i) => (
                                            <a
                                                key={i}
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-100/80 transition-colors group"
                                            >
                                                <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${item.severity === 'Critical' ? 'bg-red-500' : item.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'}`}></span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-800 text-sm font-medium group-hover:text-[#1E3A8A] transition-colors line-clamp-2">{item.title}</p>
                                                    <p className="text-slate-400 text-xs mt-1">{item.source} · {new Date(item.pubDate).toLocaleDateString()}</p>
                                                </div>
                                                <span className="text-slate-400 group-hover:text-[#1E3A8A] text-sm transition-colors flex-shrink-0">↗</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-4xl mb-3">🗂️</p>
                        <p className="font-medium text-slate-600">No clusters yet — clusters appear after intelligence articles are fetched.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
