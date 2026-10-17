import React, { useState, useRef, useEffect } from 'react';
import { Search, Calendar, FileDown, User, Menu, ExternalLink, Eye, AlertOctagon, LogOut, Shield } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
    onMenuToggle?: () => void;
    isDemoEnabled?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, isDemoEnabled }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { setIsModalOpen } = useAccessibility();
    const { user, logout } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [timeRange, setTimeRange] = useState('24h');
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Keyboard shortcut: Ctrl+K or Cmd+K to focus search input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close user dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync time range from URL parameters if present
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlTime = params.get('time') || params.get('range');
        if (urlTime && ['24h', '7d', '30d', 'all'].includes(urlTime)) {
            setTimeRange(urlTime);
        }
    }, [location.search]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;

        // Route IOC identifiers directly to Enrichment, otherwise search Archives or Intelligence
        if (
            q.toLowerCase().startsWith('cve-') ||
            /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(q) ||
            /^[a-fA-F0-9]{32,64}$/.test(q)
        ) {
            navigate(`/enrich?ioc=${encodeURIComponent(q)}`);
        } else {
            navigate(`/intelligence?q=${encodeURIComponent(q)}`);
        }
    };

    const handleTimeRangeChange = (val: string) => {
        setTimeRange(val);
        // Dispatch time range to current page searchParams (using canonical 'time' and fallback 'range')
        const params = new URLSearchParams(location.search);
        params.set('time', val);
        params.set('range', val);
        navigate({ search: params.toString() }, { replace: true });
    };

    const handleQuickExport = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`${API_BASE}/api/reports/daily`);
            if (!res.ok) throw new Error('Report generation failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `no-entry-daily-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download report error:', err);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <header className="h-16 bg-[#070A12] border-b border-emerald-500/10 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
            {/* Mobile Hamburger & Global Search */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
                {onMenuToggle && (
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg focus:outline-none"
                        aria-label="Open mobile navigation drawer"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}

                <form onSubmit={handleSearchSubmit} className="relative w-full">
                    <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Ask AI Copilot or search reports, actors, indicators, or CVEs…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-14 py-2 bg-[#0D1527] border border-emerald-500/15 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-white placeholder-slate-400 outline-none transition-all"
                        aria-label="Search reports, actors, indicators, or keywords"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); navigate('/intelligence'); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded"
                            title="Clear search"
                            aria-label="Clear search query"
                        >
                            <span className="text-xs font-semibold">✕</span>
                        </button>
                    ) : (
                        <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
                            Ctrl+K
                        </kbd>
                    )}
                </form>
            </div>

            {/* Positive Reinforcement Indicator - Stress Reduction Cue */}
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">System Protected</span>
                <span className="text-emerald-300/80">· 47 threats mitigated today</span>
            </div>

            {/* Right Controls: Time Range, Quick Export & User Menu */}
            <div className="flex items-center gap-2.5">
                {isDemoEnabled && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded">
                        <AlertOctagon className="w-3 h-3 text-emerald-400" />
                        <span>DEMO DATA</span>
                    </span>
                )}
                {/* Time Range Selector */}
                <div className="hidden md:flex items-center gap-1.5 bg-[#0D1527] border border-emerald-500/15 rounded-xl px-2.5 py-1.5 text-xs text-white">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <select
                        value={timeRange}
                        onChange={(e) => handleTimeRangeChange(e.target.value)}
                        className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer pr-1"
                        aria-label="Filter intelligence by time range"
                    >
                        <option value="24h" className="bg-[#0D1527] text-white">Last 24 Hours</option>
                        <option value="7d" className="bg-[#0D1527] text-white">Last 7 Days</option>
                        <option value="30d" className="bg-[#0D1527] text-white">Last 30 Days</option>
                        <option value="all" className="bg-[#0D1527] text-white">All Time</option>
                    </select>
                </div>

                {/* Quick PDF Report Download */}
                <button
                    onClick={handleQuickExport}
                    disabled={downloading}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-500/20 bg-[#0D1527] hover:bg-[#131F38] hover:border-emerald-500/40 text-white transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    title="Download daily PDF sitrep report"
                >
                    <FileDown className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    <span>{downloading ? 'Exporting...' : 'Daily Report'}</span>
                </button>

                {/* Authenticated Analyst User Menu */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-emerald-500/20 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        aria-expanded={userDropdownOpen}
                        aria-haspopup="true"
                        aria-label="User account menu"
                    >
                        <div className="text-right hidden sm:block">
                            <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[120px]">
                                {user?.name || 'Security Analyst'}
                            </span>
                            <span className="text-[10px] text-emerald-400 block font-normal truncate max-w-[120px]">
                                {user?.role || 'Analyst'}
                            </span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xs shadow-2xs">
                            {user?.initials || <User className="w-4 h-4" />}
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {userDropdownOpen && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-1.5 w-64 bg-[#0D1527] border border-emerald-500/20 rounded-2xl shadow-2xl py-1.5 text-xs z-50 text-white animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                        >
                            <div className="px-3.5 py-2.5 border-b border-white/5 bg-[#070A12]">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-500/40">
                                        {user?.initials || 'SA'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="font-semibold block text-white truncate">
                                            {user?.name || 'Security Analyst'}
                                        </span>
                                        <span className="text-[11px] text-slate-400 block truncate font-mono">
                                            {user?.email || 'analyst@soc.corp'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5">
                                    <Shield className="w-3 h-3 text-amber-400" />
                                    <span className="text-[10px] font-mono font-medium text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                                        {user?.clearance || 'Level 3 (Secret)'}
                                    </span>
                                </div>
                            </div>

                            <div className="py-1">
                                <button
                                    role="menuitem"
                                    onClick={() => {
                                        setIsModalOpen(true);
                                        setUserDropdownOpen(false);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/5 flex items-center gap-2 text-slate-300"
                                >
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Accessibility &amp; High Contrast</span>
                                </button>

                                <a
                                    role="menuitem"
                                    href="https://sujampathirathnayaka.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setUserDropdownOpen(false)}
                                    className="w-full px-3.5 py-2 text-left hover:bg-white/5 flex items-center justify-between text-slate-300"
                                >
                                    <span>About Platform &amp; Creator</span>
                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                </a>
                            </div>

                            <div className="border-t border-white/5 pt-1">
                                <button
                                    role="menuitem"
                                    onClick={() => {
                                        setUserDropdownOpen(false);
                                        logout();
                                        navigate('/login');
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-amber-500/10 flex items-center gap-2 text-amber-400 font-medium transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Sign Out &amp; Terminate Session</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
