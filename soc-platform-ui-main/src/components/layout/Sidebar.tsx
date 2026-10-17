import React from 'react';
import {
    Compass,
    Search,
    ShieldAlert,
    Network,
    FileText,
    Sliders,
    Server,
    Settings,
    Shield,
    X
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
    onClose?: () => void;
    isDemoEnabled?: boolean;
}

interface RailItem {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    matchPaths: string[];
}

const PRIMARY_RAIL_ITEMS: RailItem[] = [
    {
        label: 'Overview',
        path: '/overview',
        icon: Compass,
        matchPaths: ['/overview']
    },
    {
        label: 'Explorer',
        path: '/intelligence',
        icon: Search,
        matchPaths: ['/', '/intelligence', '/news', '/global-news', '/explorer']
    },
    {
        label: 'Cases',
        path: '/threats',
        icon: ShieldAlert,
        matchPaths: ['/threats', '/critical', '/archives']
    },
    {
        label: 'ATT&CK',
        path: '/mitre',
        icon: Network,
        matchPaths: ['/mitre', '/mitre-news', '/detections']
    },
    {
        label: 'Briefs',
        path: '/reports',
        icon: FileText,
        matchPaths: ['/reports', '/ai']
    },
    {
        label: 'Rules',
        path: '/rules',
        icon: Sliders,
        matchPaths: ['/rules']
    }
];

const SECONDARY_RAIL_ITEMS: RailItem[] = [
    {
        label: 'Stack',
        path: '/settings?tab=stack',
        icon: Server,
        matchPaths: ['/settings?tab=stack']
    },
    {
        label: 'Admin',
        path: '/settings',
        icon: Settings,
        matchPaths: ['/settings']
    }
];

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
    const location = useLocation();
    const currentPath = location.pathname + location.search;

    const isItemActive = (item: RailItem) => {
        if (item.matchPaths.some(p => location.pathname === p || currentPath.startsWith(p))) {
            return true;
        }
        return false;
    };

    return (
        <aside
            aria-label="TacticLens Primary Icon Rail"
            className="w-[72px] h-full bg-[#FFFFFF] border-r border-[#E4E7EC] flex flex-col items-center justify-between py-3 select-none z-30 shadow-xs"
        >
            {/* Top Brand Logo */}
            <div className="flex flex-col items-center w-full">
                <Link
                    to="/overview"
                    onClick={onClose}
                    className="w-10 h-10 rounded-xl bg-[#0F1720] flex items-center justify-center text-white shadow-xs hover:bg-[#1E293B] transition-all group mb-4"
                    title="TacticLens — SOC Triage Console"
                >
                    <Shield className="w-5 h-5 text-[#00E5FF] group-hover:scale-110 transition-transform" />
                </Link>

                {onClose && (
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 mb-2 rounded"
                        aria-label="Close navigation"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Main Navigation Rail */}
                <nav className="flex flex-col items-center gap-1.5 w-full px-2" aria-label="Main Navigation">
                    {PRIMARY_RAIL_ITEMS.map((item) => {
                        const active = isItemActive(item);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={onClose}
                                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all group relative ${
                                    active
                                        ? 'bg-[#0B776C] text-white font-medium shadow-xs'
                                        : 'text-[#5B6573] hover:text-[#0F1720] hover:bg-[#F3F4F6]'
                                }`}
                                title={item.label}
                                aria-label={item.label}
                            >
                                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'group-hover:scale-105 transition-transform'}`} />
                                <span className={`text-[10px] font-sans leading-none ${active ? 'text-white font-semibold' : 'text-[#5B6573]'}`}>
                                    {item.label}
                                </span>
                                {active && (
                                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#0B776C] rounded-r-md" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Divider & Secondary Rail (Stack, Admin) */}
            <div className="flex flex-col items-center w-full px-2">
                <div className="w-8 border-t border-[#E4E7EC] my-2" />

                <nav className="flex flex-col items-center gap-1.5 w-full" aria-label="Secondary Navigation">
                    {SECONDARY_RAIL_ITEMS.map((item) => {
                        const active = isItemActive(item);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={onClose}
                                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all group relative ${
                                    active
                                        ? 'bg-[#0B776C] text-white font-medium shadow-xs'
                                        : 'text-[#5B6573] hover:text-[#0F1720] hover:bg-[#F3F4F6]'
                                }`}
                                title={item.label}
                                aria-label={item.label}
                            >
                                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'group-hover:scale-105 transition-transform'}`} />
                                <span className={`text-[10px] font-sans leading-none ${active ? 'text-white font-semibold' : 'text-[#5B6573]'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
};

export default Sidebar;
