/**
 * siemQueryService.js
 * Generates copy-paste threat hunting queries for Splunk, Microsoft Sentinel (KQL),
 * and auto-generates basic Sigma rules for extracted IOCs and CVEs.
 *
 * P0 item 7: All IOC values are escaped before insertion into SPL/KQL/YAML to
 * prevent injection of query-language metacharacters.
 */

// ── IOC sanitisation helpers ──────────────────────────────────────────────────

/**
 * Escape a value for Splunk SPL string literals.
 * Splunk SPL uses backslash as escape: double-quote → \", backslash → \\.
 * Also removes newlines/CRs which could break multi-line query strings.
 */
function escapeSpl(ioc) {
    return String(ioc)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]/g, ' ');
}

/**
 * Escape a value for KQL string literals (single-quote strings).
 * KQL single-quoted strings escape single quotes by doubling them.
 */
function escapeKql(ioc) {
    return String(ioc)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/[\r\n]/g, ' ');
}

/**
 * Escape a value for Sigma YAML single-quoted strings.
 * Single quotes in YAML single-quoted strings are escaped by doubling.
 */
function escapeSigmaYaml(ioc) {
    return String(ioc)
        .replace(/'/g, "''")  // YAML single-quote escape
        .replace(/[\r\n]/g, ' ')
        .replace(/\\/g, '\\\\');
}

/**
 * Generate Splunk SPL query for a given IOC
 */
export const generateSplunkQuery = (ioc, iocType = 'auto') => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;
    const safe = escapeSpl(ioc);

    switch (type) {
        case 'ip':
            return `index=* (src_ip="${safe}" OR dest_ip="${safe}" OR src="${safe}" OR dst="${safe}")\n| stats count by _time, host, index, src_ip, dest_ip, action\n| sort -_time`;

        case 'domain':
            return `index=* (query="${safe}" OR domain="${safe}" OR url="*${safe}*" OR dest_host="${safe}")\n| stats count by _time, host, src_ip, query, action\n| sort -_time`;

        case 'hash':
            return `index=* (md5="${safe}" OR sha256="${safe}" OR sha1="${safe}" OR file_hash="${safe}")\n| stats count by _time, host, file_name, file_path, user\n| sort -_time`;

        case 'cve':
            return `index=* (cve="${safe}" OR vulnerability="${safe}" OR signature="*${safe}*")\n| stats count by _time, host, src_ip, dest_ip, signature\n| sort -_time`;

        default:
            return `index=* "${safe}"\n| stats count by _time, host, index\n| sort -_time`;
    }
};

/**
 * Generate Microsoft Sentinel KQL query for a given IOC
 */
export const generateKQLQuery = (ioc, iocType = 'auto') => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;
    const safe = escapeKql(ioc);

    switch (type) {
        case 'ip':
            return `union DeviceNetworkEvents, CommonSecurityLog, AzureNetworkAnalytics_CL\n| where TimeGenerated > ago(7d)\n| where RemoteIP == "${safe}" or DestinationIP == "${safe}" or SourceIP == "${safe}"\n| project TimeGenerated, DeviceName, InitiatingProcessFileName, RemoteIP, RemotePort, ActionType\n| order by TimeGenerated desc`;

        case 'domain':
            return `union DeviceNetworkEvents, DnsEvents, AzureDiagnostics\n| where TimeGenerated > ago(7d)\n| where RemoteUrl has "${safe}" or Name has "${safe}" or QueryName has "${safe}"\n| project TimeGenerated, DeviceName, RemoteUrl, InitiatingProcessFileName\n| order by TimeGenerated desc`;

        case 'hash':
            return `union DeviceFileEvents, DeviceProcessEvents\n| where TimeGenerated > ago(7d)\n| where MD5 == "${safe}" or SHA256 == "${safe}" or SHA1 == "${safe}"\n| project TimeGenerated, DeviceName, FileName, FolderPath, InitiatingProcessFileName, AccountName\n| order by TimeGenerated desc`;

        case 'cve':
            return `SecurityAlert\n| where TimeGenerated > ago(30d)\n| where AlertName has "${safe}" or Description has "${safe}" or ExtendedProperties has "${safe}"\n| project TimeGenerated, AlertName, AlertSeverity, CompromisedEntity, Description\n| order by TimeGenerated desc`;

        default:
            return `search "${safe}"\n| where TimeGenerated > ago(7d)\n| project TimeGenerated, Type, _ResourceId\n| order by TimeGenerated desc`;
    }
};

