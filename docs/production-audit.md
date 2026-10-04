# NO ENTRY — SOC AI Platform Production Audit Report

**Date**: 2026-10-04  
**Auditor**: Senior Full-Stack, Security, SOC Platform, Database, QA & DevOps Engineering  
**Scope**: Full repository audit across Frontend (React 19 + TypeScript + Vite), Express 5 Backend, Vercel Serverless Function (`api/index.js`), Database layer (PostgreSQL / Supabase), Python AI microservice, CI/CD pipelines, and Collector processes.

---

## 1. Executive Summary

A comprehensive architectural and security audit of the NO ENTRY Threat Intelligence & SOC Triage Platform was conducted. While the application possesses a functional React 19 UI and modular server endpoints, it suffers from severe systemic architectural defects:

1. **Dual / Disconnected Architecture**: 
   - A standalone Express backend (`server/server.js`) and a standalone Vercel Serverless entrypoint (`api/index.js`) duplicate routing, data aggregation, MITRE mapping, and report generation logic.
   - The scheduled collector writes partially to local disk (`server/data/news.json`) and conditionally to PostgreSQL. Meanwhile, the Vercel serverless deployment (`api/index.js`) operates entirely in memory using an ephemeral cache seeded with hardcoded mock articles (`FALLBACK_NEWS`).
2. **Fabricated Telemetry & Health States**:
   - The system stamps 500+ feeds with `status: 'healthy'`, `lastHttpStatus: 200`, and `averageLatencyMs: 240` regardless of whether they were ever fetched or whether they actually work.
   - The dashboard reports `"Live Telemetry Active"` and `"500/500 Healthy"` even when total ingested intelligence is 0 and no feeds have succeeded.
   - Timestamps like `lastSuccessfulIngestion` are hardcoded (`new Date(now - 5 * 60 * 1000)`).
3. **Serverless Persistence Anti-Patterns**:
   - Multiple routes (`analyst.js`, `threats.js`, `reports.js`, `feedHealthService.js`) attempt to read and write to local JSON files (`analyst_actions.json`, `threats.json`, `news.json`, `feed_health.json`). In a serverless environment (Vercel) or multi-container environment, the local filesystem is ephemeral, read-only in production bundles, or isolated per invocation instance, causing immediate state loss and desynchronization.
4. **Security & Authorization Vulnerabilities**:
   - Mutation endpoints such as `POST /api/analyst/action`, `POST /api/webhooks/test`, and feed refresh triggers (`POST /api/news/refresh`) are unauthenticated, allowing anonymous public users to mutate state or trigger resource-exhaustive scans.
   - CORS is improperly configured: `Access-Control-Allow-Origin: *` is combined with `Access-Control-Allow-Credentials: true` in `vercel.json`, violating W3C CORS specifications.
   - Generated Sigma rules concatenate unescaped user input into YAML strings.
5. **Time Filter Inconsistency**:
   - The `TopBar` component sets a URL query parameter (`?time=24h`), but backend routes ignore the time filter, resulting in inconsistent figures across dashboard cards, news feeds, and AI briefs.

---

## 2. Current Architecture vs. Broken Data Flows

```
[CURRENT BROKEN RUNTIME FLOW]

                          ┌────────────────────────────────┐
                          │     Scheduled Collector        │
                          │     (server/collector.js)      │
                          └───────────────┬────────────────┘
                                          │
                                          ├─────────────► Writes to local news.json
                                          │               (Ephemeral / local disk only)
                                          ▼
                                (Conditionally to DB)
                                 PostgreSQL (Supabase)
                                          ▲
                                          │  (DISCONNECTED)
                                          │  API routes don't read from DB!
                                          ▼
┌─────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  Vercel Serverless API  │       │ Express Backend Server │       │   React 19 Frontend    │
│    (api/index.js)       │       │   (server/server.js)   │       │ (soc-platform-ui-main) │
└────────────┬────────────┘       └───────────┬────────────┘       └───────────┬────────────┘
             │                                │                                │
             ├─ Reads FALLBACK_NEWS (In-Mem)  ├─ Reads news.json               ├─ Reads snapshot
             ├─ Scrapes RSS on-the-fly (Slow) ├─ Writes analyst_actions.json   ├─ Shows fake "Live"
             └─ No DB persistence            └─ Writes feed_health.json       └─ Disconnected state
```

### Key Failure Points:
1. **Collector -> Disk**: Collector runs in GitHub Actions or locally and writes to `server/data/news.json`. When deployed to Vercel, `news.json` is not updated by GitHub Actions, meaning Vercel runs with whatever was committed to Git or falls back to `FALLBACK_NEWS`.
2. **PostgreSQL Ignored by Readers**: While `insertThreat` exists in `db.js`, `GET /api/news`, `GET /api/dashboard/snapshot`, `GET /api/categories`, `GET /api/mitre/*`, and `GET /api/reports/*` read strictly from in-memory objects or local JSON files.
3. **Stateless Vercel Lambda Memory Leak / Timeout**: Scraped RSS feeds inside `api/index.js` execute via `Promise.allSettled` for up to 102 feeds within a single serverless invocation. This exceeds Vercel's default 10-15s execution timeout and frequently drops requests.

