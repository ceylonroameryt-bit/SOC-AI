/**
 * reportGenerator.js
 * Generates security intelligence reports in PDF, DOCX, CSV, JSON, and STIX 2.1 formats.
 * Designed to run in standard Node.js environments without heavyweight external dependencies.
 */

import crypto from 'crypto';

/**
 * Escapes characters for PDF text streams
 */
function escapePdfText(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

/**
 * Generates a valid standard PDF (PDF-1.4) document
 * Includes header banner, executive summary, active threat table, and global news table.
 */
export function generatePdfReport({ title, date, news = [], threats = [], summary = '' }) {
    const today = date || new Date().toISOString().split('T')[0];
    const reportTitle = title || `NO ENTRY — Daily Security Intelligence Report (${today})`;
    
    // Split long lines into wrapped chunks
    function wrapText(text, maxChars = 75) {
        if (!text) return [];
        const words = text.split(/\s+/);
        const lines = [];
        let current = '';
        for (const word of words) {
            if ((current + ' ' + word).trim().length <= maxChars) {
                current = (current + ' ' + word).trim();
            } else {
                if (current) lines.push(current);
                current = word.slice(0, maxChars);
            }
        }
        if (current) lines.push(current);
        return lines;
    }

    // Build PDF content stream
    const contentLines = [];
    
    // Document background & banner
    contentLines.push('q'); // save state
    // Dark header box
    contentLines.push('0.06 0.09 0.16 rg'); // #0f172a
    contentLines.push('40 760 532 50 re f');
    
    // Header Title Text
    contentLines.push('BT');
    contentLines.push('/F1 16 Tf');
    contentLines.push('1 1 1 rg'); // white
    contentLines.push('55 780 Td');
    contentLines.push(`(${escapePdfText(reportTitle)}) Tj`);
    contentLines.push('ET');

    // Subtitle / Date
    contentLines.push('BT');
    contentLines.push('/F1 9 Tf');
    contentLines.push('0.58 0.64 0.72 rg'); // #94a3b8
    contentLines.push('55 767 Td');
    contentLines.push(`(Generated: ${escapePdfText(new Date().toUTCString())} | Classification: TLP:AMBER+STRICT | SOC Operational Intelligence) Tj`);
    contentLines.push('ET');

    let currentY = 730;

    // Summary Section
    contentLines.push('BT');
    contentLines.push('/F1 12 Tf');
    contentLines.push('0.12 0.23 0.54 rg'); // #1e3a8a
    contentLines.push(`40 ${currentY} Td`);
    contentLines.push('(1. EXECUTIVE INTELLIGENCE SUMMARY) Tj');
    contentLines.push('ET');
    currentY -= 18;

    const summaryText = summary || `Telemetry indicates ${threats.length} active priority threat indicators and ${news.length} verified security advisories in the current window. Operational vigilance is recommended for internet-facing systems.`;
    const summaryLines = wrapText(summaryText, 85);
    
    contentLines.push('BT');
    contentLines.push('/F1 9 Tf');
    contentLines.push('0.2 0.2 0.2 rg');
    contentLines.push(`45 ${currentY} Td`);
    for (const sLine of summaryLines) {
        contentLines.push(`(${escapePdfText(sLine)}) Tj`);
        contentLines.push('0 -13 Td');
        currentY -= 13;
    }
    contentLines.push('ET');
    currentY -= 15;

    // Threats Section
    contentLines.push('BT');
    contentLines.push('/F1 12 Tf');
    contentLines.push('0.75 0.1 0.1 rg'); // Red
    contentLines.push(`40 ${currentY} Td`);
    contentLines.push(`(2. ACTIVE THREAT ESCALATIONS (${threats.length})) Tj`);
    contentLines.push('ET');
    currentY -= 18;

    if (threats.length === 0) {
        contentLines.push('BT');
        contentLines.push('/F1 9 Tf');
        contentLines.push('0.4 0.4 0.4 rg');
        contentLines.push(`45 ${currentY} Td`);
        contentLines.push('(No critical threat escalations reported for this period.) Tj');
        contentLines.push('ET');
        currentY -= 20;
    } else {
        for (const t of threats.slice(0, 5)) {
            if (currentY < 120) break;
            const sev = (t.severity || 'Medium').toUpperCase();
            const header = `[${sev}] ${t.type || 'Threat'} — ${t.source || 'SOC Telemetry'}`;
            contentLines.push('BT');
            contentLines.push('/F1 9 Tf');
            contentLines.push('0.1 0.1 0.1 rg');
            contentLines.push(`45 ${currentY} Td`);
            contentLines.push(`(${escapePdfText(header)}) Tj`);
            contentLines.push('ET');
            currentY -= 12;

            const descLines = wrapText(t.description || 'No description available', 85);
            contentLines.push('BT');
            contentLines.push('/F1 8 Tf');
            contentLines.push('0.35 0.35 0.35 rg');
            contentLines.push(`55 ${currentY} Td`);
            for (const dLine of descLines.slice(0, 2)) {
                contentLines.push(`(${escapePdfText(dLine)}) Tj`);
                contentLines.push('0 -11 Td');
                currentY -= 11;
            }
            contentLines.push('ET');
            currentY -= 6;
        }
    }

    currentY -= 10;

    // News & Advisories Section
    if (currentY > 120) {
        contentLines.push('BT');
        contentLines.push('/F1 12 Tf');
        contentLines.push('0.12 0.23 0.54 rg');
        contentLines.push(`40 ${currentY} Td`);
        contentLines.push(`(3. VERIFIED INTELLIGENCE ADVISORIES (${news.length})) Tj`);
        contentLines.push('ET');
        currentY -= 18;

        for (const n of news.slice(0, 8)) {
            if (currentY < 60) break;
            const itemHeader = `* [${n.severity || 'Info'}] ${n.title || 'Untitled'}`;
            const itemLines = wrapText(itemHeader, 85);
            contentLines.push('BT');
            contentLines.push('/F1 8 Tf');
            contentLines.push('0.15 0.15 0.15 rg');
            contentLines.push(`45 ${currentY} Td`);
            for (const iLine of itemLines.slice(0, 1)) {
                contentLines.push(`(${escapePdfText(iLine)}) Tj`);
                contentLines.push('0 -11 Td');
                currentY -= 11;
            }
            contentLines.push('ET');
        }
    }

    // Footer
    contentLines.push('BT');
    contentLines.push('/F1 8 Tf');
    contentLines.push('0.6 0.6 0.6 rg');
    contentLines.push('40 30 Td');
    contentLines.push('(NO ENTRY SOC Platform | Confidential Intelligence Report | https://noentry-soc.io) Tj');
    contentLines.push('ET');
    contentLines.push('Q'); // restore state

    const streamContent = contentLines.join('\n');
    const streamLength = Buffer.byteLength(streamContent, 'utf-8');

    // Construct valid PDF object table
    const objects = [];
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
    objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
    objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
    objects.push(`5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);

    let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [0]; // offset 0 for generation 65535 f

    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf-8'));
        pdf += obj + '\n';
    }

    const startXref = Buffer.byteLength(pdf, 'utf-8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i++) {
        pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(pdf, 'utf-8');
}

/**
 * Generates a valid DOCX file using standard Office Open XML structure packed as ZIP
 */
export function generateDocxReport({ title, date, news = [], threats = [], summary = '' }) {
    const today = date || new Date().toISOString().split('T')[0];
    const reportTitle = title || `NO ENTRY — Daily Security Intelligence Report (${today})`;

    function escapeXml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Build document.xml
    let body = `
        <w:p>
            <w:pPr>
                <w:pStyle w:val="Title"/>
                <w:jc w:val="left"/>
            </w:pPr>
            <w:r>
                <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F172A"/></w:rPr>
                <w:t>${escapeXml(reportTitle)}</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr>
                <w:t>Generated: ${escapeXml(new Date().toUTCString())} | TLP:AMBER+STRICT | SOC Operational Intelligence</w:t>
            </w:r>
        </w:p>
        <w:p/>
        <w:p>
            <w:r>
                <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr>
                <w:t>1. Executive Intelligence Summary</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:r>
                <w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
                <w:t>${escapeXml(summary || `Active threat posture indicates ${threats.length} high priority threat alerts and ${news.length} verified news advisories in the current operating cycle.`)}</w:t>
            </w:r>
        </w:p>
        <w:p/>
        <w:p>
            <w:r>
                <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="B91C1C"/></w:rPr>
                <w:t>2. Active Priority Threat Incidents (${threats.length})</w:t>
            </w:r>
        </w:p>
    `;

    if (threats.length === 0) {
        body += `<w:p><w:r><w:t>No critical threat escalations reported for this period.</w:t></w:r></w:p>`;
    } else {
        for (const t of threats.slice(0, 10)) {
            body += `
                <w:p>
                    <w:r><w:rPr><w:b/><w:color w:val="B91C1C"/></w:rPr><w:t>[${escapeXml((t.severity || 'Medium').toUpperCase())}] ${escapeXml(t.type || 'Threat')} </w:t></w:r>
                    <w:r><w:rPr><w:color w:val="64748B"/></w:rPr><w:t>(${escapeXml(t.source || 'Unknown')}) - </w:t></w:r>
                    <w:r><w:t>${escapeXml(t.description || 'No description')}</w:t></w:r>
                </w:p>
            `;
        }
    }

    body += `
        <w:p/>
        <w:p>
            <w:r>
                <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr>
                <w:t>3. Intelligence Advisories (${news.length})</w:t>
            </w:r>
        </w:p>
    `;

    for (const n of news.slice(0, 15)) {
        body += `
            <w:p>
                <w:r><w:rPr><w:b/></w:rPr><w:t>* [${escapeXml(n.severity || 'Info')}] </w:t></w:r>
                <w:r><w:t>${escapeXml(n.title || 'Untitled')} (${escapeXml(n.source || 'Advisory')})</w:t></w:r>
            </w:p>
        `;
    }

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        ${body}
    </w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    // Pack into a standard ZIP archive buffer
    return createZipArchive([
        { name: '[Content_Types].xml', content: contentTypesXml },
        { name: '_rels/.rels', content: relsXml },
        { name: 'word/document.xml', content: documentXml }
    ]);
}

/**
 * Creates a valid standard ZIP archive buffer for files
 */
function createZipArchive(files) {
    const fileEntries = [];
    let offset = 0;

    for (const f of files) {
        const nameBuf = Buffer.from(f.name, 'utf-8');
        const dataBuf = Buffer.from(f.content, 'utf-8');
        const uncompressedSize = dataBuf.length;
        const crc = crc32(dataBuf);

        const localHeader = Buffer.alloc(30 + nameBuf.length);
        localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
        localHeader.writeUInt16LE(20, 4);         // version needed to extract (2.0)
        localHeader.writeUInt16LE(0, 6);          // general purpose bit flag
        localHeader.writeUInt16LE(0, 8);          // compression method (0 = uncompressed)
        localHeader.writeUInt16LE(0, 10);         // file last mod time
        localHeader.writeUInt16LE(0, 12);         // file last mod date
        localHeader.writeUInt32LE(crc, 14);       // crc-32
        localHeader.writeUInt32LE(uncompressedSize, 18); // compressed size
        localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
        localHeader.writeUInt16LE(nameBuf.length, 26);   // file name length
        localHeader.writeUInt16LE(0, 28);                // extra field length
        nameBuf.copy(localHeader, 30);

        fileEntries.push({
            nameBuf,
            dataBuf,
            localHeader,
            offset,
            crc,
            size: uncompressedSize
        });

        offset += localHeader.length + dataBuf.length;
    }

    // Central Directory
    const centralDirOffset = offset;
    const centralDirBuffers = [];

    for (const entry of fileEntries) {
        const cdHeader = Buffer.alloc(46 + entry.nameBuf.length);
        cdHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
        cdHeader.writeUInt16LE(20, 4);          // version made by
        cdHeader.writeUInt16LE(20, 6);          // version needed
        cdHeader.writeUInt16LE(0, 8);           // flag
        cdHeader.writeUInt16LE(0, 10);          // compression method
        cdHeader.writeUInt16LE(0, 12);          // last mod time
        cdHeader.writeUInt16LE(0, 14);          // last mod date
        cdHeader.writeUInt32LE(entry.crc, 16);  // crc-32
        cdHeader.writeUInt32LE(entry.size, 20); // compressed size
        cdHeader.writeUInt32LE(entry.size, 24); // uncompressed size
        cdHeader.writeUInt16LE(entry.nameBuf.length, 28); // file name length
        cdHeader.writeUInt16LE(0, 30);          // extra field length
        cdHeader.writeUInt16LE(0, 32);          // comment length
        cdHeader.writeUInt16LE(0, 34);          // disk number start
        cdHeader.writeUInt16LE(0, 36);          // internal file attributes
        cdHeader.writeUInt32LE(0, 38);          // external file attributes
        cdHeader.writeUInt32LE(entry.offset, 42); // relative offset of local header
        entry.nameBuf.copy(cdHeader, 46);
        centralDirBuffers.push(cdHeader);
    }

    const centralDirBuf = Buffer.concat(centralDirBuffers);
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0); // EOCD signature
    endRecord.writeUInt16LE(0, 4);          // disk number
    endRecord.writeUInt16LE(0, 6);          // disk where cd starts
    endRecord.writeUInt16LE(fileEntries.length, 8); // num of entries on disk
    endRecord.writeUInt16LE(fileEntries.length, 10); // total num entries
    endRecord.writeUInt32LE(centralDirBuf.length, 12); // size of central directory
    endRecord.writeUInt32LE(centralDirOffset, 16);    // offset of cd
    endRecord.writeUInt16LE(0, 20);                  // comment length

    const parts = [];
    for (const entry of fileEntries) {
        parts.push(entry.localHeader);
        parts.push(entry.dataBuf);
    }
    parts.push(centralDirBuf);
    parts.push(endRecord);

    return Buffer.concat(parts);
}

/**
 * Simple CRC32 implementation for ZIP generation
 */
function crc32(buf) {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
}

const crc32Table = (() => {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c >>> 0;
    }
    return table;
})();

/**
 * Escapes fields for CSV format
 */
export function escapeCsvField(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Exports threat records to STIX 2.1 JSON bundle format
 */
export function exportThreatsToStix(threats = []) {
    const bundleId = `bundle--${crypto.randomUUID()}`;
    const objects = [];

    // Identity SDO for the generating platform
    const identityId = 'identity--3023e936-07a8-4222-92a0-47b86ad4ff81';
    objects.push({
        type: 'identity',
        spec_version: '2.1',
        id: identityId,
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-01T00:00:00.000Z',
        name: 'NO ENTRY SOC Intelligence Platform',
        identity_class: 'system',
    });

    for (const threat of threats) {
        const createdTime = threat.timestamp || new Date().toISOString();
        const threatDesc = threat.description || 'Observed cyber threat event';
        
        // Map indicator patterns
        const patterns = [];
        if (threat.ioc?.ip_addresses?.length) {
            for (const ip of threat.ioc.ip_addresses) {
                patterns.push(`[ipv4-addr:value = '${ip}']`);
            }
        }
        if (threat.ioc?.domains?.length) {
            for (const d of threat.ioc.domains) {
                patterns.push(`[domain-name:value = '${d}']`);
            }
        }
        if (threat.ioc?.sha256) {
            patterns.push(`[file:hashes.'SHA-256' = '${threat.ioc.sha256}']`);
        }
        if (threat.ioc?.cves?.length) {
            for (const cve of threat.ioc.cves) {
                patterns.push(`[vulnerability:name = '${cve}']`);
            }
        }

        const patternString = patterns.length > 0 ? patterns.join(' OR ') : `[x-custom:type = '${threat.type || 'unknown'}']`;

        objects.push({
            type: 'indicator',
            spec_version: '2.1',
            id: `indicator--${crypto.randomUUID()}`,
            created_by_ref: identityId,
            created: createdTime,
            modified: createdTime,
            name: `${threat.severity || 'Medium'} Threat: ${threat.type || 'Cyber Incident'}`,
            description: threatDesc,
            indicator_types: [threat.type?.toLowerCase().includes('ransomware') ? 'malicious-activity' : 'anomalous-activity'],
            pattern: patternString,
            pattern_type: 'stix',
            valid_from: createdTime,
            confidence: threat.severity === 'Critical' ? 90 : (threat.severity === 'High' ? 75 : 50),
            external_references: [
                {
                    source_name: threat.source || 'NO ENTRY SOC',
                    external_id: threat.id || undefined,
                }
            ]
        });
    }

    return {
        type: 'bundle',
        id: bundleId,
        objects,
    };
}
