import { useEffect, useState } from 'react';
import { ExternalLink, Flame, Calendar } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface NewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    severity?: string;
    category?: string;
    contentSnippet?: string;
}

interface NewsFeedProps {
    mode?: 'all' | 'critical' | 'timeline';
    severityFilter?: string | null;
    isEmbedded?: boolean;
}

const NewsFeed = ({ mode = 'all', severityFilter, isEmbedded = false }: NewsFeedProps) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const fetchNews = () => {
            fetch(`${API_BASE}/api/news`)
                .then(res => {
                    if (!res.ok) throw new Error(`Server returned ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    const items = Array.isArray(data) ? data : (data.news || []);
                    if (!Array.isArray(items)) throw new Error('Invalid response format');
                    setNews(items);
                    setError(null);
                    setLoading(false);
                    setLastUpdated(new Date());
                })
                .catch(err => {
                    console.error('Error fetching news:', err);
                    setError(err.message || 'Failed to load news feed');
                    setLoading(false);
                });
        };

        // Initial fetch
        fetchNews();

        // Poll every 30 minutes to catch incoming items continuously
        const interval = setInterval(fetchNews, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity?: string) => {
        switch (severity) {
            case 'Critical': return 'text-red-700 border-red-200 bg-red-50';
            case 'High': return 'text-orange-700 border-orange-200 bg-orange-50';
            case 'Medium': return 'text-amber-700 border-amber-200 bg-amber-50';
            case 'Low': return 'text-blue-700 border-blue-200 bg-blue-50';
            default: return 'text-slate-600 border-slate-200 bg-slate-100';
        }
    };

    const formatDateLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Filter Logic
    let filteredNews = news;
    if (severityFilter) {
        filteredNews = news.filter(item => item.severity === severityFilter);
    }

    const showFilteredList = !!severityFilter;

    // Determine what to show in the Grid section
    // If filtering, show filteredNews. If not, show criticalNews (original behavior)
    // LIMIT to 50 items for performance
    const gridItems = (showFilteredList ? filteredNews : news.filter(item => item.severity === 'Critical' || item.severity === 'High')).slice(0, 50);

    // Determine what to show in List section
    // If filtering, show NOTHING in list (user wants boxes). If not filtering, show timelineNews
    // LIMIT to 100 items for performance
    const listItems = (showFilteredList ? [] : news.filter(item => item.severity !== 'Critical' && item.severity !== 'High')).slice(0, 100);

    const groupedListItems = listItems.reduce((acc, item) => {
        const label = formatDateLabel(item.pubDate);
        if (!acc[label]) acc[label] = [];
        acc[label].push(item);
        return acc;
    }, {} as Record<string, NewsItem[]>);

    // Visibility flags
    // If filtering: Show Grid (true), Show List (false)
    // If mode='all': Show Grid (if items), Show List (true)
    // If mode='critical': Show Grid (true), Show List (false)
    // If mode='timeline': Show Grid (false), Show List (true)

    const showGrid = showFilteredList || (mode === 'all' || mode === 'critical');
    const showList = !showFilteredList && (mode === 'all' || mode === 'timeline');

    // Statistics for the portfolio-style stats strip
    const totalCount = news.length;
    const criticalCount = news.filter(n => n.severity === 'Critical').length;
    const highCount = news.filter(n => n.severity === 'High').length;
    const uniqueSources = new Set(news.map(n => n.source)).size;

    return (
        <div className={isEmbedded ? "flex flex-col gap-4 w-full" : "h-full flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full"}>

            {/* Header with Portfolio Editorial Styling */}
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="section-label">Live Threat Stream</span>
                            <div className="availability-chip text-[10px] py-0.5 px-2">
                                <span className="chip-dot"></span>
                                <span>Active Ingestion</span>
                            </div>
                        </div>
                        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                            Global Security Intelligence
                        </h1>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl">
                            Automated multi-tier alert triage, threat extraction, and severity scoring across global vulnerability disclosures.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-end">
                        {lastUpdated && (
                            <span className="text-[11px] text-slate-500 font-mono bg-white px-2.5 py-1 rounded-lg border border-[#E2E8F0] shadow-sm">
                                Synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <span className="text-[11px] text-blue-700 font-medium bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            Auto-refresh 30m
                        </span>
                    </div>
                </div>
            )}

            {/* Stats Strip matching sujampathirathnayaka.com */}
            {!isEmbedded && (
                <div className="stats-strip my-1">
                    <div className="stats-strip-inner">
                        <div className="strip-stat">
                            <span className="strip-num">{totalCount > 0 ? totalCount : '1.2K'}<span className="strip-sup">+</span></span>
                            <span className="strip-label">Ingested Disclosures</span>
                            <span className="strip-sub">Real-time Stream</span>
                        </div>
                        <div className="strip-divider hidden md:block"></div>
                        <div className="strip-stat">
                            <span className="strip-num text-red-600">{criticalCount}<span className="strip-sup text-red-600"> Crit</span></span>
                            <span className="strip-label">Critical Vulnerabilities</span>
                            <span className="strip-sub">Zero-Days &amp; Exploits</span>
                        </div>
                        <div className="strip-divider hidden md:block"></div>
                        <div className="strip-stat">
                            <span className="strip-num text-amber-600">{highCount}<span className="strip-sup text-amber-600"> High</span></span>
                            <span className="strip-label">High Severity</span>
                            <span className="strip-sub">Active Triage SLA</span>
                        </div>
                        <div className="strip-divider hidden md:block"></div>
                        <div className="strip-stat">
                            <span className="strip-num">{uniqueSources || 18}<span className="strip-sup"> Feeds</span></span>
                            <span className="strip-label">Active Sources</span>
                            <span className="strip-sub">CISA, Bleeping, THN</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid Section (Critical or Filtered) */}
            {showGrid && gridItems.length > 0 && (
                <div className={`metric-card p-4 sm:p-5 ${mode === 'critical' || showFilteredList ? 'flex-1 flex flex-col' : 'flex-none'}`}>
                    <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#E2E8F0]">
                        <div className="flex items-center gap-2">
                            {severityFilter ? (
                                <div className={`w-3 h-3 rounded-full ${getSeverityColor(severityFilter).split(' ')[0].replace('text-', 'bg-')}`} />
                            ) : (
                                <Flame className="w-5 h-5 text-red-600 animate-pulse" />
                            )}
                            <h3 className={`font-display text-base sm:text-lg font-bold ${severityFilter ? 'text-[#0F172A]' : 'text-red-700'}`}>
                                {severityFilter ? `${severityFilter} Threats` : 'Critical & Escalated Threats'}
                            </h3>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-[#E2E8F0]">
                            {gridItems.length} items
                        </span>
                    </div>

                    <div className={`grid gap-3.5 ${mode === 'critical' || showFilteredList ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {gridItems.map((item, index) => (
                            <a
                                key={index}
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block bg-white hover:bg-slate-50 border border-[#E2E8F0] hover:border-blue-300 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/50 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-center mb-2.5">
                                    <span className={`uppercase font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityColor(item.severity)}`}>
                                        {item.severity || 'Info'}
                                    </span>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h4 className="font-display font-bold text-slate-900 group-hover:text-blue-700 text-sm mb-1.5 line-clamp-2 leading-snug">
                                    {item.title}
                                </h4>
                                {item.contentSnippet && (
                                    <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed mb-3">
                                        {item.contentSnippet}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                                    <span className="font-semibold text-slate-700">{item.source}</span>
                                    <span>•</span>
                                    <span>{formatDateLabel(item.pubDate)}</span>
                                    {item.category && item.category !== 'General Info' && (
                                        <span className="ml-auto text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 truncate max-w-[120px]">
                                            {item.category}
                                        </span>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline Feed (List) */}
            {showList && (
                <div className={isEmbedded ? "metric-card p-4 sm:p-5 flex flex-col" : "metric-card p-5 flex-1 min-h-0 flex flex-col"}>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0]">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-blue-700" />
                            </div>
                            <h3 className="font-display text-base sm:text-lg font-bold text-[#0F172A]">
                                Intelligence Timeline
                            </h3>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-[#E2E8F0]">
                            Chronological Feed
                        </span>
                    </div>

                    <div className={isEmbedded ? "space-y-6" : "flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6"}>
                        {loading ? (
                            <div className="text-slate-500 text-center py-16 text-sm animate-pulse flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span>Ingesting real-time threat intelligence feeds...</span>
                            </div>
                        ) : error ? (
                            <div className="text-center py-16 space-y-2">
                                <p className="text-3xl">⚠️</p>
                                <p className="text-red-600 font-semibold text-sm">Failed to load news feed</p>
                                <p className="text-slate-500 text-xs font-mono">{error}</p>
                            </div>
                        ) : (
                            Object.entries(groupedListItems).map(([dateLabel, items]) => (
                                <div key={dateLabel} className="space-y-2.5">
                                    <div className="sticky top-0 bg-white/95 backdrop-blur py-1.5 px-3 rounded-lg z-10 border border-[#E2E8F0] flex items-center justify-between shadow-sm">
                                        <span className="text-xs font-bold text-blue-800 uppercase tracking-wider font-mono">
                                            {dateLabel}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {items.length} updates
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {items.map((item, idx) => (
                                            <a
                                                key={idx}
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group block bg-white hover:bg-slate-50/80 p-3.5 rounded-xl border border-[#E2E8F0] hover:border-blue-300 transition-all hover:translate-x-1 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-display text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                                                            {item.title}
                                                        </h4>
                                                        <div className="flex items-center gap-2.5 mt-2 text-[11px] text-slate-500 font-mono">
                                                            <span className="text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{item.source}</span>
                                                            <span>{new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {item.severity && item.severity !== 'Low' && (
                                                                <span className={`px-2 py-0.5 rounded border font-semibold ${getSeverityColor(item.severity)}`}>
                                                                    {item.severity}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsFeed;
