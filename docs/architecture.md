# System Architecture Specification

## 1. High-Level Architecture Overview

NO ENTRY Threat Intelligence Platform / SOC-AI is an enterprise-grade autonomous threat ingestion, triage, and incident response platform.

```
                           ┌────────────────────────────────────────┐
                           │          External Threat Feeds         │
                           │   (CISA KEV, Vendor Labs, RSS/Atom)    │
                           └──────────────────┬─────────────────────┘
                                              │ Scheduled Cron /
                                              │ GitHub Actions Collector
                                              ▼
┌───────────────────────┐          ┌───────────────────────┐
│     Public Web UI     │          │ Autonomous Collector  │
│  (React 19 / Vite 7)  │          │  (Node.js / Parser)   │
└───────────┬───────────┘          └──────────┬────────────┘
            │ HTTPS API Calls                 │ Ingestion & Deduplication
            ▼                                 ▼
┌──────────────────────────────────────────────────────────┐
│             Express / Vercel Serverless API              │
│  - /api/dashboard/snapshot                               │
│  - /api/news & /api/explore                              │
│  - /api/sources & /api/sources/runs                      │
│  - /api/analyst/action & /api/analyst/record             │
│  - /api/enrich/domain & /api/enrich/ip                   │
│  - /api/ai/brief & /api/ai/remediate                     │
│  - /api/reports/daily & /api/reports/export              │
└────────────────────────────┬─────────────────────────────┘
                             │
                             │ Parameterized SQL Pool
                             ▼
┌──────────────────────────────────────────────────────────┐
│         Authoritative PostgreSQL Database (Supabase)     │
│  - intel_articles        - source_health                 │
│  - intel_sources         - collection_runs               │
│  - collection_results    - threat_alerts                 │
│  - analyst_records       - analyst_actions               │
│  - ai_briefs             - system_state                  │
└──────────────────────────────────────────────────────────┘
```

## 2. Core Architectural Principles

1. **PostgreSQL as Single Source of Truth**:
   - The runtime application eliminates all dependency on writable filesystem JSON files (`news.json`, `threats.json`, `feed_health.json`, `analyst_actions.json`).
   - All serverless lambdas share identical transactional state backed by PostgreSQL connection pooling.

2. **Decoupled Autonomous Collection**:
   - Long-running multi-feed crawling occurs asynchronously via dedicated background workers or scheduled GitHub Actions, never blocking user request cycles.
   - Collector records collection telemetry (`collection_runs`) including latency, HTTP status, and parsing yields.

3. **Truthful Telemetry Pipeline**:
   - Platform operational state is dynamically evaluated from measured timestamps and active counts (`LIVE`, `DEGRADED`, `STALE`, `NO_DATA`, `COLLECTION_FAILURE`).
   - If 0 records exist in a reporting window, the system displays an honest empty state rather than inventing threat disclosures or claiming 100% health.

4. **Strict Authorization & Least Privilege**:
   - Guest users operate strictly in read-only mode across analyst triage, notes, incident dismissals, and webhook testing.
   - API keys and database credentials remain exclusively on the server, never exposed in frontend bundles.

## 3. Runtime Data Flows

### Ingestion Flow
1. Collector reads enabled sources from `intel_sources`.
2. Fetches upstream feeds with timeout and error capture.
3. Computes SHA-256 fingerprint from title + canonical link.
4. Validates publication timestamps (tags future dates with `dateAnomaly: true`).
5. Persists new records to `intel_articles` table.
6. Records execution metrics in `collection_runs` and updates `source_health`.

### Dashboard Snapshot Flow
1. Client requests `/api/dashboard/snapshot?time={24h|7d|30d|all}`.
2. Server queries PostgreSQL for article counts, severity distributions, and active tactics.
3. Evaluates source health totals (`healthy`, `degraded`, `failed`, `stale`, `disabled`, `unknown`).
4. Computes truthful pipeline status:
   - `LIVE`: Ingestion succeeded within SLA and active intel exists.
   - `DEGRADED`: Some feeds are failing but collection remains operational.
   - `STALE`: No successful collection within 6 hours.
   - `NO_DATA`: Pipeline operational but 0 articles in selected reporting window.
   - `COLLECTION_FAILURE`: Most recent run aborted or failed.
5. Returns consolidated JSON payload with browser cache headers.

### Analyst Workflow Flow
1. Analyst inspects report in `ReportDetailPanel`.
2. Client queries `/api/analyst/record/:id` to load persistent triage state from PostgreSQL.
3. When updating status or adding notes, client sends mutation with `Authorization: Bearer <session-token>`.
4. Server validates credentials; if absent (Guest), returns HTTP 403 `GUEST_READ_ONLY`.
5. If authenticated, records immutable audit log in `analyst_actions` and updates `analyst_records`.
