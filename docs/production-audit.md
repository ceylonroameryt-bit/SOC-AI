# NO ENTRY — SOC-AI Threat Intelligence Platform: Production Audit Report

**Date:** October 2026  
**Auditor:** Senior Full-Stack, Security, SOC Platform, Database & QA Systems Engineering Team  
**Scope:** Complete platform audit across frontend, Express server, Vercel Serverless runtime, PostgreSQL/Supabase persistence layer, and threat ingestion pipeline.

---

## 1. Executive Summary

A comprehensive architectural and security audit of the **NO ENTRY — SOC-AI** threat intelligence platform was conducted. The audit revealed critical architectural defects, serverless persistence traps, unauthenticated administrative mutation routes, fabricated feed health timestamps, dual/contradictory data paths, and data model desynchronization between PostgreSQL and client-facing API routes.

While individual unit tests passed in synthetic environments, in production the platform suffers from:
1. **Broken Persistence**: Scheduled collectors push intelligence to PostgreSQL, but public API endpoints read from in-memory caches and disk JSON files (`news.json`, `threats.json`, `feed_health.json`, `collection_runs.json`, `analyst_actions.json`), which are ephemeral, read-only, or isolated per serverless instance on Vercel.
2. **Fabricated Telemetry & Impossible States**: Source health scripts stamped 350+ candidate feeds with identical timestamps and HTTP 200 statuses without actual collection, leading to dashboards displaying "500/500 Healthy" and "Live Telemetry Active" even when total collected intelligence was 0.
3. **Unprotected Mutation & Collection Triggers**: Public GET and POST endpoints allow anonymous callers to trigger external feed collection and invoke external AI LLM endpoints without rate limiting or authorization.
4. **Analyst Workflow Desynchronization**: Analyst notes, status changes, and dismissals were saved to browser `localStorage` and sent to the server without required credentials, where requests silently failed (`.catch(() => {})`).
5. **Route-Order Bugs**: Express routes registered `/:id` before `/runs`, blocking access to collection run telemetry.

---

## 2. Current Architecture vs. Broken Architecture

### 2.1 Current Intended Architecture (High-Level)
```
[External RSS/Atom Feeds (500+)] 
           │
           ▼
[GitHub Actions Scheduled Collector (cron: 15 */2 * * *)]
           │
     ┌─────┴──────────────────┐
     ▼                        ▼
[PostgreSQL Database]   [news.json / feed_health.json (Local Disk)]
     │
     ? (Disconnected)
     ▼
[Express Backend / Vercel Serverless Function]
     │
     ▼
[React 19 Frontend Dashboard]
```

### 2.2 Broken Architecture Reality
1. **Collector Path**: Standalone collector runs in GitHub Actions or locally, writing rows into `threats` and `iocs` in PostgreSQL. However, it also writes to `server/data/news.json`. In GitHub Actions, changes to `news.json` are discarded when the runner terminates.
2. **Serverless API Path**: Vercel executes serverless functions statelessly. Each invocation runs in an isolated micro-VM where filesystem writes to `server/data/*.json` are non-persistent and discarded between lambdas.
3. **Frontend Data Flow**: The frontend queries `/api/dashboard/snapshot`, `/api/news`, `/api/explore`, and `/api/threats`. These endpoints read from `NEWS_CACHE` and local files. When `news.json` is missing or empty, `newsService.js` silently falls back to `news_seed.json`, displaying simulated demo intelligence as real production data!
4. **Telemetric Contradiction**: The dashboard reads `sources_registry.json` and `feed_health.json`. Because previous helper scripts stamped hundreds of feeds as `status: 'healthy'`, the UI renders 500/500 healthy sources and "Live Telemetry Active", while at the same time displaying 0 collected intelligence articles.

---

## 3. Runtime Data Flows & File Usage Identification

