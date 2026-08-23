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
        <aside className="w-72 sm:w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl lg:shadow-none select-none">
            {/* Header with Mobile Close Button */}
            <div className="h-16 flex items-center px-5 border-b border-slate-800 justify-between flex-shrink-0">
                <div className="flex items-center">
                    <Shield className="w-7 h-7 text-cyan-500 mr-2.5" />
                    <span className="text-lg font-bold tracking-wider text-slate-100">
                        NO <span className="text-cyan-500">ENTRY</span>
                    </span>
                </div>
                {/* Close Button on Mobile */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
                        aria-label="Close Sidebar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Nav Items List */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-4 custom-scrollbar">
                {navSections.map(section => (
                    <div key={section.label}>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5">
                            {section.label}
                        </p>
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = location.pathname === item.path ||
                                    (item.path === '/mitre-news' && location.pathname === '/mitre/news');

                                return (
                                    <Link
                                        key={item.label}
                                        to={item.path}
                                        onClick={onClose}
                                        className={`w-full flex items-center px-3.5 py-2.5 rounded-xl transition-all group min-h-[42px] ${
                                            isActive
                                                ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
                                                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 border border-transparent'
                                        }`}
                                    >
                                        <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 transition-colors ${
                                            isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-200'
                                        }`} />
                                        <span className="text-sm truncate">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Profile Footer */}
            <div className="p-3.5 border-t border-slate-800 flex-shrink-0 bg-slate-900/60">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 flex-shrink-0">
                        SR
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate">Sujampathi Rathnayaka</p>
                        <p className="text-[11px] text-slate-500 truncate">Security Analyst</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
