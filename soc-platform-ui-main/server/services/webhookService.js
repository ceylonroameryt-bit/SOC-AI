/**
 * webhookService.js
 * Sends rich security alert notifications to Slack, Microsoft Teams, and Discord.
 * Triggered automatically for every Critical/High severity threat ingested.
 */

// ── Severity → Color Mapping ───────────────────────────────────────────────────
const SEVERITY_COLORS = {
    Critical: { slack: '#FF1744', teams: 'attention', discord: 0xFF1744 },
    High:     { slack: '#FF6D00', teams: 'warning',   discord: 0xFF6D00 },
    Medium:   { slack: '#FFD600', teams: 'default',   discord: 0xFFD600 },
    Low:      { slack: '#00E676', teams: 'good',      discord: 0x00E676 },
};

const getSeverityEmoji = (severity) => {
    const map = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };
    return map[severity] || '⚪';
};

// ── Slack ──────────────────────────────────────────────────────────────────────
export const sendSlackAlert = async (threat) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return { success: false, reason: 'SLACK_WEBHOOK_URL not configured' };

    const color = SEVERITY_COLORS[threat.severity]?.slack || '#888888';
    const emoji = getSeverityEmoji(threat.severity);

    const payload = {
        username: 'NO ENTRY SOC',
        icon_emoji: ':shield:',
        attachments: [{
            color,
            pretext: `${emoji} *New ${threat.severity} Threat Detected*`,
            title: `[${threat.id || 'ALERT'}] ${threat.type}`,
            title_link: threat.link || undefined,
            text: threat.description || 'No description available.',
            fields: [
                { title: 'Severity', value: threat.severity, short: true },
                { title: 'Source',   value: threat.source || 'Unknown', short: true },
                ...(threat.ioc?.ip_addresses?.length
                    ? [{ title: 'IOC IPs', value: threat.ioc.ip_addresses.join(', '), short: false }]
                    : []),
                ...(threat.ioc?.domains?.length
                    ? [{ title: 'IOC Domains', value: threat.ioc.domains.join(', '), short: false }]
                    : []),
            ],
            footer: 'NO ENTRY SOC Platform',
            // Use a stable public shield icon (Slack emoji CDN URLs require a valid workspace ID)
            footer_icon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f6e1.png',
            ts: Math.floor(Date.now() / 1000),
        }]
    };

    try {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`Slack responded with ${resp.status}`);
        console.log(`[WEBHOOK] Slack alert sent for ${threat.id || threat.type}`);
        return { success: true, platform: 'slack' };
    } catch (err) {
        console.error('[WEBHOOK] Slack error:', err.message);
        return { success: false, platform: 'slack', error: err.message };
    }
};

// ── Microsoft Teams ────────────────────────────────────────────────────────────
export const sendTeamsAlert = async (threat) => {
    const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
    if (!webhookUrl) return { success: false, reason: 'TEAMS_WEBHOOK_URL not configured' };

    const themeColor = SEVERITY_COLORS[threat.severity]?.slack?.replace('#', '') || '888888';
    const emoji = getSeverityEmoji(threat.severity);

    const facts = [
        { name: 'Severity', value: threat.severity },
        { name: 'Type',     value: threat.type },
        { name: 'Source',   value: threat.source || 'Unknown' },
        ...(threat.ioc?.ip_addresses?.length
            ? [{ name: 'IOC IPs', value: threat.ioc.ip_addresses.join(', ') }]
            : []),
        ...(threat.ioc?.cves?.length
            ? [{ name: 'CVEs', value: threat.ioc.cves.join(', ') }]
            : []),
    ];

    const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor,
        summary: `${emoji} ${threat.severity} Threat: ${threat.type}`,
        sections: [{
            activityTitle: `${emoji} **${threat.severity} Threat Detected**`,
            activitySubtitle: `[${threat.id || 'ALERT'}] ${threat.type}`,
            activityText: threat.description || 'No description available.',
            facts,
        }],
        potentialAction: threat.link ? [{
            '@type': 'OpenUri',
            name: 'View Threat Details',
            targets: [{ os: 'default', uri: threat.link }],
        }] : [],
    };

    try {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`Teams responded with ${resp.status}`);
        console.log(`[WEBHOOK] Teams alert sent for ${threat.id || threat.type}`);
        return { success: true, platform: 'teams' };
    } catch (err) {
        console.error('[WEBHOOK] Teams error:', err.message);
        return { success: false, platform: 'teams', error: err.message };
    }
};

