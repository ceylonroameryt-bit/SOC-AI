import React, { useState } from 'react';
import { FileDown, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config/api';

export const ReportsHub: React.FC = () => {
    const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
    const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

    const handleDownload = async (url: string, filename: string, key: string) => {
        setDownloadingFormat(key);
        setDownloadSuccess(null);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(blobUrl);
            setDownloadSuccess(key);
            setTimeout(() => setDownloadSuccess(null), 3000);
        } catch (err) {
            console.error('Download error:', err);
        } finally {
            setDownloadingFormat(null);
        }
    };

    const dateStr = new Date().toISOString().split('T')[0];

    const reportCards = [
        {
            title: 'Daily Intelligence Sitrep (PDF)',
            description: 'Executive PDF-1.4 briefing including priority threats, ATT&CK correlation, and source telemetry.',
            buttonText: 'Download PDF',
            formatKey: 'daily-pdf',
            filename: `no-entry-daily-report-${dateStr}.pdf`,
            endpoint: `${API_BASE}/api/reports/daily?format=pdf`,
            badge: 'PDF-1.4',
            badgeColor: 'bg-red-50 text-red-700 border-red-200'
        },
        {
            title: 'Daily Operational Report (DOCX)',
            description: 'Editable Microsoft Word OpenXML document structured for enterprise briefings and editing.',
            buttonText: 'Download DOCX',
            formatKey: 'daily-docx',
            filename: `no-entry-daily-report-${dateStr}.docx`,
            endpoint: `${API_BASE}/api/reports/daily?format=docx`,
            badge: 'OpenXML DOCX',
            badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
        },
        {
            title: 'Threat Intelligence Export (STIX 2.1)',
            description: 'OASIS STIX 2.1 compliant indicator bundle for ingestion into SIEMs, SOARs, and TIPs.',
            buttonText: 'Export STIX 2.1',
            formatKey: 'threats-stix',
            filename: `no-entry-threats-stix2-${dateStr}.json`,
            endpoint: `${API_BASE}/api/reports/export/threats?format=stix`,
            badge: 'STIX 2.1',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        },
        {
            title: 'Threat Detections History (CSV)',
            description: 'Full spreadsheet export of detected ransomware, exploits, zero-days, and associated IOCs.',
            buttonText: 'Export CSV',
            formatKey: 'threats-csv',
            filename: `no-entry-threats-${dateStr}.csv`,
            endpoint: `${API_BASE}/api/reports/export/threats?format=csv`,
            badge: 'CSV Table',
            badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
        },
        {
            title: 'Intelligence Stream Archive (CSV)',
            description: 'Chronological raw feed archive including published timestamps, sources, and normalized severity.',
            buttonText: 'Export News CSV',
            formatKey: 'news-csv',
            filename: `no-entry-news-${dateStr}.csv`,
            endpoint: `${API_BASE}/api/reports/export/news?format=csv`,
            badge: 'CSV Table',
            badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
        },
        {
            title: 'Intelligence Stream JSON (JSON)',
            description: 'Machine-readable JSON data export suitable for custom analytics pipelines and scripts.',
            buttonText: 'Export JSON',
            formatKey: 'news-json',
            filename: `no-entry-news-${dateStr}.json`,
            endpoint: `${API_BASE}/api/reports/export/news?format=json`,
            badge: 'JSON API',
            badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
        }
    ];

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto w-full">
            <div className="pb-3 border-b border-[#E2E8F0]">
                <span className="text-[11px] font-semibold text-[#0665F9] uppercase tracking-wider bg-[#EAF2FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                    Executive Disclosures &amp; Exports
                </span>
                <h1 className="text-2xl sm:text-[30px] font-bold text-[#0F172A] tracking-tight font-sans mt-1">
                    Reports &amp; Intelligence Exports
                </h1>
                <p className="text-[#64748B] text-xs sm:text-sm mt-0.5">
                    Download verified executive briefings, compliance reports, and structured threat feeds in standard formats.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {reportCards.map(card => {
                    const isDownloading = downloadingFormat === card.formatKey;
                    const isSuccess = downloadSuccess === card.formatKey;

                    return (
                        <div
                            key={card.formatKey}
                            className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between shadow-2xs hover:border-[#CBD5E1] transition-colors"
                        >
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${card.badgeColor}`}>
                                        {card.badge}
                                    </span>
                                    <FileDown className="w-4 h-4 text-[#94A3B8]" />
                                </div>
                                <h2 className="text-base font-semibold text-[#0F172A] leading-snug">
                                    {card.title}
                                </h2>
                                <p className="text-xs text-[#64748B] leading-relaxed">
                                    {card.description}
                                </p>
                            </div>

                            <div className="mt-5 pt-3 border-t border-[#F1F5F9]">
                                <button
                                    onClick={() => handleDownload(card.endpoint, card.filename, card.formatKey)}
                                    disabled={isDownloading}
                                    className="w-full py-2 px-3 rounded-md bg-[#0665F9] hover:bg-[#0554D0] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9] disabled:opacity-50"
                                >
                                    {isSuccess ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Downloaded</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileDown className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                                            <span>{isDownloading ? 'Generating...' : card.buttonText}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ReportsHub;
