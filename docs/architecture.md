# System Architecture Specification — NO ENTRY Threat Intelligence Platform / SOC-AI

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Production URL:** https://soc-ai-six.vercel.app/  
**Repository:** https://github.com/ceylonroameryt-bit/SOC-AI  
**Revision:** 2.0 (Post-Production Enterprise Repair)  
**Status:** Approved & Authoritative  

---

## 1. Architectural Overview & Design Principles

The NO ENTRY Threat Intelligence Platform is a multi-tier, cloud-native SOC monitoring and threat advisory engine. The platform ingests, categorizes, validates, enriches, and correlates open-source and proprietary threat intelligence streams across 500+ verified cybersecurity endpoints.

### Key Architectural Tenets:
1. **PostgreSQL as the Single Source of Truth:**
   Ephemeral serverless filesystem writes are completely prohibited. All runtime operational state—intelligence records, source health measurements, collection run execution logs, analyst triage decisions, and executive AI briefings—are persisted authoritatively in PostgreSQL (Supabase pooler).
2. **Technical Honesty & Measured State:**
   No fabricated health metrics, timestamps, synthetic "500/500 healthy" counters, or mock delivery successes exist. If no intelligence exists for a reporting period, an honest empty state is rendered.
3. **Decoupled Asynchronous Ingestion:**
   Feed collection is detached from interactive user requests. Long-running batch collections run via scheduled jobs / GitHub Actions / background collectors, writing directly to PostgreSQL. Public UI routes (`/api/news`, `/api/dashboard/snapshot`) perform high-speed, indexed reads from PostgreSQL with multi-tier caching (`stale-while-revalidate`).
4. **Strict Security Posture:**
   No server secrets (`DATABASE_URL`, `INGEST_API_KEY`, `OPENAI_API_KEY`) are ever leaked to client bundles. Guest access is strictly read-only; mutation endpoints require token authorization.

---

## 2. End-to-End Runtime Data Flow

```mermaid
graph TD
    subgraph External Sources & Services
        RSS[500+ Verified RSS/Atom/JSON Endpoints]
        CISA[CISA KEV Catalog API]
        VT[VirusTotal v3 API]
        ABUSE[AbuseIPDB API]
        OPENAI[OpenAI / LLM API]
    end

    subgraph Ingestion & Background Processing
        GHA[Scheduled Collector / GitHub Actions / Cron]
        COLL[server/collector.js Engine]
        VAL[Feed Validator & Health Tracker]
        RESTRICT[Permission & Scope Enforcer]
    end

    subgraph Authoritative Storage Tier
        DB[(PostgreSQL / Supabase)]
        T_THREATS[(threats / intel_articles)]
        T_HEALTH[(source_health)]
        T_RUNS[(collection_runs)]
        T_ANALYST[(analyst_records & actions)]
        T_BRIEFS[(ai_briefs)]
    end

    subgraph API & Application Gateway
        EXPRESS[Express 5 / Node Server / Vercel Serverless]
        AUTH[Auth & Timing-Safe Verification]
        RATE[Shared & Local Rate Limiters]
        API_NEWS[/api/news]
        API_SNAP[/api/dashboard/snapshot]
        API_SOURCES[/api/sources]
        API_ANALYST[/api/analyst]
        API_ENRICH[/api/enrich]
        API_AI[/api/ai]
    end

    subgraph Client Application (React 19 + Vite)
        UI_DASH[SOC Executive Dashboard]
        UI_INTEL[Intelligence Workspace & Stream]
        UI_RADAR[Critical Threats Radar]
        UI_ATTACK[MITRE ATT&CK Matrix]
        UI_SOURCES[Source Registry & Measured Health]
        UI_DRAWER[AI Assistant Control Drawer]
    end

    RSS --> COLL
    COLL --> VAL
    COLL --> RESTRICT
    VAL --> T_HEALTH
    RESTRICT --> T_THREATS
    COLL --> T_RUNS

    T_THREATS --> API_NEWS
    T_THREATS --> API_SNAP
    T_HEALTH --> API_SOURCES
    T_RUNS --> API_SOURCES
    T_ANALYST <--> API_ANALYST
    T_BRIEFS <--> API_AI

    CISA --> API_SNAP
    VT --> API_ENRICH
    ABUSE --> API_ENRICH
    OPENAI --> T_BRIEFS

    EXPRESS --> API_NEWS
    EXPRESS --> API_SNAP
    EXPRESS --> API_SOURCES
    EXPRESS --> API_ANALYST
    EXPRESS --> API_ENRICH
    EXPRESS --> API_AI

    API_NEWS --> UI_INTEL
    API_SNAP --> UI_DASH
    API_SNAP --> UI_RADAR
    API_SOURCES --> UI_SOURCES
    API_ANALYST --> UI_INTEL
    API_AI --> UI_DRAWER
```

