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
                const newsData = await newsRes.json();
                const statsData = await statsRes.json();

                setNews(newsData);
                setChartData(statsData);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
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
    let threatColor = "text-blue-500 border-blue-500/30 bg-blue-500/10";

    if (threatScore > 5) { threatLevel = "ELEVATED"; threatColor = "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"; }
    if (threatScore > 10) { threatLevel = "HIGH"; threatColor = "text-orange-500 border-orange-500/30 bg-orange-500/10"; }
    if (threatScore > 20) { threatLevel = "CRITICAL"; threatColor = "text-red-500 border-red-500/30 bg-red-500/10"; }

    if (loading) return <div className="text-slate-500 text-center py-20">Loading Intelligence...</div>;

    return (
        <div className="h-full flex flex-col gap-4">

            {/* Top Section: Analysis & Chart */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4 h-48 md:h-56">

                {/* SOC Widget: Threat Level */}
                <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Activity className="w-24 h-24" />
                    </div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Current Threat Level</div>
                    <div className={`text-3xl md:text-4xl font-black px-6 py-2 rounded-lg border-2 ${threatColor} shadow-lg shadow-current/20 animate-pulse`}>
                        {threatLevel}
                    </div>
                    <div className="mt-4 flex gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-500" /> {criticalItems.length} Critical</div>
                        <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-orange-500" /> {highItems.length} High</div>
                    </div>
                </div>

                {/* Small Chart */}
                <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                    <h3 className="text-sm font-semibold text-slate-100 mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-500" />
                        Live Severity Distribution
                    </h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" stroke="#475569" fontSize={10} hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={60} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
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
                <div className="flex flex-col bg-red-950/10 border border-red-900/30 rounded-xl overflow-hidden">
                    <div className="p-3 bg-red-950/20 border-b border-red-900/30 flex items-center gap-2 sticky top-0 backdrop-blur z-10">
                        <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                        <h3 className="font-bold text-red-400 uppercase tracking-wide text-sm">Critical Priority</h3>
                    </div>
                    <div className="overflow-y-auto p-3 space-y-2 flex-1 custom-scrollbar">
                        {criticalItems.length === 0 ? (
                            <div className="text-center text-slate-500 py-10 text-sm">No Critical Threats Detected</div>
                        ) : (
                            criticalItems.map((item, idx) => (
                                <NewsCard key={idx} item={item} colorClass="bg-red-500/10 border-red-500/20 text-red-400" />
                            ))
                        )}
                    </div>
                </div>

                {/* Right: High */}
                <div className="flex flex-col bg-orange-950/10 border border-orange-900/30 rounded-xl overflow-hidden">
                    <div className="p-3 bg-orange-950/20 border-b border-orange-900/30 flex items-center gap-2 sticky top-0 backdrop-blur z-10">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <h3 className="font-bold text-orange-400 uppercase tracking-wide text-sm">High Priority</h3>
                    </div>
                    <div className="overflow-y-auto p-3 space-y-2 flex-1 custom-scrollbar">
                        {highItems.length === 0 ? (
                            <div className="text-center text-slate-500 py-10 text-sm">No High Priority Threats Detected</div>
                        ) : (
                            highItems.map((item, idx) => (
                                <NewsCard key={idx} item={item} colorClass="bg-orange-500/10 border-orange-500/20 text-orange-400" />
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
    <a href={item.link} target="_blank" rel="noopener noreferrer"
        className="block bg-slate-900/40 border border-slate-800 p-3 rounded-lg hover:bg-slate-800 transition-colors group">
        <div className="flex justify-between items-start gap-3">
            <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 leading-snug">{item.title}</h4>
            <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex-none mt-1" />
        </div>

        {item.contentSnippet && (
            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed opacity-90">{item.contentSnippet}</p>
        )}

        <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500">
            <span>{item.source} • {new Date(item.pubDate).toLocaleTimeString()}</span>
            <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] ${colorClass}`}>
                {item.severity}
            </span>
        </div>
    </a>
);

export default CriticalThreatsView;
