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
}

const NewsFeed = ({ mode = 'all', severityFilter }: NewsFeedProps) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    useEffect(() => {
        const fetchNews = () => {
            fetch(`${API_BASE}/api/news`)
                .then(res => res.json())
                .then(data => {
                    const items = Array.isArray(data) ? data : (data.news || []);
                    setNews(items);
                    setLoading(false);
                    setLastUpdated(new Date());
                })
                .catch(err => {
                    console.error('Error fetching news:', err);
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
            case 'Critical': return 'text-red-500 border-red-500/30 bg-red-500/10';
            case 'High': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
            case 'Medium': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
            case 'Low': return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
            default: return 'text-slate-400 border-slate-700 bg-slate-800';
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

    return (
        <div className="h-full flex flex-col gap-3">

            {/* Grid Section (Critical or Filtered) */}
            {showGrid && gridItems.length > 0 && (
                <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-3 custom-scrollbar ${mode === 'critical' || showFilteredList ? 'h-full flex flex-col' : 'flex-none max-h-[160px] overflow-y-auto'}`}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-900/90 backdrop-blur z-10 py-1 flex-none">
                        {severityFilter ? (
                            <div className={`w-3 h-3 rounded-full ${getSeverityColor(severityFilter).split(' ')[0].replace('text-', 'bg-')}`} />
                        ) : (
                            <Flame className="w-5 h-5 text-red-500 animate-pulse" />
                        )}
                        <h3 className={`text-lg font-bold ${severityFilter ? 'text-slate-200' : 'text-red-400'}`}>
                            {severityFilter ? `${severityFilter} Threats` : 'Critical Threats'}
                        </h3>
                    </div>
                    <div className={`grid gap-3 ${mode === 'critical' || showFilteredList ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-y-auto pr-2 custom-scrollbar p-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {gridItems.map((item, index) => (
                            <a key={index} href={item.link} target="_blank" rel="noopener noreferrer"
                                className={`block bg-slate-800/40 border border-slate-700/50 rounded hover:border-cyan-500/50 transition-colors group h-fit ${mode === 'critical' ? 'p-6' : 'p-3'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`uppercase font-bold rounded border ${getSeverityColor(item.severity)} ${mode === 'critical' ? 'text-sm px-3 py-1' : 'text-[10px] px-1.5 py-0.5'}`}>
                                        {item.severity}
                                    </span>
                                    <ExternalLink className={`text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ${mode === 'critical' ? 'w-5 h-5' : 'w-3 h-3'}`} />
                                </div>
                                <h4 className={`font-bold text-slate-200 group-hover:text-cyan-400 ${mode === 'critical' ? 'text-xl mb-2' : 'text-sm mb-1 truncate'}`}>{item.title}</h4>
                                {item.contentSnippet && (
                                    <p className={`text-slate-400 mt-1 leading-relaxed opacity-80 ${mode === 'critical' ? 'text-base line-clamp-4' : 'text-xs line-clamp-2'}`}>{item.contentSnippet}</p>
                                )}
                                <div className={`flex items-center gap-2 mt-2 ${mode === 'critical' ? 'text-sm' : 'text-[10px]'}`}>
                                    <span className="text-slate-500 font-medium">{item.source}</span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-slate-500">{formatDateLabel(item.pubDate)}</span>
                                    {item.category && item.category !== 'General Info' && (
                                        <>
                                            <span className="text-slate-600">•</span>
                                            <span className="text-cyan-400/80 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50">{item.category}</span>
                                        </>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline Feed (List) */}
            {showList && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-6 flex-none">
                        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                            <Calendar className="w-6 h-6 text-cyan-500" />
                            Latest Security Feed
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 items-end">
                            {lastUpdated && (
                                <span className="text-xs text-slate-500 font-mono">
                                    Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            )}
                            <span className="text-sm text-slate-500 font-medium bg-slate-800 px-3 py-1 rounded-full">
                                Auto-updates every 30m
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                        {loading ? (
                            <div className="text-slate-500 text-center py-20 text-lg animate-pulse">Loading Intelligence Feed...</div>
                        ) : (
                            Object.entries(groupedListItems).map(([dateLabel, items]) => (
                                <div key={dateLabel} className="mb-8 last:mb-0">
                                    <div className="sticky top-0 bg-slate-900/95 backdrop-blur py-3 z-10 border-b border-slate-800 mb-4">
                                        <span className="text-sm font-bold text-cyan-400 uppercase tracking-widest pl-2 border-l-4 border-cyan-500">{dateLabel}</span>
                                    </div>
                                    <div className="space-y-4">
                                        {items.map((item, idx) => (
                                            <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block group bg-slate-800/20 p-4 rounded-xl border border-transparent hover:border-slate-700 transition-all hover:bg-slate-800/40">
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-lg font-bold text-slate-200 group-hover:text-cyan-400 transition-colors leading-snug">
                                                            {item.title}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500 font-mono">
                                                            <span className="text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded">{item.source}</span>
                                                            <span>{new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {item.severity && item.severity !== 'Low' && (
                                                                <span className={`px-2 py-0.5 rounded border font-bold ${getSeverityColor(item.severity)}`}>{item.severity}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-5 h-5 text-slate-600 group-hover:text-cyan-500 transition-colors opacity-0 group-hover:opacity-100 flex-none mt-1" />
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
