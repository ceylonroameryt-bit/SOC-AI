/**
 * aiService.js
 * LLM-based threat summarization and de-duplication / clustering engine.
 * Supports OpenAI API (cloud) or Ollama (local). Gracefully degrades if no key is configured.
 * De-duplication uses TF-IDF cosine similarity — no external library needed.
 */

// ── LLM Summarization ─────────────────────────────────────────────────────────
const callOpenAI = async (prompt, maxTokens = 400) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: 'You are a senior SOC analyst and threat intelligence expert. Be concise, precise, and actionable.' },
                { role: 'user', content: prompt },
            ],
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${err}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
};

const callOllama = async (prompt, maxTokens = 400) => {
    const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3';

    const resp = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: { num_predict: maxTokens },
        }),
    });
    if (!resp.ok) throw new Error(`Ollama API error ${resp.status}`);
    const data = await resp.json();
    return data.response || '';
};

const callLLM = async (prompt, maxTokens = 400) => {
    // Try OpenAI first, then Ollama, then gracefully fail
    if (process.env.OPENAI_API_KEY) {
        return callOpenAI(prompt, maxTokens);
    }
    if (process.env.OLLAMA_URL || process.env.USE_OLLAMA === 'true') {
        return callOllama(prompt, maxTokens);
    }
    throw new Error('No LLM provider configured. Set OPENAI_API_KEY or OLLAMA_URL in .env');
};

// Cache for daily brief
let briefCache = { content: null, generatedAt: null };
const BRIEF_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const generateExecutiveBrief = async (newsItems = [], threats = []) => {
    // Return cached brief if fresh
    if (briefCache.content && briefCache.generatedAt && (Date.now() - briefCache.generatedAt < BRIEF_TTL_MS)) {
        return { ...briefCache, cached: true };
    }

    const criticalNews = newsItems.filter(n => n.severity === 'Critical' || n.severity === 'High').slice(0, 10);
    const criticalThreats = threats.filter(t => t.severity === 'Critical' || t.severity === 'High').slice(0, 5);

    const newsContext = criticalNews.map((n, i) =>
        `${i + 1}. [${n.severity}] ${n.title} (Source: ${n.source || 'Unknown'})`
    ).join('\n');

    const threatContext = criticalThreats.map((t, i) =>
        `${i + 1}. [${t.severity}] ${t.type}: ${t.description?.substring(0, 150) || 'N/A'}`
    ).join('\n');

    const prompt = `You are a SOC analyst writing a daily threat intelligence executive briefing.

Based on the following real-time security intelligence, write:
1. A 2-3 sentence EXECUTIVE SUMMARY (for C-suite, non-technical)
2. 3-5 bullet ANALYST HIGHLIGHTS (technical, specific threats)  
3. TOP 3 RECOMMENDED ACTIONS for the security team today

Current threat intelligence:
CRITICAL/HIGH NEWS (last 24h):
${newsContext || 'No critical news today.'}

ACTIVE THREATS:
${threatContext || 'No active high-severity threats.'}

Format your response exactly as:
## Executive Summary
[2-3 sentences]

## Key Analyst Highlights
- [highlight 1]
- [highlight 2]
- [highlight 3]

## Recommended Actions
1. [action 1]
2. [action 2]
3. [action 3]`;

    try {
        const content = await callLLM(prompt, 600);
        briefCache = { content, generatedAt: Date.now(), cached: false };
        return briefCache;
    } catch (err) {
        console.error('[AI] Executive brief generation failed:', err.message);
        return {
            content: null,
            error: err.message,
            fallback: generateFallbackBrief(criticalNews, criticalThreats),
            generatedAt: Date.now(),
            cached: false,
        };
    }
};

export const generateRemediationSteps = async (threat) => {
    const prompt = `As a senior SOC analyst, provide specific, actionable remediation steps for the following threat:

Threat Type: ${threat.type}
Severity: ${threat.severity}
Description: ${threat.description || 'N/A'}
IOCs: ${JSON.stringify(threat.ioc || {})}

Provide exactly 5 numbered remediation steps. Be specific about tools, commands, and processes.
Start immediately — no preamble.`;

    try {
        const content = await callLLM(prompt, 400);
        return { threatId: threat.id, steps: content, generatedAt: new Date().toISOString() };
    } catch (err) {
        console.error('[AI] Remediation steps generation failed:', err.message);
        return {
            threatId: threat.id,
            steps: null,
            error: err.message,
            fallbackSteps: generateFallbackRemediation(threat),
            generatedAt: new Date().toISOString(),
        };
    }
};