/**
 * Generate a basic Sigma rule YAML for a given IOC.
 * P0 item 20: lowercase level, no hard-coded attack.execution tag,
 *             correct logsource field names.
 */
export const generateSigmaRule = (ioc, iocType = 'auto', context = {}) => {
    const type = iocType === 'auto' ? detectIOCType(ioc) : iocType;
    const { title, description, severity = 'high', tags = [] } = context;
    const safeIoc = escapeSigmaYaml(ioc);

    const ruleAuthor = process.env.SIGMA_AUTHOR || 'NO ENTRY SOC Platform (auto-generated)';
    const ruleTitle = title || `Detected IOC: ${ioc}`;
    const ruleDesc = description || `Auto-generated rule to detect IOC ${ioc} (${type}) in security logs.`;
    const ruleId = crypto.randomUUID();
    const date = new Date().toISOString().split('T')[0];

    // P0 item 20: do not hard-code attack.execution; use only provided tags
    const baseTags = [...tags];
    // Add a sensible default tag only when caller doesn't provide any
    if (baseTags.length === 0) {
        if (type === 'ip' || type === 'domain') baseTags.push('attack.command_and_control');
        else if (type === 'hash') baseTags.push('attack.defense_evasion');
        else if (type === 'cve') baseTags.push('attack.initial_access');
    }

    let detection = '';
    let logsource = '';

    switch (type) {
        case 'ip':
            // P0 item 20: correct logsource field names for network category
            logsource = `category: network_connection\n    product: any`;
            detection = `  keywords:\n        - '${safeIoc}'\n  condition: keywords`;
            break;

        case 'domain':
            logsource = `category: dns\n    product: any`;
            detection = `  selection:\n        dns.question.name: '${safeIoc}'\n  condition: selection`;
            break;

        case 'hash':
            logsource = `category: process_creation\n    product: windows`;
            detection = `  selection:\n        Hashes|contains:\n          - '${safeIoc}'\n  condition: selection`;
            break;

        case 'cve':
            logsource = `category: application\n    product: any`;
            detection = `  keywords:\n        - '${safeIoc}'\n  condition: keywords`;
            break;

        default:
            logsource = `product: any\n    category: any`;
            detection = `  keywords:\n        - '${safeIoc}'\n  condition: keywords`;
    }

    // P0 item 20: lowercase level (Sigma spec requires lowercase)
    return `title: ${ruleTitle}\nid: ${ruleId}\nstatus: experimental\ndescription: ${ruleDesc}\nreferences:\n    - https://www.virustotal.com\ndate: ${date}\nauthor: ${ruleAuthor}\ntags:\n${baseTags.map(t => `    - ${t}`).join('\n')}\nlogsource:\n    ${logsource}\ndetection:\n${detection}\nfalsepositives:\n    - Unknown - review and tune before production use\nlevel: ${severity.toLowerCase()}\n`;
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
 * Detect IOC type from value.
 * P0 item 20: accept multi-label domains, punycode (xn--).
 */
export const detectIOCType = (ioc) => {
    if (!ioc || typeof ioc !== 'string') return 'unknown';
    if (/^CVE-\d{4}-\d{4,7}$/i.test(ioc)) return 'cve';
    if (/^[a-fA-F0-9]{64}$/.test(ioc)) return 'hash'; // SHA256
    if (/^[a-fA-F0-9]{40}$/.test(ioc)) return 'hash'; // SHA1
    if (/^[a-fA-F0-9]{32}$/.test(ioc)) return 'hash'; // MD5
    if (/^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ioc)) return 'ip';
    // Accept multi-label domains including punycode labels (xn--)
    if (/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(ioc) ||
        /^(?:xn--[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(ioc)) return 'domain';
    return 'unknown';
};

// Need crypto for UUID generation
import crypto from 'crypto';
