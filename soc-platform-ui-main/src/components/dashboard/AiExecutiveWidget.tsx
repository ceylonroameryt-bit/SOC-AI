import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Bot, Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface BriefData {
    headline?: string;
    content?: string;
    fallback?: string;
}

const AiExecutiveWidget = () => {
    const [rangeParams] = useSearchParams();
    const range = rangeParams.get('time') || rangeParams.get('range') || '24h';
    const [headline, setHeadline] = useState('Source-linked reporting');
    const [points, setPoints] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE}/api/ai/brief?time=${encodeURIComponent(range)}`)
            .then(res => (res.ok ? res.json() : null))
            .then((data: BriefData | null) => {
                if (data?.headline) setHeadline(data.headline);
                const text = data?.content || data?.fallback;
                if (text) {
                    const lines = text
                        .split('\n')
                        .filter(l => l.trim().startsWith('- **') || l.trim().startsWith('- '))
                        .slice(0, 3)
                        .map(l => l.replace(/^[-\s*#]+/, '').replace(/\*\*/g, '').replace(/`/g, '').trim());
                    if (lines.length > 0) setPoints(lines);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [range]);

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
                                Intelligence Brief
                            </h3>
                            <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                                <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                                SOURCE DIGEST
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                            {headline.replace(/\*\*/g, '')}
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

            {/* Campaign Summary Points */}
            <div className="flex-1 space-y-2">
                {loading ? (
                    <div className="py-6 flex justify-center text-xs text-slate-400 animate-pulse">
                        Synthesizing intelligence telemetry...
                    </div>
                ) : (
                    points.length === 0 ? <p className="text-xs text-slate-500">No briefing available for this window.</p> : points.map((pt, i) => (
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
                )}
            </div>

            {/* Action Bottom Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1 text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Review source evidence</span>
                </div>
                <Link to="/ai" className="text-blue-600 hover:underline font-semibold">
                    View sources →
                </Link>
            </div>
        </div>
    );
};

export default AiExecutiveWidget;
