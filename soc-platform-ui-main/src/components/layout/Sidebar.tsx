import {
    LayoutDashboard, ShieldAlert, Shield, BarChart3, Flame,
    Database, Radio, Search, Target, BookOpen, Bot, Settings,
    Newspaper, X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
    onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
    const location = useLocation();

    const navSections = [
        {
            label: 'Intelligence',
            items: [
                { icon: LayoutDashboard, label: 'Global News',       path: '/' },
                { icon: BarChart3,       label: 'Severity Analysis', path: '/metrics' },
                { icon: Flame,           label: 'Critical Threats',  path: '/critical' },
                { icon: ShieldAlert,     label: 'Threat Intel',      path: '/threats' },
                { icon: Database,        label: 'Data Archives',     path: '/archives' },
                { icon: Radio,           label: 'Intel Sources',     path: '/sources' },
            ]
        },
        {
            label: 'Enrichment',
            items: [
                { icon: Search, label: 'IOC Enrichment', path: '/enrich' },
            ]
        },
        {
            label: 'Frameworks',
            items: [
                { icon: Newspaper, label: 'ATT&CK News Matrix', path: '/mitre-news' },
                { icon: Target,    label: 'MITRE Heatmap',      path: '/mitre' },
                { icon: BookOpen,  label: 'Rule Library',       path: '/rules' },
            ]
        },
        {
            label: 'AI & Ops',
            items: [
                { icon: Bot,      label: 'AI Brief',      path: '/ai' },
                { icon: Settings, label: 'Integrations',  path: '/settings' },
            ]
        },
    ];

    return (
        <aside
            aria-label="Main Navigation Sidebar"
            className="w-72 sm:w-64 h-full bg-white border-r border-[#E2E8F0] flex flex-col shadow-sm select-none"
        >
            {/* Header with Mobile Close Button */}
            <div className="h-16 flex items-center px-5 border-b border-[#E2E8F0] justify-between flex-shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20 border border-blue-400/30 flex-shrink-0">
                        <Shield className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <span className="font-display text-base font-extrabold tracking-tight text-[#0F172A]">
                                NO ENTRY
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_6px_#3B82F6]" aria-hidden="true"></span>
                        </div>
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-600 font-mono">
                            Threat Intelligence
                        </span>
                    </div>
                </div>
                {/* Close Button on Mobile */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden transition-colors focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        aria-label="Close Navigation Sidebar"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Nav Items List */}
            <nav aria-label="Primary Navigation" className="flex-1 py-3 px-3 overflow-y-auto space-y-3.5 custom-scrollbar bg-white">
                {navSections.map(section => (
                    <div key={section.label} role="group" aria-label={section.label}>
                        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest px-3 mb-1 font-mono">
                            {section.label}
                        </p>
                        <div className="space-y-0.5" role="list">
                            {section.items.map((item) => {
                                const isActive = location.pathname === item.path ||
                                    (item.path === '/mitre-news' && location.pathname === '/mitre/news');

                                return (
                                    <div key={item.label} role="listitem">
                                        <Link
                                            to={item.path}
                                            onClick={onClose}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={`w-full flex items-center px-3 py-2 rounded-xl transition-all group min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                                isActive
                                                    ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200 shadow-sm'
                                                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent font-medium'
                                            }`}
                                        >
                                            <item.icon className={`w-4 h-4 mr-2.5 flex-shrink-0 transition-colors ${
                                                isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
                                            }`} aria-hidden="true" />
                                            <span className="text-xs truncate">{item.label}</span>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Profile Footer linked to portfolio */}
            <div className="p-3 border-t border-[#E2E8F0] flex-shrink-0 bg-slate-50/80">
                <a
                    href="https://sujampathirathnayaka.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-600"
                    title="View Sujampathi's Portfolio (opens in new tab)"
                    aria-label="View Poorna Sujampathi's Portfolio, Cyber Security Analyst (opens in new tab)"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-indigo-900 border border-blue-400/40 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-sm" aria-hidden="true">
                        PS
                    </div>
                    <div className="ml-2.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">Poorna Sujampathi</p>
                            <span className="text-[10px] text-blue-600" aria-hidden="true">↗</span>
                        </div>
                        <p className="text-[10px] text-slate-600 truncate">Cyber Security Analyst</p>
                    </div>
                </a>
            </div>
        </aside>
    );
};

export default Sidebar;
