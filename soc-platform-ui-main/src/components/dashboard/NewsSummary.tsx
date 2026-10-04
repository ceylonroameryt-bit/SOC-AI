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
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                setNews(Array.isArray(data) ? data : (Array.isArray(data?.news) ? data.news : []));
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching news:', err);
                setNews([]);
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
        <div className="h-full flex flex-col gap-5 p-4 lg:p-6 overflow-y-auto custom-scrollbar bg-white">

            {/* Header / Stats Row */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="metric-card flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-display text-slate-900">{totalAlerts}</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Intel Items</div>
                    </div>
                </div>
                <div className="metric-card flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-100">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-display text-slate-900">{criticalItems.length + highItems.length}</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical & High Threats</div>
                    </div>
                </div>
                <Link to="/sources" className="metric-card flex items-center gap-4 hover:border-blue-400/50 transition-all cursor-pointer group">
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                        <Globe className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold font-display text-slate-900">{uniqueSources.length}</div>
                        <div className="text-xs font-semibold text-slate-500 group-hover:text-blue-700 transition-colors">Active Sources &rarr;</div>
                    </div>
                </Link>
            </div>

            {/* AI Summary Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1E3A8A]"></div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold font-display text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#1E3A8A]" />
                        Executive Intelligence Summary
                    </h3>
                    <span className="section-label">SOC Synthesis</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm md:text-base font-sans">
                    {generateSummary()}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {uniqueSources.map(s => (
                        <span key={s} className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                            {s}
                        </span>
                    ))}
                </div>
            </div>

            {/* Critical Breakdown */}
            {(criticalItems.length > 0 || highItems.length > 0) && (
                <div className="flex-1 min-h-0 bg-red-50/40 border border-red-200/80 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold font-display text-red-900 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-600" />
                            Priority Incident Escalation
                        </h3>
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200">
                            {criticalItems.length + highItems.length} Urgent Items
                        </span>
                    </div>
                    <div className="space-y-3">
                        {[...criticalItems, ...highItems].map((item, idx) => (
                            <div key={idx} className="bg-white border border-red-200/80 p-4 rounded-xl flex items-start justify-between gap-4 shadow-sm hover:shadow transition-shadow">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                                    {item.contentSnippet && (
                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{item.contentSnippet}</p>
                                    )}
                                    <div className="text-xs text-slate-400">
                                        Source: <span className="text-slate-700 font-medium">{item.source}</span> • {new Date(item.pubDate).toLocaleTimeString()}
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 border ${item.severity === 'Critical'
                                    ? 'border-red-300 text-red-700 bg-red-50'
                                    : 'border-orange-300 text-orange-700 bg-orange-50'
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
