/**
 * siemQueryService.js
 * Generates copy-paste threat hunting queries for Splunk, Microsoft Sentinel (KQL),
 * and auto-generates basic Sigma rules for extracted IOCs and CVEs.
 */

/**
 * Generate Splunk SPL query for a given IOC
 */
export const generateSplunkQuery = (ioc, iocType = 'auto') => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;

    switch (type) {
        case 'ip':
            return `index=* (src_ip="${ioc}" OR dest_ip="${ioc}" OR src="${ioc}" OR dst="${ioc}")
| stats count by _time, host, index, src_ip, dest_ip, action
| sort -_time`;

        case 'domain':
            return `index=* (query="${ioc}" OR domain="${ioc}" OR url="*${ioc}*" OR dest_host="${ioc}")
| stats count by _time, host, src_ip, query, action
| sort -_time`;

        case 'hash':
            return `index=* (md5="${ioc}" OR sha256="${ioc}" OR sha1="${ioc}" OR file_hash="${ioc}")
| stats count by _time, host, file_name, file_path, user
| sort -_time`;

        case 'cve':
            return `index=* (cve="${ioc}" OR vulnerability="${ioc}" OR signature="*${ioc}*")
| stats count by _time, host, src_ip, dest_ip, signature
| sort -_time`;

        default:
            return `index=* "${ioc}"
| stats count by _time, host, index
| sort -_time`;
    }
};

/**
 * Generate Microsoft Sentinel KQL query for a given IOC
 */
export const generateKQLQuery = (ioc, iocType = 'auto') => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;

    switch (type) {
        case 'ip':
            return `union DeviceNetworkEvents, CommonSecurityLog, AzureNetworkAnalytics_CL
| where TimeGenerated > ago(7d)
| where RemoteIP == "${ioc}" or DestinationIP == "${ioc}" or SourceIP == "${ioc}"
| project TimeGenerated, DeviceName, InitiatingProcessFileName, RemoteIP, RemotePort, ActionType
| order by TimeGenerated desc`;

        case 'domain':
            return `union DeviceNetworkEvents, DnsEvents, AzureDiagnostics
| where TimeGenerated > ago(7d)
| where RemoteUrl has "${ioc}" or Name has "${ioc}" or QueryName has "${ioc}"
| project TimeGenerated, DeviceName, RemoteUrl, InitiatingProcessFileName
| order by TimeGenerated desc`;

        case 'hash':
            return `union DeviceFileEvents, DeviceProcessEvents
| where TimeGenerated > ago(7d)
| where MD5 == "${ioc}" or SHA256 == "${ioc}" or SHA1 == "${ioc}"
| project TimeGenerated, DeviceName, FileName, FolderPath, InitiatingProcessFileName, AccountName
| order by TimeGenerated desc`;

        case 'cve':
            return `SecurityAlert
| where TimeGenerated > ago(30d)
| where AlertName has "${ioc}" or Description has "${ioc}" or ExtendedProperties has "${ioc}"
| project TimeGenerated, AlertName, AlertSeverity, CompromisedEntity, Description
| order by TimeGenerated desc`;

        default:
            return `search "${ioc}"
| where TimeGenerated > ago(7d)
| project TimeGenerated, Type, _ResourceId
| order by TimeGenerated desc`;
    }
};

/**
 * Generate a basic Sigma rule YAML for a given IOC
 */
export const generateSigmaRule = (ioc, iocType = 'auto', context = {}) => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;
    const { title, description, severity = 'high', tags = [] } = context;

    const ruleAuthor = process.env.SIGMA_AUTHOR || 'NO ENTRY SOC Platform (auto-generated)';
    const ruleTitle = title || `Detected IOC: ${ioc}`;
    const ruleDesc = description || `Auto-generated rule to detect IOC ${ioc} (${type}) in security logs.`;
    const ruleId = generateUUID();
    const date = new Date().toISOString().split('T')[0];

    const baseTags = ['attack.execution', ...tags];

    let detection = '';
    let logsource = '';

    switch (type) {
        case 'ip':
            logsource = `category: network
    product: any`;
            detection = `  keywords:
        - '${ioc}'
  condition: keywords`;
            break;

        case 'domain':
            logsource = `category: dns
    product: any`;
            detection = `  selection:
        dns.question.name: '${ioc}'
  condition: selection`;
            break;

        case 'hash':
            logsource = `category: process_creation
    product: windows`;
            detection = `  selection:
        Hashes|contains:
          - '${ioc}'
  condition: selection`;
            break;

        case 'cve':
            logsource = `category: application
    product: any`;
            detection = `  keywords:
        - '${ioc}'
  condition: keywords`;
            break;

        default:
            logsource = `product: any
    category: any`;
            detection = `  keywords:
        - '${ioc}'
  condition: keywords`;
    }

    return `title: ${ruleTitle}
id: ${ruleId}
status: experimental
description: ${ruleDesc}
references:
    - https://www.virustotal.com
date: ${date}
author: ${ruleAuthor}
tags:
${baseTags.map(t => `    - ${t}`).join('\n')}
logsource:
    ${logsource}
detection:
${detection}
falsepositives:
    - Unknown - review and tune before production use
level: ${severity}
`;
};

/**
 * Generate a complete query bundle (all three formats) for an IOC
 */
export const generateQueryBundle = (ioc, iocType = 'auto', context = {}) => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;
    return {
        ioc,
        iocType: type,
        queries: {
            splunk: generateSplunkQuery(ioc, type),
            kql: generateKQLQuery(ioc, type),
            sigma: generateSigmaRule(ioc, type, context),
        },
        generatedAt: new Date().toISOString(),
    };
};

/**
 * Detect IOC type from value
 */
export const detectIOCType = (ioc) => {
    if (/^CVE-\d{4}-\d{4,7}$/i.test(ioc)) return 'cve';
    if (/^[a-fA-F0-9]{64}$/.test(ioc)) return 'hash'; // SHA256
    if (/^[a-fA-F0-9]{40}$/.test(ioc)) return 'hash'; // SHA1
    if (/^[a-fA-F0-9]{32}$/.test(ioc)) return 'hash'; // MD5
    if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ioc)) return 'ip';
    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(ioc)) return 'domain';
    return 'unknown';
};

// Simple UUID v4 generator (no dependency needed)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
