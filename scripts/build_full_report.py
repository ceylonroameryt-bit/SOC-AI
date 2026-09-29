#!/usr/bin/env python3
"""
NO ENTRY — Complete Project Report Generator
Generates a single comprehensive HTML document covering every aspect of the project,
then exports PDF (via Edge headless) and DOCX (via python-docx).
"""
import os, subprocess, sys, shutil

OUTDIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs')
os.makedirs(OUTDIR, exist_ok=True)

HTML_OUT  = os.path.join(OUTDIR, 'NO_ENTRY_COMPLETE_PROJECT_REPORT.html')
PDF_OUT   = os.path.join(OUTDIR, 'NO_ENTRY_COMPLETE_PROJECT_REPORT.pdf')
DOCX_OUT  = os.path.join(OUTDIR, 'NO_ENTRY_COMPLETE_PROJECT_REPORT.docx')
MHTML_OUT = os.path.join(OUTDIR, 'NO_ENTRY_COMPLETE_PROJECT_REPORT.mhtml')

# ─── ARTIFACT DIR (copy final files here for IDE browser) ────────────────────
ARTIFACT_DIR = r'C:\Users\Sujampathi\.gemini\antigravity-ide\brain\7ef0eabc-57fa-45aa-b08e-4c57a1dc92da'

