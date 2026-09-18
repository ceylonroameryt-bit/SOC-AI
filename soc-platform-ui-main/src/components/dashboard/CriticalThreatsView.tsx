import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, Activity, Zap, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_BASE } from '../../config/api';

interface NewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    severity?: string;
    contentSnippet?: string;
}

interface SeverityStat {
    name: string;
    count: number;
}

const COLORS = {
    Critical: '#ef4444', // Red
    High: '#f97316',     // Orange
    Medium: '#eab308',   // Yellow
    Low: '#3b82f6'       // Blue
};

const CriticalThreatsView = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [chartData, setChartData] = useState<SeverityStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [newsRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/news`),
                    fetch(`${API_BASE}/api/news/stats`)
                ]);
                const newsData = newsRes.ok ? await newsRes.json() : [];
                const statsData = statsRes.ok ? await statsRes.json() : [];

                setNews(Array.isArray(newsData) ? newsData : (Array.isArray(newsData?.news) ? newsData.news : []));
                setChartData(Array.isArray(statsData) ? statsData : []);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                setNews([]);
                setChartData([]);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const criticalItems = news.filter(item => item.severity === 'Critical');
    const highItems = news.filter(item => item.severity === 'High');

    // Calculate Threat Level
    const threatScore = (criticalItems.length * 3) + (highItems.length * 1);
    let threatLevel = "LOW";
    let threatColor = "text-blue-700 border-blue-300 bg-blue-50";

    if (threatScore > 5) { threatLevel = "ELEVATED"; threatColor = "text-amber-700 border-amber-300 bg-amber-50"; }
    if (threatScore > 10) { threatLevel = "HIGH"; threatColor = "text-orange-700 border-orange-300 bg-orange-50"; }
    if (threatScore > 20) { threatLevel = "CRITICAL"; threatColor = "text-red-700 border-red-300 bg-red-50"; }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
    );

    return (
        <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-2 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="section-label">Incident Response</span>
                        <div className="availability-chip text-[10px] py-0.5 px-2">
                            <span className="chip-dot"></span>
                            <span>Triage Level: {threatLevel}</span>
                        </div>
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Critical Threat Escalation
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">
                        High-priority vulnerabilities, active exploit indicators, and urgent mitigation advisories.
                    </p>
                </div>
            </div>

            {/* Top Section: Analysis & Chart */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* SOC Widget: Threat Level */}
                <div className="metric-card md:col-span-1 p-5 flex flex-col justify-center items-center relative overflow-hidden bg-white">
                    <div className="absolute top-0 right-0 p-3 opacity-5 text-blue-900 pointer-events-none">
                        <Activity className="w-28 h-28" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 font-mono">Current Threat Condition</div>
                    <div className={`font-display text-3xl md:text-4xl font-black px-6 py-2.5 rounded-xl border-2 ${threatColor} shadow-md tracking-wider`}>
                        {threatLevel}
                    </div>
                    <div className="mt-4 flex gap-4 text-xs font-mono text-slate-500">
                        <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-red-600" /> <strong className="text-slate-800">{criticalItems.length}</strong> Critical</div>
                        <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-orange-600" /> <strong className="text-slate-800">{highItems.length}</strong> High</div>
                    </div>
                </div>

                {/* Small Chart */}
                <div className="metric-card md:col-span-2 p-5 flex flex-col bg-white">
                    <h3 className="font-display text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        Live Severity Breakdown
                    </h3>
                    <div className="flex-1 min-h-[120px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={70} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
                                    cursor={{ fill: '#f8fafc', opacity: 0.8 }}
                                />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Split Sections */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Left: Critical */}
                <div className="flex flex-col bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-red-50/70 border-b border-red-200 flex items-center justify-between sticky top-0 backdrop-blur z-10">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
                            <h3 className="font-display font-bold text-red-800 uppercase tracking-wide text-xs sm:text-sm">Critical Priority</h3>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200 font-semibold">
                            {criticalItems.length} active
                        </span>
                    </div>
                    <div className="overflow-y-auto p-3 space-y-2.5 flex-1 custom-scrollbar bg-slate-50/40">
                        {criticalItems.length === 0 ? (
                            <div className="text-center text-slate-500 py-12 text-sm font-mono">No Critical Threats Detected</div>
                        ) : (
                            criticalItems.map((item, idx) => (
                                <NewsCard key={idx} item={item} colorClass="bg-red-50 border-red-200 text-red-700" />
                            ))
                        )}
                    </div>
                </div>

                {/* Right: High */}
                <div className="flex flex-col bg-white border border-orange-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-3.5 bg-orange-50/70 border-b border-orange-200 flex items-center justify-between sticky top-0 backdrop-blur z-10">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                            <h3 className="font-display font-bold text-orange-800 uppercase tracking-wide text-xs sm:text-sm">High Priority</h3>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200 font-semibold">
                            {highItems.length} active
                        </span>
                    </div>
                    <div className="overflow-y-auto p-3 space-y-2.5 flex-1 custom-scrollbar bg-slate-50/40">
                        {highItems.length === 0 ? (
                            <div className="text-center text-slate-500 py-12 text-sm font-mono">No High Priority Threats Detected</div>
                        ) : (
                            highItems.map((item, idx) => (
                                <NewsCard key={idx} item={item} colorClass="bg-orange-50 border-orange-200 text-orange-700" />
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper Component for consistency
const NewsCard = ({ item, colorClass }: { item: NewsItem, colorClass: string }) => (
    <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white border border-slate-200 hover:border-blue-300 p-3.5 rounded-xl hover:bg-slate-50 transition-all duration-200 group hover:-translate-y-0.5 shadow-sm"
    >
        <div className="flex justify-between items-start gap-3">
            <h4 className="font-display text-sm font-bold text-slate-900 group-hover:text-blue-700 leading-snug">{item.title}</h4>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-none mt-1" />
        </div>

        {item.contentSnippet && (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">{item.contentSnippet}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-500">
            <span>{item.source} • {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className={`px-2 py-0.5 rounded border uppercase font-bold text-[9px] ${colorClass}`}>
                {item.severity}
            </span>
        </div>
    </a>
);

export default CriticalThreatsView;
