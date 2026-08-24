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
    Critical: 'text-red-400 bg-red-900/20 border-red-700/40',
    High:     'text-orange-400 bg-orange-900/20 border-orange-700/40',
    Medium:   'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
    Low:      'text-green-400 bg-green-900/20 border-green-700/40',
};

// Markdown-ish renderer for LLM output
const MarkdownText = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-2">
            {lines.map((line, i) => {
                if (line.startsWith('## ')) return <h3 key={i} className="text-cyan-300 font-bold text-base mt-4 first:mt-0">{line.replace('## ', '')}</h3>;
                if (line.startsWith('- ') || line.match(/^\d+\./)) {
                    return <div key={i} className="flex gap-2 text-gray-300 text-sm"><span className="text-cyan-500 mt-0.5 flex-shrink-0">▸</span><span>{line.replace(/^- /, '').replace(/^\d+\.\s/, '')}</span></div>;
                }
                if (line.trim()) return <p key={i} className="text-gray-300 text-sm">{line}</p>;
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
        } catch (err: any) {
            console.error('Failed to load clusters:', err);
            setClustersError(err.message || 'Failed to load incident clusters');
        } finally { setClustersLoading(false); }
    };

    useEffect(() => {
        loadBrief();
        loadClusters();
    }, []);

    const briefContent = brief?.content || brief?.fallback;

    return (
        <div className="p-6 space-y-8 min-h-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span>🤖</span> AI Intelligence Brief
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                    LLM-powered executive briefings and de-duplicated incident clusters from today's intelligence.
                </p>
            </div>

            {/* Executive Briefing */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-xl flex items-center gap-2">
                        <span>📋</span> Executive Intelligence Briefing
                        {brief?.cached && <span className="text-xs text-gray-500 font-normal">(cached)</span>}
                    </h2>
                    <button onClick={loadBrief} disabled={briefLoading}
                        className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-all flex items-center gap-2">
                        {briefLoading ? '⏳ Generating...' : '↺ Regenerate'}
                    </button>
                </div>

                <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden">
                    {briefLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
                            <p className="text-gray-500 text-sm">AI is analyzing current threat intelligence...</p>
                        </div>
                    ) : (
                        <>
                            <div className="px-4 py-2 bg-gray-800/60 border-b border-gray-700/40 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-gray-400 text-xs">
                                    Generated {brief?.generatedAt ? new Date(brief.generatedAt).toLocaleString() : 'N/A'}
                                </span>
                                {brief?.error && !briefContent && (
                                    <span className="text-yellow-400 text-xs ml-auto">{brief.error}</span>
                                )}
                            </div>
                            <div className="p-6">
                                {briefContent ? (
                                    <MarkdownText text={briefContent} />
                                ) : (
                                    <div className="text-center py-8 text-gray-500 space-y-3">
                                        <p className="text-4xl">🤖</p>
                                        <p className="font-medium">LLM not configured</p>
                                        <p className="text-sm">Add <code className="text-cyan-400 bg-gray-800 px-1 rounded">OPENAI_API_KEY</code> or <code className="text-cyan-400 bg-gray-800 px-1 rounded">OLLAMA_URL</code> to your .env file.</p>
                                        <p className="text-xs text-gray-600">See Settings → Environment Variables for the full template.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* De-duplication Stats */}
            {clusters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Articles', value: clusters.totalArticles, color: 'text-cyan-400' },
                        { label: 'Incident Clusters', value: clusters.clustersFound, color: 'text-purple-400' },
                        { label: 'De-dup Rate', value: `${clusters.deduplicationRate}%`, color: 'text-green-400' },
                        { label: 'Articles Saved', value: clusters.totalArticles - clusters.clustersFound, color: 'text-orange-400' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-4 text-center">
                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-gray-500 text-xs mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Incident Clusters */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-xl flex items-center gap-2">
                        <span>🗂️</span> De-duplicated Incident Clusters
                    </h2>
                    <button onClick={loadClusters} disabled={clustersLoading}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm rounded-xl transition-all">
                        {clustersLoading ? '⏳' : '↺'} Refresh
                    </button>
                </div>

                {clustersLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                    </div>
                ) : clustersError ? (
                    <div className="text-center py-12 bg-gray-900/40 rounded-2xl border border-red-900/30 space-y-3">
                        <p className="text-4xl">⚠️</p>
                        <p className="text-red-400 font-medium">Failed to load incident clusters</p>
                        <p className="text-gray-500 text-sm">{clustersError}</p>
                        <button onClick={loadClusters} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-all">
                            ↺ Retry
                        </button>
                    </div>
                ) : clusters?.clusters?.length ? (
                    <div className="space-y-3">
                        {clusters.clusters.slice(0, 30).map(cluster => (
                            <div key={cluster.id} className="bg-gray-900/80 border border-gray-700/40 rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
                                    className="w-full text-left p-5 hover:bg-gray-800/40 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${SEVERITY_COLORS[cluster.severity] || SEVERITY_COLORS.Low}`}>
                                                    {cluster.severity}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md text-xs text-gray-400 bg-gray-800/60 border border-gray-700/40">
                                                    {cluster.category}
                                                </span>
                                                {cluster.itemCount > 1 && (
                                                    <span className="px-2 py-0.5 rounded-md text-xs text-purple-300 bg-purple-900/30 border border-purple-700/40">
                                                        {cluster.itemCount} related articles
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-white font-medium leading-snug">{cluster.headline}</p>
                                            <p className="text-gray-500 text-xs mt-1.5">
                                                Sources: {cluster.sources.slice(0, 3).join(', ')}{cluster.sources.length > 3 ? ` +${cluster.sources.length - 3} more` : ''}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-gray-600 text-lg">
                                            {expandedCluster === cluster.id ? '▲' : '▼'}
                                        </div>
                                    </div>
                                </button>

                                {expandedCluster === cluster.id && (
                                    <div className="border-t border-gray-700/40 divide-y divide-gray-800/50">
                                        {cluster.items.map((item, i) => (
                                            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                                                className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/30 transition-colors group">
                                                <span className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${item.severity === 'Critical' ? 'bg-red-500' : item.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'}`}></span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-gray-300 text-sm group-hover:text-white transition-colors line-clamp-2">{item.title}</p>
                                                    <p className="text-gray-600 text-xs mt-0.5">{item.source} · {new Date(item.pubDate).toLocaleDateString()}</p>
                                                </div>
                                                <span className="text-gray-600 group-hover:text-cyan-400 text-sm transition-colors flex-shrink-0">↗</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500 bg-gray-900/40 rounded-2xl border border-gray-700/30">
                        <p className="text-4xl mb-3">🗂️</p>
                        <p>No clusters yet — clusters appear after news is fetched.</p>
                    </div>
                )}

            </section>
        </div>
    );
}
