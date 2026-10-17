import React, { useState, useRef, useEffect } from 'react';
import {
    Search,
    Calendar,
    FileDown,
    Menu,
    LogOut,
    Building2,
    ChevronDown,
    Bell,
    CheckCircle2,
    AlertOctagon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../../config/api';
import { useAccessibility } from '../../context/AccessibilityContext';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
    onMenuToggle?: () => void;
    isDemoEnabled?: boolean;
}

const AVAILABLE_TENANTS = [
    { id: 'acme-mat', name: 'Acme Multi-Academy Trust', sector: 'Education (UK)', plan: 'Team' },
    { id: 'st-marys', name: "St Mary's University", sector: 'Higher Ed (UK)', plan: 'Pro' },
    { id: 'mssp-core', name: 'Apex Security MSSP', sector: 'MSSP Partner', plan: 'MSSP' }
];

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, isDemoEnabled }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { setIsModalOpen } = useAccessibility();
    const { user, logout } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [timeRange, setTimeRange] = useState('24h');
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(AVAILABLE_TENANTS[0]);
    const [downloading, setDownloading] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const tenantMenuRef = useRef<HTMLDivElement>(null);

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

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserDropdownOpen(false);
            }
            if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
                setTenantDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync time range from URL parameters
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

        // Route IOC identifiers directly to Enrichment, otherwise search Explorer
        if (
            q.toLowerCase().startsWith('cve-') ||
            /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(q) ||
            /^[a-fA-F0-9]{32,64}$/.test(q)
        ) {
            navigate(`/enrich?ioc=${encodeURIComponent(q)}`);
        } else {
            navigate(`/explorer?q=${encodeURIComponent(q)}`);
        }
    };

    const handleTimeRangeChange = (val: string) => {
        setTimeRange(val);
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
            a.download = `tacticlens-daily-sitrep-${new Date().toISOString().split('T')[0]}.pdf`;
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
        <header className="h-14 bg-[#0F1720] border-b border-[#1E293B] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
            {/* Left: Mobile Toggle, Brand & Tenant Switcher */}
            <div className="flex items-center gap-3">
                {onMenuToggle && (
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg focus:outline-none"
                        aria-label="Open mobile navigation"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}

                {/* Tenant Switcher Dropdown */}
                <div className="relative" ref={tenantMenuRef}>
                    <button
                        onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-white text-xs font-medium border border-[#334155] transition-colors focus:outline-none focus:ring-1 focus:ring-[#00E5FF]"
                        aria-expanded={tenantDropdownOpen}
                        aria-label="Tenant switcher"
                    >
                        <Building2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span className="font-semibold text-slate-100">{selectedTenant.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0B776C] text-white uppercase font-mono font-bold tracking-wider">
                            {selectedTenant.plan}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {tenantDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-64 bg-[#0F1720] border border-[#1E293B] rounded-xl shadow-2xl py-2 z-50 text-xs font-sans">
                            <div className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-400 font-mono tracking-wider">
                                Switch Organization
                            </div>
                            {AVAILABLE_TENANTS.map(tenant => (
                                <button
                                    key={tenant.id}
                                    onClick={() => {
                                        setSelectedTenant(tenant);
                                        setTenantDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#1E293B] transition-colors ${
                                        selectedTenant.id === tenant.id ? 'bg-[#1E293B]/70 text-[#00E5FF]' : 'text-slate-300'
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium text-slate-100">{tenant.name}</div>
                                        <div className="text-[11px] text-slate-400">{tenant.sector}</div>
                                    </div>
                                    {selectedTenant.id === tenant.id && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Center: Global ⌘K / TQL Search */}
            <div className="flex-1 max-w-xl mx-2">
                <form onSubmit={handleSearchSubmit} className="relative w-full">
                    <Search className="w-4 h-4 text-[#00E5FF] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search threats, CVEs, or run TQL (e.g. kev:true AND stack:true)…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-14 py-1.5 bg-[#1E293B] border border-[#334155] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] rounded-lg text-xs text-white placeholder-slate-400 outline-none transition-all font-mono"
                        aria-label="Search threats or run TQL"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => { setSearchQuery(''); navigate('/explorer'); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded"
                            title="Clear search"
                        >
                            <span className="text-xs font-semibold">✕</span>
                        </button>
                    ) : (
                        <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#0F1720] border border-[#334155] rounded">
                            ⌘K
                        </kbd>
                    )}
                </form>
            </div>

            {/* Right: Ingest-Health Pill, Time Range, Notifications, Profile */}
            <div className="flex items-center gap-3">
                {/* Ingest-Health Pill */}
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1E293B] border border-[#334155] text-xs font-mono text-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-semibold">944/1,000 ok</span>
                    <span className="text-slate-400">· 1,420/h</span>
                </div>

                {/* Time Range Selector with Timezone */}
                <div className="hidden md:flex items-center gap-1.5 bg-[#1E293B] border border-[#334155] rounded-lg px-2.5 py-1 text-xs text-white font-mono">
                    <Calendar className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                    <select
                        value={timeRange}
                        onChange={(e) => handleTimeRangeChange(e.target.value)}
                        className="bg-transparent text-xs text-white font-medium outline-none cursor-pointer pr-1"
                        aria-label="Filter intelligence by time range"
                    >
                        <option value="24h" className="bg-[#0F1720] text-white">24h · London (BST)</option>
                        <option value="7d" className="bg-[#0F1720] text-white">7d · London (BST)</option>
                        <option value="30d" className="bg-[#0F1720] text-white">30d · London (BST)</option>
                        <option value="all" className="bg-[#0F1720] text-white">All · London (BST)</option>
                    </select>
                </div>

                {/* Demo Mode Badge */}
                {isDemoEnabled && (
                    <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-bold">
                        <AlertOctagon className="w-3 h-3 text-amber-400" />
                        <span>SIMULATION</span>
                    </div>
                )}

                {/* Quick PDF Sitrep Download */}
                <button
                    onClick={handleQuickExport}
                    disabled={downloading}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#334155] bg-[#1E293B] hover:bg-[#334155] text-slate-200 transition-colors focus:outline-none"
                    title="Download daily SITREP PDF report"
                >
                    <FileDown className="w-3.5 h-3.5 text-[#00E5FF]" aria-hidden="true" />
                    <span>{downloading ? 'Exporting...' : 'SITREP'}</span>
                </button>

                {/* Notifications Bell */}
                <button
                    onClick={() => navigate('/rules')}
                    className="relative p-1.5 text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-lg transition-colors"
                    title="Alerts and Notifications"
                    aria-label="Notifications"
                >
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#EF4444]" />
                </button>

                {/* Analyst User Menu */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center gap-2 p-1 pl-2 rounded-lg hover:bg-[#1E293B] border border-transparent hover:border-[#334155] transition-colors focus:outline-none"
                        aria-expanded={userDropdownOpen}
                        aria-label="User account menu"
                    >
                        <div className="w-6 h-6 rounded-full bg-[#0B776C] flex items-center justify-center text-white text-xs font-bold font-mono">
                            {user?.initials || (user?.name ? user.name.charAt(0).toUpperCase() : 'A')}
                        </div>
                        <div className="hidden lg:block text-left">
                            <div className="text-xs font-semibold text-slate-100 leading-none">
                                {user?.name || 'Senior Analyst'}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-none mt-0.5">
                                {user?.role || 'Tier 2'} · UK SOC
                            </div>
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#0F1720] border border-[#1E293B] rounded-xl shadow-2xl py-1.5 z-50 text-xs">
                            <div className="px-3 py-1.5 border-b border-[#1E293B]">
                                <div className="font-semibold text-white">{user?.email || 'analyst@tacticlens.co.uk'}</div>
                                <div className="text-[10px] text-[#00E5FF]">Role: {user?.title || 'Analyst (Tier 2)'}</div>
                            </div>
                            <button
                                onClick={() => { setUserDropdownOpen(false); navigate('/settings'); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#1E293B] text-slate-300 transition-colors"
                            >
                                Organization Settings
                            </button>
                            <button
                                onClick={() => { setUserDropdownOpen(false); setIsModalOpen(true); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#1E293B] text-slate-300 transition-colors"
                            >
                                Accessibility Preferences
                            </button>
                            <button
                                onClick={() => { logout(); setUserDropdownOpen(false); navigate('/login'); }}
                                className="w-full text-left px-3 py-1.5 hover:bg-[#EF4444]/20 text-[#EF4444] transition-colors flex items-center gap-1.5"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
