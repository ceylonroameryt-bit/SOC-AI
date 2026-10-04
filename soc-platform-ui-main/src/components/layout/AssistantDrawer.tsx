import React, { useState } from 'react';
import { Bot, X, Sparkles, Send, ShieldAlert, FileCode2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AssistantDrawer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputQuery, setInputQuery] = useState('');

    return (
        <>
            {/* Compact Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-10 right-6 z-30 flex items-center gap-2 px-3 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-full shadow-lg border border-slate-700 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Open SOC Intelligence Assistant"
                    aria-label="Open SOC Intelligence Assistant"
                >
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold pr-1 hidden sm:inline">SOC Assistant</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </button>
            )}

            {/* Slide-over Right Assistant Panel */}
            {isOpen && (
                <div
                    className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
                    role="dialog"
                    aria-label="SOC Intelligence Assistant Panel"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-display text-sm font-bold text-slate-900 leading-tight">
                                    SOC Assistant
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Operational Triage &amp; Threat Intelligence
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                            aria-label="Close assistant"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar text-xs">
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-slate-700 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                <span>Autonomous Telemetry Ingestion</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                Ask about active threats, query indicators, or generate defensive Sigma detection rules directly from PostgreSQL records.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                                Quick Workflows
                            </span>
                            <div className="space-y-1.5">
                                <Link
                                    to="/ai"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                        <span className="font-medium text-slate-800">Executive Threat Briefing</span>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                </Link>

                                <Link
                                    to="/rules"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileCode2 className="w-4 h-4 text-purple-600" />
                                        <span className="font-medium text-slate-800">Sigma &amp; YARA Rule Library</span>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                </Link>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] space-y-1">
                            <div className="font-semibold text-slate-800">Operational Notice</div>
                            <p>
                                Threat briefings and SIEM queries run strictly against authenticated, database-backed intelligence. No hallucinated records are generated.
                            </p>
                        </div>
                    </div>

                    {/* Quick Query Input */}
                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!inputQuery.trim()) return;
                                window.location.href = `/enrich?ioc=${encodeURIComponent(inputQuery.trim())}`;
                            }}
                            className="flex items-center gap-2"
                        >
                            <input
                                type="text"
                                placeholder="Lookup IOC, CVE, or IP..."
                                value={inputQuery}
                                onChange={(e) => setInputQuery(e.target.value)}
                                className="flex-1 text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                type="submit"
                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Run lookup"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