---

## 3. Inventory of State Storage & File Classifications

| File Path | Current Role | Flaw / Problem | Classification | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `server/data/sources.json` | 102 feed definitions | Static registry | Static Configuration | Keep as baseline source registry; seed to PostgreSQL `intel_sources` table. |
| `server/data/rules/*.yml` | Sigma / YARA rule files | Static detection rules | Static Configuration | Retain for curated rule catalog. |
| `server/data/news.json` | Ingested threat articles | Runtime state stored on disk | Runtime State (Corrupt pattern) | **ELIMINATE RUNTIME WRITES**. Migrate authoritative storage to PostgreSQL `intel_articles`. |
| `server/data/threats.json` | Extracted threat events | Runtime state stored on disk | Runtime State (Corrupt pattern) | **ELIMINATE RUNTIME WRITES**. Migrate to PostgreSQL `threat_alerts` / `intel_articles`. |
| `server/data/feed_health.json`| Source health telemetry | Runtime telemetry on disk | Runtime State (Fabricated) | **ELIMINATE RUNTIME WRITES**. Calculate dynamically or store in PostgreSQL `source_health`. |
| `server/data/analyst_actions.json`| Analyst notes/status | Runtime workflow state | Runtime State (Corrupt pattern) | **ELIMINATE RUNTIME WRITES**. Persist to PostgreSQL `analyst_records` & `analyst_actions`. |
| `api/index.js: FALLBACK_NEWS` | Seed articles for cold-start | Silent fake fallback in prod | Demo/Test Data | Remove silent fallback; only serve when `ENABLE_DEMO_DATA=true`. |
| `threats.js: DEMO_THREATS` | Mock threat items | Hardcoded demo items | Demo/Test Data | Strictly gate behind `ENABLE_DEMO_DATA=true` with `isSimulated: true`. |
| `localStorage` | Client-side bookmarks & UI settings | Good for client UI, but abused for analyst state | Client Preference | Keep for bookmarks/theme; eliminate for analyst workflow mutations. |

---

## 4. Route & Entrypoint Mapping

### Express 5 Server (`server/server.js`)
- `/api/news` -> `routes/news.js` (`GET /`, `POST /refresh`, `GET /stats`)
- `/api/threats` -> `routes/threats.js` (`GET /`, `GET /status`, `GET /:id`)
- `/api/reports` -> `routes/reports.js` (`GET /daily`, `GET /export/csv`, `GET /export/json`, `GET /export/stix`)
- `/api/sources` -> `routes/sources.js` (`GET /`, `GET /stats`, `GET /health`)
- `/api/enrich` -> `routes/enrich.js` (`GET /ip/:ip`, `GET /hash/:hash`, `GET /cve/:cveId`, `POST /iocs`, `GET /queries/:ioc`)
- `/api/mitre` -> `routes/mitre.js` (`GET /tactics`, `GET /news`, `GET /heatmap`, `GET /coverage`)
- `/api/webhooks` -> `routes/webhooks.js` (`GET /config`, `POST /test`)
- `/api/ai` -> `routes/ai.js` (`GET /brief`, `POST /remediate`, `GET /clusters`)
- `/api/rules` -> `routes/rules.js` (`GET /sigma`, `GET /yara`, `POST /generate`)
- `/api/dashboard` -> `routes/dashboard.js` (`GET /snapshot`)
- `/api/categories` -> `routes/categories.js` (`GET /counts`, `GET /taxonomy`)
- `/api/analyst` -> `routes/analyst.js` (`GET /status`, `GET /record/:id`, `POST /action`, `POST /relevance`)
- `/api/v1/alerts` -> `server/server.js` (Ingestion endpoint for SIEM alerts)

### Vercel Serverless (`soc-platform-ui-main/api/index.js` & `api/index.js`)
Re-implements an ad-hoc monolithic router duplicating:
- `/api/news`
- `/api/threats`
- `/api/dashboard/snapshot`
- `/api/sources`
- `/api/sources/health`
- `/api/mitre/tactics`, `/api/mitre/news`, `/api/mitre/heatmap`
- `/api/enrich/ip/:ip`, `/api/enrich/cve/:cveId`, `/api/enrich/hash/:hash`
- `/api/rules/sigma`, `/api/rules/yara`
- `/api/reports/daily`, `/api/reports/export/*`
- `/api/ai/brief`, `/api/ai/clusters`
- `/api/categories/counts`

**Defect**: Express backend and Vercel serverless have drifted out of sync. `api/index.js` uses different mocks, lacks database querying, and cannot sustain long-running network calls.

---

## 5. Security & Inconsistency Audit

1. **Unauthenticated Endpoints**:
   - `POST /api/analyst/action`: Modifies analyst workflow state without credentials.
   - `POST /api/webhooks/test`: Sends webhook requests to third-party Slack/Teams/Discord servers without authentication.
   - `POST /api/news/refresh`: Forces 100+ HTTP requests to external RSS servers anonymously.
