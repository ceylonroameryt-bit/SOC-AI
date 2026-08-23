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
            .then(res => res.json())
            .then(data => setData(data))
            .catch(err => console.error('Error fetching stats:', err));
    }, []);

    const handleBarClick = (entry: any) => {
        if (selectedSeverity === entry.name) {
            setSelectedSeverity(null); // Deselect
        } else {
            setSelectedSeverity(entry.name);
        }
    };

    return (
        <div className="h-full flex flex-col gap-4">
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col ${selectedSeverity ? 'h-1/2' : 'h-full transition-all duration-300'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <h3 className="text-sm font-semibold text-slate-100">
                        Monthly Threat Severity
                    </h3>
                    <div className="flex bg-slate-800/50 p-1 rounded-lg">
                        {['Critical', 'High', 'Medium', 'Low'].map((severity) => (
                            <button
                                key={severity}
                                onClick={() => setSelectedSeverity(selectedSeverity === severity ? null : severity)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${selectedSeverity === severity
                                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                                    }`}
                            >
                                {severity}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} onClick={(state: any) => {
                            if (state && state.activePayload) {
                                handleBarClick(state.activePayload[0].payload);
                            }
                        }}>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                                cursor={{ fill: '#334155', opacity: 0.4 }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={60}>
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
                {!selectedSeverity && <p className="text-xs text-slate-500 text-center mt-2">Click a bar to filter news</p>}
            </div>

            {selectedSeverity && (
                <div className="flex-1 min-h-0 animate-in slide-in-from-bottom duration-300 fade-in">
                    <div className="h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-200">
                                {selectedSeverity} Items
                            </h4>
                            <button onClick={() => setSelectedSeverity(null)} className="text-xs text-slate-400 hover:text-white">
                                Close
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 p-2">
                            {/* Import NewsFeed locally to avoid circular dependencies if any, but standard import should work */}
                            <NewsFeed mode="timeline" severityFilter={selectedSeverity} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeverityChart;
