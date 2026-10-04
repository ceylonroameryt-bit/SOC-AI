import React, { useState } from 'react';
import {
    Compass,
    Newspaper,
    Search,
    ShieldAlert,
    Radio,
    FileText,
    Settings,
    X,
    Shield,
    ChevronDown,
    ChevronRight,
    Bug,
    Network,
    BookOpen,
    Bot,
    Archive,
    Flame,
    Layers,
    Globe,
    Bookmark,
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
    activePaths?: string[];
    subLinks?: SubLink[];
}

// 7 primary navigation items specified by UI specification, mapping to existing working routes
const PRIMARY_NAV_ITEMS: NavSection[] = [
    {
        label: 'Explore',
        path: '/overview',
        icon: Compass,
        description: 'Threat overview & mission control',
        activePaths: ['/overview'],
    },
    {
        label: 'Intelligence',
        path: '/intelligence',
        icon: Newspaper,
        description: 'Category-based threat intelligence workspace',
        activePaths: ['/', '/intelligence', '/news', '/global-news'],
        subLinks: [
            { label: 'Threat Categories', path: '/intelligence?view=categories', icon: Layers },
            { label: 'Global Live News', path: '/intelligence?view=global-news', icon: Globe },
            { label: 'Saved Articles', path: '/intelligence?view=saved', icon: Bookmark },
        ],
    },
    {
        label: 'Indicators',
        path: '/investigate',
        icon: Search,
        description: 'IOC & CVE investigation and enrichment',
        activePaths: ['/investigate', '/enrich', '/vulnerabilities'],
        subLinks: [
            { label: 'IOC Enrichment', path: '/investigate', icon: Search },
            { label: 'Vulnerabilities & KEV', path: '/vulnerabilities', icon: Bug },
        ],
    },
    {
        label: 'Actors',
        path: '/threats',
        icon: ShieldAlert,
        description: 'Adversary campaigns & incident radar',
        activePaths: ['/threats', '/critical', '/archives'],
        subLinks: [
            { label: 'Incident Threats', path: '/threats', icon: ShieldAlert },
            { label: 'Critical Radar', path: '/critical', icon: Flame },
            { label: 'Archives', path: '/archives', icon: Archive },
        ],
    },
    {
        label: 'Collections',
        path: '/sources',
        icon: Radio,
        description: 'Feeds, connectors & source telemetry',
        activePaths: ['/sources'],
    },
    {
        label: 'Reports',
        path: '/reports',
        icon: FileText,
        description: 'Daily sitreps, AI briefings & exports',
        activePaths: ['/reports', '/ai'],
        subLinks: [
            { label: 'Reports Hub', path: '/reports', icon: FileText },
            { label: 'AI Executive Brief', path: '/ai', icon: Bot },
        ],
    },
    {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        description: 'Integrations, webhooks & API credentials',
        activePaths: ['/settings'],
    },
];

// Additional frameworks and tools retained so existing routes remain 100% accessible
const FRAMEWORK_ITEMS: SubLink[] = [
    { label: 'ATT&CK Heatmap', path: '/mitre', icon: Network },
    { label: 'Rule Library', path: '/rules', icon: BookOpen },
    { label: 'Detections Hub', path: '/detections', icon: Layers },
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

    const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        for (const section of PRIMARY_NAV_ITEMS) {
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
            className="w-[216px] h-full bg-[#142A43] text-slate-300 flex flex-col justify-between flex-shrink-0 select-none z-30 shadow-md border-r border-[#1B3655]"
        >
            {/* Top Brand Header */}
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="h-16 px-4 flex items-center justify-between border-b border-[#1B3655] flex-shrink-0">
                    <Link to="/intelligence" onClick={onClose} className="flex items-center gap-2.5 group">
                        <div className="w-8 h-8 rounded-lg bg-[#147DFA] flex items-center justify-center text-white font-bold shadow-xs">
                            <Shield className="w-4 h-4 text-white" aria-hidden="true" />
                        </div>
                        <div className="leading-tight">
                            <span className="font-bold text-white text-sm tracking-tight block">
                                NO ENTRY
                            </span>
                            <span className="text-[10px] text-slate-300 block font-normal tracking-wide">
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
                <nav className="p-3 space-y-1 overflow-y-auto flex-1 custom-scrollbar" aria-label="Main navigation">
                    <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Navigation
                    </div>

                    {PRIMARY_NAV_ITEMS.map((section) => {
                        const Icon = section.icon;
                        const active = isActiveSection(section, currentPath);
                        const hasSubLinks = !!(section.subLinks && section.subLinks.length > 0);
                        const isExpanded = expandedSections.has(section.path);

                        return (
                            <div key={section.path} className="space-y-0.5">
                                <div
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        active
                                            ? 'bg-[#147DFA] text-white shadow-xs font-semibold'
                                            : 'text-slate-300 hover:text-white hover:bg-[#1B3655]'
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
                                    {hasSubLinks ? (
                                        <>
                                            <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
                                            <span className="flex-1 truncate">{section.label}</span>
                                            {isExpanded
                                                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
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
                                            <span className="flex-1 truncate">{section.label}</span>
                                        </Link>
                                    )}
                                </div>

                                {/* Collapsible Sub-links */}
                                {hasSubLinks && isExpanded && (
                                    <div className="pl-6 pr-1 py-0.5 space-y-0.5">
                                        {section.subLinks!.map(sub => {
                                            const SubIcon = sub.icon;
                                            const subActive = currentPath === sub.path || currentPath.startsWith(sub.path + '?');
                                            return (
                                                <Link
                                                    key={sub.path}
                                                    to={sub.path}
                                                    onClick={onClose}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                                        subActive
                                                            ? 'bg-[#1B3655] text-white font-semibold'
                                                            : 'text-slate-400 hover:text-slate-200 hover:bg-[#1B3655]/60'
                                                    }`}
                                                    aria-current={subActive ? 'page' : undefined}
                                                >
                                                    <SubIcon className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                                                    <span className="truncate">{sub.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Quick Access Frameworks */}
                    <div className="pt-3">
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Frameworks & Rules
                        </div>
                        <div className="space-y-0.5 mt-0.5">
                            {FRAMEWORK_ITEMS.map(item => {
                                const SubIcon = item.icon;
                                const active = currentPath === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={onClose}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                            active
                                                ? 'bg-[#147DFA] text-white font-semibold'
                                                : 'text-slate-400 hover:text-white hover:bg-[#1B3655]'
                                        }`}
                                    >
                                        <SubIcon className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="truncate">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </nav>
            </div>

            {/* Bottom Brand / Version Status */}
            <div className="p-3 border-t border-[#1B3655] bg-[#102236] text-[11px] text-slate-400 space-y-1">
                {isDemoEnabled && (
                    <div className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold text-center mb-1">
                        DEMO MODE ACTIVE
                    </div>
                )}
                <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="font-medium text-slate-300">NO ENTRY SOC</span>
                    <span className="text-[10px] text-slate-400 font-mono">v2.4.0</span>
                </div>
                <div className="text-[10px] text-slate-400 px-1 truncate">
                    Enterprise Intelligence Grid
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
