import { useState, useEffect } from 'react';
import { Radio, Shield, Globe, ExternalLink, Search } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config/api';

interface Source {
    name: string;
    url: string;
    type: string;
    category: string;
    status?: string;
    description?: string;
}

const Sources = () => {
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const fetchSources = async () => {
            try {
                const response = await axios.get(`${API_BASE}/api/sources`);
                setSources(response.data);
            } catch (error) {
                console.error('Error fetching sources:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSources();
    }, []);

    const categories = Array.from(new Set(sources.map(s => s.category)));

    const filteredSources = sources.filter(source => {
        const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            source.type.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory ? source.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto custom-scrollbar bg-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="section-label">Feed Ingestion</span>
                        <span className="availability-chip">
                            <span className="chip-dot"></span>
                            {sources.length} Active Feeds
                        </span>
                    </div>
                    <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                        <Radio className="w-8 h-8 text-[#1E3A8A]" />
                        Intelligence Sources
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Active data collection nodes and automated ingest points across clear and dark web networks
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search sources..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-[#CBD5E1] text-slate-800 pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] w-full sm:w-64 shadow-sm"
                        />
                    </div>
                    <select
                        value={selectedCategory || ''}
                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                        className="bg-white border border-[#CBD5E1] text-slate-800 px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] shadow-sm font-medium"
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dark Web Methodology Section */}
            <div className="bg-slate-50 border border-[#E2E8F0] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100/80 rounded-xl text-[#1E3A8A]">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold font-display text-slate-900">Dark Web & Hidden Services Collection</h2>
                        <p className="text-xs text-slate-500">Methodology used to monitor underground cyber intelligence</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3">
                    <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-1.5 flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                            Tor Network Crawling
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Collectors utilize <span className="font-semibold text-slate-800">Tor proxies</span> to route traffic to <strong>.onion</strong> hidden services, indexing ransomware leak sites and darknet forums.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-1.5 flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                            Marketplace Monitoring
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Automated crawlers track illicit marketplaces for credential dumps, initial access broker listings, and compromised infrastructure.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-1.5 flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-700"></span>
                            Chat & Telegram Scraping
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Continuous ingestion from open and invite-only <span className="font-semibold text-slate-800">threat actor channels</span> where threat groups claim DDoS and breach activity.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-slate-500 animate-pulse font-medium">
                        Loading Source Database...
                    </div>
                ) : filteredSources.map((source, index) => (
                    <div key={index} className="metric-card flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[#1E3A8A] group-hover:bg-[#1E3A8A] group-hover:text-white transition-colors">
                                    {source.category === 'Government' ? <Shield className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                                </div>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1E3A8A] transition-colors"
                                        title="Visit Source Website"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Active
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-base font-bold font-display text-slate-900 mb-1.5 group-hover:text-[#1E3A8A] transition-colors truncate" title={source.name}>
                                {source.name}
                            </h3>
                        </div>

                        <div className="flex flex-col gap-1 mt-4 pt-3 border-t border-[#E2E8F0]">
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span className="font-mono text-[11px]">{source.type}</span>
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium text-[10px]">
                                    {source.category}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sources;
