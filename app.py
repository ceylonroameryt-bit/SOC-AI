"""
NO ENTRY — Python AI Microservice (FastAPI)
Provides threat intelligence summarization, incident deduplication clustering,
Sigma rule generation, and automated SOC remediation workflows.
"""

import os
import re
import math
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI App
app = FastAPI(
    title="NO ENTRY AI Microservice",
    description="Threat Intelligence AI Engine for Summarization, Deduplication, and SOC Playbooks",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Request/Response Models ──────────────────────────────────────────

class ThreatArticle(BaseModel):
    title: str
    contentSnippet: Optional[str] = ""
    source: Optional[str] = "Unknown"
    severity: Optional[str] = "Medium"
    category: Optional[str] = "General"
    link: Optional[str] = "#"
    pubDate: Optional[str] = Field(default_factory=lambda: datetime.utcnow().isoformat())

class BriefingRequest(BaseModel):
    articles: List[ThreatArticle]
    focus_topic: Optional[str] = None
    max_bullet_points: Optional[int] = 5

class BriefingResponse(BaseModel):
    headline: str
    key_threats: List[str]
    critical_vulnerabilities: List[str]
    recommended_actions: List[str]
    executive_summary: str
    generated_at: str

class ClusterRequest(BaseModel):
    articles: List[ThreatArticle]
    similarity_threshold: Optional[float] = 0.30

class ClusterResponse(BaseModel):
    clusters_count: int
    total_articles: int
    deduplication_rate_percent: float
    clusters: List[Dict[str, Any]]

class RemediationRequest(BaseModel):
    threat_type: str
    severity: str
    description: Optional[str] = ""
    iocs: Optional[Dict[str, List[str]]] = Field(default_factory=dict)

class SigmaGenRequest(BaseModel):
    title: str
    indicator: str
    indicator_type: str = "auto"
    severity: str = "high"
    description: Optional[str] = ""

# ── Health & Info Endpoint ────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "NO ENTRY AI Microservice",
        "status": "online",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": [
            "/docs",
            "/api/v1/briefing",
            "/api/v1/cluster",
            "/api/v1/remediate",
            "/api/v1/sigma"
        ]
    }

@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy", "uptime_check": True}

# ── Executive Briefing Generator ──────────────────────────────────────────────

@app.post("/api/v1/briefing", response_model=BriefingResponse, tags=["AI Pipeline"])
def generate_briefing(payload: BriefingRequest):
    articles = payload.articles
    if not articles:
        raise HTTPException(status_code=400, detail="Article list cannot be empty.")

    critical_count = sum(1 for a in articles if (a.severity or "").lower() == "critical")
    high_count = sum(1 for a in articles if (a.severity or "").lower() == "high")

    # Group topics
    ransomware_articles = [a.title for a in articles if "ransomware" in (a.title or "").lower()]
    vuln_articles = [a.title for a in articles if re.search(r"cve-\d{4}-\d+", a.title, re.I) or "zero-day" in a.title.lower()]

    key_threats = ransomware_articles[:4] if ransomware_articles else [a.title for a in articles[:3]]
    critical_vulns = vuln_articles[:4] if vuln_articles else [
        "Monitor public-facing SSL VPNs and perimeter firewalls for unpatched CVEs."
    ]

    actions = [
        "Audit Active Directory domain admin accounts and enforce FIDO2/MFA on all VPN endpoints.",
        "Ensure offline/immutable backups for all critical SQL databases and hypervisors.",
        "Ingest latest IOCs into SIEM/EDR blocklists and run automated threat hunting queries.",
        "Review CISA Known Exploited Vulnerabilities (KEV) catalog against external IP range."
    ]

    summary_text = (
        f"Global threat monitoring analyzed {len(articles)} intelligence reports. "
        f"Identified {critical_count} critical-severity alerts and {high_count} high-severity incidents. "
        f"Primary threat vectors include ransomware extortion campaigns, zero-day exploitation of edge devices, "
        f"and supply-chain malware loaders."
    )

    return BriefingResponse(
        headline=f"Executive Threat Briefing — {datetime.utcnow().strftime('%B %d, %Y')}",
        key_threats=key_threats,
        critical_vulnerabilities=critical_vulns,
        recommended_actions=actions,
        executive_summary=summary_text,
        generated_at=datetime.utcnow().isoformat()
    )

# ── Incident Clustering & Deduplication (TF-IDF & Cosine Sim) ─────────────────

STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'if', 'then',
    'else', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
}

def tokenize(text: str) -> List[str]:
    words = re.findall(r'[a-z0-9]{3,}', text.lower())
    return [w for w in words if w not in STOPWORDS]

def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    dot_product = sum(v1.get(k, 0) * v2.get(k, 0) for k in v1)
    mag1 = math.sqrt(sum(val ** 2 for val in v1.values()))
    mag2 = math.sqrt(sum(val ** 2 for val in v2.values()))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot_product / (mag1 * mag2)