// ── TF-IDF Cosine Similarity De-duplication ───────────────────────────────────
const tokenize = (text) => {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 3 && !STOP_WORDS.has(t));
};

const STOP_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
    'their', 'them', 'there', 'then', 'than', 'will', 'would', 'could',
    'should', 'about', 'which', 'when', 'where', 'what', 'more', 'into',
    'also', 'after', 'over', 'such', 'some', 'each', 'most', 'both',
    'through', 'during', 'before', 'between', 'under', 'while',
]);

const computeTFIDF = (docs) => {
    const N = docs.length;
    const tokenizedDocs = docs.map(tokenize);

    // Build IDF
    const dfMap = new Map();
    for (const tokens of tokenizedDocs) {
        const seen = new Set(tokens);
        for (const token of seen) {
            dfMap.set(token, (dfMap.get(token) || 0) + 1);
        }
    }

    // Compute TF-IDF vectors
    return tokenizedDocs.map(tokens => {
        const vec = new Map();
        const total = tokens.length || 1;
        for (const token of tokens) {
            const tf = (tokens.filter(t => t === token).length) / total;
            const idf = Math.log(N / (dfMap.get(token) || 1));
            vec.set(token, tf * idf);
        }
        return vec;
    });
};

const cosineSimilarity = (vecA, vecB) => {
    let dot = 0, normA = 0, normB = 0;
    for (const [term, valA] of vecA) {
        const valB = vecB.get(term) || 0;
        dot += valA * valB;
        normA += valA * valA;
    }
    for (const val of vecB.values()) normB += val * val;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
};

export const clusterSimilarItems = (newsItems, threshold = 0.35) => {
    if (!newsItems || newsItems.length === 0) return [];

    const texts = newsItems.map(item => `${item.title || ''} ${item.contentSnippet || ''}`);
    const vectors = computeTFIDF(texts);

    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < newsItems.length; i++) {
        if (assigned.has(i)) continue;

        const cluster = {
            id: `cluster-${Date.now()}-${i}`,
            headline: newsItems[i].title,
            severity: newsItems[i].severity,
            category: newsItems[i].category,
            items: [newsItems[i]],
            itemCount: 1,
            sources: [newsItems[i].source].filter(Boolean),
            firstSeen: newsItems[i].pubDate,
            lastSeen: newsItems[i].pubDate,
        };

        assigned.add(i);

        for (let j = i + 1; j < newsItems.length; j++) {
            if (assigned.has(j)) continue;
            const sim = cosineSimilarity(vectors[i], vectors[j]);
            if (sim >= threshold) {
                cluster.items.push(newsItems[j]);
                cluster.itemCount++;
                if (!cluster.sources.includes(newsItems[j].source)) {
                    cluster.sources.push(newsItems[j].source);
                }
                // Track date range
                if (newsItems[j].pubDate < cluster.firstSeen) cluster.firstSeen = newsItems[j].pubDate;
                if (newsItems[j].pubDate > cluster.lastSeen)  cluster.lastSeen  = newsItems[j].pubDate;
                assigned.add(j);
            }
        }

        clusters.push(cluster);
    }

    // Sort by item count (largest clusters first) then by severity
    const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return clusters.sort((a, b) => {
        if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
        return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
};

// ── Fallback Generators (when no LLM available) ────────────────────────────────
const generateFallbackBrief = (news, threats) => {
    const critCount = news.length;
    const threatCount = threats.length;
    return `## Executive Summary\nThe SOC platform has detected ${critCount} critical/high severity news items and ${threatCount} active threats in the current period. Immediate analyst review is recommended for all Critical items.\n\n## Key Analyst Highlights\n${news.slice(0, 3).map(n => `- [${n.severity}] ${n.title}`).join('\n') || '- No critical alerts at this time.'}\n\n## Recommended Actions\n1. Review all Critical severity alerts immediately\n2. Validate and enrich IOCs using the Enrichment module\n3. Check CISA KEV for any newly exploited CVEs`;
};

const generateFallbackRemediation = (threat) => {
    return `1. Isolate affected systems from the network immediately\n2. Capture forensic memory dumps and system logs before remediation\n3. Block identified IOCs at the perimeter firewall and DNS level\n4. Run EDR/AV scans across the environment for related indicators\n5. Notify stakeholders and escalate according to IR runbook`;
};