// ── Discord ────────────────────────────────────────────────────────────────────
export const sendDiscordAlert = async (threat) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return { success: false, reason: 'DISCORD_WEBHOOK_URL not configured' };

    const color = SEVERITY_COLORS[threat.severity]?.discord || 0x888888;
    const emoji = getSeverityEmoji(threat.severity);

    const fields = [
        { name: 'Severity', value: threat.severity, inline: true },
        { name: 'Source',   value: threat.source || 'Unknown', inline: true },
        { name: 'Type',     value: threat.type, inline: true },
    ];

    if (threat.ioc?.ip_addresses?.length) {
        fields.push({ name: '📡 IOC IPs', value: `\`${threat.ioc.ip_addresses.join('`, `')}\``, inline: false });
    }
    if (threat.ioc?.domains?.length) {
        fields.push({ name: '🌐 IOC Domains', value: `\`${threat.ioc.domains.join('`, `')}\``, inline: false });
    }
    if (threat.ioc?.sha256) {
        fields.push({ name: '🔑 SHA256', value: `\`${threat.ioc.sha256}\``, inline: false });
    }

    const payload = {
        username: 'NO ENTRY SOC',
        // Using a stable Twemoji shield icon (Discord CDN emoji URLs require snowflake IDs)
        avatar_url: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f6e1.png',
        embeds: [{
            title: `${emoji} ${threat.severity} Threat: ${threat.type}`,
            description: threat.description || 'No description available.',
            color,
            fields,
            footer: { text: 'NO ENTRY SOC Intelligence Platform' },
            timestamp: new Date().toISOString(),
            url: threat.link || undefined,
        }]
    };

    try {
        const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`Discord responded with ${resp.status}`);
        console.log(`[WEBHOOK] Discord alert sent for ${threat.id || threat.type}`);
        return { success: true, platform: 'discord' };
    } catch (err) {
        console.error('[WEBHOOK] Discord error:', err.message);
        return { success: false, platform: 'discord', error: err.message };
    }
};

// ── Broadcast to All Configured Platforms ─────────────────────────────────────
export const broadcastAlert = async (threat) => {
    const results = await Promise.allSettled([
        sendSlackAlert(threat),
        sendTeamsAlert(threat),
        sendDiscordAlert(threat),
    ]);

    return {
        slack:   results[0].value || { success: false, error: results[0].reason?.message },
        teams:   results[1].value || { success: false, error: results[1].reason?.message },
        discord: results[2].value || { success: false, error: results[2].reason?.message },
        broadcastAt: new Date().toISOString(),
    };
};

// ── Get Configured Webhook Status (masked URLs) ────────────────────────────────
export const getWebhookStatus = () => {
    const maskUrl = (url) => url ? `${url.substring(0, 30)}...` : null;
    return {
        slack:   { configured: !!process.env.SLACK_WEBHOOK_URL,   maskedUrl: maskUrl(process.env.SLACK_WEBHOOK_URL) },
        teams:   { configured: !!process.env.TEAMS_WEBHOOK_URL,   maskedUrl: maskUrl(process.env.TEAMS_WEBHOOK_URL) },
        discord: { configured: !!process.env.DISCORD_WEBHOOK_URL, maskedUrl: maskUrl(process.env.DISCORD_WEBHOOK_URL) },
    };
};
