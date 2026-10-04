import React from 'react';
import { Target, Newspaper, BookOpen, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DetectionsHub: React.FC = () => {
    const sections = [
        {
            title: 'MITRE ATT&CK Enterprise Matrix',
            description: '14 Enterprise tactics mapped against incoming real-time telemetry with technique execution counts.',
            path: '/mitre',
            icon: Target,
            badge: 'v16 Framework',
            color: 'text-purple-600 bg-purple-50 border-purple-200'
        },
        {
            title: 'ATT&CK News Matrix Stream',
            description: 'Automated extraction of tactic and technique references directly from security feeds and advisories.',
            path: '/mitre-news',
            icon: Newspaper,
            badge: 'Feed Correlation',
            color: 'text-blue-600 bg-blue-50 border-blue-200'
        },
        {
            title: 'Detection Rule Library',
            description: 'Curated repository of YARA signatures, Sigma rules, and IOC hunting queries.',
            path: '/rules',
            icon: BookOpen,
            badge: 'Sigma & YARA',
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
        }
    ];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto w-full">
            <div className="pb-3 border-b border-[#E2E8F0]">
                <span className="text-[11px] font-semibold text-[#0665F9] uppercase tracking-wider bg-[#EAF2FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                    Adversary Tradecraft
                </span>
                <h1 className="text-2xl sm:text-[30px] font-bold text-[#0F172A] tracking-tight font-sans mt-1">
                    Detections &amp; Frameworks
                </h1>
                <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">
                    MITRE ATT&CK correlation, adversarial tactics, and detection engineering rule repository.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {sections.map(s => {
                    const Icon = s.icon;
                    return (
                        <Link
                            key={s.path}
                            to={s.path}
                            className="bg-white border border-[#E2E8F0] rounded-lg p-5 hover:border-[#0665F9] transition-all flex flex-col justify-between shadow-2xs group"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className={`p-2 rounded-md border ${s.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[11px] font-mono font-medium text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded">
                                        {s.badge}
                                    </span>
                                </div>
                                <h2 className="text-base font-semibold text-[#0F172A] group-hover:text-[#0665F9] transition-colors">
                                    {s.title}
                                </h2>
                                <p className="text-xs text-[#64748B] leading-relaxed">
                                    {s.description}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#0665F9] font-medium">
                                <span>Open module</span>
                                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default DetectionsHub;
