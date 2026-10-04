# 🛡️ NO ENTRY — Next-Gen AI Threat Intelligence & SOC Triage Platform

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-soc--ai--six.vercel.app-00dfa2?style=for-the-badge&logo=vercel&logoColor=white)](https://soc-ai-six.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-ceylonroameryt--bit%2FSOC--AI-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ceylonroameryt-bit/SOC-AI)
[![React 19](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Python FastAPI](https://img.shields.io/badge/Python-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MITRE ATT&CK](https://img.shields.io/badge/MITRE-ATT%26CK_v14-FF6B6B?style=for-the-badge)](https://attack.mitre.org/)

<p align="center">
  <b>Transforming high-volume cyber threat intelligence into automated, prioritized, and enriched defense workflows for Security Operations Centers (SOCs).</b>
</p>

</div>

---

## 🌟 Key Capabilities & Features

### 🔍 1. Smart Triage & Indicator of Compromise (IOC) Enrichment
- **Automated Reputation Checks**: Direct live queries against **VirusTotal** and **AbuseIPDB** with inline Maliciousness Confidence Scores.
- **Exploit Likelihood & Zero-Days**: Maps detected CVEs against the **FIRST EPSS** (Exploit Prediction Scoring System) and cross-references **CISA's Known Exploited Vulnerabilities (KEV)** catalog.
- **1-Click SIEM Query Generation**: Instantly generates copy-paste threat hunting queries:
  - **Splunk**: `index=* src_ip="192.0.2.1" OR dest_ip="192.0.2.1" | stats count by src_ip, sourcetype`
  - **Microsoft Sentinel (KQL)**: `DeviceNetworkEvents | where RemoteIP == "192.0.2.1"`
  - **Sigma Rules**: Auto-generates structured YAML detection rules for any IP, hash, CVE, or domain.

### 🗺️ 2. MITRE ATT&CK News Matrix & Heatmap
- **100% Framework Coverage**: Categorizes thousands of daily threat intelligence articles across all **14 MITRE Tactics** (from *Reconnaissance* and *Initial Access* to *Exfiltration* and *Impact*) and **52 ATT&CK Techniques**.
- **Interactive Technique Heatmap**: Visual frequency matrix revealing attack pattern concentrations with an on-demand inspector drawer.
- **Multi-Tactic Ribbon & Filtering**: Filter by tactic, technique ID (e.g. `T1486`, `T1059`), severity level, and search keywords.

### 🤖 3. AI Threat Briefings & Incident Clustering
- **Executive CISO Briefings**: High-level daily cybersecurity intelligence briefs summarizing critical threat vectors, active CVEs under exploitation, and immediate tactical remediations.
- **TF-IDF Incident Deduplication**: Machine-learning pipeline using TF-IDF vectorization and cosine similarity to cluster redundant news by **70%+**, preventing alert fatigue.
- **Automated Remediation Playbooks**: Generates structured 4-phase incident response plans (*Identification*, *Containment*, *Eradication*, *Recovery*).

### 📜 4. Detection Engineering Rule Library
- **Curated Rule Catalog**: Searchable repository of production **Sigma YAML** and **YARA** detection rules covering ransomware artifacts, LSASS credential dumps, and Cobalt Strike beacons.
- **Syntax Highlighting & Export**: Responsive split-panel code viewer with 1-click clipboard copy and raw file download.

### 📱 5. Multi-Platform & Responsive SOC Console
- Fully optimized responsive UI with touch-friendly mobile navigation drawers, horizontal matrix scrolling, and clean dark-mode aesthetics.

---

## 🏛️ System Architecture

```
                           ┌───────────────────────────┐
                           │    Frontend (Vite React)  │
                           │   Deployed on Vercel CDN  │
                           └─────────────┬─────────────┘
                                         │ REST API / CORS
                                         ▼
                           ┌───────────────────────────┐
                           │   Backend Server (Node)   │
                           │   Express 5 / Serverless  │
                           └──────┬─────────────┬──────┘
                                  │             │
                    HTTP Request  │             │ Connection Pool
                    for Briefings │             │ (pg Pool / SSL)
                                  ▼             ▼
  ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
  │   AI Microservice (Python app.py)│       │     PostgreSQL Database          │
  │    FastAPI / TF-IDF Clustering   │       │     Supabase / Neon (with RLS)   │
  └──────────────────────────────────┘       └──────────────────────────────────┘
```

---

## 🧰 Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS | High-performance SPA with custom dark theme & Lucide icons |
| **Backend** | Node.js, Express 5, Axios, RSS-Parser | Feed aggregation, IOC extraction engine & REST API |
| **AI Engine** | Python 3.11, FastAPI, Pydantic, Scikit-Learn | Natural language threat briefing & TF-IDF clustering |
| **Database** | PostgreSQL (via Supabase / Neon) | Full-text indexed schema with Row-Level Security (RLS) |
| **Detection** | MITRE ATT&CK v14, Sigma YAML, YARA | Industry-standard classification and detection formats |
| **Cloud Hosting**| Vercel & Render / Railway | Serverless frontend deployment & microservice hosting |

---

## 🗄️ Database Schema (`schema.sql`)

The database uses PostgreSQL with `uuid-ossp` and `pg_trgm` extensions:

- **`threats`**: Ingested articles with unique URL constraints, severity checks, and trigram search indexes.
- **`iocs`**: Extracted indicators (IPv4, Domain, CVE, SHA256, MD5) linked via foreign keys with deduplication constraints.
- **`threat_mitre_mapping`**: Relational junction table mapping articles to MITRE tactic and technique IDs.
- **`incident_clusters`**: AI-clustered incident groups with deduplicated headline summaries.
- **`alert_logs`**: External SIEM webhook and alert ingestion audit log.

---

## 🚀 Quickstart & Local Installation

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.9 or higher, optional for local AI microservice)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/ceylonroameryt-bit/SOC-AI.git
cd SOC-AI
```

### 2. Frontend & Backend Setup
```bash
cd soc-platform-ui-main
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

```env
PORT=3000
DATABASE_URL=postgresql://postgres:[password]@db.supabase.co:5432/postgres
VIRUSTOTAL_API_KEY=your_virustotal_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
```

### 4. Run Development Servers

**Terminal 1 — Node.js Backend:**
```bash
cd soc-platform-ui-main
npm run server
# Running at http://localhost:3000
```

**Terminal 2 — React Frontend:**
```bash
cd soc-platform-ui-main
npm run dev
# Running at http://localhost:5174
```

**Terminal 3 (Optional) — Python AI Microservice:**
```bash
pip install -r requirements.txt
python app.py
# Running at http://localhost:8000 (Swagger docs at /docs)
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/news` | Fetches aggregated cyber news with severity & categories |
| `GET` | `/api/mitre/news` | Returns categorized intelligence mapped to 14 MITRE tactics |
| `GET` | `/api/mitre/heatmap` | Aggregated technique hit counts for ATT&CK heatmap |
| `GET` | `/api/enrich/ip/:ip` | VirusTotal & AbuseIPDB reputation lookup for an IP |
| `GET` | `/api/enrich/cve/:cveId` | EPSS score and CISA KEV exploitation status for a CVE |
| `GET` | `/api/enrich/queries/:ioc` | Generates Splunk, Sentinel KQL, and Sigma hunting rules |
| `GET` | `/api/rules/sigma` | Fetches curated Sigma detection rules |
| `GET` | `/api/rules/yara` | Fetches curated YARA signature rules |
| `GET` | `/api/ai/brief` | Executive CISO security intelligence brief |
| `GET` | `/api/ai/clusters` | Clustered and deduplicated threat incidents |
| `POST` | `/api/v1/alerts` | Authenticated external SIEM alert ingestion endpoint |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

<div align="center">
  <b>Built with ❤️ for the Cybersecurity and Blue Team Community</b>
</div>