2. **CORS Misconfiguration**:
   - `vercel.json` provides:
     ```json
     { "key": "Access-Control-Allow-Credentials", "value": "true" },
     { "key": "Access-Control-Allow-Origin", "value": "*" }
     ```
     Browsers reject XMLHttpRequests and fetch with credentials when origin is `*`.
3. **YAML Injection in Sigma Generator**:
   - `services/siemQueryService.js` and `app.py` use string template interpolation (`title: Detection for ${ioc}`) without escaping quotes, newlines, or YAML control characters.
4. **Fabricated Health States**:
   - `feedHealthService.js:initHealth()` sets `status: 'healthy'`, `lastHttpStatus: 200`, `itemsLast24Hours: 12`, `averageLatencyMs: 240` for every source found in `sources.json`.
   - Result: Dashboard claims 100% feed health even when no requests have ever succeeded.
5. **Route Precedence Bug**:
   - In `routes/sources.js`, if `/runs` is added after `/:id`, Express will match `/:id` with parameter `id="runs"`.
6. **Missing Domain Enrichment**:
   - The UI presents Domain enrichment capability, but backend route `GET /api/enrich/domain/:domain` does not exist; only SIEM query generation is provided.

---

## 6. Proposed Production Architecture

```
[TARGET PRODUCTION ARCHITECTURE]

                       ┌───────────────────────────────────────────────┐
                       │           PostgreSQL / Supabase               │
                       │           (AUTHORITATIVE TRUTH)               │
                       ├───────────────────────────────────────────────┤
                       │ - intel_articles     - intel_sources          │
                       │ - source_health      - collection_runs        │
                       │ - collection_results - threat_alerts          │
                       │ - iocs               - analyst_records        │
                       │ - analyst_actions    - ai_briefs              │
                       │ - system_state                                │
                       └───────────────▲───────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
           (Database Read/Write)                 (Database Read/Write)
                    │                                     │
┌───────────────────┴─────────────────┐       ┌───────────┴────────────────────────┐
│     Scheduled Collector CLI         │       │ Express / Vercel API Service       │
│     (GitHub Actions / Server)       │       │ - Unified DB-backed queries        │
│  - Bounded concurrency              │       │ - Real measured telemetry only     │
│  - Measured source health           │       │ - Strict Auth on Mutations         │
│  - Ingests to intel_articles        │       │ - Global time filter honored       │
│  - Records collection_runs          │       │ - Honest empty states              │
└─────────────────────────────────────┘       └───────────────────▲────────────────┘
                                                                  │
                                                          REST API (CORS safe)
                                                                  │
                                                      ┌───────────┴────────────┐
                                                      │  React 19 Frontend SPA │
                                                      │  - Measured Telemetry  │
                                                      │  - Global Time Filter  │
                                                      │  - Read-Only for Guest │
                                                      │  - Accessible & Smooth │
                                                      └────────────────────────┘
```

---

## 7. Execution Plan

- **Phase 1**: Database migrations & schema (`server/db/migrations/003_authoritative_source_of_truth.sql`) + PostgreSQL connection pooling & database-backed DAO layer.
- **Phase 2**: Rewiring Ingestion & Read APIs to query PostgreSQL as single source of truth (`/api/news`, `/api/dashboard/snapshot`, `/api/categories`, `/api/mitre`, `/api/reports`).
- **Phase 3**: Purge fake fallbacks; enforce `ENABLE_DEMO_DATA=true` gate with honest empty states.
- **Phase 4 & 5**: Measured source health engine (`unknown`, `healthy`, `degraded`, `failed`, `stale`, `disabled`); rebuild telemetry counters.
- **Phase 6**: Pipeline states (`LIVE`, `DEGRADED`, `STALE`, `NO DATA`, `COLLECTION FAILURE`).
- **Phase 7**: Authoritative global time filter (`24h`, `7d`, `30d`, `all`) wired through TopBar to all endpoints.
- **Phase 8**: AI brief caching, background pregeneration, and token protection.
- **Phase 9 & 10**: Role authorization for Analyst workflow & Webhooks (`Guest` read-only, `Admin` for actions).
- **Phase 11 & 12**: Rate limit & protect refresh endpoints; persist collection run telemetry in DB.
- **Phase 13**: Route order fixes (`/runs` before `/:id`).
- **Phase 14**: Database-backed PDF/DOCX/CSV/JSON/STIX reporting matching dashboard window.
- **Phase 15 & 16**: Canonical Source Permission interface (`permissionOutcome`, `rules`, `requirements`).
- **Phase 17 & 18**: Future date / bad timestamp anomaly handling; separate `published_at`, `ingested_at`, `created_at`.
- **Phase 19 & 20**: Domain enrichment implementation & granular error responses.
- **Phase 21 & 22**: Strict CORS without wildcard credentials; remove fake notification successes.
- **Phase 23 - 29**: Rate limiting, dashboard empty states, KEV card readable formatting, accessibility, responsive polish, and collapsible assistant widget.
- **Phase 30 - 32**: Security hardening (sanitization, parameterized queries, safe YAML), standardized JSON errors.
- **Phase 33 - 40**: Regression tests, documentation generation, and full build & lint verification.
