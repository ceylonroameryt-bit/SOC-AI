import { useEffect, useState } from 'react';
import { Bot, Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface BriefData {
    timeRange?: string;
    headline?: string;
    content?: string;
    summary?: string;
    keyThreats?: string[];
    criticalVulnerabilities?: string[];
    recommendedActions?: string[];
    sourcesCount?: number;
    sourcesUsed?: string[];
    generationMethod?: string;
    isAiGenerated?: boolean;
    generatedAt?: string;
    cached?: boolean;
}

interface AiExecutiveWidgetProps {
    timeRange?: string;
}

const AiExecutiveWidget = ({ timeRange = '24h' }: AiExecutiveWidgetProps) => {
    const [brief, setBrief] = useState<BriefData | null>(null);
    const [points, setPoints] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const timeWindowLabel = timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'All Time';

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE}/api/ai/brief?time=${encodeURIComponent(timeRange)}`)
            .then(res => (res.ok ? res.json() : null))
            .then((data: BriefData | null) => {
                setBrief(data);
                if (data && data.sourcesCount && data.sourcesCount > 0) {
                    if (data.keyThreats && data.keyThreats.length > 0) {
                        setPoints(data.keyThreats.slice(0, 3));
                    } else if (data.content) {
                        const lines = data.content
                            .split('\n')
                            .filter(l => l.trim().startsWith('- **') || l.trim().startsWith('- '))
                            .slice(0, 3)
                            .map(l => l.replace(/^[-\s*#]+/, '').replace(/\*\*/g, '').replace(/`/g, '').trim());
                        setPoints(lines);
                    } else {
                        setPoints([]);
                    }
                } else {
                    setPoints([]);
                }
            })
            .catch(() => {
                setBrief(null);
                setPoints([]);
            })
            .finally(() => setLoading(false));
    }, [timeRange]);

    const hasData = brief && (brief.sourcesCount ?? 0) > 0 && points.length > 0;

    return (
        <div className="glass-card p-4 sm:p-5 flex flex-col h-full bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/20">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 gap-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shadow-2xs">
                        <Bot className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-display text-sm font-bold text-slate-900 leading-tight">
                                AI Threat Intelligence Brief
                            </h3>
                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                                <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                                {hasData ? 'AI SYNTHESIS' : 'OPERATIONAL STATE'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                            {hasData ? (brief?.headline || 'Operational SITREP Synthesis').replace(/\*\*/g, '') : `No reports collected for ${timeWindowLabel}`}
                        </p>
                    </div>
                </div>
                <Link
                    to="/ai"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 flex-shrink-0"
                >
                    <span>Full Brief</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* Campaign Summary Points / Honest Empty State */}
            <div className="flex-1 space-y-2">
                {loading ? (
                    <div className="py-6 flex justify-center text-xs text-slate-400 animate-pulse">
                        Querying database intelligence briefs for {timeWindowLabel}...
                    </div>
                ) : hasData ? (
                    points.map((pt, i) => (
                        <div
                            key={i}
                            className="p-2.5 rounded-xl bg-white/90 border border-slate-200/80 hover:border-blue-300 transition-all flex items-start gap-2 text-xs text-slate-700 leading-relaxed shadow-2xs"
                        >
                            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                {i + 1}
                            </span>
                            <span className="line-clamp-2">{pt}</span>
                        </div>
                    ))
                ) : (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                        <div className="font-semibold text-slate-800">
                            No intelligence has been collected for this period ({timeWindowLabel}).
                        </div>
                        <p className="text-[11px] text-slate-500">
                            The platform does not fabricate threat reports. Intelligence briefings require active ingested articles from configured feeds.
                        </p>
                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Suggested Action: Check collection status in Sources</span>
                            <Link to="/sources" className="text-blue-600 font-semibold hover:underline">
                                Sources Registry →
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Bottom Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1 text-slate-600 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{hasData ? `${brief?.sourcesCount} Source Reports Analyzed` : 'Authoritative Database Backed'}</span>
                </div>
                {hasData && (
                    <Link to="/ai" className="text-blue-600 hover:underline font-semibold">
                        View Mitigation Playbooks →
                    </Link>
                )}
            </div>
        </div>
    );
};

export default AiExecutiveWidget;
