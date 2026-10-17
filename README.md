# 🎯 TacticLens — Subscription Threat Intelligence & SOC Triage Platform

<div align="center">

[![React 19](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node/Express 5](https://img.shields.io/badge/Node%2FExpress-5.2-026E00?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase%20%2F%20Neon%20(UK%2FEU)-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Python FastAPI](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MITRE ATT&CK](https://img.shields.io/badge/MITRE-ATT%26CK_v16.1-FF6B6B?style=for-the-badge)](https://attack.mitre.org/)
[![License](https://img.shields.io/badge/License-Proprietary-darkred?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Actionable threat intelligence and high-fidelity SOC triage designed for UK small/medium SOC teams and Managed Security Service Providers (MSSPs).</b>
</p>

</div>

---

## 🛡️ Ground Rules & Data Integrity Contract

TacticLens is built on strict data fidelity and auditability principles:
1. **Never Invent Data**: CVSS scores originate authoritatively from **NVD**, KEV status comes directly from the **CISA Known Exploited Vulnerabilities (KEV) catalog**, and EPSS percentiles/scores come directly from **FIRST**. When data is missing, TacticLens displays `"—"` or `"stale"` — never an estimated or fabricated score.
2. **AI Integrity & Human Control**: Artificial Intelligence summarises articles and assists ATT&CK mapping verification with required evidence citations. **AI never sets severity or risk scores.** Every AI-generated output carries an explicit `"AI"` badge alongside direct source citations.
3. **Respectful Feed Collection**: Feeds are polled respecting publisher `robots.txt`, caching headers (`ETag` / `If-Modified-Since`), with an explicit User-Agent: `TacticLensBot/1.0 (+https://tacticlens.co.uk/bot)`.
4. **UK/EU Data Residency**: Authoritative operational storage resides in UK/EU cloud regions with full data sovereignty and Row-Level Security (RLS).
5. **Fail-Closed Security**: Ingestion and synchronization triggers require a non-empty `CRON_SECRET`. If `CRON_SECRET` is unset or empty, all collection endpoints immediately fail closed with HTTP `401 Unauthorized`.

---

## 🌟 Core Platform Capabilities

### 🔍 1. High-Fidelity Triage & IOC Enrichment
- **Authoritative Vulnerability Telemetry**: Real-time cross-referencing of CVEs against CISA KEV and FIRST EPSS exploit likelihood models.
- **Defanged IOC Extraction**: Ingests, normalizes, and extracts defanged IP addresses (`192[.]168[.]1[.]1`), domains (`hxxp[s]://`), and cryptographic hashes.
- **On-Demand Reputation Intelligence**: Direct BYOK (Bring Your Own Key) integration with **VirusTotal** and **AbuseIPDB**.
- **Instant Threat Hunting Query Generation**:
  - **Microsoft Sentinel (KQL)**: Copy-paste hunting queries for network, process, and device telemetry.
  - **Splunk (SPL)**: Tuned index search queries with field extraction.
  - **Sigma Rules**: Detection queries mapped to verified community signatures from [SigmaHQ](https://github.com/SigmaHQ/sigma).

### 🗺️ 2. Verified MITRE ATT&CK® Mapping
- **14 Tactics, 52 Techniques Mapped**: Authoritative mapping across all 14 Enterprise tactics and 52 core techniques from **MITRE ATT&CK® Enterprise v16.1**.
- **Interactive Tactic Heatmap**: Operational frequency matrix showing attack concentrations across ingested feeds.
- **Evidence-Grounded Mapping**: Heuristic keyword pass paired with citation quotes from source text.

### 🤖 3. Incident Clustering & AI Executive Briefing
- **TF-IDF Incident Deduplication**: Groups redundant intelligence reports by 70%+ across feeds to eliminate alert fatigue.
- **CISO & Management Briefings**: Evidence-cited briefings synthesizing critical campaigns, targeted CVEs, and high-priority action items.

---

## 🏛️ System Architecture

```
                            ┌────────────────────────────────────────┐
                            │    Frontend UI (Vite / React 19)       │
                            │    Dark Global Shell / Light Console   │
                            └───────────────────┬────────────────────┘
                                                │ REST API / CORS
                                                ▼
                            ┌────────────────────────────────────────┐
                            │      Backend Core (Node / Express 5)   │
                            │      Unified Serverless / Container    │
                            └─────────┬────────────────────┬─────────┘
                                      │                    │
                    Intelligence Read │                    │ Pool / RLS
                    & Shared Snapshot │                    │ (SSL Mode)
                                      ▼                    ▼
        ┌───────────────────────────────────┐    ┌───────────────────────────────────┐
        │  Scheduled Worker / Collector CLI │    │   PostgreSQL Authoritative DB     │
        │  SSRF Guard / Worker Concurrency  │    │   Supabase / Neon (UK/EU Region)  │
        └─────────────────┬─────────────────┘    └───────────────────────────────────┘
                          │ HTTP Fetch
                          ▼
        ┌───────────────────────────────────┐
        │ 1,000+ Public Security Sources    │
        │ NCSC, CISA, Vendor PSIRTs, CERTs  │
        └───────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS | High-density SOC console with IBM Plex typography |
| **Backend** | Node.js, Express 5, RSS-Parser | Shared core API, rate limiting, and snapshot middleware |
| **Database** | PostgreSQL (Supabase / Neon UK/EU) | Authoritative storage, RLS multi-tenant policies |
| **Collector** | Node.js Worker Pool, SSRF Guard | Bounded concurrency (10 workers), 5MB cap, tracking stripper |
| **AI Engine** | Python 3.11, FastAPI, Scikit-Learn | ATT&CK verification & incident clustering |
| **Framework** | MITRE ATT&CK® Enterprise v16.1 | 14 tactics, 52 techniques catalogue |

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- PostgreSQL database (or runs with in-memory authoritative fallback store)

### 1. Installation
```bash
git clone https://github.com/ceylonroameryt-bit/SOC-AI.git tacticlens
cd tacticlens
npm run install:all
```

### 2. Environment Configuration
Copy `.env.example` in `soc-platform-ui-main`:
```bash
cp soc-platform-ui-main/.env.example soc-platform-ui-main/.env
```

Ensure `CRON_SECRET` is set for ingestion operations:
```env
PORT=3000
CRON_SECRET=your_secure_random_cron_secret
DATABASE_URL=postgresql://postgres:[password]@db.supabase.co:5432/postgres
FETCH_CONCURRENCY=10
```

### 3. Run Development Servers
```bash
# Start backend server
npm run server

# In a separate terminal, start frontend console
npm run dev
```

### 4. Run Test Suite
```bash
npm run test
```

---

## 📡 Key API Routes

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/news` | Aggregated, deduplicated threat intelligence feed |
| `POST` | `/api/news/refresh` | Protected feed collection (`CRON_SECRET` required) |
| `GET` | `/api/explore` | Server-side archive search with date range & MITRE filters |
| `GET` | `/api/explore/article/:id` | Full article detail with mapping provenance |
| `GET` | `/api/mitre/heatmap` | ATT&CK technique hit matrix across 14 tactics |
| `GET` | `/api/enrich/cve/:cveId` | NVD CVSS, CISA KEV status, and FIRST EPSS score |
| `GET` | `/api/enrich/queries/:ioc` | Generates Sentinel KQL and Splunk queries |
| `GET` | `/api/sources` | Measured feed health telemetry and permissions |
| `POST` | `/api/sources/refresh` | Trigger source ingestion cycle (`CRON_SECRET` required) |
| `GET` | `/api/ai/brief` | Executive threat briefing with source citations |

---

## ⚖️ Legal & Attributions

* **License**: Proprietary commercial software. Copyright © 2026 TacticLens Limited. All rights reserved. See [LICENSE](LICENSE).
* **MITRE ATT&CK®**: MITRE ATT&CK and ATT&CK are registered trademarks of The MITRE Corporation. Content is utilized under the terms of the MITRE ATT&CK terms of use.
* **Sigma Rules**: Sigma detection logic links to the community-maintained [SigmaHQ](https://github.com/SigmaHQ/sigma) repository.