| File | Classification | Problem / Risk | Target Architecture |
|---|---|---|---|
| `server/data/news.json` | **Runtime Operational State** | Writable JSON file used as primary data store on disk; fails on serverless. | **PostgreSQL `threats` / `intel_articles` table.** |
| `server/data/threats.json` | **Runtime Operational State** | Separate threat alerts file decoupled from `news.json`. | **Unified PostgreSQL intelligence store.** |
| `server/data/feed_health.json` | **Runtime Operational State** | Ephemeral file holding feed health; overwritten by batch scripts. | **PostgreSQL `source_health` table.** |
| `server/data/collection_runs.json` | **Runtime Operational State** | Ephemeral file storing collection run telemetry. | **PostgreSQL `collection_runs` table.** |
| `server/data/analyst_actions.json` | **Runtime Operational State** | Stores analyst notes and triage status; lost on serverless restarts. | **PostgreSQL `analyst_actions` & `analyst_records` tables.** |
| `server/data/source_permissions.json` | **Static Configuration & State** | Inconsistent schema (`permissionOutcome` vs `permissionStatus`). | Canonical PostgreSQL schema + static seed fallback. |
| `server/data/sources_registry.json` | **Static Configuration** | Base source metadata; valid as static config seed. | Seed for PostgreSQL `sources` / `intel_sources` table. |
| `server/data/news_seed.json` | **Demo / Test Data** | Silently used as production fallback when `news.json` is empty. | **Only loaded when `ENABLE_DEMO_DATA=true`.** |
| `localStorage` | **Client Browser State** | Used to store analyst notes/status to mask failed API mutations. | Replaced with authenticated server mutations; read-only for Guest. |
| In-memory caches (`NEWS_CACHE`, `healthMap`) | **Runtime Operational Cache** | Out of sync across multi-instance serverless functions. | Replaced with database queries with short HTTP Cache-Control. |

---

## 4. Route Map & Entry Point Audit

### 4.1 Express Routes (`soc-platform-ui-main/server/routes/`)
- `news.js`:
  - `GET /api/news`: Reads `NEWS_CACHE` or `news.json`/`news_seed.json`.
  - `POST /api/news/refresh`: **UNPROTECTED**. Triggers full 500-feed collection synchronously.
  - `GET /api/news/stats`: Severity stats from memory.
- `explore.js`:
  - `GET /api/explore`: Reads from `newsService.queryArchive`.
  - `GET /api/explore/article/:id`: Single article retrieval.
- `dashboard.js`:
  - `GET /api/dashboard/snapshot`: Aggregates news, threats, source health, KEV, and MITRE. Mixes disparate data sources.
- `sources.js`:
  - `GET /api/sources`: Reads feed health records.
  - `GET /api/sources/stats`: Returns source stats.
  - `GET /api/sources/health`: Detailed source health.
  - `GET /api/sources/permissions`: Permission matrix stats.
  - `GET /api/sources/:id`: **BUGGY ORDER**. Registered before `/runs`, hijacking `/api/sources/runs`.
  - `GET /api/sources/runs`: Unreachable due to route order bug.
  - `POST /api/sources/refresh`: **UNPROTECTED**. Triggers background/foreground ingestion.
- `threats.js`:
  - `GET /api/threats`: Reads from `threats.json` and demo threats.
  - `POST /api/threats`: Ingestion point.
- `analyst.js`:
  - `GET /api/analyst/status`: Requires `INGEST_API_KEY`.
  - `GET /api/analyst/record/:id`: Returns record analyst state.
  - `POST /api/analyst/action`: Requires `INGEST_API_KEY`. Frontend lacks key; mutations fail silently.
- `webhooks.js`:
  - `GET /api/webhooks/config`: Returns masked webhook URLs.
  - `POST /api/webhooks/test`: Requires `INGEST_API_KEY`. Frontend calls it without auth; returns 401.
