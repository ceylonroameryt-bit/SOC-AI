import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

interface WebhookStatus {
    configured: boolean;
    maskedUrl: string | null;
}

interface WebhookConfig {
    slack: WebhookStatus;
    teams: WebhookStatus;
    discord: WebhookStatus;
}

interface TestResult {
    success: boolean;
    message: string;
    results?: {
        slack: { success: boolean; error?: string; reason?: string };
        teams: { success: boolean; error?: string; reason?: string };
        discord: { success: boolean; error?: string; reason?: string };
    };
}

const PlatformCard = ({
    name, icon, color, status, envKey, testResult
}: {
    name: string; icon: string; color: string; status: WebhookStatus;
    envKey: string; testResult?: { success: boolean; error?: string; reason?: string };
}) => (
    <div className={`metric-card space-y-3.5 ${status.configured ? 'border-emerald-300' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-3xl">{icon}</span>
                <div>
                    <h3 className={`font-bold font-display text-base ${color}`}>{name}</h3>
                    <p className="text-slate-500 text-xs font-medium">ChatOps Webhook Channel</p>
                </div>
            </div>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.configured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {status.configured ? '✓ Configured' : 'Not Configured'}
            </div>
        </div>

        {status.configured && status.maskedUrl && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 truncate">
                {status.maskedUrl}
            </div>
        )}

        {!status.configured && (
            <div className="bg-slate-50 rounded-xl p-3 border border-dashed border-slate-300">
                <p className="text-slate-500 text-xs">
                    Add <code className="text-[#1E3A8A] font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{envKey}</code> to your <code className="text-slate-800 bg-slate-200 px-1 py-0.5 rounded">.env</code> file.
                </p>
            </div>
        )}

        {testResult && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {testResult.success ? '✓ Test alert sent successfully!' : `✗ ${testResult.reason || testResult.error || 'Failed'}`}
            </div>
        )}
    </div>
);

export default function Settings() {
    const [config, setConfig] = useState<WebhookConfig | null>(null);
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);
    const [ingestKey] = useState(Math.random().toString(36).slice(2, 18).toUpperCase());

    useEffect(() => {
        fetch(`${API_BASE}/api/webhooks/config`)
            .then(r => r.json())
            .then(setConfig)
            .catch(console.error);
    }, []);

    const runTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const resp = await fetch(`${API_BASE}/api/webhooks/test`, { method: 'POST' });
            setTestResult(await resp.json());
        } catch {
            setTestResult({ success: false, message: 'Request failed. Is the server running?' });
        } finally {
            setTesting(false);
        }
    };

    const envTemplate = `# ── ChatOps Webhook URLs ──────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/YOUR/URL
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL

# ── Enrichment API Keys ────────────────────────────────
VIRUSTOTAL_API_KEY=your_vt_api_key_here
ABUSEIPDB_API_KEY=your_abuseipdb_api_key_here

# ── LLM Provider (choose one) ─────────────────────────
OPENAI_API_KEY=sk-your-openai-key-here
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=llama3

# ── SIEM Ingestion ─────────────────────────────────────
INGEST_API_KEY=${ingestKey}`;

    const [copiedEnv, setCopiedEnv] = useState(false);
    const copyEnv = () => {
        navigator.clipboard.writeText(envTemplate);
        setCopiedEnv(true);
        setTimeout(() => setCopiedEnv(false), 2000);
    };

    return (
        <div className="p-6 space-y-8 min-h-full bg-white max-w-7xl mx-auto">
            {/* Header */}
            <div className="pb-4 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2 mb-1.5">
                    <span className="section-label">Configuration</span>
                    <span className="availability-chip">
                        <span className="chip-dot"></span>
                        Platform Integrations
                    </span>
                </div>
                <h1 className="text-3xl font-extrabold font-display text-slate-900 flex items-center gap-3">
                    <span>⚙️</span> Integration Settings
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                    Configure ChatOps webhooks, API keys, SIEM ingestion nodes, and external alert dispatchers.
                </p>
            </div>

            {/* Webhook Status */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                        <span>🔔</span> ChatOps Webhooks
                    </h2>
                    <button
                        onClick={runTest}
                        disabled={testing}
                        className="btn-accent px-5 py-2 text-xs font-semibold flex items-center gap-2"
                    >
                        {testing ? '⏳ Dispatching...' : '🚀 Send Test Alert'}
                    </button>
                </div>

                {testResult && (
                    <div className={`rounded-xl p-4 border text-sm font-medium ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        {testResult.success ? '✅' : '⚠️'} {testResult.message}
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-4">
                    {config ? (
                        <>
                            <PlatformCard name="Slack" icon="💬" color="text-emerald-700"
                                status={config.slack} envKey="SLACK_WEBHOOK_URL"
                                testResult={testResult?.results?.slack} />
                            <PlatformCard name="Microsoft Teams" icon="💼" color="text-blue-700"
                                status={config.teams} envKey="TEAMS_WEBHOOK_URL"
                                testResult={testResult?.results?.teams} />
                            <PlatformCard name="Discord" icon="🎮" color="text-indigo-700"
                                status={config.discord} envKey="DISCORD_WEBHOOK_URL"
                                testResult={testResult?.results?.discord} />
                        </>
                    ) : (
                        <div className="col-span-3 text-center py-10 text-slate-400 font-medium">Loading configuration...</div>
                    )}
                </div>
            </section>

            {/* SIEM Ingestion */}
            <section className="space-y-4">
                <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                    <span>📡</span> SIEM Ingestion Endpoint
                </h2>
                <div className="metric-card space-y-4">
                    <p className="text-slate-600 text-sm">
                        Push alerts from Wazuh, Snort, Suricata, or any external security pipeline directly into NO ENTRY.
                        Critical and High alerts are automatically broadcast to all configured ChatOps webhooks.
                    </p>
                    <div className="space-y-2">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">HTTP Ingestion Target</p>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-sm">
                            <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded text-xs">POST</span>
                            <span className="text-slate-800 font-semibold">/api/v1/alerts</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Example cURL Payload</p>
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="proj-img-browser-bar">
                                <span className="dot dot-red"></span>
                                <span className="dot dot-yellow"></span>
                                <span className="dot dot-green"></span>
                                <span className="proj-img-url">bash — curl /api/v1/alerts</span>
                            </div>
                            <pre className="bg-slate-900 p-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre leading-relaxed">{`curl -X POST https://your-domain.com/api/v1/alerts \\
  -H "X-API-Key: $INGEST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "Ransomware",
    "severity": "Critical",
    "source": "Wazuh",
    "description": "Suspicious file encryption detected on WORKSTATION-04",
    "ioc": {
      "ip_addresses": ["192.168.1.50"],
      "sha256": "e3b0c44298fc1c149afbf4c8996fb924..."
    }
  }'`}</pre>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {['type (required)', 'severity (required)', 'source', 'description', 'ioc.ip_addresses', 'ioc.domains', 'ioc.sha256', 'ioc.md5'].map(field => (
                            <div key={field} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-700 text-center font-medium">{field}</div>
                        ))}
                    </div>
                </div>
            </section>

            {/* .env Template */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                        <span>🔑</span> Environment Variables Configuration
                    </h2>
                    <button
                        onClick={copyEnv}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            copiedEnv ? 'bg-emerald-600 text-white' : 'btn-secondary'
                        }`}
                    >
                        {copiedEnv ? '✓ Copied to Clipboard!' : '📋 Copy .env Template'}
                    </button>
                </div>
                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="proj-img-browser-bar">
                        <span className="dot dot-red"></span>
                        <span className="dot dot-yellow"></span>
                        <span className="dot dot-green"></span>
                        <span className="proj-img-url">.env — Configuration Template</span>
                    </div>
                    <pre className="p-5 text-xs text-slate-800 bg-slate-50 font-mono leading-relaxed overflow-x-auto whitespace-pre border-t border-slate-200">
                        {envTemplate}
                    </pre>
                </div>
                <p className="text-amber-700 text-xs font-medium">
                    ⚠️ Never commit your production .env file to public version control repositories.
                </p>
            </section>

            {/* API Reference Quick Links */}
            <section className="space-y-4 pb-8">
                <h2 className="text-slate-900 font-bold font-display text-xl flex items-center gap-2">
                    <span>📡</span> Platform API Surface
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                    {[
                        { method: 'GET', path: '/api/enrich/ip/:ip', desc: 'VirusTotal + AbuseIPDB IP enrichment' },
                        { method: 'GET', path: '/api/enrich/cve/:id', desc: 'EPSS score + CISA KEV status' },
                        { method: 'POST', path: '/api/enrich/iocs', desc: 'Bulk IOC extraction + enrichment' },
                        { method: 'GET', path: '/api/enrich/queries/:ioc', desc: 'Splunk / KQL / Sigma queries' },
                        { method: 'GET', path: '/api/mitre/heatmap', desc: 'MITRE ATT&CK heatmap data' },
                        { method: 'GET', path: '/api/rules/sigma', desc: 'List Sigma detection rules' },
                        { method: 'GET', path: '/api/rules/yara', desc: 'List YARA detection rules' },
                        { method: 'POST', path: '/api/rules/generate', desc: 'Generate rule for custom IOC' },
                        { method: 'GET', path: '/api/ai/brief', desc: 'LLM executive briefing synthesis' },
                        { method: 'GET', path: '/api/ai/clusters', desc: 'De-duplicated incident clusters' },
                        { method: 'POST', path: '/api/webhooks/test', desc: 'Test all webhook platforms' },
                        { method: 'POST', path: '/api/v1/alerts', desc: 'External SIEM alert ingestion' },
                    ].map(ep => (
                        <div key={ep.path} className="flex items-center gap-3 metric-card p-3.5">
                            <span className={`text-[11px] font-bold w-14 text-center px-2 py-1 rounded-md ${ep.method === 'GET' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-900 border border-blue-200'}`}>
                                {ep.method}
                            </span>
                            <div>
                                <p className="font-mono text-xs font-semibold text-[#1E3A8A]">{ep.path}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{ep.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