@app.post("/api/v1/cluster", response_model=ClusterResponse, tags=["AI Pipeline"])
def cluster_articles(payload: ClusterRequest):
    articles = payload.articles
    threshold = payload.similarity_threshold or 0.30

    if not articles:
        return ClusterResponse(
            clusters_count=0,
            total_articles=0,
            deduplication_rate_percent=0.0,
            clusters=[]
        )

    # Compute TF-IDF vectors
    tokenized = [tokenize(f"{a.title} {a.contentSnippet or ''}") for a in articles]
    doc_freq: Dict[str, int] = {}
    for tokens in tokenized:
        for term in set(tokens):
            doc_freq[term] = doc_freq.get(term, 0) + 1

    num_docs = len(articles)
    tfidf_vectors = []
    for tokens in tokenized:
        tf: Dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        vec: Dict[str, float] = {}
        for t, count in tf.items():
            idf = math.log((1 + num_docs) / (1 + doc_freq.get(t, 1))) + 1.0
            vec[t] = (count / len(tokens)) * idf
        tfidf_vectors.append(vec)

    clusters: List[Dict[str, Any]] = []

    for i, article in enumerate(articles):
        vec = tfidf_vectors[i]
        matched_cluster = None

        for c in clusters:
            sim = cosine_similarity(vec, c['centroid'])
            if sim >= threshold:
                matched_cluster = c
                break

        if matched_cluster:
            matched_cluster['items'].append(article.dict())
            matched_cluster['item_count'] += 1
            if article.source and article.source not in matched_cluster['sources']:
                matched_cluster['sources'].append(article.source)
        else:
            clusters.append({
                'id': f"cluster-{len(clusters) + 1}",
                'headline': article.title,
                'category': article.category or "General",
                'severity': article.severity or "Medium",
                'sources': [article.source] if article.source else [],
                'item_count': 1,
                'centroid': vec,
                'items': [article.dict()]
            })

    # Strip centroid before returning
    for c in clusters:
        del c['centroid']

    dedup_rate = round(((len(articles) - len(clusters)) / len(articles)) * 100, 1) if articles else 0.0

    return ClusterResponse(
        clusters_count=len(clusters),
        total_articles=len(articles),
        deduplication_rate_percent=dedup_rate,
        clusters=clusters
    )

# ── SOC Analyst Remediation Playbook ──────────────────────────────────────────

@app.post("/api/v1/remediate", tags=["SOC Automation"])
def generate_remediation_playbook(payload: RemediationRequest):
    t_type = (payload.threat_type or "").lower()
    sev = payload.severity

    playbook = {
        "title": f"Incident Response Playbook — {payload.threat_type} ({sev})",
        "phase_1_identification": [
            "Validate detection alert in EDR console and correlate process execution tree.",
            "Verify network connections to identified IP/Domain indicators.",
            "Extract memory dump and artifact hashes from suspect host."
        ],
        "phase_2_containment": [
            "Isolate compromised endpoint from network via EDR single-click isolation.",
            "Revoke all active Kerberos / OAuth sessions for involved user accounts.",
            "Null-route / block malicious IP addresses at the perimeter firewall."
        ],
        "phase_3_eradication": [
            "Terminate unauthorized background processes and remove persistent scheduled tasks.",
            "Delete malicious artifacts identified by hash verification.",
            "Patch target CVE vulnerabilities across all reachable network hosts."
        ],
        "phase_4_recovery": [
            "Restore encrypted or damaged files from verified offline snapshot.",
            "Reset passwords for affected service and administrative accounts.",
            "Monitor endpoint telemetry for 72 hours for recurrence."
        ]
    }

    if "ransomware" in t_type:
        playbook["phase_2_containment"].insert(0, "🚨 CRITICAL: Immediately sever SMB shares and unbind shared storage volumes to stop encryption propagation.")

    return playbook

# ── Sigma Detection Rule Generator ────────────────────────────────────────────

@app.post("/api/v1/sigma", tags=["Detection Engineering"])
def generate_sigma_rule(payload: SigmaGenRequest):
    ioc = payload.indicator.strip()
    rule_title = payload.title or f"Detection for {ioc}"
    severity = payload.severity.lower()

    sigma_yaml = f"""title: {rule_title}
id: {os.urandom(8).hex()}-{os.urandom(4).hex()}
status: experimental
description: {payload.description or f"Detects malicious activity involving {ioc}"}
author: NO ENTRY SOC Automated Engine
date: {datetime.utcnow().strftime('%Y-%m-%d')}
tags:
    - attack.execution
    - attack.command_and_control
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        CommandLine|contains: '{ioc}'
    condition: selection
falsepositives:
    - Legitimate administrative actions
level: {severity}
"""
    return {
        "title": rule_title,
        "format": "Sigma YAML",
        "rule_yaml": sigma_yaml,
        "queries": {
            "splunk": f'index=* "{ioc}" | stats count by host, user, process_name',
            "sentinel_kql": f'DeviceProcessEvents | where ProcessCommandLine has "{ioc}"',
            "elastic": f'process.command_line: *"{ioc}"*'
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting NO ENTRY AI Microservice on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
