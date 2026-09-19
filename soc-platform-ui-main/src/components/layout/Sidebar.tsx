import React, { useState } from 'react';
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
    Flame,
    ShieldAlert,
    Newspaper,
    ChevronDown,
    ChevronRight,
    Bug,
    Network,
    BookOpen,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
    onClose?: () => void;
    isDemoEnabled?: boolean;
}

interface SubLink {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    /** Any path that should activate this top-level item */
    activePaths?: string[];
    subLinks?: SubLink[];
}

// 8 primary navigation sections
const NAV_SECTIONS: NavSection[] = [
    {
        label: 'Overview',
        path: '/overview',
        icon: LayoutDashboard,
        description: 'Mission control & AI brief',
        subLinks: [
            { label: 'Dashboard', path: '/overview', icon: LayoutDashboard },
            { label: 'AI Brief', path: '/ai', icon: Bot },
        ],
    },
    {
        label: 'Threat Intelligence',
        path: '/intelligence',
        icon: Newspaper,
        description: 'News, incidents & critical radar',
        activePaths: ['/', '/intelligence', '/threats', '/archives', '/critical'],
        subLinks: [
            { label: 'Latest Intel', path: '/intelligence', icon: Shield },
            { label: 'Critical Radar', path: '/critical', icon: Flame },
            { label: 'Archives', path: '/archives', icon: Archive },
        ],
    },
    {
        label: 'Vulnerabilities',
        path: '/vulnerabilities',
        icon: Bug,
        description: 'CVEs, KEV & patch advisories',
        activePaths: ['/vulnerabilities'],
        subLinks: [
            { label: 'All Vulnerabilities', path: '/vulnerabilities', icon: Bug },
            { label: 'Known Exploited (KEV)', path: '/vulnerabilities?filter=kev', icon: ShieldAlert },
            { label: 'Recently Disclosed', path: '/vulnerabilities?filter=recent', icon: Newspaper },
        ],
    },
    {
        label: 'IOC Investigation',
        path: '/investigate',
        icon: Search,
        description: 'IOC & CVE enrichment',
        activePaths: ['/investigate', '/enrich'],
    },
    {
        label: 'Detection Engineering',
        path: '/detections',
        icon: Target,
        description: 'ATT&CK matrix, Sigma & YARA',
        activePaths: ['/detections', '/mitre', '/mitre-news', '/mitre/news', '/rules'],
        subLinks: [
            { label: 'ATT&CK Heatmap', path: '/mitre', icon: Network },
            { label: 'ATT&CK News', path: '/mitre-news', icon: Newspaper },
            { label: 'Rule Library', path: '/rules', icon: BookOpen },
        ],
    },
    {
        label: 'Saved & Reports',
        path: '/reports',
        icon: FileText,
        description: 'Daily sitreps, AI brief & exports',
        activePaths: ['/reports'],
        subLinks: [
            { label: 'Reports & Exports', path: '/reports', icon: FileText },
            { label: 'AI Brief', path: '/ai', icon: Bot },
        ],
    },
    {
        label: 'Source Health',
        path: '/sources',
        icon: Radio,
        description: 'Feeds, collectors & connectors',
    },
    {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        description: 'Integrations, webhooks & API keys',
    },
];

function isActiveSection(section: NavSection, path: string): boolean {
    if (path === section.path) return true;
    if (section.activePaths?.includes(path)) return true;
    if (section.path === '/intelligence' && path === '/') return true;
    if (section.subLinks?.some(sl => path === sl.path || path.startsWith(sl.path + '?'))) return true;
    return false;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, isDemoEnabled = false }) => {
    const location = useLocation();
    const currentPath = location.pathname;

    // Track which sections have their sub-links expanded
    const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
        // Auto-expand the section that contains the current path
        const initial = new Set<string>();
        for (const section of NAV_SECTIONS) {
            if (isActiveSection(section, currentPath)) {
                initial.add(section.path);
            }
        }
        return initial;
    });

    function toggleSection(sectionPath: string, hasSubLinks: boolean) {
        if (!hasSubLinks) return;
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionPath)) {
                next.delete(sectionPath);
            } else {
                next.add(sectionPath);
            }
            return next;
        });
    }

    return (
        <aside
            aria-label="Primary Navigation Sidebar"
            className="w-[232px] h-full bg-[#101F35] text-slate-300 flex flex-col justify-between flex-shrink-0 select-none z-30 shadow-md border-r border-[#1E2E48]"
        >
            {/* Top Brand Header */}
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="h-16 px-4 flex items-center justify-between border-b border-[#1A2D4A] flex-shrink-0">
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

                {/* Scrollable Navigation */}
                <nav className="p-3 space-y-0.5 overflow-y-auto flex-1 custom-scrollbar" aria-label="Main navigation">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Main
                    </div>

                    {NAV_SECTIONS.map((section) => {
                        const Icon = section.icon;
                        const active = isActiveSection(section, currentPath);
                        const hasSubLinks = !!(section.subLinks && section.subLinks.length > 0);
                        const isExpanded = expandedSections.has(section.path);

                        return (
                            <div key={section.path}>
                                {/* Top-level nav item */}
                                <div
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                        active
                                            ? 'bg-[#0665F9] text-white shadow-xs'
                                            : 'text-slate-300 hover:text-white hover:bg-[#182A45]'
                                    }`}
                                    role="button"
                                    tabIndex={0}
                                    aria-current={active && !hasSubLinks ? 'page' : undefined}
                                    aria-expanded={hasSubLinks ? isExpanded : undefined}
                                    onClick={() => {
                                        if (hasSubLinks) {
                                            toggleSection(section.path, hasSubLinks);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if (hasSubLinks) {
                                                toggleSection(section.path, hasSubLinks);
                                            }
                                        }
                                    }}
                                >
                                    {/* If no sub-links, wrap in Link; if has sub-links, just a div */}
                                    {hasSubLinks ? (
                                        <>
                                            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                                            <span className="flex-1">{section.label}</span>
                                            {isExpanded
                                                ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                            }
                                        </>
                                    ) : (
                                        <Link
                                            to={section.path}
                                            onClick={onClose}
                                            className="flex items-center gap-2.5 w-full"
                                            aria-current={active ? 'page' : undefined}
                                        >
                                            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                                            <span className="flex-1">{section.label}</span>
                                        </Link>
                                    )}
                                </div>

                                {/* Sub-links (shown when expanded or section is active) */}
                                {hasSubLinks && (isExpanded || active) && (
                                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#1E3A5F] pl-2">
                                        {section.subLinks!.map((sub) => {
                                            const SubIcon = sub.icon;
                                            const subActive = currentPath === sub.path ||
                                                (sub.path.includes('?') && location.pathname + location.search === sub.path);
                                            return (
                                                <Link
                                                    key={sub.path}
                                                    to={sub.path}
                                                    onClick={onClose}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                                        subActive
                                                            ? 'bg-[#0665F9]/20 text-white'
                                                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#182A45]'
                                                    }`}
                                                    aria-current={subActive ? 'page' : undefined}
                                                >
                                                    <SubIcon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                                    <span>{sub.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Section: Demo status and version */}
            <div className="p-3 border-t border-[#1A2D4A] space-y-2 text-xs flex-shrink-0">
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
