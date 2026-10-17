import React, { useState } from 'react';
import {
    Check,
    Shield,
    GraduationCap,
    HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Pricing: React.FC = () => {
    const [isAnnual, setIsAnnual] = useState(true);

    const faqs = [
        {
            q: "How does TacticLens tech-stack relevance work?",
            a: "You register your organization's products, versions, and perimeter assets. The platform correlates incoming CVEs and threat clusters, placing threats matching your perimeter at the top of your triage queue."
        },
        {
            q: "Do you invent or hallucinate CVSS, KEV, or EPSS data?",
            a: "Never. CVSS is sourced directly from NVD, KEV status from the CISA catalog, and EPSS from FIRST.org. Missing or synchronizing values display as '—' or 'stale' with timestamps."
        },
        {
            q: "How does the Education and Charity discount apply?",
            a: "Schools, Multi-Academy Trusts (MATs), colleges, universities, and registered UK charities receive a 30% discount across all paid subscription tiers."
        },
        {
            q: "Where is customer data hosted?",
            a: "All customer data and PostgreSQL databases are hosted in the UK (London region, eu-west-2) in compliance with UK GDPR and DPA requirements."
        }
    ];

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-[#0F1720] font-sans">
            {/* Header / Nav */}
            <header className="h-16 bg-[#0F1720] border-b border-[#1E293B] px-6 lg:px-12 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#0B776C] flex items-center justify-center text-white shadow-xs">
                        <Shield className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-white text-base tracking-tight font-display">TacticLens</span>
                </Link>
                <div className="flex items-center gap-4 text-xs font-semibold">
                    <Link to="/login" className="text-slate-300 hover:text-white transition-colors">
                        Sign In
                    </Link>
                    <Link
                        to="/login"
                        className="px-3.5 py-1.5 rounded-lg bg-[#0B776C] hover:bg-[#096057] text-white transition-colors font-medium shadow-xs"
                    >
                        Console Access
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="py-12 sm:py-16 px-4 max-w-6xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F2] border border-[#0B776C]/30 text-[#0B776C] text-xs font-semibold mb-4">
                    <GraduationCap className="w-4 h-4" />
                    <span>Education &amp; Charity SOCs: 30% off all plans</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0F1720] tracking-tight max-w-3xl mx-auto">
                    Subscription threat intelligence priced for UK SOC teams
                </h1>
                <p className="mt-4 text-sm sm:text-base text-[#5B6573] max-w-2xl mx-auto">
                    Every threat triaged, scored with deterministic evidence, and mapped to MITRE ATT&amp;CK® before your morning shift starts.
                </p>

                {/* Billing Interval Toggle */}
                <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <button
                        onClick={() => setIsAnnual(false)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            !isAnnual ? 'bg-[#0B776C] text-white shadow-2xs' : 'text-[#5B6573] hover:text-[#0F1720]'
                        }`}
                    >
                        Monthly Billing
                    </button>
                    <button
                        onClick={() => setIsAnnual(true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isAnnual ? 'bg-[#0B776C] text-white shadow-2xs' : 'text-[#5B6573] hover:text-[#0F1720]'
                        }`}
                    >
                        <span>Annual Billing</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-extrabold uppercase">
                            2 Months Free
                        </span>
                    </button>
                </div>
            </section>

            {/* Plan Cards Grid */}
            <section className="px-4 max-w-6xl mx-auto pb-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Free Card */}
                    <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-[#0F1720]">Free Community</h3>
                            <p className="text-xs text-[#5B6573] mt-1">Essential threat feeds for individual analysts and students.</p>
                            <div className="mt-6 mb-6">
                                <span className="text-4xl font-extrabold font-mono text-[#0F1720]">£0</span>
                                <span className="text-xs text-[#5B6573] ml-1">/ forever</span>
                            </div>
                            <ul className="space-y-2.5 text-xs text-[#0F1720] border-t border-[#E4E7EC] pt-4">
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> 1,000+ public security sources</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> 7-day threat history</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Severity &amp; ATT&amp;CK taxonomy</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> BYOK reputation lookup</li>
                            </ul>
                        </div>
                        <Link to="/login" className="mt-8 w-full py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-semibold text-[#0F1720] hover:bg-[#F3F4F6] text-center transition-colors">
                            Get Started
                        </Link>
                    </div>

                    {/* Pro Card */}
                    <div className="bg-white rounded-2xl p-6 border-2 border-[#0B776C] shadow-lg flex flex-col justify-between relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#0B776C] text-white text-[10px] font-bold uppercase tracking-wider font-mono">
                            MOST POPULAR
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-[#0F1720]">Pro Analyst</h3>
                            <p className="text-xs text-[#5B6573] mt-1">Full TQL query language, tech stack relevance, and AI summaries.</p>
                            <div className="mt-6 mb-6">
                                <span className="text-4xl font-extrabold font-mono text-[#0F1720]">
                                    {isAnnual ? '£15' : '£19'}
                                </span>
                                <span className="text-xs text-[#5B6573] ml-1">/ user / mo (ex VAT)</span>
                            </div>
                            <ul className="space-y-2.5 text-xs text-[#0F1720] border-t border-[#E4E7EC] pt-4">
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Everything in Free</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Full 365-day archive</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> TQL query compiler &amp; autocomplete</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Tech stack relevance (0–100 risk)</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> AI summaries with source citations</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Instant email alerting &amp; CSV</li>
                            </ul>
                        </div>
                        <Link to="/login" className="mt-8 w-full py-2.5 rounded-xl bg-[#0B776C] hover:bg-[#096057] text-white text-xs font-semibold text-center transition-colors shadow-xs">
                            Start 14-Day Pro Trial
                        </Link>
                    </div>

                    {/* Team Card */}
                    <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-[#0F1720]">SOC Team</h3>
                            <p className="text-xs text-[#5B6573] mt-1">Incident cases, live SLA timers, and ATT&amp;CK gaps for small SOCs.</p>
                            <div className="mt-6 mb-6">
                                <span className="text-4xl font-extrabold font-mono text-[#0F1720]">
                                    {isAnnual ? '£49' : '£59'}
                                </span>
                                <span className="text-xs text-[#5B6573] ml-1">/ seat / mo (min 3)</span>
                            </div>
                            <ul className="space-y-2.5 text-xs text-[#0F1720] border-t border-[#E4E7EC] pt-4">
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Everything in Pro</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> P1–P4 Incident Cases &amp; SLA timers</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> ATT&amp;CK coverage &amp; gap matrix</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Microsoft Teams &amp; Slack alerts</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> STIX 2.1 / MISP / OpenCTI export</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Weekly CISO executive briefing</li>
                            </ul>
                        </div>
                        <Link to="/login" className="mt-8 w-full py-2.5 rounded-xl bg-[#0F1720] hover:bg-[#1E293B] text-white text-xs font-semibold text-center transition-colors shadow-xs">
                            Start Team Trial
                        </Link>
                    </div>

                    {/* MSSP Card */}
                    <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC] shadow-xs flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-lg text-[#0F1720]">MSSP Partner</h3>
                            <p className="text-xs text-[#5B6573] mt-1">Multi-tenant estates and client SLAs for managed service providers.</p>
                            <div className="mt-6 mb-6">
                                <span className="text-4xl font-extrabold font-mono text-[#0F1720]">Custom</span>
                                <span className="text-xs text-[#5B6573] ml-1">/ estate scale</span>
                            </div>
                            <ul className="space-y-2.5 text-xs text-[#0F1720] border-t border-[#E4E7EC] pt-4">
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Everything in Team</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Multi-tenant client switching</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Per-client tech stacks &amp; custom SLAs</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> White-label executive sitreps</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Public REST API &amp; Webhooks</li>
                                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#0B776C]" /> Enterprise SSO (Entra ID, Google)</li>
                            </ul>
                        </div>
                        <a href="mailto:partners@tacticlens.co.uk" className="mt-8 w-full py-2.5 rounded-xl border border-[#E4E7EC] text-xs font-semibold text-[#0F1720] hover:bg-[#F3F4F6] text-center transition-colors">
                            Talk to Security Team
                        </a>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-12 bg-white border-t border-[#E4E7EC] px-4">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-[#0F1720] text-center mb-8">Frequently Asked Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {faqs.map((f, i) => (
                            <div key={i} className="p-4 rounded-xl border border-[#E4E7EC] bg-[#F3F4F6]/50">
                                <div className="font-semibold text-xs text-[#0F1720] flex items-center gap-2 mb-1.5">
                                    <HelpCircle className="w-4 h-4 text-[#0B776C]" />
                                    <span>{f.q}</span>
                                </div>
                                <p className="text-xs text-[#5B6573] leading-relaxed">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Mandatory Attribution Footer (CLAUDE.md §3) */}
            <footer className="py-8 bg-[#0F1720] text-[#94A3B8] border-t border-[#1E293B] px-6 text-xs text-center">
                <p className="mb-2">
                    MITRE ATT&amp;CK® is a registered trademark of The MITRE Corporation.
                </p>
                <p className="text-[11px] text-slate-500">
                    CVSS telemetry credited to the National Vulnerability Database (NVD). Known Exploited Vulnerabilities credited to CISA KEV. EPSS telemetry credited to FIRST.org.
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                    © 2026 TacticLens Limited. All rights reserved. Data hosted in London, UK (eu-west-2).
                </p>
            </footer>
        </div>
    );
};

export default Pricing;
