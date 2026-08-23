import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

interface Rule {
    id: number;
    name?: string;
    title?: string;
    description?: string;
    status?: string;
    level?: string;
    severity?: string;
    date?: string;
    author?: string;
    tags: string[];
    platform?: string;
    mitreTechnique?: string;
    reference?: string;
    raw: string;
}

const LEVEL_COLORS: Record<string, string> = {
    critical: 'bg-red-600/20 text-red-300 border-red-600/40',
    high:     'bg-orange-600/20 text-orange-300 border-orange-600/40',
    medium:   'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
    low:      'bg-green-600/20 text-green-300 border-green-600/40',
    stable:   'bg-blue-600/20 text-blue-300 border-blue-600/40',
    experimental: 'bg-purple-600/20 text-purple-300 border-purple-600/40',
};

const Badge = ({ label, color = 'bg-gray-700/60 text-gray-400 border-gray-600/50' }: { label: string; color?: string }) => (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${color}`}>{label}</span>
);

export default function RuleLibrary() {
    const [tab, setTab] = useState<'sigma' | 'yara'>('sigma');
    const [sigmaRules, setSigmaRules] = useState<Rule[]>([]);
    const [yaraRules, setYaraRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
    const [copied, setCopied] = useState(false);

    const loadRules = async () => {
        setLoading(true);
        try {
            const [sigmaResp, yaraResp] = await Promise.all([
                fetch(`${API_BASE}/api/rules/sigma`),
                fetch(`${API_BASE}/api/rules/yara`),
            ]);
            const sigmaData = await sigmaResp.json();
            const yaraData  = await yaraResp.json();
            setSigmaRules(sigmaData.rules || []);
            setYaraRules(yaraData.rules || []);
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadRules(); }, []);

    const rules = tab === 'sigma' ? sigmaRules : yaraRules;
    const filtered = rules.filter(r => {
        const name = (r.title || r.name || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        const tags = r.tags.join(' ').toLowerCase();
        const matchSearch = !search || name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase()) || tags.includes(search.toLowerCase());
        const level = r.level || r.severity || '';
        const matchLevel = !levelFilter || level.toLowerCase() === levelFilter.toLowerCase();
        return matchSearch && matchLevel;
    });

    const handleCopy = () => {
        if (!selectedRule) return;
        navigator.clipboard.writeText(selectedRule.raw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = (rule: Rule) => {
        const ext = tab === 'sigma' ? 'yml' : 'yar';
        const name = (rule.title || rule.name || 'rule').replace(/\s+/g, '_');
        const blob = new Blob([rule.raw], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name}.${ext}`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    <span>📚</span> Detection Rule Library
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">
                    Browse, search, and download production Sigma &amp; YARA detection rules for your SIEM / EDR stack.
                </p>
            </div>

            {/* Tab + Controls */}
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div className="flex gap-2">
                    {(['sigma', 'yara'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setSelectedRule(null); setSearch(''); setLevelFilter(''); }}
                            className={`px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                                tab === t
                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            {t === 'sigma' ? '⚡' : '🔬'} {t.toUpperCase()} Rules
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tab === t ? 'bg-cyan-500/40' : 'bg-gray-700'}`}>
                                {t === 'sigma' ? sigmaRules.length : yaraRules.length}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search rules..."
                        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-gray-300 placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 w-full sm:w-56 transition-colors"
                    />
                    <select
                        value={levelFilter}
                        onChange={e => setLevelFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-cyan-500"
                    >
                        <option value="">All Severity Levels</option>
                        {['critical', 'high', 'medium', 'low'].map(l => (
                            <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Rule List (Scrollable on desktop, stacked on mobile) */}
                    <div className="w-full lg:w-80 flex-shrink-0 space-y-2 max-h-[400px] lg:max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-gray-900/40 rounded-xl border border-gray-800">
                                <p className="text-3xl mb-2">🔍</p>
                                <p className="text-sm">No rules match your filter.</p>
                            </div>
                        ) : (
                            filtered.map(rule => (
                                <button
                                    key={rule.id}
                                    onClick={() => setSelectedRule(rule)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                                        selectedRule?.id === rule.id
                                            ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-500/10'
                                            : 'bg-gray-900/70 border-gray-800 hover:bg-gray-800/80 hover:border-gray-700'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-white text-sm font-semibold leading-tight">
                                            {rule.title || rule.name}
                                        </p>
                                        <Badge
                                            label={rule.level || rule.severity || 'unknown'}
                                            color={LEVEL_COLORS[(rule.level || rule.severity || '').toLowerCase()]}
                                        />
                                    </div>
                                    <p className="text-gray-400 text-xs mt-1.5 line-clamp-2">{rule.description}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {rule.tags.slice(0, 3).map(tag => (
                                            <Badge key={tag} label={tag.replace('attack.', '')} />
                                        ))}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Rule Detail Viewer */}
                    <div className="flex-1 bg-gray-900/90 border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[350px]">
                        {selectedRule ? (
                            <>
                                <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-gray-900/50">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-white font-bold text-base sm:text-lg truncate">
                                            {selectedRule.title || selectedRule.name}
                                        </h2>
                                        <p className="text-gray-400 text-xs sm:text-sm mt-1 leading-relaxed">
                                            {selectedRule.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                                            {(selectedRule.level || selectedRule.severity) && (
                                                <Badge
                                                    label={(selectedRule.level || selectedRule.severity || '').toUpperCase()}
                                                    color={LEVEL_COLORS[(selectedRule.level || selectedRule.severity || '').toLowerCase()]}
                                                />
                                            )}
                                            {selectedRule.status && <Badge label={selectedRule.status} color={LEVEL_COLORS[selectedRule.status.toLowerCase()]} />}
                                            {selectedRule.platform && <Badge label={selectedRule.platform} />}
                                            {selectedRule.mitreTechnique && (
                                                <a
                                                    href={`https://attack.mitre.org/techniques/${selectedRule.mitreTechnique}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-block px-2 py-0.5 rounded-md text-xs font-medium border bg-purple-600/20 text-purple-300 border-purple-600/40 hover:underline"
                                                >
                                                    ATT&amp;CK {selectedRule.mitreTechnique}
                                                </a>
                                            )}
                                            {selectedRule.tags.map(t => <Badge key={t} label={t.replace('attack.', '')} />)}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0 self-end sm:self-start">
                                        <button
                                            onClick={handleCopy}
                                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                                                copied ? 'bg-emerald-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                            }`}
                                        >
                                            {copied ? '✓ Copied' : '📋 Copy'}
                                        </button>
                                        <button
                                            onClick={() => handleDownload(selectedRule)}
                                            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow"
                                        >
                                            ⬇ Download
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 sm:p-5 overflow-x-auto bg-slate-950/60 custom-scrollbar">
                                    <pre className="text-xs sm:text-sm text-emerald-400 font-mono leading-relaxed whitespace-pre font-normal">
                                        {selectedRule.raw}
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
                                <div className="text-center space-y-2">
                                    <p className="text-4xl">{tab === 'sigma' ? '⚡' : '🔬'}</p>
                                    <p className="text-base font-semibold text-slate-300">Select a rule from the list to view syntax</p>
                                    <p className="text-xs text-gray-600">{filtered.length} {tab.toUpperCase()} rules available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
