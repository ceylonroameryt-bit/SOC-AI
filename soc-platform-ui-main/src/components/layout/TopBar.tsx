import { useState, useRef, useEffect } from 'react';
import { Search, Download, Mail, ExternalLink, CheckCircle2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { useAccessibility } from '../../context/AccessibilityContext';



const TopBar = () => {
    const navigate = useNavigate();
    const { setIsModalOpen, contrast } = useAccessibility();
    const [searchQuery, setSearchQuery] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Global keyboard shortcut: pressing '/' focuses the search input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === '/' &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            const query = searchQuery.trim();
            // If it looks like an IP, CVE, or Hash, navigate to IOC Enrichment
            if (
                query.toLowerCase().startsWith('cve-') ||
                /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(query) ||
                /^[a-fA-F0-9]{32,64}$/.test(query)
            ) {
                navigate(`/enrich?ioc=${encodeURIComponent(query)}`);
            } else {
                navigate(`/archives?q=${encodeURIComponent(query)}`);
            }
        }
    };

    const handleSendReport = async () => {
        setSendingEmail(true);
        setEmailStatus(null);
        try {
            const res = await fetch(`${API_BASE}/api/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) {
                setEmailStatus('Report dispatched successfully!');
            } else {
                setEmailStatus('Failed to send. Server configured.');
            }
        } catch {
            setEmailStatus('Server unreachable.');
        } finally {
            setSendingEmail(false);
            setTimeout(() => setEmailStatus(null), 4000);
        }
    };

    return (
        <header role="banner" className="h-16 bg-white/95 backdrop-blur-xl border-b border-[#E2E8F0] flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 z-20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 mr-2">

                {/* Search Bar with Smart Routing & Semantic Form */}
                <form
                    role="search"
                    onSubmit={e => e.preventDefault()}
                    className="flex items-center flex-1 max-w-md min-w-0"
                >
                    <label htmlFor="global-soc-search" className="sr-only">
                        Quick search indicators, CVEs, threats, or press slash key
                    </label>
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none" aria-hidden="true">
                            <Search className="w-4 h-4 text-slate-500" />
                        </span>
                        <input
                            ref={searchInputRef}
                            id="global-soc-search"
                            type="search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearch}
                            placeholder="Quick search IOCs, CVEs, threats (Press / or Enter)..."
                            className="w-full bg-slate-50 focus:bg-white border border-[#E2E8F0] text-slate-900 text-xs sm:text-sm rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 block pl-10 pr-12 py-2 placeholder-slate-500 transition-all shadow-2xs font-sans focus:outline-none"
                            aria-label="Search intelligence, CVEs, and IOCs"
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[10px] font-mono font-bold text-slate-600 bg-slate-100 my-1.5 mr-1.5 px-1.5 rounded border border-[#E2E8F0]" title="Press Enter to search" aria-hidden="true">
                            ↵
                        </span>
                    </div>
                </form>

                {/* 24/7 SOC Radar Status Chip relocated from Sidebar */}
                <div
                    className="availability-chip text-[11px] py-1 px-3 hidden sm:inline-flex items-center gap-2 flex-shrink-0"
                    role="status"
                    aria-label="System status: 24/7 SOC Radar Active"
                >
                    <span className="chip-dot" aria-hidden="true"></span>
                    <span className="font-semibold text-emerald-900 tracking-tight">24/7 SOC Radar Active</span>
                </div>

                {/* Status Indicator */}
                <div
                    className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/90 text-[11px] font-semibold text-slate-700 flex-shrink-0"
                    role="status"
                    aria-label="Telemetry feed status: 102 Feeds Connected"
                >
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden="true"></span>
                    <span>102 Feeds Connected</span>
                </div>
            </div>

            {/* Quick Actions & Accessibility Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Live Announcement for Email Dispatch */}
                <div aria-live="polite" className="contents">
                    {emailStatus && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 animate-fade-in" role="alert">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                            {emailStatus}
                        </span>
                    )}
                </div>

                {/* Accessibility Preferences Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-600"
                    aria-label="Open Accessibility and Display Preferences (Shortcut: Alt+A)"
                    title="Accessibility Preferences (Alt+A)"
                >
                    <Eye className="w-4 h-4 text-blue-700 flex-shrink-0" aria-hidden="true" />
                    <span className="hidden md:inline">Accessibility</span>
                    {contrast === 'high-contrast' && (
                        <span className="w-2 h-2 rounded-full bg-blue-700" title="High contrast mode active" aria-label="High contrast mode active"></span>
                    )}
                </button>

                <a
                    href="https://sujampathirathnayaka.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                    title="Poorna Sujampathi Portfolio (opens in new tab)"
                    aria-label="Poorna Sujampathi Portfolio (opens in new tab)"
                >
                    <span>Portfolio</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                </a>

                <button
                    onClick={handleSendReport}
                    disabled={sendingEmail}
                    className="btn-secondary flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    title="Send Email Report to analyst"
                    aria-label={sendingEmail ? 'Dispatching email report' : 'Send daily email report'}
                >
                    <Mail className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" aria-hidden="true" />
                    <span className="hidden md:inline">{sendingEmail ? 'Dispatching...' : 'Email Report'}</span>
                </button>

                <a
                    href={`${API_BASE}/api/reports/daily`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    title="Download Executive Daily Intelligence PDF/DOCX (opens in new tab)"
                    aria-label="Download Executive Daily Intelligence Report PDF or DOCX"
                >
                    <Download className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>Download Report</span>
                </a>
            </div>
        </header>
    );
};

export default TopBar;