- `ai.js`:
  - `GET /api/ai/brief`: **UNCONTROLLED**. Public GET triggers live OpenAI generation if configured.
  - `POST /api/ai/remediate`: Generates remediation steps (auth required).
  - `GET /api/ai/clusters`: Clusters articles from memory.
- `enrich.js`:
  - `GET /api/enrich/ip/:ip`: IP enrichment.
  - `GET /api/enrich/hash/:hash`: Hash enrichment.
  - `GET /api/enrich/cve/:cveId`: CVE enrichment.
  - `POST /api/enrich/iocs`: Bulk IOC enrichment.
  - `GET /api/enrich/queries/:ioc`: SIEM queries.
  - **MISSING**: `GET /api/enrich/domain/:domain` does not exist; UI falls back to queries only.
- `reports.js`:
  - `GET /api/reports/daily`: Reads `news.json` and `threats.json` directly from disk.
  - `GET /api/reports/export/threats`: Reads `threats.json`.
  - `GET /api/reports/export/news`: Reads `news.json`.
- `rules.js`:
  - `GET /api/rules/sigma`, `GET /api/rules/yara`: Reads static YAML/YAR.
  - `POST /api/rules/generate`: Unsafe string concatenation for Sigma rule YAML.

### 4.2 Vercel Serverless Entry Points
- Root `vercel.json` rewrites `/api/(.*)` to `/api` (`api/index.js`).
- `api/index.js` imports `soc-platform-ui-main/api/index.js`, which imports `server/server.js`.
- Express runs inside a single Vercel Serverless Function (`maxDuration: 15`, `memory: 1024`).
- Any background worker or long-running collection running inside an HTTP request will hit Vercel's 15-second hard timeout.

---

## 5. Security & Inconsistency Audit

1. **CORS Conflict**:
   - `vercel.json` sends `Access-Control-Allow-Credentials: false`.
   - `server.js` sets `credentials: true`.
   - Browsers reject cross-origin requests when credentials configuration contradicts.
2. **Fake Production Intelligence Fallback**:
   - `server/data/news_seed.json` is automatically loaded whenever `news.json` is missing.
   - Production instances on Vercel thus show synthetic threat actors, fabricated CVEs, and fake alerts.
3. **Fabricated Source Health Timestamps**:
   - Scripts (`promote_sources_to_500.mjs`) set `lastSuccessAt = nowIso` and `status = 'healthy'` across hundreds of sources without any HTTP fetch or validation.
4. **Unauthenticated Expensive Endpoints**:
   - Anonymous users could trigger `fetchAndProcessNews` via `POST /api/news/refresh`.
   - Public GET requests to `/api/ai/brief` can exhaust OpenAI API credits.
5. **Analyst Workflow Broken**:
   - Frontend lacks API keys; mutations fail with 401; failures are swallowed with `.catch(() => {})`; data is stored in `localStorage` creating a false impression of success.
6. **Date Parsing & Future Timestamps**:
   - If an article has no publication date, the database insertion converts `null` to `Date.now()`, corrupting publication timestamps.
7. **YAML Injection Risk in Sigma Generation**:
   - `siemQueryService.js` concatenates user-provided titles and descriptions directly into YAML template strings without proper escaping or serialization.

---

## 6. Proposed Production Architecture

```
                                  ┌────────────────────────────────┐
                                  │ PostgreSQL Database (Authoritative)
                                  │  - threats (intel_articles)    │
                                  │  - sources (intel_sources)     │
                                  │  - source_health               │
                                  │  - collection_runs             │
                                  │  - analyst_records / actions   │
                                  │  - ai_briefs                   │
                                  └──────────────┬─────────────────┘
                                                 │
                        ┌────────────────────────┴───────────────────────┐
                        ▼                                                ▼
     ┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
     │ Scheduled Collector (GitHub Actions)│         │ Vercel Serverless API / Express     │
     │ - Measures feed latency & HTTP codes│         │ - Reads exclusively from PostgreSQL │
     │ - Persists runs to collection_runs  │         │ - Serves /api/news, /dashboard, etc │
     │ - Updates source_health measured    │         │ - Protected endpoints with API key  │
     │ - Writes articles to threats        │         │ - Guest role is strictly read-only  │
     └─────────────────────────────────────┘         └──────────────────┬──────────────────┘
                                                                        │
                                                                        ▼
                                                     ┌─────────────────────────────────────┐
                                                     │ React 19 Frontend Dashboard         │
                                                     │ - Honest empty states when 0 intel  │
                                                     │ - Measured source health display    │
                                                     │ - Unified time filter (24h/7d/30d)  │
                                                     │ - Proper assistant slide-out widget │
                                                     └─────────────────────────────────────┘
```

