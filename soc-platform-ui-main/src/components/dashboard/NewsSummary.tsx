import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, FileText, Activity, Globe } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface NewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    severity?: string;
    contentSnippet?: string;
}

const NewsSummary = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/api/news`)
            .then(res => res.json())
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching news:', err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="text-slate-500 text-center py-20">Generating Briefing...</div>;

    // Analysis
    const criticalItems = news.filter(i => i.severity === 'Critical');
    const highItems = news.filter(i => i.severity === 'High');

    const totalAlerts = news.length;
    const uniqueSources = Array.from(new Set(news.map(i => i.source)));

    // Auto-Summary Generation
    const generateSummary = () => {
        if (totalAlerts === 0) return "No significant threats detected in the last 24 hours. Global cyber activity appears nominal.";

        const criticalCount = criticalItems.length + highItems.length;
        const severityStatus = criticalCount > 0 ? "ELEVATED" : "NORMAL";

        let summary = `Current Threat Level is ${severityStatus}. System has aggregated ${totalAlerts} distinct intelligence items from ${uniqueSources.length} global sources. `;

        if (criticalCount > 0) {
            summary += `Primary concerns involve ${criticalCount} Critical/High severity alerts, specifically targeting systems mentioned in headers like "${criticalItems[0]?.title || highItems[0]?.title}". `;
        } else {
            summary += "No critical vulnerabilities reported. Monitoring standard low-level chatter. ";
        }

        return summary;
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar">

            {/* Header / Stats Row */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-100">{totalAlerts}</div>
                        <div className="text-xs text-slate-500">Total Intel Items</div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/10 text-red-400">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-100">{criticalItems.length + highItems.length}</div>
                        <div className="text-xs text-slate-500">Critical & High Threats</div>
                    </div>
                </div>
                <Link to="/sources" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4 hover:border-emerald-500/50 transition-colors cursor-pointer group">
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-100">{uniqueSources.length}</div>
                        <div className="text-xs text-slate-500 group-hover:text-emerald-400 transition-colors">Active Sources &rarr;</div>
                    </div>
                </Link>
            </div>

            {/* AI Summary Section */}
            <div className="bg-slate-900/50 border border-cyan-500/20 rounded-xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5" />
                    Executive Summary
                </h3>
                <p className="text-slate-300 leading-relaxed text-sm md:text-base">
                    {generateSummary()}
                </p>
                <div className="mt-4 flex gap-2">
                    {uniqueSources.map(s => (
                        <span key={s} className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-1 rounded">
                            {s}
                        </span>
                    ))}
                </div>
            </div>

            {/* Critical Breakdown */}
            {(criticalItems.length > 0 || highItems.length > 0) && (
                <div className="flex-1 min-h-0 bg-red-950/10 border border-red-900/30 rounded-xl p-6">
                    <h3 className="text-base font-bold text-red-400 mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" />
                        Priority Incident Report
                    </h3>
                    <div className="space-y-3">
                        {[...criticalItems, ...highItems].map((item, idx) => (
                            <div key={idx} className="bg-slate-950/50 border border-red-900/20 p-3 rounded-lg flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-medium text-slate-200">{item.title}</h4>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {item.contentSnippet && (
                                            <p className="text-slate-400 mb-1 line-clamp-2 leading-relaxed opacity-90">{item.contentSnippet}</p>
                                        )}
                                        Source: <span className="text-slate-400">{item.source}</span> • {new Date(item.pubDate).toLocaleTimeString()}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${item.severity === 'Critical'
                                    ? 'border-red-500 text-red-500 bg-red-500/10'
                                    : 'border-orange-500 text-orange-500 bg-orange-500/10'
                                    }`}>
                                    {item.severity}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewsSummary;
