import React, { useState, useRef, useEffect } from 'react';
import { Search, Calendar, FileDown, User, Menu, ExternalLink, Eye, AlertOctagon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { useAccessibility } from '../../context/AccessibilityContext';

interface TopBarProps {
    onMenuToggle?: () => void;
    isDemoEnabled?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, isDemoEnabled }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { setIsModalOpen } = useAccessibility();

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
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
            {/* Mobile Hamburger & Global Search */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
                {onMenuToggle && (
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-md focus:outline-none"
                        aria-label="Open mobile navigation drawer"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}

                <form onSubmit={handleSearchSubmit} className="relative w-full">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search reports, actors, indicators, or keywords…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-14 py-2 bg-[#F8FAFC] border border-[#E2EAF3] focus:border-[#147DFA] focus:bg-white rounded-lg text-xs text-[#14263F] placeholder-[#94A3B8] outline-none transition-colors"
                        aria-label="Search reports, actors, indicators, or keywords"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); navigate('/intelligence'); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                            title="Clear search"
                            aria-label="Clear search query"
                        >
                            <span className="text-xs font-semibold">✕</span>
                        </button>
                    ) : (
                        <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 text-[10px] font-mono text-[#64748B] bg-white border border-[#E2EAF3] rounded shadow-2xs">
                            Ctrl+K
                        </kbd>
                    )}
                </form>
            </div>

            {/* Right Controls: Time Range, Quick Export & User Menu */}
            <div className="flex items-center gap-2.5">
                {isDemoEnabled && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shadow-2xs">
                        <AlertOctagon className="w-3 h-3 text-amber-700" />
                        <span>DEMO DATA</span>
                    </span>
                )}
                {/* Time Range Selector */}
                <div className="hidden md:flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-2.5 py-1.5 text-xs text-[#0F172A]">
                    <Calendar className="w-3.5 h-3.5 text-[#64748B]" aria-hidden="true" />
                    <select
                        value={timeRange}
                        onChange={(e) => handleTimeRangeChange(e.target.value)}
                        className="bg-transparent text-xs text-[#0F172A] font-medium outline-none cursor-pointer pr-1"
                        aria-label="Filter intelligence by time range"
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="all">All Time</option>
                    </select>
                </div>

                {/* Quick PDF Report Download */}
                <button
                    onClick={handleQuickExport}
                    disabled={downloading}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0F172A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                    title="Download daily PDF sitrep report"
                >
                    <FileDown className="w-3.5 h-3.5 text-[#64748B]" aria-hidden="true" />
                    <span>{downloading ? 'Exporting...' : 'Daily Report'}</span>
                </button>

                {/* Authenticated / Guest User Menu */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center gap-2 p-1.5 pl-2.5 rounded-md hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                        aria-expanded={userDropdownOpen}
                        aria-haspopup="true"
                        aria-label="User account menu"
                    >
                        <div className="text-right hidden sm:block">
                            <span className="text-xs font-semibold text-[#0F172A] block leading-tight">
                                Guest
                            </span>
                            <span className="text-[10px] text-[#64748B] block font-normal">
                                Security Analyst
                            </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#EAF2FF] border border-[#BFDBFE] text-[#0665F9] flex items-center justify-center font-bold text-xs">
                            <User className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {userDropdownOpen && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-1.5 w-56 bg-white border border-[#E2E8F0] rounded-md shadow-lg py-1.5 text-xs z-50 text-[#0F172A]"
                        >
                            <div className="px-3 py-2 border-b border-[#F1F5F9]">
                                <span className="font-semibold block text-[#0F172A]">Security Operations</span>
                                <span className="text-[11px] text-[#64748B]">Session: Guest Analyst</span>
                            </div>

                            <button
                                role="menuitem"
                                onClick={() => {
                                    setIsModalOpen(true);
                                    setUserDropdownOpen(false);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[#F8FAFC] flex items-center gap-2 text-[#334155]"
                            >
                                <Eye className="w-3.5 h-3.5 text-[#64748B]" />
                                <span>Accessibility & Contrast</span>
                            </button>

                            <a
                                role="menuitem"
                                href="https://sujampathirathnayaka.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setUserDropdownOpen(false)}
                                className="w-full px-3 py-2 text-left hover:bg-[#F8FAFC] flex items-center justify-between text-[#334155]"
                            >
                                <span>About Platform & Creator</span>
                                <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
