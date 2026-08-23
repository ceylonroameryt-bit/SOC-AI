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
    <div className={`bg-gray-900/80 border rounded-2xl p-5 space-y-3 transition-all ${status.configured ? 'border-green-700/40' : 'border-gray-700/40'}`}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className="text-3xl">{icon}</span>
                <div>
                    <h3 className={`font-bold text-lg ${color}`}>{name}</h3>
                    <p className="text-gray-500 text-xs">Webhook Integration</p>
                </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${status.configured ? 'bg-green-900/30 text-green-300 border-green-700/40' : 'bg-gray-800/60 text-gray-500 border-gray-700/40'}`}>
                {status.configured ? '✓ Configured' : 'Not Configured'}
            </div>
        </div>

        {status.configured && status.maskedUrl && (
            <div className="bg-gray-800/60 rounded-lg px-3 py-2 font-mono text-xs text-gray-400 truncate">
                {status.maskedUrl}
            </div>
        )}

        {!status.configured && (
            <div className="bg-gray-800/40 rounded-xl p-3 border border-dashed border-gray-700/50">
                <p className="text-gray-500 text-xs">
                    Add <code className="text-cyan-400 bg-gray-900/60 px-1 rounded">{envKey}</code> to your <code className="text-cyan-400 bg-gray-900/60 px-1 rounded">.env</code> file to enable.
                </p>
            </div>
        )}

        {testResult && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium border ${testResult.success ? 'bg-green-900/20 text-green-300 border-green-700/40' : 'bg-red-900/20 text-red-300 border-red-700/40'}`}>
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
        } catch (err) {
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
        <div className="p-6 space-y-8 min-h-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span>⚙️</span> Integration Settings
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                    Configure ChatOps webhooks, API keys, and external integrations.
                </p>
            </div>

            {/* Webhook Status */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-xl flex items-center gap-2">
                        <span>🔔</span> ChatOps Webhooks
                    </h2>
                    <button
                        onClick={runTest}
                        disabled={testing}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-2"
                    >
                        {testing ? '⏳ Sending...' : '🚀 Send Test Alert'}
                    </button>
                </div>

                {testResult && (
                    <div className={`rounded-xl p-4 border text-sm font-medium ${testResult.success ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-red-900/20 border-red-700/40 text-red-300'}`}>
                        {testResult.success ? '✅' : '⚠️'} {testResult.message}
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-4">
                    {config ? (
                        <>
                            <PlatformCard name="Slack" icon="💬" color="text-green-400"
                                status={config.slack} envKey="SLACK_WEBHOOK_URL"
                                testResult={testResult?.results?.slack} />
                            <PlatformCard name="Microsoft Teams" icon="💼" color="text-blue-400"
                                status={config.teams} envKey="TEAMS_WEBHOOK_URL"
                                testResult={testResult?.results?.teams} />
                            <PlatformCard name="Discord" icon="🎮" color="text-indigo-400"
                                status={config.discord} envKey="DISCORD_WEBHOOK_URL"
                                testResult={testResult?.results?.discord} />
                        </>
                    ) : (
                        <div className="col-span-3 text-center py-10 text-gray-500">Loading configuration...</div>
                    )}
                </div>
            </section>

            {/* SIEM Ingestion */}
            <section className="space-y-4">
                <h2 className="text-white font-bold text-xl flex items-center gap-2">
                    <span>📡</span> SIEM Ingestion Endpoint
                </h2>
                <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl p-5 space-y-4">
                    <p className="text-gray-400 text-sm">
                        Push alerts from Wazuh, Snort, Suricata, or any external tool directly into NO ENTRY.
                        Critical/High alerts are automatically broadcast to all configured webhooks.
                    </p>
                    <div className="space-y-2">
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Endpoint</p>
                        <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-3 font-mono text-sm">
                            <span className="text-green-400 font-bold">POST</span>
                            <span className="text-gray-300">/api/v1/alerts</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Example cURL</p>
                        <pre className="bg-gray-800/60 rounded-xl p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">{`curl -X POST https://your-domain.com/api/v1/alerts \\
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {['type (required)', 'severity (required)', 'source', 'description', 'ioc.ip_addresses', 'ioc.domains', 'ioc.sha256', 'ioc.md5'].map(field => (
                            <div key={field} className="bg-gray-800/50 rounded-lg px-3 py-2 font-mono text-gray-400">{field}</div>
                        ))}
                    </div>
                </div>
            </section>

            {/* .env Template */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-xl flex items-center gap-2">
                        <span>🔑</span> Environment Variables Template
                    </h2>
                    <button onClick={copyEnv}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${copiedEnv ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                        {copiedEnv ? '✓ Copied!' : '📋 Copy .env Template'}
                    </button>
                </div>
                <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2 bg-gray-800/60 border-b border-gray-700/40 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                        <span className="text-gray-500 text-xs ml-2">.env</span>
                    </div>
                    <pre className="p-5 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre">
                        {envTemplate}
                    </pre>
                </div>
                <p className="text-yellow-400/80 text-xs">
                    ⚠️ Never commit your .env file to version control. It is already in .gitignore.
                </p>
            </section>

            {/* API Reference Quick Links */}
            <section className="space-y-4">
                <h2 className="text-white font-bold text-xl flex items-center gap-2">
                    <span>📡</span> New API Endpoints
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                    {[
                        { method: 'GET', path: '/api/enrich/ip/:ip', desc: 'VirusTotal + AbuseIPDB IP enrichment' },
                        { method: 'GET', path: '/api/enrich/cve/:id', desc: 'EPSS score + CISA KEV status' },
                        { method: 'POST', path: '/api/enrich/iocs', desc: 'Bulk IOC extraction + enrichment' },
                        { method: 'GET', path: '/api/enrich/queries/:ioc', desc: 'Splunk / KQL / Sigma queries' },
                        { method: 'GET', path: '/api/mitre/heatmap', desc: 'MITRE ATT&CK heatmap data' },
                        { method: 'GET', path: '/api/rules/sigma', desc: 'List Sigma rules' },
                        { method: 'GET', path: '/api/rules/yara', desc: 'List YARA rules' },
                        { method: 'POST', path: '/api/rules/generate', desc: 'Generate rule for custom IOC' },
                        { method: 'GET', path: '/api/ai/brief', desc: 'LLM executive briefing' },
                        { method: 'GET', path: '/api/ai/clusters', desc: 'De-duplicated incident clusters' },
                        { method: 'POST', path: '/api/webhooks/test', desc: 'Test all webhook platforms' },
                        { method: 'POST', path: '/api/v1/alerts', desc: 'External SIEM alert ingestion' },
                    ].map(ep => (
                        <div key={ep.path} className="flex items-center gap-3 bg-gray-900/60 border border-gray-700/40 rounded-xl px-4 py-3">
                            <span className={`text-xs font-bold w-12 text-center px-2 py-1 rounded-md ${ep.method === 'GET' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                {ep.method}
                            </span>
                            <div>
                                <p className="font-mono text-xs text-cyan-300">{ep.path}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{ep.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