---

## 7. Migration & Fix Plan

1. **Phase 1: Database Authority**:
   - Enhance schema migrations (`003_authoritative_runtime_schema.sql`) to guarantee tables: `threats` (with canonical URL uniqueness, separate `published_at` vs `ingested_at`), `sources`, `source_health`, `collection_runs`, `analyst_records`, `analyst_actions`, `ai_briefs`.
   - Update `db.js` to provide full database query access for all operational data with safe connection pooling and fallbacks.
2. **Phase 2 & 3: Intelligence Ingestion & Remove Fake Fallback**:
   - Make `newsService.js`, `dashboard.js`, `explore.js`, and `threats.js` query PostgreSQL directly.
   - Enforce that `news_seed.json` is ONLY loaded when `ENABLE_DEMO_DATA=true`. If PostgreSQL contains 0 articles, return an honest empty state with `[]`.
3. **Phase 4, 5, 6: Measured Source Health & Telemetry Integrity**:
   - Replace fabricated `status: 'healthy'` with real measured health: `unknown`, `healthy`, `degraded`, `failed`, `stale`, `disabled`.
   - Never mark sources healthy without real fetch success within expected intervals.
   - Align Dashboard counters with actual database numbers.
4. **Phase 7: Authoritative Time Range**:
   - Enforce consistent `24h`, `7d`, `30d`, `all` time window filtering across all API routes and UI components.
5. **Phase 8: AI Briefing Architecture**:
   - Store generated briefings in `ai_briefs`. Public `GET /api/ai/brief` returns the latest stored brief or honest notice if 0 reports exist.
6. **Phase 9 & 10: Security & Protected Endpoints**:
   - Protect `/api/news/refresh`, `/api/sources/refresh`, `/api/webhooks/test`.
   - Keep Guest users strictly read-only; show permission notice on UI.
   - Persist analyst actions to PostgreSQL when authorized.
7. **Phase 13: Route Order Bug**:
   - Move `/runs` and `/runs/latest` before `/:id` in `sources.js`.
8. **Phase 14: Reports from Database**:
   - Update PDF, DOCX, CSV, STIX exporters to query PostgreSQL directly.
9. **Phase 15: Source Permission Schema**:
   - Harmonize backend and frontend schema: `permissionOutcome`, `rules`, `requirements`.
10. **Phase 17 & 18: Publication Date vs Ingestion Date**:
    - Separate `published_at` (null if missing or dateAnomaly if future) from `ingested_at` and `created_at`.
11. **Phase 19 & 20: Real Domain Enrichment**:
    - Implement `GET /api/enrich/domain/:domain` with VirusTotal domain lookups, reputation, category, and queries.
    - Check `resp.ok` on frontend and distinguish rate limits, missing keys, and invalid IOCs.
12. **Phase 22, 25, 29, 31: CORS, CISA KEV, Assistant, Sigma**:
    - Align CORS headers.
    - Format CISA KEV dates and explicit unavailable labels.
    - Transform robot assistant into an accessible button and slide-over panel.
    - Use safe YAML serialization for Sigma rules.
13. **Phase 33 & 34: Test Suite & Regression Testing**:
    - Add comprehensive automated tests covering all 40 requirements.
