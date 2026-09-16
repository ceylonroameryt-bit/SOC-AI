import { useState, useEffect } from 'react';
import { Database, FileText, Search, ShieldAlert, Globe } from 'lucide-react';
import { API_BASE } from '../config/api';

interface ThreatItem {
    id: string;
    type: string;
    severity: string;
    source: string;
    description: string;
    timestamp: string;
}

interface NewsItem {
    title: string;
    source: string;
    link: string;
    pubDate: string;
    severity?: string;
}

const Archives = () => {
    const [activeTab, setActiveTab] = useState<'threats' | 'news'>('threats');
    const [threats, setThreats] = useState<ThreatItem[]>([]);
    const [news, setNews] = useState<NewsItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [threatsRes, newsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/threats`),
                    fetch(`${API_BASE}/api/news`)
                ]);
                const threatsData = await threatsRes.json();
                const newsData = await newsRes.json();
                setThreats(Array.isArray(threatsData) ? threatsData : []);
                setNews(Array.isArray(newsData) ? newsData : (Array.isArray(newsData?.news) ? newsData.news : []));
            } catch (error) {
                console.error('Error loading archives:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const getSeverityColor = (severity?: string) => {
        switch (severity) {
            case 'Critical': return 'text-red-700 border-red-200 bg-red-50';
            case 'High': return 'text-orange-700 border-orange-200 bg-orange-50';
            case 'Medium': return 'text-yellow-800 border-yellow-200 bg-yellow-50';
            case 'Low': return 'text-blue-700 border-blue-200 bg-blue-50';
            default: return 'text-slate-700 border-slate-200 bg-slate-100';
        }
    };

    const filteredThreats = threats.filter(t =>
        t.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredNews = news.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar bg-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="section-label">Historical Logs</span>
                        <span className="availability-chip">
                            <span className="chip-dot"></span>
                            {threats.length + news.length} Indexed Records
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                        <Database className="w-8 h-8 text-[#1E3A8A]" />
                        Data Archives
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Full immutable history of detected threats and normalized intelligence feeds</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search archives..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 text-sm rounded-xl pl-10 pr-4 py-2 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] outline-none w-full sm:w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 border-b border-[#E2E8F0] pb-2">
                <button
                    onClick={() => setActiveTab('threats')}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'threats'
                            ? 'bg-[#1E3A8A] text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    Threat History ({threats.length})
                </button>
                <button
                    onClick={() => setActiveTab('news')}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all ${
                        activeTab === 'news'
                            ? 'bg-[#1E3A8A] text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <Globe className="w-4 h-4" />
                    News Logs ({news.length})
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar pb-12">
                {loading ? (
                    <div className="text-center py-20 text-slate-500 font-medium animate-pulse">Loading archives...</div>
                ) : (
                    <>
                        {activeTab === 'threats' && (
                            <div className="space-y-3.5">
                                {filteredThreats.map((t, idx) => (
                                    <div key={idx} className="metric-card">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase border ${getSeverityColor(t.severity)}`}>
                                                    {t.severity}
                                                </span>
                                                <span className="text-slate-900 font-bold font-display text-base">{t.type}</span>
                                            </div>
                                            <span className="text-xs text-slate-400 font-mono">{new Date(t.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-2 leading-relaxed">{t.description}</p>
                                        <div className="text-xs text-slate-400 font-mono">
                                            Source: <span className="text-slate-700 font-semibold">{t.source}</span> | ID: <span className="text-blue-900">{t.id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'news' && (
                            <div className="space-y-3.5">
                                {filteredNews.map((n, idx) => (
                                    <div key={idx} className="metric-card flex justify-between items-center gap-4">
                                        <div className="flex-1">
                                            <h4 className="text-slate-900 font-semibold text-base hover:text-[#1E3A8A] transition-colors">
                                                <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a>
                                            </h4>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span className="font-medium text-slate-700">{n.source}</span>
                                                <span>•</span>
                                                <span>{new Date(n.pubDate).toLocaleString()}</span>
                                                {n.severity && (
                                                    <span className={`${getSeverityColor(n.severity)} px-2 py-0.5 rounded text-[10px] font-bold uppercase border`}>
                                                        {n.severity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <a
                                            href={n.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2.5 text-slate-400 hover:text-[#1E3A8A] hover:bg-slate-100 rounded-xl transition-colors shrink-0"
                                        >
                                            <FileText className="w-5 h-5" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Archives;
