import { useState, useRef, useEffect } from 'react';
import {
    LayoutDashboard, ShieldAlert, Shield, BarChart3, Flame,
    Database, Radio, Search, Target, BookOpen, Bot, Settings,
    Newspaper, ChevronDown
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

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
            { icon: Bot,      label: 'AI Brief',     path: '/ai' },
            { icon: Settings, label: 'Integrations', path: '/settings' },
        ]
    },
];

interface DropdownProps {
    section: typeof navSections[0];
    activePathname: string;
}

const NavDropdown = ({ section, activePathname }: DropdownProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const isSectionActive = section.items.some(
        item => activePathname === item.path ||
            (item.path === '/mitre-news' && activePathname === '/mitre/news')
    );

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={open}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSectionActive
                        ? 'text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
            >
                <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${isSectionActive ? 'text-blue-600' : 'text-slate-500'}`}>
                    {section.label}
                </span>
                <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${isSectionActive ? 'text-blue-500' : 'text-slate-400'}`}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div
                    className="absolute top-full left-0 mt-1.5 min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 z-50 py-1.5"
                    role="menu"
                    aria-label={`${section.label} navigation`}
                >
                    {section.items.map(item => {
                        const isActive =
                            activePathname === item.path ||
                            (item.path === '/mitre-news' && activePathname === '/mitre/news');
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                role="menuitem"
                                onClick={() => setOpen(false)}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors focus:outline-none focus:bg-blue-50 ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-800 font-bold'
                                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                                }`}
                            >
                                <item.icon
                                    className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                                    aria-hidden="true"
                                />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const quickLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Flame,           label: 'Critical',  path: '/critical' },
    { icon: Search,          label: 'IOC',        path: '/enrich' },
    { icon: Target,          label: 'MITRE',      path: '/mitre' },
    { icon: Bot,             label: 'AI Brief',   path: '/ai' },
];

const NavBar = () => {
    const location = useLocation();

    return (
        <nav
            aria-label="Primary Navigation"
            className="h-10 bg-white border-b border-slate-200/80 flex items-center px-4 gap-1 flex-shrink-0 overflow-x-auto custom-scrollbar select-none"
        >
            <div className="flex items-center gap-1.5 mr-3 flex-shrink-0">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center shadow-sm">
                    <Shield className="w-3 h-3 text-white" aria-hidden="true" />
                </div>
                <span className="font-display text-xs font-extrabold tracking-tight text-slate-800 hidden sm:block">
                    NO ENTRY
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_6px_#3B82F6] hidden sm:block" aria-hidden="true" />
            </div>

            <div className="w-px h-5 bg-slate-200 mr-2 flex-shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-0.5 mr-3 flex-shrink-0">
                {quickLinks.map(link => {
                    const isActive = location.pathname === link.path;
                    return (
                        <Link
                            key={link.label}
                            to={link.path}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <link.icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                            <span className="hidden md:inline">{link.label}</span>
                        </Link>
                    );
                })}
            </div>

            <div className="w-px h-5 bg-slate-200 mr-2 flex-shrink-0" aria-hidden="true" />

            <div className="flex items-center gap-0.5">
                {navSections.map(section => (
                    <NavDropdown
                        key={section.label}
                        section={section}
                        activePathname={location.pathname}
                    />
                ))}
            </div>

            <div className="flex-1" />

            <a
                href="https://sujampathirathnayaka.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="View Poorna Sujampathi Portfolio (opens in new tab)"
                aria-label="Poorna Sujampathi Portfolio (opens in new tab)"
            >
                <div
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-700 to-indigo-900 border border-blue-400/40 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    aria-hidden="true"
                >
                    PS
                </div>
                <div className="hidden lg:flex flex-col leading-none">
                    <span className="text-[10px] font-semibold text-slate-700">Poorna Sujampathi</span>
                    <span className="text-[9px] text-slate-500">Cyber Security Analyst</span>
                </div>
            </a>
        </nav>
    );
};

export default NavBar;
