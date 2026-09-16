import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import NewsFeed from './NewsFeed';
import { API_BASE } from '../../config/api';

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

const SeverityChart = () => {
    const [data, setData] = useState<SeverityStat[]>([]);
    const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/news/stats`)
            .then(res => {
                if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setData(data);
            })
            .catch(err => console.error('Error fetching stats:', err));
    }, []);

    const handleBarClick = (entry: { name: string }) => {
        if (selectedSeverity === entry.name) {
            setSelectedSeverity(null); // Deselect
        } else {
            setSelectedSeverity(entry.name);
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4 lg:p-6 overflow-y-auto custom-scrollbar max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-2 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="section-label">Severity Analytics</span>
                        <div className="availability-chip text-[10px] py-0.5 px-2">
                            <span className="chip-dot"></span>
                            <span>Historical Aggregation</span>
                        </div>
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Threat Severity Distribution
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">
                        Breakdown of incoming intelligence categorized by operational impact and required response SLA.
                    </p>
                </div>
            </div>

            <div className={`metric-card p-5 flex flex-col bg-white ${selectedSeverity ? 'h-1/2' : 'h-full min-h-[380px] transition-all duration-300'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <h3 className="font-display text-base font-bold text-slate-900">
                        Incident Volume by Priority
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {['Critical', 'High', 'Medium', 'Low'].map((severity) => (
                            <button
                                key={severity}
                                onClick={() => setSelectedSeverity(selectedSeverity === severity ? null : severity)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedSeverity === severity
                                    ? 'btn-accent shadow-md shadow-blue-500/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                    }`}
                            >
                                {severity}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} onClick={(state) => {
                            if (state && 'activePayload' in state) {
                                const chartState = state as { activePayload?: Array<{ payload: SeverityStat }> };
                                if (chartState.activePayload?.[0]?.payload) {
                                    handleBarClick(chartState.activePayload[0].payload);
                                }
                            }
                        }}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
                                cursor={{ fill: '#f8fafc', opacity: 0.8 }}
                            />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={54}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[entry.name as keyof typeof COLORS] || '#94a3b8'}
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        opacity={selectedSeverity && selectedSeverity !== entry.name ? 0.3 : 1}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                {!selectedSeverity && <p className="text-xs text-slate-500 text-center mt-2 font-mono">Click a bar to filter live disclosures</p>}
            </div>

            {selectedSeverity && (
                <div className="flex-1 min-h-[300px] animate-in slide-in-from-bottom duration-300 fade-in">
                    <div className="h-full metric-card overflow-hidden flex flex-col p-0 bg-white">
                        <div className="p-3.5 border-b border-[#E2E8F0] bg-slate-50 flex justify-between items-center">
                            <h4 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                {selectedSeverity} Priority Items
                            </h4>
                            <button onClick={() => setSelectedSeverity(null)} className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-white border border-[#E2E8F0] shadow-sm font-medium">
                                Clear filter ✕
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <NewsFeed severityFilter={selectedSeverity} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeverityChart;
