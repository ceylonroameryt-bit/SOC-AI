import React from 'react';
import { X, ExternalLink, ShieldCheck, Target, Search, FileDown, ShieldAlert, ArrowUpRight, CheckCircle2, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SeverityBadge from './SeverityBadge';
import { INTEL_CATEGORY_LABELS } from './IntelligenceTable';
import { API_BASE } from '../../config/api';

export interface IntelligenceRecord {
    id?: string;
    title: string;
    link: string;
    source: string;
    pubDate: string;
    severity?: string;
    category?: string;
    sourceCategory?: string;
    // New taxonomy fields
    intelCategory?: string;
    intelCategoryDisplay?: string;
    secondaryTopics?: string[];
    classificationMethod?: string;
    classificationConfidence?: number | null;
    classificationReason?: string;
    taxonomyVersion?: string;
    evidenceStatus?: 'verified' | 'unverified-claim' | 'advisory' | 'unassessed';
    contentSnippet?: string;
    content?: string;
    ingestedAt?: string;
    fetchedAt?: string;
    freshness?: string;
    ioc?: {
        ip_addresses?: string[];
        domains?: string[];
        cves?: string[];
        sha256?: string;
    };
    mitreTechniques?: Array<{
        id: string;
        name: string;
        inferred?: boolean;
        evidence?: string;
    }>;
    suggestedActions?: string[];
}

interface ReportDetailPanelProps {
    record: IntelligenceRecord | null;
    onClose: () => void;
    onAddToReport?: (record: IntelligenceRecord) => void;
}

export const ReportDetailPanel: React.FC<ReportDetailPanelProps> = ({
    record,
    onClose,
    onAddToReport
}) => {
    const navigate = useNavigate();
    const [downloading, setDownloading] = React.useState(false);
    const [addedNotice, setAddedNotice] = React.useState(false);

    if (!record) return null;

    // Format relative or concise publication date
    const formattedPubDate = record.pubDate
        ? new Date(record.pubDate).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Unknown date';

    const formattedIngested = record.ingestedAt
        ? new Date(record.ingestedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Telemetry snapshot';

    // Extract IOCs from text if not explicitly present in record.ioc
    const detectedCves: string[] = record.ioc?.cves && record.ioc.cves.length > 0
        ? record.ioc.cves
        : Array.from(new Set((record.title + ' ' + (record.contentSnippet || '')).match(/\bCVE-\d{4}-\d{4,7}\b/gi) || []));

    // Handle Investigate action
    const handleInvestigate = () => {
        if (detectedCves.length > 0) {
            navigate(`/enrich?ioc=${encodeURIComponent(detectedCves[0])}`);
        } else if (record.ioc?.ip_addresses && record.ioc.ip_addresses.length > 0) {
            navigate(`/enrich?ioc=${encodeURIComponent(record.ioc.ip_addresses[0])}`);
        } else {
            // Fallback: search archives for this specific threat
            navigate(`/archives?q=${encodeURIComponent(record.title.slice(0, 40))}`);
        }
    };

    // Handle Add to Report action
    const handleAddOrExport = async () => {
        if (onAddToReport) {
            onAddToReport(record);
            setAddedNotice(true);
            setTimeout(() => setAddedNotice(false), 3000);
            return;
        }

        // Default export action: trigger daily PDF export
        setDownloading(true);
        try {
            const res = await fetch(`${API_BASE}/api/reports/daily`);
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `no-entry-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setAddedNotice(true);
            setTimeout(() => setAddedNotice(false), 3000);
        } catch (err) {
            console.error('Report download error:', err);
        } finally {
            setDownloading(false);
        }
    };

    // Synthesize "Why it matters" from content and severity if not explicitly provided
    const severityLower = (record.severity || '').toLowerCase();
    const whyItMatters = severityLower.includes('crit')
        ? 'High operational risk due to potential remote execution, edge perimeter exposure, or confirmed weaponization against internet-facing assets.'
        : severityLower.includes('high')
        ? 'Significant threat activity targeting corporate perimeters, enterprise infrastructure, or credential stores requiring immediate patch review.'
        : 'Standard threat telemetry advisory. Review exposed systems and verify defensive posture against referenced technique vectors.';

    // MITRE techniques
    const techniques = record.mitreTechniques || (
        detectedCves.length > 0
            ? [{ id: 'T1190', name: 'Exploit Public-Facing Application', inferred: true, evidence: `Extracted CVE identifier: ${detectedCves.join(', ')}` }]
            : [{ id: 'T1566', name: 'Phishing / Initial Access', inferred: true, evidence: 'Inferred based on advisory and telemetry signals.' }]
    );

    return (
        <aside
            id="report-detail-panel"
            aria-label="Threat Investigation Report Detail Panel"
            className="w-full bg-white border border-[#E2E8F0] rounded-lg flex flex-col h-full overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
            {/* Header: Title, Actions & Close Button */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-white flex items-start justify-between gap-3 sticky top-0 z-10">
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={record.severity} size="sm" />
                        <span className="text-xs font-medium text-[#64748B] flex items-center gap-1">
                            <span>{record.source}</span>
                            <span>•</span>
                            <time dateTime={record.pubDate}>{formattedPubDate}</time>
                        </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-[#0F172A] leading-snug break-words">
                        {record.title}
                    </h2>
                </div>

                <button
                    onClick={onClose}
                    className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                    title="Close investigation panel (Esc)"
                    aria-label="Close investigation panel"
                >
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-sm custom-scrollbar">
                
                {/* Telemetry Metadata Strip */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-3 text-xs">
                    {/* Row 1: Publisher + timestamps */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-[#64748B] block text-[11px]">Publisher</span>
                            <span className="font-medium text-[#0F172A] mt-0.5 block truncate">{record.source}</span>
                        </div>
                        <div>
                            <span className="text-[#64748B] block text-[11px]">Published</span>
                            <span className="font-medium text-[#0F172A] mt-0.5 block">{formattedPubDate}</span>
                        </div>
                        {record.fetchedAt && (
                            <div className="col-span-2">
                                <span className="text-[#64748B] block text-[11px]">Collected</span>
                                <span className="font-medium text-[#0F172A] mt-0.5 block">{formattedIngested}</span>
                            </div>
                        )}
                    </div>

                    {/* Row 2: Category + evidence status */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0]">
                        {record.intelCategory && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                                <Tag className="w-2.5 h-2.5" />
                                {record.intelCategoryDisplay || INTEL_CATEGORY_LABELS[record.intelCategory] || record.intelCategory}
                            </span>
                        )}
                        {record.evidenceStatus && record.evidenceStatus !== 'unassessed' && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                record.evidenceStatus === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                record.evidenceStatus === 'unverified-claim' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                record.evidenceStatus === 'advisory' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {record.evidenceStatus === 'verified' ? 'Verified' :
                                 record.evidenceStatus === 'unverified-claim' ? 'Unverified claim' :
                                 record.evidenceStatus === 'advisory' ? 'Advisory' : 'Unassessed'}
                            </span>
                        )}
                        {(record.secondaryTopics || []).map((tag, i) => (
                            <span key={i} className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                {tag}
                            </span>
                        ))}
                    </div>

                    {/* Row 3: Classification reason (if available and not analyst override) */}
                    {record.classificationReason && record.classificationMethod !== 'analyst-override' && (
                        <div className="pt-2 border-t border-[#E2E8F0]">
                            <span className="text-[#94A3B8] block text-[10px] uppercase tracking-wider font-semibold mb-0.5">Classification</span>
                            <p className="text-[#64748B] text-[11px] leading-relaxed">{record.classificationReason}</p>
                        </div>
                    )}
                </div>

                {/* Section 1: Summary */}
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                        Summary
                    </h3>
                    <p className="text-[#334155] leading-relaxed text-sm font-normal">
                        {record.contentSnippet || record.content || 'Detailed incident telemetry is undergoing ingestion analysis.'}
                    </p>
                </div>

                {/* Section 2: Why It Matters */}
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#B96B00]" />
                        <span>Why It Matters</span>
                    </h3>
                    <div className="p-3 bg-[#FFFAEB]/50 border border-[#FEDF89]/60 rounded-md text-xs sm:text-sm text-[#78350F] leading-relaxed">
                        {whyItMatters}
                    </div>
                </div>

                {/* Section 3: Extracted Indicators / CVEs */}
                {detectedCves.length > 0 && (
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                            Correlated Vulnerabilities (CVE)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {detectedCves.map(cve => (
                                <button
                                    key={cve}
                                    onClick={() => navigate(`/enrich?ioc=${encodeURIComponent(cve)}`)}
                                    className="px-2.5 py-1 rounded bg-[#EAF2FF] border border-[#BFDBFE] text-[#0665F9] font-mono text-xs font-semibold hover:bg-[#DBEAFE] transition-colors inline-flex items-center gap-1"
                                    title={`Enrich ${cve}`}
                                >
                                    <span>{cve}</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Section 4: MITRE ATT&CK Evidence */}
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-[#0665F9]" />
                        <span>MITRE ATT&CK Mapping</span>
                    </h3>
                    <div className="space-y-2">
                        {techniques.map(t => (
                            <div
                                key={t.id}
                                className="p-2.5 rounded-md border border-[#E2E8F0] bg-white flex flex-col gap-1 hover:border-[#CBD5E1] transition-colors"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-[#0665F9] bg-[#EAF2FF] px-1.5 py-0.5 rounded">
                                            {t.id}
                                        </span>
                                        <span className="text-xs font-medium text-[#0F172A]">{t.name}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-semibold text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                                        {t.inferred ? 'Inferred' : 'Analyst Reviewed'}
                                    </span>
                                </div>
                                {t.evidence && (
                                    <p className="text-[11px] text-[#64748B] line-clamp-2 mt-0.5">
                                        Evidence: {t.evidence}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 5: Supporting Sources */}
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                        Supporting Sources
                    </h3>
                    <div className="space-y-1.5">
                        <a
                            href={record.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#0665F9] transition-all flex items-center justify-between text-xs group"
                        >
                            <div className="truncate pr-2">
                                <span className="font-medium text-[#0F172A] group-hover:text-[#0665F9] block truncate">
                                    {record.source} Primary Disclosure
                                </span>
                                <span className="text-[#64748B] text-[11px] block truncate">{record.link}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#0665F9] flex-shrink-0" />
                        </a>
                    </div>
                </div>

                {/* Section 6: Suggested Action */}
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#138A68]" />
                        <span>Recommended Operational Guidance</span>
                    </h3>
                    <div className="p-3 rounded-md bg-[#ECFDF5]/50 border border-[#A7F3D0]/60 text-xs text-[#065F46] space-y-1">
                        <p className="font-semibold">Analyst Advisory:</p>
                        <p>
                            1. Cross-reference logs against any extracted indicators or perimeter access points.<br />
                            2. Review vendor mitigation patches and apply security workarounds if patches are pending.<br />
                            3. Escalate high-urgency zero-days to the Incident Response duty manager.
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
                <button
                    onClick={handleInvestigate}
                    className="flex-1 py-2 px-3 rounded-md bg-[#0665F9] hover:bg-[#0554D0] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9] focus:ring-offset-1"
                >
                    <Search className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Investigate</span>
                </button>

                <button
                    onClick={handleAddOrExport}
                    disabled={downloading}
                    className="flex-1 py-2 px-3 rounded-md bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] text-[#0F172A] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0665F9]"
                >
                    {addedNotice ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#138A68]" aria-hidden="true" />
                            <span className="text-[#138A68]">Added</span>
                        </>
                    ) : (
                        <>
                            <FileDown className="w-3.5 h-3.5 text-[#64748B]" aria-hidden="true" />
                            <span>{downloading ? 'Exporting...' : 'Add to Report'}</span>
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
};

export default ReportDetailPanel;