---

## 3. Component Breakdown

### A. Ingestion Engine (`server/collector.js` & `server/services/feedHealthService.js`)
- **Execution Model:** Runs asynchronously via cron or CI scheduled runner.
- **Safety Checks:** Enforces timeout limits (10s), concurrency pools (max 5 simultaneous feeds), exponential retry backoff, and `Retry-After` header parsing.
- **Provenance & Licensing:** Calls `enforceContentRestrictions()` to truncate snippets to max 500 characters, inject mandatory canonical backlinks, and strip unpermitted images/logos.
- **Persistence:** Inserts validated items into `threats` table with `ON CONFLICT (source_url) DO UPDATE`, preserving stable UUIDs and updating `ingested_at` timestamps.

### B. Health Telemetry Engine (`server/services/feedHealthService.js`)
- **Measured Health States:**
  - `unknown`: Source has never completed an authentic successful network fetch (`lastSuccessAt === null`).
  - `healthy`: Last fetch succeeded and occurred within `expectedIntervalMinutes * 3`.
  - `degraded`: Consecutive failures exist (1–2), but source previously succeeded.
  - `failed`: Consecutive failures >= 3.
  - `stale`: Last success exceeds schedule threshold without recent runs.
  - `disabled`: Source is explicitly toggled inactive in registry.
- **Anti-Fabrication:** Identical bulk timestamps are banned; invalid historical states are scrubbed.

### C. Pipeline State Calculator (`server/routes/dashboard.js`)
The top-level operational status pill is computed from empirical pipeline telemetry:
- **LIVE:** Ingestion occurred within 24 hours AND at least one article exists in reporting window.
- **DEGRADED:** Collection completed with partial source errors or warnings.
- **STALE:** Last successful collection occurred > 24 hours ago.
- **NO DATA:** Collector is operational, but 0 articles match current reporting window.
- **COLLECTION FAILURE:** Last collection run failed completely.

### D. Time Window Synchronization (`24h` / `7d` / `30d` / `all`)
- Authoritative query parameter `?time=` is propagated uniformly across all endpoints:
  - `/api/news`
  - `/api/dashboard/snapshot`
  - `/api/categories`
  - `/api/mitre/heatmap`
  - `/api/ai/brief`
  - `/api/reports/download`
- All counts, severity distributions, and threat radars share identical date boundary predicates. Future-dated articles (`date_anomaly = true`) are segregated from rolling windows.

### E. AI Briefing Architecture (`server/routes/ai.js` & `server/services/aiService.js`)
- **Cost Protection:** Public requests never trigger ad-hoc LLM billable requests.
- **Caching:** Briefings are stored in `ai_briefs` table and served to users instantly.
- **Safe Extractive Fallback:** When LLM keys are absent, the system performs structured extractive summarization from authoritative ingested reports with full provenance backlinks.

### F. Security & Access Control (`server/utils/auth.js`)
- **Constant-Time Verification:** API keys are compared using `crypto.timingSafeEqual()`, completely preventing timing side-channel attacks.
- **Read-Only Guest Mode:** Guest analysts can browse telemetry, indicators, and MITRE maps, but cannot mutate analyst status, save server notes, or trigger webhooks.
- **Strict CORS:** Restricted to explicit origin (`ALLOWED_ORIGIN`), preventing unauthorized cross-origin scraping.
