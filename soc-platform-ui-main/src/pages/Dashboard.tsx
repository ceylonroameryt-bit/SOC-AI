import { useState } from 'react';
import { LayoutDashboard, Newspaper, Flame, BarChart3, Filter, Radio, ShieldAlert } from 'lucide-react';
import TelemetryCards from '../components/dashboard/TelemetryCards';
import NewsFeed from '../components/dashboard/NewsFeed';
import SeverityChart from '../components/dashboard/SeverityChart';
import CveTrackerWidget from '../components/dashboard/CveTrackerWidget';
import MitreMiniMatrix from '../components/dashboard/MitreMiniMatrix';
import AiExecutiveWidget from '../components/dashboard/AiExecutiveWidget';
import { useAccessibility } from '../context/AccessibilityContext';

type DashboardTab = 'overview' | 'news' | 'critical' | 'metrics';

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    const { announceMessage } = useAccessibility();

    const handleTabChange = (tab: DashboardTab, label: string) => {
        setActiveTab(tab);
        announceMessage(`Switched to ${label} tab`);
    };

    const handleSeverityChange = (sev: string | null) => {
        setSelectedSeverity(sev);
        announceMessage(`Filtered threat feed by priority: ${sev || 'All'}`);
    };

    const handleRefreshAll = () => {
        setRefreshTrigger(prev => prev + 1);
        announceMessage('Refreshing all telemetry and intelligence feeds');
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-5 max-w-7xl mx-auto w-full">
            {/* Header & Mission Control Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="section-label">SOC Mission Control</span>
                        <div
                            className="availability-chip text-[10px] py-0.5 px-2"
                            role="status"
                            aria-label="Threat Radar status: Live"
                        >
                            <span className="chip-dot" aria-hidden="true"></span>
                            <span className="font-semibold text-emerald-800">Threat Radar Live</span>
                        </div>
                    </div>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                        Security Operations &amp; Intelligence Dashboard
                    </h1>
                    <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                        Real-time intelligence aggregation across 102 dark web, vendor labs, and CISA feeds.
                    </p>
                </div>

                {/* Accessible WAI-ARIA Tab Switcher */}
                <div
                    role="tablist"
                    aria-label="Dashboard views"
                    className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200"
                >
                    <button
                        id="tab-overview"
                        role="tab"
                        aria-selected={activeTab === 'overview'}
                        aria-controls="panel-overview"
                        tabIndex={activeTab === 'overview' ? 0 : -1}
                        onClick={() => handleTabChange('overview', 'Mission Control')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            activeTab === 'overview'
                                ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                                : 'text-slate-700 hover:text-slate-900'
                        }`}
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Mission Control</span>
                    </button>

                    <button
                        id="tab-news"
                        role="tab"
                        aria-selected={activeTab === 'news'}
                        aria-controls="panel-news"
                        tabIndex={activeTab === 'news' ? 0 : -1}
                        onClick={() => handleTabChange('news', 'Global Stream')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            activeTab === 'news'
                                ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                                : 'text-slate-700 hover:text-slate-900'
                        }`}
                    >
                        <Newspaper className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Global Stream</span>
                    </button>

                    <button
                        id="tab-critical"
                        role="tab"
                        aria-selected={activeTab === 'critical'}
                        aria-controls="panel-critical"
                        tabIndex={activeTab === 'critical' ? 0 : -1}
                        onClick={() => handleTabChange('critical', 'Critical Radar')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            activeTab === 'critical'
                                ? 'bg-red-700 text-white shadow-sm shadow-red-500/20'
                                : 'text-red-700 hover:text-red-800 hover:bg-red-50'
                        }`}
                    >
                        <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Critical Radar</span>
                    </button>

                    <button
                        id="tab-metrics"
                        role="tab"
                        aria-selected={activeTab === 'metrics'}
                        aria-controls="panel-metrics"
                        tabIndex={activeTab === 'metrics' ? 0 : -1}
                        onClick={() => handleTabChange('metrics', 'Analytics')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                            activeTab === 'metrics'
                                ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                                : 'text-slate-700 hover:text-slate-900'
                        }`}
                    >
                        <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Analytics</span>
                    </button>
                </div>
            </div>

            {/* Top Telemetry Strip */}
            <section aria-label="System Telemetry Overview">
                <TelemetryCards onRefresh={handleRefreshAll} />
            </section>

            {/* Dynamic Content Views */}
            {activeTab === 'overview' && (
                <div
                    id="panel-overview"
                    role="tabpanel"
                    aria-labelledby="tab-overview"
                    className="space-y-5 focus:outline-none"
                    tabIndex={0}
                >
                    {/* Top Tier: AI Executive Brief + CISA KEV Tracker */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        <div className="lg:col-span-7">
                            <AiExecutiveWidget />
                        </div>
                        <div className="lg:col-span-5">
                            <CveTrackerWidget />
                        </div>
                    </div>

                    {/* Middle Tier: MITRE ATT&CK Mini Matrix */}
                    <MitreMiniMatrix />

                    {/* Bottom Tier: Live Intel Feed with Severity Filter bar */}
                    <div className="glass-card p-4 sm:p-5 bg-white space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                    <Radio className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <div>
                                    <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 leading-tight">
                                        Live Intelligence Stream
                                    </h2>
                                    <p className="text-[11px] text-slate-600">
                                        Chronological threat telemetry stream with automatic MITRE extraction
                                    </p>
                                </div>
                            </div>

                            {/* Severity Quick Chips */}
                            <div
                                role="radiogroup"
                                aria-label="Filter threat feed by priority severity"
                                className="flex items-center gap-1.5 flex-wrap"
                            >
                                <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                                    <Filter className="w-3 h-3" aria-hidden="true" /> Priority:
                                </span>
                                {['All', 'Critical', 'High', 'Medium', 'Low'].map(sev => {
                                    const isSelected =
                                        (sev === 'All' && !selectedSeverity) || selectedSeverity === sev;
                                    return (
                                        <button
                                            key={sev}
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            onClick={() => handleSeverityChange(sev === 'All' ? null : sev)}
                                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                                isSelected
                                                    ? sev === 'Critical'
                                                        ? 'bg-red-700 text-white border-red-700'
                                                        : sev === 'High'
                                                        ? 'bg-orange-700 text-white border-orange-700'
                                                        : 'bg-blue-700 text-white border-blue-700'
                                                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                            }`}
                                        >
                                            {sev}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Embedded Feed */}
                        <div key={refreshTrigger}>
                            <NewsFeed mode="all" severityFilter={selectedSeverity} />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'news' && (
                <div
                    id="panel-news"
                    role="tabpanel"
                    aria-labelledby="tab-news"
                    className="glass-card p-4 sm:p-5 bg-white focus:outline-none"
                    tabIndex={0}
                >
                    <NewsFeed mode="timeline" />
                </div>
            )}

            {activeTab === 'critical' && (
                <div
                    id="panel-critical"
                    role="tabpanel"
                    aria-labelledby="tab-critical"
                    className="glass-card p-4 sm:p-5 bg-white focus:outline-none"
                    tabIndex={0}
                >
                    <div className="mb-4 pb-3 border-b border-slate-200 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                            <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="font-display text-base font-bold text-slate-900">
                                High &amp; Critical Urgency Response Queue
                            </h2>
                            <p className="text-xs text-slate-600">
                                Filtered queue showing only high-impact zero-days, ransomware extortion, and active exploits.
                            </p>
                        </div>
                    </div>
                    <NewsFeed mode="critical" />
                </div>
            )}

            {activeTab === 'metrics' && (
                <div
                    id="panel-metrics"
                    role="tabpanel"
                    aria-labelledby="tab-metrics"
                    className="glass-card p-4 sm:p-5 bg-white min-h-[500px] focus:outline-none"
                    tabIndex={0}
                >
                    <SeverityChart />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
