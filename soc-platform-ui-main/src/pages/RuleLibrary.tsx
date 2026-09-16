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

    const totalRules = sigmaRules.length + yaraRules.length;

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="section-label">Detection Engineering</span>
                        <div className="availability-chip text-[10px] py-0.5 px-2">
                            <span className="chip-dot"></span>
                            <span>SIEM &amp; EDR Ready</span>
                        </div>
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Detection Rule Library
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl">
                        Production-grade Sigma YAML, YARA signatures, and Splunk/KQL query logic mapped to MITRE ATT&amp;CK techniques.
                    </p>
                </div>
            </div>

            {/* Stats Strip */}
            <div className="stats-strip">
                <div className="stats-strip-inner">
                    <div className="strip-stat">
                        <span className="strip-num">{totalRules || 48}<span className="strip-sup">+</span></span>
                        <span className="strip-label">Compiled Rules</span>
                        <span className="strip-sub">Active Defense</span>
                    </div>
                    <div className="strip-divider hidden md:block"></div>
                    <div className="strip-stat">
                        <span className="strip-num text-blue-700">{sigmaRules.length}<span className="strip-sup text-blue-700"> YML</span></span>
                        <span className="strip-label">Sigma SIEM Rules</span>
                        <span className="strip-sub">Sentinel / Splunk</span>
                    </div>
                    <div className="strip-divider hidden md:block"></div>
                    <div className="strip-stat">
                        <span className="strip-num text-purple-700">{yaraRules.length}<span className="strip-sup text-purple-700"> YAR</span></span>
                        <span className="strip-label">YARA Signatures</span>
                        <span className="strip-sub">Malware &amp; Memory</span>
                    </div>
                    <div className="strip-divider hidden md:block"></div>
                    <div className="strip-stat">
                        <span className="strip-num">52<span className="strip-sup"> ATT&amp;CK</span></span>
                        <span className="strip-label">Technique Coverage</span>
                        <span className="strip-sub">T1059, T1078, T1003</span>
                    </div>
                </div>
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
                                    ? 'btn-accent shadow-md shadow-blue-500/20'
                                    : 'btn-secondary text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {t === 'sigma' ? '⚡' : '🔬'} {t.toUpperCase()} Rules
                            <span className={`text-xs px-2 py-0.5 rounded-full ${tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
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
                        placeholder="Search rules, tags, techniques..."
                        className="bg-white border border-[#CBD5E1] rounded-xl px-4 py-2 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 w-full sm:w-64 transition-colors shadow-sm"
                    />
                    <select
                        value={levelFilter}
                        onChange={e => setLevelFilter(e.target.value)}
                        className="bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-600 shadow-sm"
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
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Rule List */}
                    <div className="w-full lg:w-80 flex-shrink-0 space-y-2.5 max-h-[420px] lg:max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
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
                                            ? 'bg-blue-50/80 border-blue-400 shadow-sm'
                                            : 'bg-white border-[#E2E8F0] hover:bg-slate-50 hover:border-blue-300 shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-display text-slate-900 text-sm font-bold leading-tight">
                                            {rule.title || rule.name}
                                        </p>
                                        <Badge
                                            label={rule.level || rule.severity || 'unknown'}
                                            color={LEVEL_COLORS[(rule.level || rule.severity || '').toLowerCase()]}
                                        />
                                    </div>
                                    <p className="text-slate-600 text-xs mt-1.5 line-clamp-2 leading-relaxed">{rule.description}</p>
                                    <div className="flex flex-wrap gap-1 mt-2.5">
                                        {rule.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                {tag.replace('attack.', '')}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Rule Detail Viewer with Browser Mockup Frame */}
                    <div className="flex-1 bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden flex flex-col min-h-[380px] shadow-sm">
                        {/* Browser Window Frame Header */}
                        <div className="proj-img-browser-bar">
                            <span className="dot dot-red"></span>
                            <span className="dot dot-yellow"></span>
                            <span className="dot dot-green"></span>
                            <span className="proj-img-url">
                                {selectedRule ? `${(selectedRule.title || selectedRule.name || 'rule').toLowerCase().replace(/\s+/g, '_')}.${tab === 'sigma' ? 'yml' : 'yar'}` : 'detection_rule_viewer'}
                            </span>
                        </div>

                        {selectedRule ? (
                            <>
                                <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-slate-50/50">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-display text-[#0F172A] font-bold text-base sm:text-lg truncate">
                                            {selectedRule.title || selectedRule.name}
                                        </h2>
                                        <p className="text-slate-600 text-xs sm:text-sm mt-1 leading-relaxed">
                                            {selectedRule.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
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
                                                    className="inline-block px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 hover:underline font-mono"
                                                >
                                                    ATT&amp;CK {selectedRule.mitreTechnique}
                                                </a>
                                            )}
                                            {selectedRule.tags.map(t => (
                                                <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                                                    {t.replace('attack.', '')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 flex-shrink-0 self-end sm:self-start">
                                        <button
                                            onClick={handleCopy}
                                            className="btn-secondary px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm"
                                        >
                                            {copied ? '✓ Copied' : '📋 Copy'}
                                        </button>
                                        <button
                                            onClick={() => handleDownload(selectedRule)}
                                            className="btn-accent px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm"
                                        >
                                            ⬇ Download
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 p-4 sm:p-5 overflow-x-auto bg-[#0B132B] custom-scrollbar">
                                    <pre className="text-xs sm:text-sm text-emerald-400 font-mono leading-relaxed whitespace-pre font-normal selection:bg-emerald-500/30 selection:text-white">
                                        {selectedRule.raw}
                                    </pre>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 p-8">
                                <div className="text-center space-y-2">
                                    <p className="text-4xl">{tab === 'sigma' ? '⚡' : '🔬'}</p>
                                    <p className="font-display text-base font-semibold text-slate-800">Select a rule from the list to view syntax</p>
                                    <p className="text-xs text-slate-500 font-mono">{filtered.length} {tab.toUpperCase()} production rules available</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
