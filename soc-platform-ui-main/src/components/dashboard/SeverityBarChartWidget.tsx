import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, X } from 'lucide-react';
import { API_BASE } from '../../config/api';

export interface SeverityStat {
    name: string;
    count: number;
}

interface SeverityBarChartWidgetProps {
    selectedSeverity: string | null;
    onSelectSeverity: (severity: string | null) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
    Critical: '#dc2626', // Red-600
    High: '#ea580c',     // Orange-600
    Medium: '#d97706',   // Amber-600
    Low: '#2563eb',      // Blue-600
};

const DEFAULT_STATS: SeverityStat[] = [
    { name: 'Critical', count: 390 },
    { name: 'High', count: 310 },
    { name: 'Medium', count: 68 },
    { name: 'Low', count: 781 },
];

const SeverityBarChartWidget = ({
    selectedSeverity,
    onSelectSeverity,
}: SeverityBarChartWidgetProps) => {
    const [data, setData] = useState<SeverityStat[]>(DEFAULT_STATS);

    useEffect(() => {
        let isMounted = true;
        fetch(`${API_BASE}/api/news/stats`)
            .then(res => (res.ok ? res.json() : null))
            .then(stats => {
                if (!isMounted) return;
                if (Array.isArray(stats) && stats.length > 0) {
                    // Ensure standard order: Critical, High, Medium, Low
                    const order = ['Critical', 'High', 'Medium', 'Low'];
                    const sorted = [...stats].sort((a, b) => {
                        const idxA = order.indexOf(a.name);
                        const idxB = order.indexOf(b.name);
                        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                    });
                    setData(sorted);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, []);

    const totalCount = data.reduce((sum, item) => sum + (item.count || 0), 0);

    const handleBarClick = (entryName: string) => {
        if (selectedSeverity === entryName) {
            onSelectSeverity(null); // Deselect if already active
        } else {
            onSelectSeverity(entryName);
        }
    };

    const getPillStyle = (name: string, isSelected: boolean) => {
        if (!isSelected) {
            return 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100';
        }
        switch (name) {
            case 'Critical':
                return 'bg-red-700 text-white border-red-700 shadow-sm shadow-red-500/20';
            case 'High':
                return 'bg-orange-700 text-white border-orange-700 shadow-sm shadow-orange-500/20';
            case 'Medium':
                return 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/20';
            case 'Low':
                return 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-500/20';
            default:
                return 'bg-slate-900 text-white border-slate-900';
        }
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 transition-all">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        <BarChart3 className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                                Severity Distribution &amp; Priority Filter
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                                {totalCount.toLocaleString()} Total
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Click a chart bar or button to filter live threat reports
                        </p>
                    </div>
                </div>

                {/* Severity Pills matching the user reference */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={!selectedSeverity}
                        onClick={() => onSelectSeverity(null)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            !selectedSeverity
                                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                    >
                        All
                    </button>

                    {data.map(item => {
                        const isSelected = selectedSeverity === item.name;
                        return (
                            <button
                                key={item.name}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => handleBarClick(item.name)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 ${getPillStyle(
                                    item.name,
                                    isSelected
                                )}`}
                            >
                                <span>{item.name}</span>
                                <span
                                    className={`text-[10px] font-mono font-semibold px-1 rounded ${
                                        isSelected
                                            ? 'bg-black/20 text-white'
                                            : 'bg-slate-200/80 text-slate-700'
                                    }`}
                                >
                                    {item.count.toLocaleString()}
                                </span>
                            </button>
                        );
                    })}

                    {selectedSeverity && (
                        <button
                            type="button"
                            onClick={() => onSelectSeverity(null)}
                            title="Clear severity filter"
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Recharts Bar Chart */}
            <div className="h-32 sm:h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 12, right: 16, left: -10, bottom: 0 }}
                        onClick={state => {
                            if (state && 'activePayload' in state) {
                                const chartState = state as {
                                    activePayload?: Array<{ payload: SeverityStat }>;
                                };
                                const payload = chartState.activePayload?.[0]?.payload;
                                if (payload?.name) {
                                    handleBarClick(payload.name);
                                }
                            }
                        }}
                    >
                        <XAxis
                            dataKey="name"
                            stroke="#64748b"
                            fontSize={11}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#f1f5f9', opacity: 0.6 }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const stat = payload[0].payload as SeverityStat;
                                    const percent =
                                        totalCount > 0
                                            ? Math.round((stat.count / totalCount) * 100)
                                            : 0;
                                    return (
                                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-md text-xs font-sans">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            SEVERITY_COLORS[stat.name] || '#94a3b8',
                                                    }}
                                                />
                                                <span className="font-bold text-slate-900">
                                                    {stat.name} Priority
                                                </span>
                                            </div>
                                            <div className="font-mono text-slate-600 text-[11px]">
                                                <span>{stat.count.toLocaleString()} detections</span>
                                                <span className="text-slate-400"> ({percent}% of total)</span>
                                            </div>
                                            <div className="mt-1 text-[10px] text-blue-600 font-medium">
                                                Click to filter live stream
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar
                            dataKey="count"
                            radius={[6, 6, 0, 0]}
                            barSize={48}
                            className="cursor-pointer"
                        >
                            {data.map(entry => {
                                const isSelected = selectedSeverity === entry.name;
                                const isDimmed = selectedSeverity !== null && !isSelected;
                                return (
                                    <Cell
                                        key={entry.name}
                                        fill={SEVERITY_COLORS[entry.name] || '#94a3b8'}
                                        opacity={isDimmed ? 0.35 : 1}
                                        className="transition-opacity duration-200 hover:opacity-80"
                                    />
                                );
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SeverityBarChartWidget;
