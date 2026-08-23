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
                setThreats(threatsData);
                setNews(newsData);
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
            case 'Critical': return 'text-red-400 border-red-500/30 bg-red-500/10';
            case 'High': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
            case 'Medium': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
            case 'Low': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
            default: return 'text-slate-400 border-slate-700 bg-slate-800';
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
        <div className="h-full flex flex-col gap-6 p-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Database className="w-6 h-6 text-cyan-500" />
                        Data Archives
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Full history of detected threats and intelligence feed.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search archives..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:ring-1 focus:ring-cyan-500 outline-none w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('threats')}
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'threats' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    Threat History ({threats.length})
                </button>
                <button
                    onClick={() => setActiveTab('news')}
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'news' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                    <Globe className="w-4 h-4" />
                    News Logs ({news.length})
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar pr-2">
                {loading ? (
                    <div className="text-center py-20 text-slate-500">Loading archives...</div>
                ) : (
                    <>
                        {activeTab === 'threats' && (
                            <div className="space-y-3">
                                {filteredThreats.map((t, idx) => (
                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded textxs font-bold uppercase border ${getSeverityColor(t.severity)}`}>
                                                    {t.severity}
                                                </span>
                                                <span className="text-slate-300 font-medium">{t.type}</span>
                                            </div>
                                            <span className="text-xs text-slate-500 font-mono">{new Date(t.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-400 mb-2">{t.description}</p>
                                        <div className="text-xs text-slate-500">Source: {t.source} | ID: {t.id}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'news' && (
                            <div className="space-y-3">
                                {filteredNews.map((n, idx) => (
                                    <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-all flex justify-between gap-4">
                                        <div className="flex-1">
                                            <h4 className="text-slate-200 font-medium hover:text-cyan-400 transition-colors">
                                                <a href={n.link} target="_blank" rel="noopener noreferrer">{n.title}</a>
                                            </h4>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span>{n.source}</span>
                                                <span>{new Date(n.pubDate).toLocaleString()}</span>
                                                {n.severity && (
                                                    <span className={`${getSeverityColor(n.severity)} px-1.5 rounded border`}>
                                                        {n.severity}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <a href={n.link} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-cyan-400">
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
