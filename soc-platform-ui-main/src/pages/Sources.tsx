import { useState, useEffect } from 'react';
import { Radio, Shield, Globe, ExternalLink, Activity, Search } from 'lucide-react';
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
        <div className="h-full flex flex-col gap-6 p-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                        <Radio className="w-6 h-6 text-cyan-500" />
                        Intelligence Sources
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Active data collection points ({sources.length} Total)
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search sources..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-cyan-500 w-full sm:w-64"
                        />
                    </div>
                    <select
                        value={selectedCategory || ''}
                        onChange={(e) => setSelectedCategory(e.target.value || null)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dark Web Methodology Section */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 mb-6 mt-2">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-500/10 rounded-md">
                        <Globe className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-100">Dark Web & Hidden Services Collection</h2>
                        <p className="text-[10px] text-slate-400">Methodology used to monitor the underground economy</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-950/50 p-2.5 rounded border border-slate-800/50">
                        <h3 className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Tor Network Crawling
                        </h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Collectors utilize <span className="text-slate-300">Tor proxies</span> to route traffic to <strong>.onion</strong> hidden services, indexing ransomware leak sites and forums.
                        </p>
                    </div>

                    <div className="bg-slate-950/50 p-2.5 rounded border border-slate-800/50">
                        <h3 className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Marketplace Monitoring
                        </h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Automated bots monitor illicit marketplaces (e.g., <span className="text-slate-300">Genesis, Russian Market</span>) for credential dumps and compromised assets.
                        </p>
                    </div>

                    <div className="bg-slate-950/50 p-2.5 rounded border border-slate-800/50">
                        <h3 className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Chat & Telegram Scraping
                        </h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            Ingestion from public and invitation-only <span className="text-slate-300">Telegram channels</span> where threat actors coordinate attacks and leaks.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar pb-10">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-slate-500 animate-pulse">
                        Loading Source Database...
                    </div>
                ) : filteredSources.map((source, index) => (
                    <div key={index} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all group flex flex-col relative">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 bg-slate-800/50 rounded-lg group-hover:bg-cyan-500/10 transition-colors">
                                {source.category === 'Government' ? <Shield className="w-5 h-5 text-cyan-400" /> : <Globe className="w-5 h-5 text-cyan-400" />}
                            </div>
                            <div className="flex gap-2">
                                <a href={source.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-colors" title="Visit Source Website">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium h-fit">
                                    <Activity className="w-3 h-3" />
                                    Active
                                </span>
                            </div>
                        </div>

                        <h3 className="text-base font-bold text-slate-100 mb-1 group-hover:text-cyan-400 transition-colors truncate" title={source.name}>
                            {source.name}
                        </h3>

                        <div className="flex flex-col gap-1 mt-auto">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800 pt-2 mt-2">
                                <span>{source.type}</span>
                                <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{source.category}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Sources;
