import React from 'react';
import {
    LayoutDashboard,
    Shield,
    Search,
    Target,
    FileText,
    Radio,
    Settings,
    X,
    AlertOctagon,
    Bot,
    Archive,
    Flame
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
    onClose?: () => void;
    isDemoEnabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, isDemoEnabled = false }) => {
    const location = useLocation();
    const currentPath = location.pathname;

    const navItems = [
        {
            label: 'Overview',
            path: '/overview',
            icon: LayoutDashboard,
            description: 'Mission control telemetry'
        },
        {
            label: 'Intelligence',
            path: '/intelligence',
            aliases: ['/'],
            icon: Shield,
            description: 'Analyst triage & stream'
        },
        {
            label: 'Investigate',
            path: '/investigate',
            aliases: ['/enrich'],
            icon: Search,
            description: 'IOC & CVE enrichment'
        },
        {
            label: 'Detections',
            path: '/detections',
            aliases: ['/mitre', '/mitre-news', '/rules'],
            icon: Target,
            description: 'ATT&CK matrix & Sigma'
        },
        {
            label: 'Reports',
            path: '/reports',
            icon: FileText,
            description: 'Daily sitreps & export'
        },
        {
            label: 'Source Health',
            path: '/sources',
            icon: Radio,
            description: 'Feeds & collectors'
        },
        {
            label: 'Settings',
            path: '/settings',
            icon: Settings,
            description: 'Integrations & webhooks'
        }
    ];

    // Secondary sub-navigation links to preserve deep link access
    const secondaryItems = [
        { label: 'Critical Radar', path: '/critical', icon: Flame },
        { label: 'AI Brief', path: '/ai', icon: Bot },
        { label: 'Archives', path: '/archives', icon: Archive }
    ];

    const isItemActive = (item: typeof navItems[0]) => {
        if (currentPath === item.path) return true;
        if (item.aliases && item.aliases.includes(currentPath)) return true;
        if (item.path === '/intelligence' && currentPath === '/') return true;
        return false;
    };

    return (
        <aside
            aria-label="Primary Navigation Sidebar"
            className="w-[232px] h-full bg-[#101F35] text-slate-300 flex flex-col justify-between flex-shrink-0 select-none z-30 shadow-md border-r border-[#1E2E48]"
        >
            {/* Top Brand Header */}
            <div>
                <div className="h-16 px-4 flex items-center justify-between border-b border-[#1A2D4A]">
                    <Link to="/intelligence" onClick={onClose} className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-md bg-[#0665F9] flex items-center justify-center text-white font-bold shadow-xs">
                            <Shield className="w-4 h-4 text-white" aria-hidden="true" />
                        </div>
                        <div className="leading-tight">
                            <span className="font-bold text-white text-sm tracking-tight block">
                                NO ENTRY
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal tracking-wide">
                                Threat Intelligence Platform
                            </span>
                        </div>
                    </Link>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="lg:hidden p-1 text-slate-400 hover:text-white rounded focus:outline-none"
                            aria-label="Close navigation sidebar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Primary Navigation List */}
                <nav className="p-3 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Main
                    </div>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isItemActive(item);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                    active
                                        ? 'bg-[#0665F9] text-white shadow-xs'
                                        : 'text-slate-300 hover:text-white hover:bg-[#182A45]'
                                }`}
                                aria-current={active ? 'page' : undefined}
                            >
                                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}

                    {/* Quick Jump Secondary Links */}
                    <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Intelligence Views
                    </div>
                    {secondaryItems.map((sub) => {
                        const Icon = sub.icon;
                        const active = currentPath === sub.path;
                        return (
                            <Link
                                key={sub.path}
                                to={sub.path}
                                onClick={onClose}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    active
                                        ? 'bg-[#0665F9] text-white'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#182A45]'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
                                <span>{sub.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Section: Demo status and version */}
            <div className="p-3 border-t border-[#1A2D4A] space-y-2 text-xs">
                {isDemoEnabled && (
                    <div className="bg-amber-400/20 border border-amber-400/30 rounded p-2 text-amber-200 text-[11px] flex items-center gap-1.5 font-mono">
                        <AlertOctagon className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
                        <span>Demo Mode Active</span>
                    </div>
                )}

                <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-mono">
                    <span>Platform v2.4.0</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="System Operational" />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