HTML_CONTENT = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NO ENTRY — Complete Project Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{--blue:#1E3A8A;--blue-mid:#2563EB;--blue-light:#DBEAFE;--red:#DC2626;--red-light:#FEE2E2;--green:#16A34A;--green-light:#DCFCE7;--orange:#EA580C;--orange-light:#FFEDD5;--purple:#7C3AED;--purple-light:#EDE9FE;--slate-900:#0F172A;--slate-800:#1E293B;--slate-700:#334155;--slate-600:#475569;--slate-400:#94A3B8;--slate-200:#E2E8F0;--slate-100:#F1F5F9;--slate-50:#F8FAFC;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',system-ui,sans-serif;background:#fff;color:var(--slate-800);line-height:1.65;font-size:14px;}
.cover{background:linear-gradient(135deg,#0F172A 0%,#1E3A8A 50%,#1d4ed8 100%);color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 40px;page-break-after:always;position:relative;}
.cover h1{font-size:72px;font-weight:900;letter-spacing:-3px;line-height:1;margin-bottom:10px;}
.cover h1 span{color:#60A5FA;}
.cover-sub{font-size:22px;font-weight:300;opacity:.85;margin-bottom:36px;max-width:620px;}
.cover-tags{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:36px;}
.cover-tag{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:8px;padding:5px 14px;font-size:12px;font-weight:600;}
.cover-url{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:16px 28px;font-size:17px;font-weight:700;font-family:monospace;margin-bottom:36px;}
.cover-meta{display:flex;gap:36px;justify-content:center;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.2);padding-top:28px;}
.cm-item .cm-label{font-size:10px;opacity:.55;text-transform:uppercase;letter-spacing:.1em;}
.cm-item .cm-val{font-size:15px;font-weight:700;margin-top:3px;}
.page{max-width:900px;margin:0 auto;padding:56px 40px;}
.pb{page-break-before:always;padding-top:56px;}
.sh{margin-bottom:28px;}
.sn{font-size:11px;font-weight:700;color:var(--blue-mid);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;}
h2.st{font-size:28px;font-weight:800;color:var(--slate-900);letter-spacing:-.5px;padding-bottom:10px;border-bottom:3px solid var(--blue-light);margin-bottom:10px;}
h3{font-size:17px;font-weight:700;color:var(--blue);margin:26px 0 10px;}
h4{font-size:13.5px;font-weight:700;color:var(--slate-700);margin:18px 0 7px;}
p{margin-bottom:12px;color:var(--slate-700);}
ul,ol{margin:8px 0 14px 20px;color:var(--slate-700);}
li{margin-bottom:4px;}
strong{color:var(--slate-900);font-weight:600;}
em{font-style:italic;}
.callout{border-radius:10px;padding:14px 18px;margin:18px 0;border-left:4px solid;font-size:13px;}
.callout.info{background:#EFF6FF;border-color:#3B82F6;color:#1E3A8A;}
.callout.warn{background:#FFFBEB;border-color:#F59E0B;color:#92400E;}
.callout.ok{background:#F0FDF4;border-color:#22C55E;color:#14532D;}
.callout.purple{background:#F5F3FF;border-color:#8B5CF6;color:#4C1D95;}
.ct{font-weight:700;margin-bottom:3px;font-size:10px;text-transform:uppercase;letter-spacing:.07em;}
pre{background:var(--slate-900);color:#e2e8f0;border-radius:10px;padding:18px;font-family:'JetBrains Mono','Courier New',monospace;font-size:11.5px;line-height:1.7;overflow-x:auto;margin:14px 0;border:1px solid var(--slate-700);}
code{font-family:'JetBrains Mono','Courier New',monospace;font-size:11.5px;background:var(--slate-100);color:var(--blue);padding:2px 6px;border-radius:4px;border:1px solid var(--slate-200);}
pre code{background:transparent;color:inherit;padding:0;border:none;}
.kw{color:#c792ea;}.fn{color:#82AAFF;}.str{color:#C3E88D;}.cm{color:#546E7A;font-style:italic;}.num{color:#F78C6C;}.cls{color:#FFCB6B;}.dc{color:#89DDFF;}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;}
th{background:var(--blue);color:#fff;padding:9px 13px;text-align:left;font-weight:600;font-size:11.5px;}
td{padding:8px 13px;border-bottom:1px solid var(--slate-200);vertical-align:top;}
tr:nth-child(even) td{background:var(--slate-50);}
.badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:10.5px;font-weight:600;border:1px solid transparent;}
.br{background:var(--red-light);color:var(--red);border-color:#FCA5A5;}
.bo{background:var(--orange-light);color:var(--orange);border-color:#FED7AA;}
.bb{background:var(--blue-light);color:var(--blue);border-color:#93C5FD;}
.bg{background:var(--green-light);color:var(--green);border-color:#86EFAC;}
.bp{background:var(--purple-light);color:var(--purple);border-color:#C4B5FD;}
.arch{background:var(--slate-900);border-radius:12px;padding:28px;margin:18px 0;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.8;border:1px solid #334155;white-space:pre;}
.flow{display:flex;align-items:center;flex-wrap:wrap;margin:18px 0;gap:0;}
.fs{background:linear-gradient(135deg,var(--blue),var(--blue-mid));color:#fff;padding:10px 14px;border-radius:8px;font-weight:600;font-size:11.5px;text-align:center;min-width:95px;}
.fa{color:var(--blue-mid);font-size:20px;padding:0 6px;font-weight:700;}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:18px 0;}
.card{background:#fff;border:1px solid var(--slate-200);border-radius:12px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.ci{font-size:22px;margin-bottom:8px;}
.ct2{font-size:13px;font-weight:700;color:var(--slate-900);margin-bottom:5px;}
.cd{font-size:12px;color:var(--slate-600);line-height:1.5;}
.hs{background:linear-gradient(135deg,var(--blue),#1d4ed8);color:#fff;border-radius:12px;padding:22px 26px;margin:22px 0;}
.hs h3{color:#fff;margin:0 0 8px;}
.hs p{color:rgba(255,255,255,.85);margin:0;}
.mr{display:flex;gap:14px;flex-wrap:wrap;margin:18px 0;}
.mb{flex:1;min-width:120px;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:10px;padding:14px;text-align:center;}
.mn{font-size:26px;font-weight:900;color:var(--blue);line-height:1;}
.ml{font-size:10.5px;color:var(--slate-500);margin-top:3px;text-transform:uppercase;letter-spacing:.06em;}
hr.dv{border:none;border-top:2px solid var(--slate-100);margin:28px 0;}
.fp{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--blue-mid);background:var(--blue-light);padding:3px 10px;border-radius:5px;border:1px solid #BFDBFE;display:inline-block;margin-bottom:7px;}
.ab{border:1px solid var(--slate-200);border-radius:10px;overflow:hidden;margin:10px 0;}
.ah{display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--slate-50);border-bottom:1px solid var(--slate-200);}
.am{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:5px;}
.am.get{background:var(--green-light);color:var(--green);}
.am.post{background:var(--orange-light);color:var(--orange);}
.ap{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--slate-700);}
.abt{padding:10px 14px;font-size:12.5px;color:var(--slate-600);}
.toc-title{font-size:26px;font-weight:800;color:var(--blue);margin-bottom:24px;padding-bottom:10px;border-bottom:3px solid var(--blue-light);}
.ts{margin-bottom:5px;}
.ts a{text-decoration:none;color:var(--slate-800);display:flex;align-items:baseline;gap:7px;padding:4px 0;border-bottom:1px dotted var(--slate-200);font-size:13.5px;}
.ts a:hover{color:var(--blue-mid);}
.tn{font-weight:800;color:var(--blue-mid);min-width:26px;}
.tsub{margin-left:32px;}
.tsub a{font-size:12px;color:var(--slate-600);}
@media print{
  .cover,.hs,pre,.arch,th{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .pb{page-break-before:always;}
  .cover{page-break-after:always;}
}
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div style="position:relative;z-index:1;width:100%;">
    <div style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:100px;padding:5px 18px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;display:inline-block;margin-bottom:24px;">&#x1F6E1;&#xFE0F; Full Engineering &amp; Project Documentation</div>
    <h1>NO <span>ENTRY</span></h1>
    <div class="cover-sub">Next-Gen AI Threat Intelligence &amp; SOC Triage Platform<br>Complete Project Report — All Sections</div>
    <div class="cover-tags">
      <div class="cover-tag">React 19 + TypeScript</div>
      <div class="cover-tag">Node.js + Express 5</div>
      <div class="cover-tag">Python FastAPI</div>
      <div class="cover-tag">PostgreSQL / Supabase</div>
      <div class="cover-tag">MITRE ATT&amp;CK v14</div>
      <div class="cover-tag">Vercel + Render</div>
    </div>
    <div class="cover-url">&#x1F517; https://soc-ai-six.vercel.app/</div>
    <div class="cover-meta">
      <div class="cm-item"><div class="cm-label">Repository</div><div class="cm-val">ceylonroameryt-bit/SOC-AI</div></div>
      <div class="cm-item"><div class="cm-label">Frontend Pages</div><div class="cm-val">15 Pages</div></div>
      <div class="cm-item"><div class="cm-label">API Endpoints</div><div class="cm-val">25+ Routes</div></div>
      <div class="cm-item"><div class="cm-label">AI Engines</div><div class="cm-val">4 Engines</div></div>
      <div class="cm-item"><div class="cm-label">DB Tables</div><div class="cm-val">7 Tables</div></div>
      <div class="cm-item"><div class="cm-label">Report Date</div><div class="cm-val">September 2026</div></div>
    </div>
  </div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="page" style="page-break-after:always;">
  <div class="toc-title">&#x1F4CB; Table of Contents</div>
  <div class="ts"><a href="#s1"><span class="tn">1</span> Project Overview &amp; Purpose</a></div>
  <div class="tsub"><div class="ts"><a href="#s1a">1.1 What is NO ENTRY?</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s1b">1.2 Who Uses It?</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s1c">1.3 Key Capabilities</a></div></div>
  <div class="ts"><a href="#s2"><span class="tn">2</span> System Architecture</a></div>
  <div class="tsub"><div class="ts"><a href="#s2a">2.1 Three-Tier Architecture Diagram</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s2b">2.2 End-to-End Data Flow (10 Steps)</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s2c">2.3 Deployment Topology</a></div></div>
  <div class="ts"><a href="#s3"><span class="tn">3</span> Technology Stack</a></div>
  <div class="ts"><a href="#s4"><span class="tn">4</span> Frontend — React Application (15 Pages)</a></div>
  <div class="tsub"><div class="ts"><a href="#s4a">4.1 Routing &amp; App Shell (App.tsx)</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4b">4.2 Dashboard — SOC Mission Control</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4c">4.3 Explore — Date-Based Intelligence Archive</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4d">4.4 Sources — Feed Health &amp; Approval Console</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4e">4.5 Enrichment — IOC Triage Console</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4f">4.6 MITRE ATT&amp;CK Heatmap</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4g">4.7 MITRE News — Tactic Browser</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4h">4.8 AI Brief — Executive Threat Briefings</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4i">4.9 Rule Library — Sigma &amp; YARA</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s4j">4.10 All Other Pages</a></div></div>
  <div class="ts"><a href="#s5"><span class="tn">5</span> Backend — Node.js Server</a></div>
  <div class="tsub"><div class="ts"><a href="#s5a">5.1 Server Entry Point &amp; Vercel Bridge</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s5b">5.2 Feed Collector Engine</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s5c">5.3 Severity Scoring Engine</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s5d">5.4 MITRE ATT&amp;CK Mapping Service</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s5e">5.5 Explore Route — Timezone-Aware Archive</a></div></div>
  <div class="ts"><a href="#s6"><span class="tn">6</span> Python AI Microservice (FastAPI)</a></div>
  <div class="tsub"><div class="ts"><a href="#s6a">6.1 Executive Briefing Generator</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s6b">6.2 Incident Deduplication — TF-IDF + Cosine Similarity</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s6c">6.3 SOC Remediation Playbook Generator</a></div></div>
  <div class="tsub"><div class="ts"><a href="#s6d">6.4 Sigma Detection Rule Generator</a></div></div>
  <div class="ts"><a href="#s7"><span class="tn">7</span> Database Schema</a></div>
  <div class="ts"><a href="#s8"><span class="tn">8</span> Ingestion Pipeline</a></div>
  <div class="ts"><a href="#s9"><span class="tn">9</span> Source Registry &amp; Legal Permissions</a></div>
  <div class="ts"><a href="#s10"><span class="tn">10</span> Deployment &amp; Configuration</a></div>
  <div class="ts"><a href="#s11"><span class="tn">11</span> Complete REST API Reference</a></div>
  <div class="ts"><a href="#s12"><span class="tn">12</span> Security &amp; Legal</a></div>
  <div class="ts"><a href="#s13"><span class="tn">13</span> Local Development Guide &amp; File Structure</a></div>
  <div class="ts"><a href="#s14"><span class="tn">14</span> Glossary</a></div>
</div>

<!-- SECTION 1: PROJECT OVERVIEW -->
<div class="page pb" id="s1">
  <div class="sh"><div class="sn">Section 01</div><h2 class="st">Project Overview &amp; Purpose</h2></div>

  <div id="s1a">
    <h3>1.1 What is NO ENTRY?</h3>
    <p><strong>NO ENTRY</strong> is a full-stack, AI-powered <strong>cybersecurity threat intelligence platform</strong> built for Security Operations Centers (SOCs). It automatically collects, scores, classifies, and displays threat intelligence from hundreds of trusted cybersecurity sources in a unified, analyst-friendly dashboard.</p>
    <p>The name reflects the mission: <em>give defenders the intelligence they need to block threats before they enter the network</em>.</p>
    <div class="hs"><h3>&#x1F3AF; Platform Mission</h3><p>Transform high-volume cyber threat intelligence into automated, prioritized, and enriched defense workflows — enabling analysts to focus on response, not manual data gathering.</p></div>
    <div class="mr">
      <div class="mb"><div class="mn">1,000+</div><div class="ml">Qualified Sources</div></div>
      <div class="mb"><div class="mn">14</div><div class="ml">MITRE Tactics</div></div>
      <div class="mb"><div class="mn">52</div><div class="ml">ATT&amp;CK Techniques</div></div>
      <div class="mb"><div class="mn">70%+</div><div class="ml">Deduplication Rate</div></div>
      <div class="mb"><div class="mn">15</div><div class="ml">UI Pages</div></div>
      <div class="mb"><div class="mn">25+</div><div class="ml">API Endpoints</div></div>
    </div>
  </div>

  <hr class="dv">

  <div id="s1b">
    <h3>1.2 Who Uses It?</h3>
    <div class="cards">
      <div class="card"><div class="ci">&#x1F535;</div><div class="ct2">SOC Analysts (Blue Team)</div><div class="cd">Monitor real-time threat feeds, triage incidents, and use pre-built playbooks to respond faster.</div></div>
      <div class="card"><div class="ci">&#x1F50D;</div><div class="ct2">Threat Intelligence Researchers</div><div class="cd">Browse historical archives, filter by MITRE tactic/technique, explore daily reports from 100+ sources.</div></div>
      <div class="card"><div class="ci">&#x1F454;</div><div class="ct2">CISOs &amp; Security Leaders</div><div class="cd">Receive AI-generated executive briefings summarizing the threat landscape in plain language.</div></div>
      <div class="card"><div class="ci">&#x1F6E0;&#xFE0F;</div><div class="ct2">Detection Engineers</div><div class="cd">Access Sigma YAML and YARA rules, generate 1-click hunting queries for Splunk, Sentinel, Elastic.</div></div>
    </div>
  </div>

  <hr class="dv">

  <div id="s1c">
    <h3>1.3 Key Capabilities Summary</h3>
    <table>
      <thead><tr><th>Capability</th><th>What It Does</th><th>How It Works</th></tr></thead>
      <tbody>
        <tr><td><strong>&#x1F50D; IOC Enrichment</strong></td><td>Check IPs, domains, CVEs, and hashes against threat intel databases</td><td>Queries VirusTotal, AbuseIPDB, CISA KEV in real-time</td></tr>
        <tr><td><strong>&#x1F5FA;&#xFE0F; MITRE ATT&amp;CK Mapping</strong></td><td>Classifies every article into MITRE tactics and techniques</td><td>Keyword-based heuristic engine covering 52 techniques</td></tr>
        <tr><td><strong>&#x1F916; AI Briefings</strong></td><td>Generates executive-level threat briefings from current intel</td><td>Python FastAPI with TF-IDF and rule-based summarization</td></tr>
        <tr><td><strong>&#x1F5C2;&#xFE0F; Incident Clustering</strong></td><td>Groups duplicate/similar threats to reduce alert fatigue</td><td>TF-IDF + Cosine Similarity (70%+ deduplication)</td></tr>
        <tr><td><strong>&#x1F4DC; Detection Rules</strong></td><td>Curated library of Sigma and YARA detection rules</td><td>Pre-built catalog served via REST API with copy/export</td></tr>
        <tr><td><strong>&#x1F4C5; Historical Explorer</strong></td><td>Search archived threat reports by date, source, severity, MITRE tactic</td><td>PostgreSQL archive with timezone-aware date boundaries</td></tr>
        <tr><td><strong>&#x1FA7A; Source Health Monitor</strong></td><td>Tracks health, latency, and approval status of all sources</td><td>Per-source telemetry with retry logic and failure tracking</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- SECTION 2: ARCHITECTURE -->
<div class="page pb" id="s2">
  <div class="sh"><div class="sn">Section 02</div><h2 class="st">System Architecture</h2></div>

  <div id="s2a">
    <h3>2.1 Three-Tier Architecture</h3>
    <p>NO ENTRY is structured as a classic <strong>three-tier system</strong> — presentation, business logic, and data — deployed as independent services communicating over HTTP.</p>
    <div class="arch">+-----------------------------------------------------------------------+
|              TIER 1: PRESENTATION  (Frontend)                         |
|                                                                       |
|  React 19 + TypeScript + Vite + Tailwind CSS                         |
|  Hosted on: Vercel CDN  (soc-ai-six.vercel.app)                      |
|  15 Pages: Dashboard, Explore, Sources, Enrichment, MITRE, AI...     |
+------------------------------+----------------------------------------+
                               | REST API (fetch / axios) over CORS
                               v
+-----------------------------------------------------------------------+
|              TIER 2: BUSINESS LOGIC  (Backend)                        |
|                                                                       |
|  Node.js + Express 5                                                  |
|  +-- collectorEngine.js  feeds every 30 min                          |
|  +-- severityEngine.js   Critical / High / Medium / Low scoring      |
|  +-- mitreService.js     14 tactics, 52 technique keyword mapping    |
|  +-- routes/explore.js   timezone-aware date-range archive search    |
|  +-- routes/enrich.js    VirusTotal, AbuseIPDB, CISA KEV proxy       |
|                                                                       |
|  Python FastAPI  (app.py)                                             |
|  +-- /api/v1/briefing   executive threat brief generator             |
|  +-- /api/v1/cluster    TF-IDF cosine-similarity deduplication       |
|  +-- /api/v1/remediate  4-phase incident response playbook           |
|  +-- /api/v1/sigma      Sigma YAML + Splunk / KQL / Elastic gen      |
+-------+---------------------------------------+------------------------+
        | pg.Pool (SSL)                         | HTTP fetch
        v                                       v
+-------------------+        +------------------------------------------+
|  TIER 3: DATA     |        |  EXTERNAL APIs                           |
|                   |        |  - VirusTotal                            |
|  PostgreSQL       |        |  - AbuseIPDB                             |
|  (Supabase/Neon)  |        |  - CISA KEV Catalog                     |
|  threats          |        |  - FIRST EPSS                            |
|  iocs             |        |  - RSS / Atom Feeds (1,000+ sources)    |
|  mitre_mapping    |        +------------------------------------------+
|  clusters         |
|  alert_logs       |
|                   |
|  JSON Archive     |
|  soc-intel-*.json |
+-------------------+</div>
  </div>

  <hr class="dv">

  <div id="s2b">
    <h3>2.2 End-to-End Data Flow (10 Steps)</h3>
    <p>Here is exactly how a threat article travels from a source website to your browser screen:</p>
    <div class="flow">
      <div class="fs">&#x1F4E1;<br>RSS Feed<br><small>Source Site</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x2699;&#xFE0F;<br>Collector<br><small>Node.js</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x1F3AF;<br>Severity<br><small>Scoring</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x1F5FA;&#xFE0F;<br>MITRE<br><small>Mapping</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x1F4BE;<br>PostgreSQL<br><small>UPSERT</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x1F310;<br>REST API<br><small>Express</small></div><div class="fa">&#x2192;</div>
      <div class="fs">&#x1F4F1;<br>React UI<br><small>Browser</small></div>
    </div>
    <table>
      <thead><tr><th>Step</th><th>What Happens</th><th>Code Location</th></tr></thead>
      <tbody>
        <tr><td><strong>1 Feed Discovery</strong></td><td>Collector selects approved, enabled sources due for collection</td><td>collectorEngine.js</td></tr>
        <tr><td><strong>2 HTTP Fetch</strong></td><td>Streaming GET with 30s timeout, SSL validation, 32MB size limit</td><td>withHostLock() function</td></tr>
        <tr><td><strong>3 RSS Parsing</strong></td><td>rss-parser converts XML to JS objects: title, link, pubDate, content</td><td>rss-parser library</td></tr>
        <tr><td><strong>4 Severity Scoring</strong></td><td>Multi-factor keyword scan assigns Critical / High / Medium / Low</td><td>severityEngine.js</td></tr>
        <tr><td><strong>5 MITRE Classification</strong></td><td>Keywords matched against 52 ATT&amp;CK techniques; tactic determined</td><td>mitreService.js</td></tr>
        <tr><td><strong>6 Database Write</strong></td><td>Article saved to threats table via UPSERT on source_url</td><td>pg.Pool INSERT</td></tr>
        <tr><td><strong>7 JSON Archive</strong></td><td>In-memory cache written atomically to soc-intel-*.json disk files</td><td>server.js</td></tr>
        <tr><td><strong>8 API Serving</strong></td><td>Express routes paginate and filter articles for the frontend</td><td>routes/*.js</td></tr>
        <tr><td><strong>9 AI Enrichment</strong></td><td>Python service clusters duplicates and generates executive briefs</td><td>app.py</td></tr>
        <tr><td><strong>10 UI Rendering</strong></td><td>React components fetch, filter, and render with MITRE tactic badges</td><td>src/pages/*.tsx</td></tr>
      </tbody>
    </table>
  </div>

  <hr class="dv">

  <div id="s2c">
    <h3>2.3 Deployment Topology</h3>
    <table>
      <thead><tr><th>Service</th><th>Platform</th><th>Address</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><strong>Frontend (React)</strong></td><td>Vercel CDN</td><td>soc-ai-six.vercel.app</td><td>Global CDN delivery of the React SPA</td></tr>
        <tr><td><strong>Backend (Node.js)</strong></td><td>Vercel Serverless</td><td>/api/* routes</td><td>Feed ingestion + REST API</td></tr>
        <tr><td><strong>AI Service (Python)</strong></td><td>Render / Railway</td><td>Port 8000</td><td>Threat briefing &amp; clustering</td></tr>
        <tr><td><strong>Database</strong></td><td>Supabase / Neon</td><td>SSL connection pool</td><td>Persistent threat data storage</td></tr>
        <tr><td><strong>Secrets</strong></td><td>Vercel Env Vars</td><td>N/A</td><td>API keys, DB connection strings</td></tr>
      </tbody>
    </table>
    <div class="callout info"><div class="ct">&#x2139;&#xFE0F; Vercel Routing</div>vercel.json configures two key rules: <code>/api/*</code> rewrites to the serverless function at <code>api/index.js</code>, and all other non-asset routes fall back to <code>/index.html</code> so React Router handles client-side navigation.</div>
  </div>
</div>

<!-- SECTION 3: TECH STACK -->
<div class="page pb" id="s3">
  <div class="sh"><div class="sn">Section 03</div><h2 class="st">Technology Stack</h2></div>
  <table>
    <thead><tr><th>Layer</th><th>Technology</th><th>Version</th><th>Why This Choice</th></tr></thead>
    <tbody>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>React</strong></td><td>19.2.0</td><td>Latest React with concurrent features. All 15 pages are lazy-loaded for fast initial bundle.</td></tr>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>TypeScript</strong></td><td>5.9</td><td>Strict type-checking prevents runtime bugs. All API responses typed with interfaces.</td></tr>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>Vite</strong></td><td>6.x</td><td>Ultra-fast build tool with HMR. Builds production bundle in under 10 seconds.</td></tr>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>Tailwind CSS</strong></td><td>3.x</td><td>Utility-first CSS. Custom blue/slate design tokens throughout all pages.</td></tr>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>React Router</strong></td><td>6.x</td><td>Declarative routing with URL search params for shareable filter state (Explore page).</td></tr>
      <tr><td><span class="badge bb">Frontend</span></td><td><strong>Lucide React</strong></td><td>latest</td><td>Pixel-perfect SVG icon library used in all pages and components.</td></tr>
      <tr><td><span class="badge bg">Backend</span></td><td><strong>Node.js</strong></td><td>v18+</td><td>Non-blocking I/O ideal for high-concurrency feed fetching. Native fetch API.</td></tr>
      <tr><td><span class="badge bg">Backend</span></td><td><strong>Express 5</strong></td><td>5.x</td><td>Minimal HTTP framework. Express 5 natively handles async/await errors.</td></tr>
      <tr><td><span class="badge bg">Backend</span></td><td><strong>rss-parser</strong></td><td>3.x</td><td>Robust RSS/Atom feed parser with large content support.</td></tr>
      <tr><td><span class="badge bg">Backend</span></td><td><strong>node-postgres (pg)</strong></td><td>8.x</td><td>PostgreSQL connection pool with SSL. Used for all DB reads and writes.</td></tr>
      <tr><td><span class="badge bg">Backend</span></td><td><strong>Axios</strong></td><td>1.x</td><td>HTTP client for external API calls (VirusTotal, AbuseIPDB) with timeout support.</td></tr>
      <tr><td><span class="badge bo">AI Engine</span></td><td><strong>Python</strong></td><td>3.11</td><td>Ideal for ML workloads. FastAPI provides async request handling.</td></tr>
      <tr><td><span class="badge bo">AI Engine</span></td><td><strong>FastAPI</strong></td><td>0.100+</td><td>High-performance ASGI framework with auto OpenAPI docs at /docs.</td></tr>
      <tr><td><span class="badge bo">AI Engine</span></td><td><strong>Pydantic</strong></td><td>v2</td><td>Data validation and serialization for all AI service request/response models.</td></tr>
      <tr><td><span class="badge bp">Database</span></td><td><strong>PostgreSQL</strong></td><td>15</td><td>ACID database with trigram search, UUID generation, JSONB storage, RLS.</td></tr>
      <tr><td><span class="badge bp">Database</span></td><td><strong>Supabase / Neon</strong></td><td>latest</td><td>Managed PostgreSQL with Row-Level Security, connection pooling, Realtime.</td></tr>
      <tr><td><span class="badge br">Security</span></td><td><strong>MITRE ATT&amp;CK v14</strong></td><td>v14</td><td>Industry standard adversary behavior framework: 14 tactics, 200+ techniques.</td></tr>
      <tr><td><span class="badge br">Security</span></td><td><strong>Sigma Rules</strong></td><td>—</td><td>Platform-agnostic detection format, converted to Splunk SPL, KQL, Elastic DSL.</td></tr>
      <tr><td><span class="badge br">Security</span></td><td><strong>YARA Rules</strong></td><td>—</td><td>Binary pattern-matching for malware detection by file signature.</td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 4: FRONTEND -->
<div class="page pb" id="s4">
  <div class="sh"><div class="sn">Section 04</div><h2 class="st">Frontend — React Application (15 Pages)</h2></div>
  <p>The frontend is a <strong>Single Page Application (SPA)</strong> built with React 19 + TypeScript, bundled by Vite, deployed on Vercel CDN. All 15 page components are <strong>lazy-loaded</strong> — only downloaded when the user first navigates to them.</p>

  <div id="s4a">
    <h3>4.1 Routing &amp; App Shell</h3>
    <span class="fp">soc-platform-ui-main/src/App.tsx</span>
    <p>App.tsx is the root. It wraps everything in three providers: <strong>AccessibilityProvider</strong> (screen reader announcements), <strong>BrowserRouter</strong> (React Router), and <strong>Suspense</strong> (lazy load spinner).</p>
    <pre><code><span class="cm">// All pages are lazy-loaded — only downloaded when first navigated to</span>
<span class="kw">const</span> <span class="cls">IntelligenceWorkspace</span> = <span class="fn">lazy</span>(() =&gt; <span class="kw">import</span>(<span class="str">'./pages/IntelligenceWorkspace'</span>));
<span class="kw">const</span> <span class="cls">Dashboard</span>      = <span class="fn">lazy</span>(() =&gt; <span class="kw">import</span>(<span class="str">'./pages/Dashboard'</span>));
<span class="kw">const</span> <span class="cls">Explore</span>        = <span class="fn">lazy</span>(() =&gt; <span class="kw">import</span>(<span class="str">'./pages/Explore'</span>));
<span class="kw">const</span> <span class="cls">Sources</span>        = <span class="fn">lazy</span>(() =&gt; <span class="kw">import</span>(<span class="str">'./pages/Sources'</span>));
<span class="cm">// ... 11 more pages</span></code></pre>
    <p><strong>API Base URL Config</strong> — <span class="fp">src/config/api.ts</span></p>
    <pre><code><span class="kw">const</span> isDev = window.location.hostname === <span class="str">'localhost'</span>;
<span class="kw">export const</span> API_BASE = isDev ? <span class="str">'http://localhost:3000'</span> : <span class="str">''</span>;
<span class="cm">// Production: '' = same-origin (Vercel proxies /api/* to serverless function)</span>
<span class="cm">// Development: points to local Node.js server on port 3000</span></code></pre>
  </div>

  <hr class="dv">

  <div id="s4b">
    <h3>4.2 Dashboard — SOC Mission Control</h3>
    <span class="fp">soc-platform-ui-main/src/pages/Dashboard.tsx</span>
    <p>The Dashboard has <strong>four tab-based views</strong> with a shared telemetry strip at the top:</p>
    <table>
      <thead><tr><th>Tab ID</th><th>Tab Name</th><th>Contents</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><code>overview</code></td><td>Mission Control</td><td>AI Executive Widget + CVE Tracker + MITRE Mini Matrix + Live Feed</td><td>Full situational awareness in one view</td></tr>
        <tr><td><code>news</code></td><td>Global Stream</td><td>Chronological threat news feed — all sources</td><td>Unfiltered real-time intelligence stream</td></tr>
        <tr><td><code>critical</code></td><td>Critical Radar</td><td>High &amp; Critical severity articles only</td><td>Urgent response queue for SOC triage</td></tr>
        <tr><td><code>metrics</code></td><td>Analytics</td><td>Severity distribution chart (pie / bar)</td><td>Quantitative threat landscape at a glance</td></tr>
      </tbody>
    </table>
    <h4>Key Functions</h4>
    <ul>
      <li><code>handleTabChange(tab, label)</code> — switches active tab; announces change to screen readers via AccessibilityContext</li>
      <li><code>handleSeverityChange(sev)</code> — filters the live news feed to one severity level (Critical/High/Medium/Low)</li>
      <li><code>handleRefreshAll()</code> — increments a refresh counter; all child widgets re-fetch data in response</li>
    </ul>
    <div class="callout info"><div class="ct">&#x2139;&#xFE0F; Demo Mode Detection</div>On startup, Dashboard fetches <code>/api/dashboard/snapshot</code>. If <code>isDemoEnabled: true</code>, a yellow banner warns: "DEMO ENVIRONMENT — Contains simulated threat intelligence."</div>
  </div>

  <hr class="dv">

  <div id="s4c">
    <h3>4.3 Explore — Date-Based Intelligence Archive</h3>
    <span class="fp">soc-platform-ui-main/src/pages/Explore.tsx (1,085 lines)</span>
    <p>The Explore page is the <strong>most feature-rich page</strong> in the application. It provides a complete date-range search interface over the full historical archive of collected threat reports.</p>
    <h4>Features</h4>
    <ul>
      <li><strong>Default view:</strong> Automatically loads <em>today's</em> reports on first navigation</li>
      <li><strong>Date presets:</strong> Today / Yesterday / Last 7 Days / Last 30 Days — single click</li>
      <li><strong>Custom range:</strong> Calendar date-picker for precise start + end date</li>
      <li><strong>Multi-filter:</strong> Keyword search, source, category, severity, MITRE tactic, MITRE technique, mapped-only toggle</li>
      <li><strong>Server-side pagination:</strong> Page/pageSize params — not in-browser slicing</li>
      <li><strong>URL state:</strong> Every filter encoded in URL query params — fully shareable links, back/forward safe</li>
      <li><strong>Slide-in detail panel:</strong> Click any article for full metadata, MITRE mappings, IOC details, related articles</li>
      <li><strong>Archive coverage banner:</strong> Shows the oldest and newest available report dates from the database</li>
    </ul>
    <h4>Key TypeScript Interfaces</h4>
    <pre><code><span class="kw">interface</span> <span class="cls">Article</span> {
  id: <span class="dc">string</span>;
  title: <span class="dc">string</span>;
  link: <span class="dc">string</span>;
  pubDate: <span class="dc">string</span> | <span class="dc">null</span>;
  pubDateMissing?: <span class="dc">boolean</span>;      <span class="cm">// true if RSS feed didn't provide a date</span>
  ingestedAt: <span class="dc">string</span> | <span class="dc">null</span>;   <span class="cm">// when NO ENTRY first saw this article</span>
  contentSnippet: <span class="dc">string</span>;
  source: <span class="dc">string</span>;
  severity: <span class="dc">string</span>;            <span class="cm">// 'Critical' | 'High' | 'Medium' | 'Low'</span>
  category: <span class="dc">string</span>;
  mitreTechniques: <span class="cls">MitreTechnique</span>[];
  mitreTactics: <span class="cls">MitreTactic</span>[];
  isMitreCategorized: <span class="dc">boolean</span>;
  mappingMethod: <span class="dc">string</span> | <span class="dc">null</span>; <span class="cm">// 'keyword' | 'pattern' | 'manual'</span>
}

<span class="kw">interface</span> <span class="cls">ExploreResponse</span> {
  records: <span class="cls">Article</span>[];
  total: <span class="dc">number</span>;
  page: <span class="dc">number</span>;
  totalPages: <span class="dc">number</span>;
  resolvedWindow: {
    preset: <span class="dc">string</span> | <span class="dc">null</span>;    <span class="cm">// 'today' | 'yesterday' | 'last7d' | null</span>
    dateFrom: <span class="dc">string</span> | <span class="dc">null</span>;
    dateTo: <span class="dc">string</span> | <span class="dc">null</span>;
    tz: <span class="dc">string</span>;               <span class="cm">// user's IANA timezone (e.g. 'Europe/London')</span>
  };
  archiveCoverage: { oldest: <span class="dc">string</span>; newest: <span class="dc">string</span>; total: <span class="dc">number</span>; };
}</code></pre>
  </div>

  <hr class="dv">

  <div id="s4d">
    <h3>4.4 Sources — Feed Health &amp; Approval Console</h3>
    <span class="fp">soc-platform-ui-main/src/pages/Sources.tsx (964 lines)</span>
    <p>The Sources page is the <strong>source management console</strong>. It displays every registered intelligence feed with health metrics, approval lifecycle status, and legal permission data.</p>
    <h4>Source State Fields</h4>
    <table>
      <thead><tr><th>Field</th><th>Values</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><code>reviewState</code></td><td>candidate, approved, quarantined, retired, rejected</td><td>Editorial approval lifecycle stage</td></tr>
        <tr><td><code>status</code></td><td>healthy, delayed, degraded, failed, unknown, disabled</td><td>Current feed collection health</td></tr>
        <tr><td><code>publicationFreshness</code></td><td>fresh, active, inactive, dormant, unknown</td><td>How recently the source published content</td></tr>
        <tr><td><code>permissionStatus</code></td><td>permitted_intended_use, restricted, denied, pending</td><td>Legal right to aggregate content</td></tr>
      </tbody>
    </table>
    <h4>Health Metrics Tracked Per Source</h4>
    <ul>
      <li><code>lastAttemptAt</code> / <code>lastSuccessAt</code> — timestamps of last fetch attempt and last success</li>
      <li><code>lastHttpStatus</code> — HTTP response code returned (200, 404, 503, etc.)</li>
      <li><code>consecutiveFailures</code> — number of consecutive failed fetches</li>
      <li><code>averageLatencyMs</code> — rolling average response time in milliseconds</li>
      <li><code>itemsLast24Hours</code> / <code>itemsTotal</code> — article count metrics</li>
      <li><code>nextRetryAt</code> — when the system will retry (exponential backoff)</li>
    </ul>
  </div>

  <hr class="dv">

  <div id="s4e">
    <h3>4.5 Enrichment — IOC Triage Console</h3>
    <span class="fp">soc-platform-ui-main/src/pages/Enrichment.tsx</span>
    <p>Analysts paste any <strong>Indicator of Compromise (IOC)</strong> and instantly receive threat intelligence from multiple external sources.</p>
    <table>
      <thead><tr><th>IOC Type</th><th>Sources Queried</th><th>Data Returned</th></tr></thead>
      <tbody>
        <tr><td>IP Address</td><td>VirusTotal + AbuseIPDB</td><td>Maliciousness score %, abuse confidence %, country, ISP, ASN</td></tr>
        <tr><td>File Hash (SHA256/MD5)</td><td>VirusTotal</td><td>Detection count out of total AV engines scanned</td></tr>
        <tr><td>CVE ID (e.g. CVE-2024-1234)</td><td>CISA KEV + FIRST EPSS</td><td>Exploit probability score, KEV listing status, NVD link</td></tr>
        <tr><td>Domain</td><td>VirusTotal passive DNS</td><td>Domain reputation and category classification</td></tr>
      </tbody>
    </table>
    <p>The page also auto-generates ready-to-paste threat hunting queries in <strong>Splunk SPL</strong>, <strong>Microsoft Sentinel KQL</strong>, and <strong>Sigma YAML</strong> for any submitted IOC.</p>
  </div>

  <hr class="dv">

  <div id="s4f">
    <h3>4.6 MITRE ATT&amp;CK Heatmap</h3>
    <span class="fp">soc-platform-ui-main/src/pages/MitreHeatmap.tsx</span>
    <p>A visual frequency matrix showing how often each ATT&amp;CK technique appears in collected threat intelligence. Higher frequency = warmer color.</p>
    <pre><code><span class="kw">const</span> <span class="fn">getHeatColor</span> = (hitCount: <span class="dc">number</span>, maxHits: <span class="dc">number</span>): <span class="dc">string</span> =&gt; {
  <span class="kw">if</span> (hitCount === <span class="num">0</span>) <span class="kw">return</span> <span class="str">'bg-slate-50'</span>;          <span class="cm">// grey = no activity</span>
  <span class="kw">const</span> ratio = hitCount / maxHits;
  <span class="kw">if</span> (ratio &gt;= <span class="num">0.75</span>) <span class="kw">return</span> <span class="str">'bg-red-50 border-red-300'</span>;   <span class="cm">// RED = top 75%</span>
  <span class="kw">if</span> (ratio &gt;= <span class="num">0.50</span>) <span class="kw">return</span> <span class="str">'bg-orange-50'</span>;             <span class="cm">// ORANGE = 50-74%</span>
  <span class="kw">if</span> (ratio &gt;= <span class="num">0.25</span>) <span class="kw">return</span> <span class="str">'bg-amber-50'</span>;              <span class="cm">// AMBER = 25-49%</span>
  <span class="kw">return</span> <span class="str">'bg-blue-50'</span>;                                   <span class="cm">// BLUE = low activity</span>
};</code></pre>
    <p>Clicking a technique cell opens an inspector drawer showing all articles mapped to it, with a link to the full MITRE News view for that technique.</p>
  </div>

  <hr class="dv">

  <div id="s4g">
    <h3>4.7 MITRE News — Tactic Browser</h3>
    <span class="fp">soc-platform-ui-main/src/pages/MitreNews.tsx</span>
    <p>Full tactic/technique browser. All 14 ATT&amp;CK tactics appear as navigation tabs. Articles are filtered by the selected tactic and technique. Users can also apply keyword search and severity filters within any tactic context.</p>
  </div>

  <hr class="dv">

  <div id="s4h">
    <h3>4.8 AI Brief — Executive Threat Briefings</h3>
    <span class="fp">soc-platform-ui-main/src/pages/AIBrief.tsx</span>
    <p>Calls the Python FastAPI microservice to generate two outputs from today's collected articles:</p>
    <ol>
      <li><strong>Executive Threat Briefing</strong> — structured summary of top threats, CVEs, and tactical recommendations for a CISO audience</li>
      <li><strong>Incident Clusters</strong> — deduplicated view of similar threats grouped together, with deduplication rate percentage</li>
    </ol>
    <p>A lightweight <code>MarkdownText</code> component renders the AI output (<code>**bold**</code>, <code>## headings</code>, bullet lists) into proper HTML without any external markdown library.</p>
  </div>

  <hr class="dv">

  <div id="s4i">
    <h3>4.9 Rule Library — Sigma &amp; YARA</h3>
    <span class="fp">soc-platform-ui-main/src/pages/RuleLibrary.tsx</span>
    <p>A searchable, filterable detection engineering console with two tabs:</p>
    <ul>
      <li><strong>Sigma Rules:</strong> YAML-format detection rules for Splunk, Sentinel, Elastic (searchable by title/level)</li>
      <li><strong>YARA Rules:</strong> Binary pattern-matching rules for malware analysis tools</li>
    </ul>
    <p>Each rule displays metadata (title, severity level, status, MITRE technique, author) and a code viewer with a one-click copy-to-clipboard button.</p>
  </div>

  <hr class="dv">

  <div id="s4j">
    <h3>4.10 All Other Pages</h3>
    <table>
      <thead><tr><th>Page</th><th>Route</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><strong>Intelligence Workspace</strong></td><td><code>/</code> (default)</td><td>Landing page combining live news feed with search, filter, and MITRE tagging</td></tr>
        <tr><td><strong>Vulnerabilities View</strong></td><td><code>/vulnerabilities</code></td><td>CVE-focused view with EPSS exploit probability scores and CISA KEV cross-reference</td></tr>
        <tr><td><strong>Threats</strong></td><td><code>/threats</code></td><td>Critical threat radar and active threat campaign tracker</td></tr>
        <tr><td><strong>Reports Hub</strong></td><td><code>/reports</code></td><td>Intelligence report management and export center</td></tr>
        <tr><td><strong>Detections Hub</strong></td><td><code>/detections</code></td><td>Unified detection management dashboard</td></tr>
        <tr><td><strong>Settings</strong></td><td><code>/settings</code></td><td>Platform configuration, theme preferences, notification settings</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- SECTION 5: BACKEND -->
<div class="page pb" id="s5">
  <div class="sh"><div class="sn">Section 05</div><h2 class="st">Backend — Node.js Server</h2></div>
  <p>The Node.js + Express 5 backend handles feed ingestion, REST API serving, and external API proxying. In production it runs as a Vercel serverless function. In development it runs on port 3000.</p>

  <div id="s5a">
    <h3>5.1 Server Entry Point &amp; Vercel Bridge</h3>
    <span class="fp">server/server.js</span>
    <pre><code><span class="kw">const</span> app = <span class="fn">express</span>();

<span class="cm">// 1. Body parsing — 32MB limit for large security advisories</span>
app.<span class="fn">use</span>(<span class="fn">express.json</span>({ limit: <span class="str">'32mb'</span> }));

<span class="cm">// 2. CORS — allow requests from Vercel frontend</span>
app.<span class="fn">use</span>(<span class="fn">cors</span>({ origin: <span class="str">'*'</span> }));

<span class="cm">// 3. Mount API routes</span>
app.<span class="fn">use</span>(<span class="str">'/api'</span>, newsRouter);
app.<span class="fn">use</span>(<span class="str">'/api'</span>, exploreRouter);
app.<span class="fn">use</span>(<span class="str">'/api'</span>, mitreRouter);
app.<span class="fn">use</span>(<span class="str">'/api'</span>, enrichRouter);

<span class="cm">// 4. Start feed collection scheduler (every 30 minutes)</span>
<span class="fn">startCollector</span>();

<span class="cm">// 5. Export app for Vercel serverless bridge</span>
module.exports = app;</code></pre>
    <p><strong>api/index.js</strong> (Vercel bridge — the Vercel entrypoint):</p>
    <pre><code><span class="kw">const</span> app = <span class="fn">require</span>(<span class="str">'../server/server'</span>);
module.exports = app; <span class="cm">// Vercel treats this function as the serverless handler</span></code></pre>
  </div>

  <hr class="dv">

  <div id="s5b">
    <h3>5.2 Feed Collector Engine</h3>
    <span class="fp">server/services/collectorEngine.js</span>
    <p>The collector is the core of the data pipeline. It runs on a 30-minute schedule and processes all approved, enabled sources.</p>
    <h4>withHostLock — Preventing Duplicate Parallel Fetches</h4>
    <p>To avoid hammering the same server with parallel requests, only <strong>one fetch per domain</strong> runs at a time. Other requests for that domain queue and wait:</p>
    <pre><code><span class="kw">const</span> hostLocks = <span class="kw">new</span> <span class="cls">Map</span>();

<span class="kw">async function</span> <span class="fn">withHostLock</span>(host, fn) {
  <span class="cm">// Wait if this host is already being fetched</span>
  <span class="kw">while</span> (hostLocks.<span class="fn">has</span>(host)) <span class="kw">await</span> hostLocks.<span class="fn">get</span>(host);
  <span class="kw">let</span> resolve;
  <span class="kw">const</span> lock = <span class="kw">new</span> <span class="cls">Promise</span>(r =&gt; { resolve = r; });
  hostLocks.<span class="fn">set</span>(host, lock);
  <span class="kw">try</span> {
    <span class="kw">return await</span> <span class="fn">fn</span>();    <span class="cm">// execute the actual fetch</span>
  } <span class="kw">finally</span> {
    hostLocks.<span class="fn">delete</span>(host);
    <span class="fn">resolve</span>();             <span class="cm">// release lock, next queued fetch can proceed</span>
  }
}</code></pre>
    <h4>SSL / SSRF Protection</h4>
    <p>Before any HTTP fetch, the collector validates the URL to prevent Server-Side Request Forgery (SSRF):</p>
    <ul>
      <li>Blocks requests to private IP ranges: 10.x.x.x, 192.168.x.x, 172.16-31.x.x, 127.x.x.x</li>
      <li>Blocks non-HTTP/HTTPS schemes (file://, ftp://, data://, etc.)</li>
      <li>Enforces SSL certificate validation on all outbound connections</li>
    </ul>
    <h4>Collection Error Handling</h4>
    <table>
      <thead><tr><th>Error</th><th>Action</th><th>Auto-Retry?</th></tr></thead>
      <tbody>
        <tr><td>HTTP timeout (30s exceeded)</td><td>Mark source as delayed</td><td>Yes, next 30-min run</td></tr>
        <tr><td>HTTP 404 Not Found</td><td>Increment consecutiveFailures</td><td>Yes, with backoff</td></tr>
        <tr><td>HTTP 429 / 503</td><td>Respect rate limits, delay retry</td><td>Yes, exponential backoff</td></tr>
        <tr><td>RSS parse error</td><td>Log malformed feed, mark degraded</td><td>Yes, next run</td></tr>
        <tr><td>SSL certificate error</td><td>Log security error, mark failed</td><td>Manual review required</td></tr>
        <tr><td>3+ consecutive failures</td><td>Auto-disable source</td><td>No — requires manual re-enable</td></tr>
      </tbody>
    </table>
  </div>

  <hr class="dv">

  <div id="s5c">
    <h3>5.3 Severity Scoring Engine</h3>
    <span class="fp">server/services/severityEngine.js</span>
    <p>Every article receives a severity level (<strong>Critical / High / Medium / Low</strong>) via a multi-factor keyword scoring system:</p>
    <table>
      <thead><tr><th>Category</th><th>Example Keywords</th><th>Points</th></tr></thead>
      <tbody>
        <tr><td>Active Exploitation</td><td>"actively exploited", "zero-day", "in the wild"</td><td>+15</td></tr>
        <tr><td>Critical CVE</td><td>CVE-YYYY-NNNNNN (any CVE ID detected by regex)</td><td>+12</td></tr>
        <tr><td>CISA / KEV</td><td>"CISA", "known exploited"</td><td>+10</td></tr>
        <tr><td>Ransomware</td><td>"ransomware", "encryption", "ransom demand"</td><td>+8</td></tr>
        <tr><td>APT / Nation-State</td><td>"APT", "nation-state", "state-sponsored"</td><td>+7</td></tr>
        <tr><td>Data Breach</td><td>"data breach", "leaked", "credential dump"</td><td>+6</td></tr>
        <tr><td>General Threat</td><td>"malware", "phishing", "vulnerability"</td><td>+3</td></tr>
        <tr><td>Marketing Noise</td><td>"webinar", "free trial", "award", "download now"</td><td>−5</td></tr>
      </tbody>
    </table>
    <pre><code><span class="cm">// Severity threshold logic:</span>
<span class="kw">if</span> (score &gt;= <span class="num">20</span>) <span class="kw">return</span> <span class="str">'Critical'</span>;
<span class="kw">if</span> (score &gt;= <span class="num">10</span>) <span class="kw">return</span> <span class="str">'High'</span>;
<span class="kw">if</span> (score &gt;= <span class="num">4</span>)  <span class="kw">return</span> <span class="str">'Medium'</span>;
<span class="kw">return</span> <span class="str">'Low'</span>; <span class="cm">// score below 4 or net negative (marketing noise)</span></code></pre>
  </div>

  <hr class="dv">

  <div id="s5d">
    <h3>5.4 MITRE ATT&amp;CK Mapping Service</h3>
    <span class="fp">server/services/mitreService.js</span>
    <p>Maps every article to MITRE ATT&amp;CK tactics and techniques using a <strong>keyword lookup table</strong>:</p>
    <pre><code><span class="kw">function</span> <span class="fn">mapToMitre</span>(title, content) {
  <span class="kw">const</span> text = (title + <span class="str">' '</span> + content).<span class="fn">toLowerCase</span>();
  <span class="kw">const</span> matched = [];
  <span class="kw">for</span> (<span class="kw">const</span> [techniqueId, config] <span class="kw">of</span> TECHNIQUE_MAP) {
    <span class="kw">if</span> (config.keywords.<span class="fn">some</span>(kw =&gt; text.<span class="fn">includes</span>(kw))) {
      matched.<span class="fn">push</span>({ techniqueId, techniqueName: config.name,
        tacticId: config.tacticId, tacticName: config.tacticName });
    }
  }
  <span class="kw">return</span> <span class="fn">deduplicateAndSort</span>(matched);
}</code></pre>
    <h4>Example Technique Mappings</h4>
    <table>
      <thead><tr><th>ID</th><th>Technique</th><th>Tactic</th><th>Trigger Keywords</th></tr></thead>
      <tbody>
        <tr><td>T1486</td><td>Data Encrypted for Impact</td><td>Impact (TA0040)</td><td>ransomware, encrypt files, file encryption</td></tr>
        <tr><td>T1059</td><td>Command &amp; Scripting Interpreter</td><td>Execution (TA0002)</td><td>powershell, command line, bash, script execution</td></tr>
        <tr><td>T1190</td><td>Exploit Public-Facing Application</td><td>Initial Access (TA0001)</td><td>remote code execution, RCE, exploit, CVE</td></tr>
        <tr><td>T1078</td><td>Valid Accounts</td><td>Defense Evasion (TA0005)</td><td>credential stuffing, password spray, stolen credentials</td></tr>
        <tr><td>T1566</td><td>Phishing</td><td>Initial Access (TA0001)</td><td>phishing, spearphishing, malicious email</td></tr>
        <tr><td>T1071</td><td>Application Layer Protocol (C2)</td><td>Command &amp; Control (TA0011)</td><td>C2, command and control, cobalt strike, beacon</td></tr>
      </tbody>
    </table>
  </div>

  <hr class="dv">

  <div id="s5e">
    <h3>5.5 Explore Route — Timezone-Aware Archive</h3>
    <span class="fp">server/routes/explore.js</span>
    <p>The most complex route. It resolves "today" and "yesterday" correctly for users in different timezones:</p>
    <pre><code><span class="kw">function</span> <span class="fn">localMidnightToUTC</span>(dateStr, tz) {
  <span class="cm">// dateStr = '2026-09-27', tz = 'Europe/London'</span>
  <span class="cm">// Returns the UTC Date that corresponds to midnight local time</span>
  <span class="kw">const</span> [y, m, d] = dateStr.<span class="fn">split</span>(<span class="str">'-'</span>).<span class="fn">map</span>(Number);
  <span class="kw">return new</span> <span class="cls">Date</span>(<span class="cls">Date</span>.<span class="fn">UTC</span>(y, m - <span class="num">1</span>, d)); <span class="cm">// UTC midnight of that local date</span>
}
<span class="cm">// Preset 'today' → dateFrom = today 00:00 local → dateTo = today 23:59:59 local</span>
<span class="cm">// Preset 'last7d' → dateFrom = 7 days ago 00:00 → dateTo = today 23:59:59 local</span></code></pre>
</div>
</div>

<!-- SECTION 6: PYTHON AI -->
<div class="page pb" id="s6">
  <div class="sh"><div class="sn">Section 06</div><h2 class="st">Python AI Microservice (FastAPI)</h2></div>
  <p>A <strong>separate, independently deployable service</strong> providing ML capabilities. Runs on port 8000. Interactive Swagger UI at <code>/docs</code>. Uses <strong>zero external ML libraries</strong> — TF-IDF is implemented from scratch using Python's built-in <code>math.log</code>.</p>

  <div id="s6a">
    <h3>6.1 Executive Briefing Generator</h3>
    <span class="fp">app.py — POST /api/v1/briefing</span>
    <p>Accepts a list of threat articles and generates a structured CISO-level executive briefing:</p>
    <pre><code><span class="kw">class</span> <span class="cls">BriefingResponse</span>(<span class="cls">BaseModel</span>):
    headline: <span class="dc">str</span>                      <span class="cm"># "Executive Threat Briefing — Sep 27, 2026"</span>
    key_threats: <span class="cls">List</span>[<span class="dc">str</span>]             <span class="cm"># top threat titles (ransomware first)</span>
    critical_vulnerabilities: <span class="cls">List</span>[<span class="dc">str</span>] <span class="cm"># CVE-YYYY-NNNNN references extracted</span>
    recommended_actions: <span class="cls">List</span>[<span class="dc">str</span>]     <span class="cm"># 4 tactical SOC actions</span>
    executive_summary: <span class="dc">str</span>             <span class="cm"># plain-language paragraph for CISO</span>
    generated_at: <span class="dc">str</span>                  <span class="cm"># ISO 8601 timestamp</span></code></pre>
    <p><strong>Logic:</strong> (1) Count Critical/High articles, (2) Extract ransomware titles, (3) Extract CVE IDs via regex <code>CVE-\d{4}-\d+</code>, (4) Build recommended actions list, (5) Write plain-language executive summary paragraph.</p>
  </div>

  <hr class="dv">

  <div id="s6b">
    <h3>6.2 Incident Deduplication — TF-IDF + Cosine Similarity</h3>
    <span class="fp">app.py — POST /api/v1/cluster</span>
    <p>Groups similar/duplicate articles into clusters to reduce alert fatigue. Default similarity threshold: <strong>0.30</strong>.</p>
    <h4>Step 1: Tokenization (remove stopwords)</h4>
    <pre><code>STOPWORDS = {<span class="str">'the'</span>, <span class="str">'a'</span>, <span class="str">'an'</span>, <span class="str">'and'</span>, <span class="str">'or'</span>, <span class="str">'in'</span>, <span class="str">'is'</span>, <span class="str">'was'</span>, ...}

<span class="kw">def</span> <span class="fn">tokenize</span>(text: str) -&gt; List[str]:
    words = re.<span class="fn">findall</span>(r<span class="str">'[a-z0-9]{3,}'</span>, text.<span class="fn">lower</span>()) <span class="cm"># 3+ char words only</span>
    <span class="kw">return</span> [w <span class="kw">for</span> w <span class="kw">in</span> words <span class="kw">if</span> w <span class="kw">not in</span> STOPWORDS]</code></pre>
    <h4>Step 2: TF-IDF Vectorization</h4>
    <p><strong>TF</strong> = word count in article / total words. <strong>IDF</strong> = log((1 + N) / (1 + df)) + 1. <strong>TF-IDF</strong> = TF × IDF. Rare but relevant words score high; common words score low.</p>
    <pre><code><span class="kw">for</span> t, count <span class="kw">in</span> tf.items():
    idf = math.<span class="fn">log</span>((<span class="num">1</span> + num_docs) / (<span class="num">1</span> + doc_freq.<span class="fn">get</span>(t, <span class="num">1</span>))) + <span class="num">1.0</span>
    vec[t] = (count / <span class="fn">len</span>(tokens)) * idf</code></pre>
    <h4>Step 3: Cosine Similarity (angle between vectors)</h4>
    <pre><code><span class="kw">def</span> <span class="fn">cosine_similarity</span>(v1, v2):
    dot = <span class="fn">sum</span>(v1.<span class="fn">get</span>(k, <span class="num">0</span>) * v2.<span class="fn">get</span>(k, <span class="num">0</span>) <span class="kw">for</span> k <span class="kw">in</span> v1)
    mag1 = math.<span class="fn">sqrt</span>(<span class="fn">sum</span>(v**<span class="num">2</span> <span class="kw">for</span> v <span class="kw">in</span> v1.values()))
    mag2 = math.<span class="fn">sqrt</span>(<span class="fn">sum</span>(v**<span class="num">2</span> <span class="kw">for</span> v <span class="kw">in</span> v2.values()))
    <span class="kw">return</span> dot / (mag1 * mag2)   <span class="cm"># 0.0 = completely different, 1.0 = identical</span></code></pre>
    <h4>Step 4: Greedy Clustering</h4>
    <p>Each article is compared to existing cluster centroids. If similarity ≥ threshold, the article joins that cluster. Otherwise it starts a new cluster. Result: <strong>70%+ deduplication</strong> of repeated news coverage.</p>
  </div>

  <hr class="dv">

  <div id="s6c">
    <h3>6.3 SOC Remediation Playbook Generator</h3>
    <span class="fp">app.py — POST /api/v1/remediate</span>
    <table>
      <thead><tr><th>Phase</th><th>Purpose</th><th>Sample Actions</th></tr></thead>
      <tbody>
        <tr><td><strong>1: Identification</strong></td><td>Validate the alert is real</td><td>Correlate EDR process tree, verify network connections, extract memory dump</td></tr>
        <tr><td><strong>2: Containment</strong></td><td>Stop the threat spreading</td><td>EDR isolation, revoke Kerberos sessions, null-route malicious IPs</td></tr>
        <tr><td><strong>3: Eradication</strong></td><td>Remove all traces</td><td>Kill unauthorized processes, delete artifacts, patch CVEs</td></tr>
        <tr><td><strong>4: Recovery</strong></td><td>Restore normal operations</td><td>Restore from offline snapshot, reset passwords, 72h monitoring</td></tr>
      </tbody>
    </table>
    <div class="callout warn"><div class="ct">&#x26A0;&#xFE0F; Ransomware Special Case</div>For ransomware threats, Phase 2 automatically prepends: "CRITICAL: Immediately sever SMB shares and unbind shared storage volumes to stop encryption propagation."</div>
  </div>

  <hr class="dv">

  <div id="s6d">
    <h3>6.4 Sigma Detection Rule Generator</h3>
    <span class="fp">app.py — POST /api/v1/sigma</span>
    <p>Generates a production-ready Sigma YAML rule for any IOC, plus three platform-specific query translations:</p>
    <pre><code>title: Detection for 192.0.2.1
id: a3f2c8b1-4d9e-{uuid}
status: experimental
description: Detects malicious activity involving 192.0.2.1
author: NO ENTRY SOC Automated Engine
date: 2026-09-27
tags:
    - attack.execution
    - attack.command_and_control
logsource:
    category: process_creation
    product: windows
detection:
    selection:
        CommandLine|contains: '192.0.2.1'
    condition: selection
level: high</code></pre>
    <p><strong>Also generated:</strong> Splunk: <code>index=* "192.0.2.1" | stats count by host, user</code> &nbsp;|&nbsp; KQL: <code>DeviceProcessEvents | where ProcessCommandLine has "192.0.2.1"</code> &nbsp;|&nbsp; Elastic: <code>process.command_line: *"192.0.2.1"*</code></p>
  </div>
</div>

<!-- SECTION 7: DATABASE -->
<div class="page pb" id="s7">
  <div class="sh"><div class="sn">Section 07</div><h2 class="st">Database Schema</h2></div>
  <p>PostgreSQL with two required extensions: <code>uuid-ossp</code> (auto UUID primary keys) and <code>pg_trgm</code> (trigram full-text search on article titles).</p>
  <span class="fp">schema.sql</span>

  <h3>threats — The Main Intelligence Table</h3>
  <pre><code>CREATE TABLE threats (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        TEXT NOT NULL,
    summary      TEXT,
    content      TEXT,
    source_name  VARCHAR(100) NOT NULL,
    source_url   TEXT UNIQUE NOT NULL,   -- UNIQUE constraint prevents duplicate articles
    category     VARCHAR(50) DEFAULT 'General',
    severity     VARCHAR(20) CHECK (severity IN ('Critical','High','Medium','Low')),
    risk_score   INT DEFAULT 0,
    published_at TIMESTAMPTZ NOT NULL,   -- article's original publish date
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);</code></pre>

  <h3>iocs — Indicators of Compromise</h3>
  <pre><code>CREATE TABLE iocs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id    UUID REFERENCES threats(id) ON DELETE CASCADE,
    type         VARCHAR(20) CHECK (type IN ('IPv4','Domain','CVE','SHA256','MD5','URL')),
    value        TEXT NOT NULL,
    reputation_score INT DEFAULT NULL,
    is_malicious BOOLEAN DEFAULT NULL,
    UNIQUE(threat_id, type, value)  -- no duplicate IOCs per article
);</code></pre>

  <h3>threat_mitre_mapping — ATT&amp;CK Classifications</h3>
  <pre><code>CREATE TABLE threat_mitre_mapping (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id      UUID REFERENCES threats(id) ON DELETE CASCADE,
    tactic_id      VARCHAR(20) NOT NULL,    -- e.g. TA0040 (Impact)
    tactic_name    VARCHAR(100) NOT NULL,
    technique_id   VARCHAR(20) NOT NULL,    -- e.g. T1486 (Data Encrypted for Impact)
    technique_name VARCHAR(150) NOT NULL,
    UNIQUE(threat_id, tactic_id, technique_id)
);</code></pre>

  <h3>incident_clusters — AI-Grouped Incidents</h3>
  <pre><code>CREATE TABLE incident_clusters (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline   TEXT NOT NULL,
    category   VARCHAR(50) DEFAULT 'General',
    severity   VARCHAR(20),
    item_count INT DEFAULT 1,    -- how many articles are in this cluster
    summary    TEXT,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen  TIMESTAMPTZ DEFAULT NOW()
);</code></pre>

  <h3>alert_logs — External SIEM Webhook Ingestion</h3>
  <pre><code>CREATE TABLE alert_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_source VARCHAR(100) NOT NULL,  -- Wazuh, Suricata, Snort, etc.
    alert_type   VARCHAR(100) NOT NULL,
    severity     VARCHAR(20) NOT NULL,
    payload      JSONB NOT NULL,         -- raw alert payload
    broadcast_status JSONB,              -- delivery receipts
    created_at   TIMESTAMPTZ DEFAULT NOW()
);</code></pre>

  <h3>Performance Indexes</h3>
  <table>
    <thead><tr><th>Index Name</th><th>Table</th><th>Column</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td>idx_threats_severity</td><td>threats</td><td>severity</td><td>Fast severity filter queries</td></tr>
      <tr><td>idx_threats_published</td><td>threats</td><td>published_at DESC</td><td>Chronological timeline queries</td></tr>
      <tr><td>idx_threats_category</td><td>threats</td><td>category</td><td>Category-based filtering</td></tr>
      <tr><td>idx_threats_title_trgm</td><td>threats</td><td>title GIN trigram</td><td>Full-text keyword search</td></tr>
      <tr><td>idx_mitre_tactic</td><td>threat_mitre_mapping</td><td>tactic_id</td><td>MITRE tactic filtering</td></tr>
      <tr><td>idx_mitre_technique</td><td>threat_mitre_mapping</td><td>technique_id</td><td>MITRE technique filtering</td></tr>
      <tr><td>idx_iocs_value</td><td>iocs</td><td>value</td><td>IOC search and deduplication</td></tr>
    </tbody>
  </table>

  <h3>Row-Level Security (RLS)</h3>
  <p>All tables have PostgreSQL RLS enabled. Public read access is granted (needed for the frontend). Backend full read/write access is granted for the server connection pool. Alert logs are write-restricted to authenticated backend only.</p>

  <h3>Analytics Views</h3>
  <table>
    <thead><tr><th>View</th><th>Query</th><th>Used By</th></tr></thead>
    <tbody>
      <tr><td><code>v_severity_stats</code></td><td>COUNT threats grouped by severity</td><td>Dashboard severity pie chart</td></tr>
      <tr><td><code>v_category_stats</code></td><td>COUNT threats grouped by category</td><td>Dashboard category breakdown</td></tr>
      <tr><td><code>v_recent_threats</code></td><td>threats WHERE published_at &gt;= NOW() - 7 days</td><td>Dashboard live stream + telemetry</td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 8: INGESTION PIPELINE -->
<div class="page pb" id="s8">
  <div class="sh"><div class="sn">Section 08</div><h2 class="st">Ingestion Pipeline</h2></div>
  <p>The ingestion pipeline is an <strong>automated scheduled process</strong> that continuously collects fresh threat intelligence from all approved RSS/Atom feeds.</p>
  <ul>
    <li><strong>Frequency:</strong> Every 30 minutes (configurable)</li>
    <li><strong>Trigger:</strong> setInterval on server startup; or external cron job</li>
    <li><strong>Concurrency:</strong> Per-host locking prevents duplicate parallel fetches</li>
  </ul>
  <h3>Deduplication (Two Levels)</h3>
  <ol>
    <li><strong>Database level:</strong> <code>source_url</code> UNIQUE constraint — duplicate URLs fail silently on INSERT</li>
    <li><strong>Cache level:</strong> In-memory Set of known URLs prevents re-processing within same run</li>
  </ol>
  <h3>Run Telemetry</h3>
  <span class="fp">server/services/collectionRunService.js</span>
  <p>Each collection run records: <code>runId</code>, <code>startedAt</code>, <code>completedAt</code>, <code>sourcesAttempted</code>, <code>sourcesSucceeded</code>, <code>articlesCollected</code>, <code>errors[]</code>. All returned by <code>GET /api/health</code>.</p>
  <h3>Admin Scripts</h3>
  <table>
    <thead><tr><th>Script</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td>audit_existing_feeds.mjs</td><td>Checks all registered feeds and reports health status</td></tr>
      <tr><td>build_canonical_registry.mjs</td><td>Builds the authoritative 1,000-source registry from candidates</td></tr>
      <tr><td>verify_new_feeds.mjs</td><td>Tests new candidate feeds before adding to registry</td></tr>
      <tr><td>populate_measured_health.mjs</td><td>Pre-fills health metrics for all sources</td></tr>
      <tr><td>generate_source_permissions.mjs</td><td>Generates legal permission records for approved sources</td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 9: SOURCES & PERMISSIONS -->
<div class="page pb" id="s9">
  <div class="sh"><div class="sn">Section 09</div><h2 class="st">Source Registry &amp; Legal Permissions</h2></div>
  <p>NO ENTRY maintains a curated registry of up to <strong>1,000 approved</strong> cybersecurity intelligence feeds. Each source goes through editorial and legal review before data from it is displayed.</p>
  <h3>Source Lifecycle</h3>
  <table>
    <thead><tr><th>State</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><strong>Candidate</strong></td><td>URL submitted; awaiting editorial review</td></tr>
      <tr><td><strong>Review</strong></td><td>Feed verified, content quality assessed, legal permissions checked</td></tr>
      <tr><td><strong>Approved</strong></td><td>Live — data collected every 30 minutes</td></tr>
      <tr><td><strong>Quarantined</strong></td><td>Suspended due to quality issues or legal concern; under review</td></tr>
      <tr><td><strong>Rejected / Retired</strong></td><td>Permanently removed from registry</td></tr>
    </tbody>
  </table>
  <h3>Permission Record Structure</h3>
  <pre><code>{
  "sourceId": "krebs-on-security",
  "permissionStatus": "permitted_intended_use",
  "permissionBasis": "RSS feed published with attribution requirement",
  "licenseType": "CC BY 4.0",
  "attributionRequired": true,
  "restrictions": {
    "maxSummaryLength": 500,           // max characters stored from RSS content
    "allowFullContentScrape": false,   // only use RSS snippet — no full scrape
    "allowAiEnrichment": true,         // AI may summarize and cluster this content
    "allowCommercialDisplay": false,   // research/personal use only
    "allowDownstreamRedistribution": false
  }
}</code></pre>
  <h3>Source Categories</h3>
  <table>
    <thead><tr><th>Category</th><th>Examples</th><th>Approx. Count</th></tr></thead>
    <tbody>
      <tr><td>Government &amp; CERT</td><td>CISA, NCSC, CERT-EU, US-CERT</td><td>~80</td></tr>
      <tr><td>Vendor Security Labs</td><td>Microsoft MSRC, Mandiant, CrowdStrike, Sophos</td><td>~150</td></tr>
      <tr><td>Threat Intelligence</td><td>Recorded Future, Malwarebytes, SANS ISC</td><td>~200</td></tr>
      <tr><td>Security News</td><td>Krebs on Security, The Hacker News, BleepingComputer</td><td>~250</td></tr>
      <tr><td>Academic &amp; Research</td><td>IEEE, arXiv security, university CERTs</td><td>~100</td></tr>
      <tr><td>CVE / Vuln Trackers</td><td>NVD, MITRE CVE, ExploitDB</td><td>~80</td></tr>
      <tr><td>Community Blogs</td><td>Red Canary, PortSwigger, Schneier on Security</td><td>~140</td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 10: DEPLOYMENT -->
<div class="page pb" id="s10">
  <div class="sh"><div class="sn">Section 10</div><h2 class="st">Deployment &amp; Configuration</h2></div>
  <h3>vercel.json</h3>
  <pre><code>{
  "framework": "vite",
  "buildCommand": "cd soc-platform-ui-main &amp;&amp; npm install &amp;&amp; npm run build",
  "outputDirectory": "soc-platform-ui-main/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api|assets|soc-intel-.*|.*\\..*).*)", "destination": "/index.html" }
  ]
}</code></pre>
  <h3>Environment Variables</h3>
  <table>
    <thead><tr><th>Variable</th><th>Required</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td><code>DATABASE_URL</code></td><td><span class="badge br">Required</span></td><td>PostgreSQL connection string (Supabase or Neon)</td></tr>
      <tr><td><code>VIRUSTOTAL_API_KEY</code></td><td><span class="badge bo">Optional</span></td><td>Enables IP/hash enrichment. Without it, enrichment returns graceful errors.</td></tr>
      <tr><td><code>ABUSEIPDB_API_KEY</code></td><td><span class="badge bo">Optional</span></td><td>Enables IP abuse score lookup via AbuseIPDB</td></tr>
      <tr><td><code>PORT</code></td><td><span class="badge bb">Dev Only</span></td><td>Local server port (default: 3000)</td></tr>
      <tr><td><code>AI_SERVICE_URL</code></td><td><span class="badge bo">Optional</span></td><td>URL of Python AI microservice (default: http://localhost:8000)</td></tr>
    </tbody>
  </table>
  <div class="callout warn"><div class="ct">&#x26A0;&#xFE0F; Serverless Limitation</div>Vercel functions have a 10-60s execution limit. Long feed collection tasks are split into batches. For production-grade persistent collection, host the Node.js backend on Render or Railway (not Vercel).</div>
</div>

<!-- SECTION 11: API REFERENCE -->
<div class="page pb" id="s11">
  <div class="sh"><div class="sn">Section 11</div><h2 class="st">Complete REST API Reference</h2></div>

  <h3>Node.js Backend</h3>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/news</span></div><div class="abt">Latest aggregated threat articles. Params: limit, offset, severity, category, source, search.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/explore</span></div><div class="abt">Date-range archive search. Params: preset, dateFrom, dateTo, tz, q, source, severity, tactic, technique, mappedOnly, page, pageSize, sort.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/explore/meta</span></div><div class="abt">Filter options: all available sources, categories, MITRE tactics, severities, sort options.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/mitre/news</span></div><div class="abt">Intelligence articles grouped by MITRE ATT&amp;CK tactics and techniques. Params: tactic, technique, severity, search.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/mitre/heatmap</span></div><div class="abt">All 14 tactics with technique hit counts for the frequency heatmap visualization.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/sources</span></div><div class="abt">All registered sources with health metrics, permission status, and approval state.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/enrich/ip/:ip</span></div><div class="abt">VirusTotal + AbuseIPDB enrichment for an IP address. Returns maliciousness score, country, ISP, and SIEM queries.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/enrich/cve/:cveId</span></div><div class="abt">FIRST EPSS probability score and CISA KEV exploitation status for a CVE identifier.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/enrich/queries/:ioc</span></div><div class="abt">Generates Splunk SPL, Microsoft Sentinel KQL, and Sigma YAML for any IOC.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/rules/sigma</span></div><div class="abt">Curated Sigma YAML detection rules with metadata. Params: search, level.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/rules/yara</span></div><div class="abt">Curated YARA malware signature rules. Params: search.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/ai/brief</span></div><div class="abt">Executive threat briefing (proxied to Python AI microservice). Returns headline, key threats, CVEs, actions, summary.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/ai/clusters</span></div><div class="abt">Clustered and deduplicated incidents with deduplication rate percentage.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/dashboard/snapshot</span></div><div class="abt">Telemetry: total articles, severity counts, top sources, isDemoEnabled flag.</div></div>
  <div class="ab"><div class="ah"><span class="am get">GET</span><span class="ap">/api/health</span></div><div class="abt">System health, uptime, version, last collection run telemetry.</div></div>
  <div class="ab"><div class="ah"><span class="am post">POST</span><span class="ap">/api/v1/alerts</span></div><div class="abt">External SIEM alert ingestion (requires Authorization header). Body: {alert_source, alert_type, severity, payload}.</div></div>

  <h3>Python AI Service APIs</h3>
  <table>
    <thead><tr><th>Method</th><th>Endpoint</th><th>Request Body</th><th>Returns</th></tr></thead>
    <tbody>
      <tr><td><span class="badge bg">GET</span></td><td>/health</td><td>—</td><td>{status: "healthy", uptime_check: true}</td></tr>
      <tr><td><span class="badge bo">POST</span></td><td>/api/v1/briefing</td><td>{articles:[], focus_topic, max_bullet_points}</td><td>BriefingResponse with headline, threats, actions, summary</td></tr>
      <tr><td><span class="badge bo">POST</span></td><td>/api/v1/cluster</td><td>{articles:[], similarity_threshold}</td><td>ClusterResponse with deduplication rate %</td></tr>
      <tr><td><span class="badge bo">POST</span></td><td>/api/v1/remediate</td><td>{threat_type, severity, description, iocs}</td><td>4-phase incident response playbook</td></tr>
      <tr><td><span class="badge bo">POST</span></td><td>/api/v1/sigma</td><td>{title, indicator, indicator_type, severity}</td><td>Sigma YAML + Splunk/KQL/Elastic queries</td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 12: SECURITY & LEGAL -->
<div class="page pb" id="s12">
  <div class="sh"><div class="sn">Section 12</div><h2 class="st">Security &amp; Legal</h2></div>
  <table>
    <thead><tr><th>Control</th><th>Implementation</th><th>Protects Against</th></tr></thead>
    <tbody>
      <tr><td>SSRF Protection</td><td>Block private IP ranges (RFC 1918) before fetch</td><td>Server-Side Request Forgery attacks</td></tr>
      <tr><td>SSL Verification</td><td>Enforce TLS cert validation on all outbound fetches</td><td>Man-in-the-middle on feed collection</td></tr>
      <tr><td>Content Size Limits</td><td>32MB max body; 500-char snippet cap for display</td><td>Memory exhaustion / DoS via large feeds</td></tr>
      <tr><td>Row Level Security</td><td>PostgreSQL policies restrict writes to backend only</td><td>Unauthorized DB writes from stolen tokens</td></tr>
      <tr><td>CORS Headers</td><td>Configured in vercel.json for all /api/* routes</td><td>Cross-origin request forgery</td></tr>
      <tr><td>No Secrets in Code</td><td>All API keys via environment variables only</td><td>Credential exposure in version control</td></tr>
      <tr><td>Alert Auth</td><td>SIEM webhook endpoint requires Authorization header</td><td>Unauthorized alert injection</td></tr>
    </tbody>
  </table>
  <div class="callout info"><div class="ct">&#x2139;&#xFE0F; RSS Legal Basis</div>NO ENTRY aggregates publicly available RSS feeds designed for syndication. The platform stores only snippets (max 500 chars), always links back to the original source, attributes the original author, and respects terms of service per source.</div>
  <div class="callout purple"><div class="ct">&#x1F4DC; License</div>The NO ENTRY platform source code is released under the <strong>MIT License</strong> — free to use, modify, and distribute, including commercially, with copyright notice included.</div>
</div>

<!-- SECTION 13: LOCAL DEVELOPMENT -->
<div class="page pb" id="s13">
  <div class="sh"><div class="sn">Section 13</div><h2 class="st">Local Development Guide &amp; File Structure</h2></div>
  <h3>Prerequisites</h3>
  <p>Node.js v18+, Python 3.9+ (optional), Git, PostgreSQL database (Supabase free tier works well).</p>
  <h3>Setup Steps</h3>
  <pre><code><span class="cm"># 1. Clone and enter project</span>
git clone https://github.com/ceylonroameryt-bit/SOC-AI.git &amp;&amp; cd SOC-AI

<span class="cm"># 2. Install frontend + backend dependencies</span>
cd soc-platform-ui-main &amp;&amp; npm install

<span class="cm"># 3. Environment variables (.env in project root)</span>
PORT=3000
DATABASE_URL=postgresql://postgres:[pwd]@db.supabase.co:5432/postgres
VIRUSTOTAL_API_KEY=your_key_here
ABUSEIPDB_API_KEY=your_key_here

<span class="cm"># 4. Initialize database schema</span>
psql $DATABASE_URL &lt; schema.sql

<span class="cm"># Terminal 1 — Node.js Backend (port 3000)</span>
npm run server

<span class="cm"># Terminal 2 — React Frontend (port 5174)</span>
npm run dev

<span class="cm"># Terminal 3 — Python AI Service (port 8000, optional)</span>
pip install -r requirements.txt &amp;&amp; python app.py</code></pre>

  <h3>Project File Structure</h3>
  <pre><code>SOC-AI/
├── api/index.js                   ← Vercel serverless bridge
├── app.py                         ← Python FastAPI AI microservice
├── schema.sql                     ← PostgreSQL database schema
├── vercel.json                    ← Vercel deployment configuration
├── requirements.txt               ← Python dependencies
├── scripts/                       ← Admin &amp; pipeline management scripts
│   ├── audit_existing_feeds.mjs
│   ├── build_canonical_registry.mjs
│   ├── verify_new_feeds.mjs
│   ├── generate_source_permissions.mjs
│   └── generate_all_reports.py
└── soc-platform-ui-main/
    ├── src/
    │   ├── App.tsx                ← Root app with all routing
    │   ├── config/api.ts          ← API_BASE URL configuration
    │   ├── context/
    │   │   └── AccessibilityContext.tsx  ← Screen reader announcements
    │   ├── pages/                 ← 15 page components
    │   │   ├── Dashboard.tsx        (274 lines)
    │   │   ├── Explore.tsx          (1,085 lines — most complex)
    │   │   ├── Sources.tsx          (964 lines)
    │   │   ├── Enrichment.tsx       (477 lines)
    │   │   ├── MitreHeatmap.tsx     (312 lines)
    │   │   ├── MitreNews.tsx        (large)
    │   │   ├── AIBrief.tsx          (311 lines)
    │   │   ├── RuleLibrary.tsx      (335 lines)
    │   │   └── ... (7 more pages)
    │   └── components/
    │       ├── dashboard/          ← Dashboard widgets
    │       │   ├── TelemetryCards.tsx
    │       │   ├── NewsFeed.tsx
    │       │   ├── SeverityChart.tsx
    │       │   ├── MitreMiniMatrix.tsx
    │       │   └── AiExecutiveWidget.tsx
    │       └── layout/             ← Navigation &amp; app shell
    └── server/
        ├── server.js              ← Express server entry point
        ├── routes/
        │   ├── news.js
        │   ├── explore.js         ← Timezone-aware archive search
        │   ├── mitre.js
        │   ├── sources.js
        │   └── enrich.js
        └── services/
            ├── collectorEngine.js ← RSS feed ingestion with host locking
            ├── severityEngine.js  ← Multi-factor keyword scoring
            ├── mitreService.js    ← ATT&amp;CK technique mapping
            └── collectionRunService.js ← Run telemetry</code></pre>
</div>

<!-- SECTION 14: GLOSSARY -->
<div class="page pb" id="s14">
  <div class="sh"><div class="sn">Section 14</div><h2 class="st">Glossary</h2></div>
  <table>
    <thead><tr><th>Term</th><th>Full Name</th><th>Definition</th></tr></thead>
    <tbody>
      <tr><td><strong>APT</strong></td><td>Advanced Persistent Threat</td><td>A sophisticated, long-term cyberattack, often state-sponsored</td></tr>
      <tr><td><strong>ATT&amp;CK</strong></td><td>Adversarial Tactics, Techniques &amp; Common Knowledge</td><td>MITRE's framework documenting adversary behavior patterns</td></tr>
      <tr><td><strong>CERT</strong></td><td>Computer Emergency Response Team</td><td>An organization handling cybersecurity incidents for a region or sector</td></tr>
      <tr><td><strong>CISA</strong></td><td>Cybersecurity and Infrastructure Security Agency</td><td>U.S. government agency responsible for national cybersecurity</td></tr>
      <tr><td><strong>Cosine Similarity</strong></td><td>—</td><td>Measure of similarity between two text vectors (0 = different, 1 = identical)</td></tr>
      <tr><td><strong>CVE</strong></td><td>Common Vulnerabilities and Exposures</td><td>Industry-standard ID for public security vulnerabilities (e.g. CVE-2024-12345)</td></tr>
      <tr><td><strong>EPSS</strong></td><td>Exploit Prediction Scoring System</td><td>Daily probability score predicting if a CVE will be exploited in the wild</td></tr>
      <tr><td><strong>HMR</strong></td><td>Hot Module Replacement</td><td>Vite feature that applies code changes instantly without full page refresh</td></tr>
      <tr><td><strong>IOC</strong></td><td>Indicator of Compromise</td><td>Observable evidence of a cyberattack: IP addresses, file hashes, domains, CVEs</td></tr>
      <tr><td><strong>KEV</strong></td><td>Known Exploited Vulnerabilities</td><td>CISA's catalog of CVEs actively exploited by real threat actors</td></tr>
      <tr><td><strong>KQL</strong></td><td>Kusto Query Language</td><td>Microsoft's query language for Azure Sentinel SIEM and Log Analytics</td></tr>
      <tr><td><strong>MITRE</strong></td><td>MITRE Corporation</td><td>Non-profit that maintains the ATT&amp;CK framework and CVE list</td></tr>
      <tr><td><strong>RLS</strong></td><td>Row Level Security</td><td>PostgreSQL feature restricting which rows each database role can access</td></tr>
      <tr><td><strong>RSS</strong></td><td>Really Simple Syndication</td><td>XML format for publishing regularly updated content (news feeds)</td></tr>
      <tr><td><strong>SIEM</strong></td><td>Security Information and Event Management</td><td>Platform aggregating and analyzing security logs (Splunk, Sentinel, Elastic)</td></tr>
      <tr><td><strong>Sigma</strong></td><td>—</td><td>Platform-agnostic YAML detection rule format convertible to any SIEM query language</td></tr>
      <tr><td><strong>SOC</strong></td><td>Security Operations Center</td><td>Team of analysts monitoring, detecting, and responding to cybersecurity incidents</td></tr>
      <tr><td><strong>SPA</strong></td><td>Single Page Application</td><td>Web app that loads once and updates content dynamically without full page reloads</td></tr>
      <tr><td><strong>SPL</strong></td><td>Search Processing Language</td><td>Splunk's query language for searching and analyzing log data</td></tr>
      <tr><td><strong>SSRF</strong></td><td>Server-Side Request Forgery</td><td>Attack tricking a server into making requests to internal or unauthorized systems</td></tr>
      <tr><td><strong>Tactic</strong></td><td>—</td><td>MITRE ATT&amp;CK: high-level attacker goal (e.g. Initial Access, Persistence, Exfiltration)</td></tr>
      <tr><td><strong>Technique</strong></td><td>—</td><td>MITRE ATT&amp;CK: specific method to achieve a tactic (e.g. T1486 — Data Encrypted for Impact)</td></tr>
      <tr><td><strong>TF-IDF</strong></td><td>Term Frequency-Inverse Document Frequency</td><td>Statistical weight measuring word importance in a document vs. a collection</td></tr>
      <tr><td><strong>TTP</strong></td><td>Tactics, Techniques, and Procedures</td><td>The behavior patterns of a threat actor, described using ATT&amp;CK framework</td></tr>
      <tr><td><strong>YARA</strong></td><td>Yet Another Ridiculous Acronym</td><td>Tool for creating malware detection rules based on binary file patterns</td></tr>
      <tr><td><strong>Zero-Day</strong></td><td>—</td><td>Vulnerability unknown to the vendor with no patch — exploitable from day zero</td></tr>
    </tbody>
  </table>

  <div style="margin-top:48px;padding:28px;background:linear-gradient(135deg,#0F172A,#1E3A8A);border-radius:14px;text-align:center;color:#fff;">
    <div style="font-size:28px;margin-bottom:10px;">&#x1F6E1;&#xFE0F;</div>
    <div style="font-size:20px;font-weight:800;margin-bottom:6px;">NO ENTRY Platform</div>
    <div style="opacity:.7;font-size:12px;">Built with &#x2764;&#xFE0F; for the Cybersecurity and Blue Team Community</div>
    <div style="margin-top:12px;opacity:.45;font-size:10.5px;font-family:monospace;">
      soc-ai-six.vercel.app &middot; github.com/ceylonroameryt-bit/SOC-AI &middot; MIT License
    </div>
  </div>
</div>

</body>
</html>"""

print("[1/4] Writing HTML report...")
with open(HTML_OUT, 'w', encoding='utf-8') as f:
    f.write(HTML_CONTENT)
print(f"  HTML: {HTML_OUT}")

print("[2/4] Generating PDF via Edge Headless...")
edge_paths = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]
edge_exe = next((p for p in edge_paths if os.path.exists(p)), None)
if edge_exe:
    subprocess.run([
        edge_exe, '--headless', '--disable-gpu', '--no-sandbox',
        f'--print-to-pdf={PDF_OUT}',
        '--print-to-pdf-no-header',
        f'file:///{HTML_OUT.replace(os.sep, "/")}'
    ], timeout=60, check=False, capture_output=True)
    if os.path.exists(PDF_OUT):
        print(f"  PDF:  {PDF_OUT}")
    else:
        print("  PDF: Edge not available or failed — skipping")
else:
    print("  PDF: Microsoft Edge not found — skipping")

print("[3/4] Generating Word (.docx) report...")
try:
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()

    # Title page
    doc.add_heading('NO ENTRY', 0)
    doc.add_heading('Next-Gen AI Threat Intelligence & SOC Triage Platform', 1)
    doc.add_paragraph('Complete Project Report — All Sections')
    doc.add_paragraph(f'Live App: https://soc-ai-six.vercel.app/')
    doc.add_paragraph(f'Repository: ceylonroameryt-bit/SOC-AI')
    doc.add_page_break()

    sections_text = [
        ("Section 1 — Project Overview", "NO ENTRY is a full-stack, AI-powered cybersecurity threat intelligence platform designed for SOCs. It continuously collects, enriches, classifies, and presents threat intelligence from 1,000+ trusted cybersecurity sources.\n\nKey capabilities:\n- IOC Enrichment via VirusTotal, AbuseIPDB, CISA KEV\n- MITRE ATT&CK Mapping (14 tactics, 52 techniques)\n- AI Executive Briefings via Python FastAPI\n- Incident Clustering with TF-IDF + Cosine Similarity (70%+ dedup)\n- Detection Rule Library (Sigma + YARA)\n- Historical Archive Explorer with timezone-aware date boundaries\n- Source Health Monitor with per-source telemetry"),
        ("Section 2 — System Architecture", "Three-tier architecture:\n\nTier 1 PRESENTATION: React 19 + TypeScript + Vite + Tailwind CSS on Vercel CDN\nTier 2 LOGIC: Node.js + Express 5 backend + Python FastAPI AI microservice\nTier 3 DATA: PostgreSQL (Supabase/Neon) + JSON archive files\n\nData Flow: RSS Feed → Collector → Severity Engine → MITRE Service → PostgreSQL → REST API → React UI\n\nDeployment: Frontend on Vercel, Backend on Vercel Serverless/Render, AI on Render/Railway, DB on Supabase."),
        ("Section 3 — Technology Stack", "Frontend: React 19.2.0, TypeScript 5.9, Vite 6.x, Tailwind CSS 3.x, React Router 6.x, Lucide React\nBackend: Node.js v18+, Express 5.x, rss-parser, node-postgres (pg), Axios\nAI Engine: Python 3.11, FastAPI 0.100+, Pydantic v2\nDatabase: PostgreSQL 15, Supabase/Neon\nSecurity: MITRE ATT&CK v14, Sigma Rules, YARA Rules"),
        ("Section 4 — Frontend (15 Pages)", "App.tsx: Root with AccessibilityProvider, BrowserRouter, Suspense\nDashboard.tsx: 4 tabs — Mission Control, Global Stream, Critical Radar, Analytics\nExplore.tsx: Date-range archive search with URL state, MITRE filters, detail panel\nSources.tsx: Source health, approval lifecycle, permission status per feed\nEnrichment.tsx: IOC triage — IP/hash/CVE/domain enrichment + SIEM query generation\nMitreHeatmap.tsx: Visual ATT&CK technique frequency matrix with heat colors\nMitreNews.tsx: All 14 tactics as tabs with technique filtering\nAIBrief.tsx: Executive briefing + incident clustering results\nRuleLibrary.tsx: Sigma YAML and YARA rule catalog with copy/export"),
        ("Section 5 — Backend (Node.js)", "server.js: Express bootstrap, route mounting, collector scheduler, Vercel export\ncollectorEngine.js: withHostLock() for per-host concurrency, SSL/SSRF protection, 30s timeout, error tracking\nseverityEngine.js: Keyword scoring system (+15 for active exploitation, -5 for marketing noise, thresholds at 20/10/4)\nmitreService.js: Keyword-to-technique lookup covering 52 ATT&CK techniques\nexplore.js: Intl.DateTimeFormat timezone-aware date boundary math"),
        ("Section 6 — Python AI Microservice", "app.py (FastAPI on port 8000, Swagger UI at /docs)\n/api/v1/briefing: Generates executive threat briefing — headline, key threats, CVEs, recommended actions\n/api/v1/cluster: TF-IDF vectorization + cosine similarity greedy clustering (threshold 0.30 default, 70%+ dedup)\n/api/v1/remediate: 4-phase SOC playbook (Identification, Containment, Eradication, Recovery)\n/api/v1/sigma: Generates Sigma YAML + Splunk SPL + Microsoft Sentinel KQL + Elastic DSL"),
        ("Section 7 — Database Schema", "threats: id, title, summary, content, source_name, source_url (UNIQUE), category, severity (Critical/High/Medium/Low), risk_score, published_at, created_at\niocs: id, threat_id (FK), type (IPv4/Domain/CVE/SHA256/MD5/URL), value, reputation_score, is_malicious\nthreat_mitre_mapping: id, threat_id (FK), tactic_id, tactic_name, technique_id, technique_name\nincident_clusters: id, headline, category, severity, item_count, summary, first_seen, last_seen\nalert_logs: id, alert_source, alert_type, severity, payload (JSONB), broadcast_status\n\nAll tables have Row-Level Security (RLS). Indexes on severity, published_at, title (trigram GIN), tactic/technique IDs."),
        ("Section 8 — Ingestion Pipeline", "Runs every 30 minutes. Per-host locking prevents parallel hammering. Deduplication at DB level (UNIQUE source_url) and cache level (in-memory Set).\n\nError handling: timeout→delayed, 404→increment failures, 429→backoff, SSL error→manual review, 3+ failures→auto-disable.\n\nRun telemetry (collectionRunService.js): runId, startedAt, completedAt, sourcesAttempted, sourcesSucceeded, articlesCollected, errors[]."),
        ("Section 9 — Source Registry & Permissions", "Lifecycle: Candidate → Review → Approved → Quarantined → Rejected/Retired\nPermission record: permissionStatus (permitted_intended_use/restricted/denied/pending), licenseType, attributionRequired, maxSummaryLength, allowAiEnrichment, allowCommercialDisplay\nCategories: Government/CERT (~80), Vendor Labs (~150), Threat Intel (~200), Security News (~250), Academic (~100), CVE Trackers (~80), Community (~140). Total: ~1,000 sources."),
        ("Section 10 — Deployment & Config", "vercel.json: framework=vite, buildCommand runs npm build in soc-platform-ui-main, rewrites /api/* to serverless, fallback to /index.html for SPA.\nEnv vars: DATABASE_URL (required), VIRUSTOTAL_API_KEY (optional), ABUSEIPDB_API_KEY (optional), PORT (dev), AI_SERVICE_URL (optional)."),
        ("Section 11 — REST API Reference", "Node.js: GET /api/news, GET /api/explore, GET /api/explore/meta, GET /api/mitre/news, GET /api/mitre/heatmap, GET /api/sources, GET /api/enrich/ip/:ip, GET /api/enrich/cve/:cveId, GET /api/enrich/queries/:ioc, GET /api/rules/sigma, GET /api/rules/yara, GET /api/ai/brief, GET /api/ai/clusters, GET /api/dashboard/snapshot, GET /api/health, POST /api/v1/alerts\n\nPython: GET /health, POST /api/v1/briefing, POST /api/v1/cluster, POST /api/v1/remediate, POST /api/v1/sigma"),
        ("Section 12 — Security & Legal", "SSRF protection, SSL verification, 32MB content size limits, PostgreSQL RLS, CORS headers, no secrets in code, alert auth header.\n\nLegal: RSS aggregation is intended use of RSS feeds. Only snippets stored (max 500 chars). Always links to original. Respects robots.txt and ToS per source. MIT License for platform code."),
        ("Section 13 — Local Development", "Prerequisites: Node.js v18+, Python 3.9+ (optional), Git, PostgreSQL.\nTerminal 1: cd soc-platform-ui-main && npm run server (port 3000)\nTerminal 2: npm run dev (port 5174)\nTerminal 3: python app.py (port 8000, optional)\nDB init: psql $DATABASE_URL < schema.sql"),
        ("Section 14 — Glossary", "APT: Advanced Persistent Threat\nATT&CK: Adversarial Tactics Techniques & Common Knowledge\nCERT: Computer Emergency Response Team\nCISA: Cybersecurity & Infrastructure Security Agency\nCVE: Common Vulnerabilities and Exposures\nEPSS: Exploit Prediction Scoring System\nIOC: Indicator of Compromise\nKEV: Known Exploited Vulnerabilities\nKQL: Kusto Query Language\nMITRE: MITRE Corporation\nRLS: Row Level Security\nRSS: Really Simple Syndication\nSIEM: Security Information and Event Management\nSigma: Platform-agnostic detection rule YAML format\nSOC: Security Operations Center\nSPA: Single Page Application\nSPL: Splunk Search Processing Language\nSSRF: Server-Side Request Forgery\nTF-IDF: Term Frequency-Inverse Document Frequency\nTTP: Tactics Techniques and Procedures\nYARA: Yet Another Ridiculous Acronym\nZero-Day: Unpatched unknown vulnerability exploitable from day zero")
    ]

    for title, body in sections_text:
        doc.add_heading(title, level=1)
        doc.add_paragraph(body)
        doc.add_page_break()

    doc.save(DOCX_OUT)
    print(f"  DOCX: {DOCX_OUT}")
except ImportError:
    print("  DOCX: python-docx not installed — skipping")

print("[4/4] Copying to artifact directory...")
os.makedirs(ARTIFACT_DIR, exist_ok=True)
for src in [HTML_OUT, PDF_OUT, DOCX_OUT]:
    if os.path.exists(src):
        dst = os.path.join(ARTIFACT_DIR, os.path.basename(src))
        shutil.copy2(src, dst)
        print(f"  Copied: {os.path.basename(src)}")

print("\n=== All Done ===")
for f in [HTML_OUT, PDF_OUT, DOCX_OUT]:
    if os.path.exists(f):
        size_kb = os.path.getsize(f) / 1024
        print(f"  {os.path.basename(f)}: {size_kb:.0f} KB")
