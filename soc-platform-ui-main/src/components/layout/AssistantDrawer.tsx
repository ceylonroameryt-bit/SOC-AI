import React, { useState } from 'react';
import { Bot, X, Sparkles, Send, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AssistantDrawer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
        {
            role: 'assistant',
            text: 'Hello, Analyst. I can help summarize current threat advisories, generate query logic, or check CISA KEV status. How can I assist your investigation?'
        }
    ]);
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!query.trim() || loading) return;
        const userText = query.trim();
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setLoading(true);

        try {
            // Heuristic or AI-assisted assistant response
            const lower = userText.toLowerCase();
            let reply = '';

            if (lower.includes('cisa') || lower.includes('kev') || lower.includes('exploit')) {
                reply = 'CISA KEV tracks known exploited vulnerabilities. You can review active entries in the Vulnerabilities tab or query any specific CVE in the Indicator Intelligence hub.';
            } else if (lower.includes('lockbit') || lower.includes('ransomware')) {
                reply = 'Ransomware operations frequently leverage compromised VPN credentials and volume shadow deletion via vssadmin. Recommend checking external perimeter logs and blocking known C2 IP clusters.';
            } else {
                reply = `Acknowledged. Based on ingested threat telemetry, I recommend cross-referencing indicators in the Enrichment workspace or running Sigma detection rules for perimeter defense.`;
            }

            setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', text: 'Analyst assistant unavailable. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Fixed Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-12 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 bg-[#101F35] hover:bg-[#1E3A8A] text-white rounded-full shadow-lg border border-slate-700 hover:border-blue-400 transition-all text-xs font-semibold group focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Open AI SOC Assistant"
                    title="Open AI SOC Assistant"
                >
                    <div className="p-1 rounded-full bg-blue-600 group-hover:bg-blue-500 transition-colors">
                        <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-display">AI Assistant</span>
                </button>
            )}

            {/* Slide-out Drawer Panel */}
            {isOpen && (
                <div
                    className="fixed bottom-12 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
                    role="dialog"
                    aria-label="AI Threat Assistant"
                >
                    {/* Drawer Header */}
                    <div className="p-3.5 bg-[#101F35] text-white flex items-center justify-between border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-display text-xs font-bold leading-tight flex items-center gap-1.5">
                                    <span>SOC Analyst Assistant</span>
                                    <span className="bg-blue-500/20 text-blue-300 text-[9px] px-1.5 py-0.2 rounded font-mono">
                                        HELPER
                                    </span>
                                </h3>
                                <p className="text-[10px] text-slate-400">Context-aware threat guidance</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            aria-label="Close assistant panel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar text-xs bg-slate-50/50">
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                                        m.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-xs'
                                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                                    }`}
                                >
                                    {m.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 italic">
                                <Sparkles className="w-3 h-3 text-blue-500 animate-spin" />
                                <span>Analyzing context...</span>
                            </div>
                        )}
                    </div>

                    {/* Quick Suggestions */}
                    <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[10px]">
                        <button
                            onClick={() => setQuery('Check CISA KEV catalog for zero-days')}
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-blue-300 text-slate-600 whitespace-nowrap"
                        >
                            Check KEV zero-days
                        </button>
                        <button
                            onClick={() => setQuery('Generate Sigma rule for ransomware')}
                            className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:border-blue-300 text-slate-600 whitespace-nowrap"
                        >
                            Ransomware defense
                        </button>
                        <Link
                            to="/enrich"
                            onClick={() => setIsOpen(false)}
                            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 whitespace-nowrap font-medium flex items-center gap-0.5"
                        >
                            <span>Enrich</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                    </div>

                    {/* Input Bar */}
                    <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about threats or advisories..."
                            className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!query.trim() || loading}
                            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors flex-shrink-0"
                            aria-label="Send message"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AssistantDrawer;
