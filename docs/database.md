# Database Architecture & Migration Specification — NO ENTRY Threat Intelligence Platform

**Project:** NO ENTRY — Threat Intelligence Platform / SOC-AI  
**Database:** PostgreSQL 15+ (Authoritative runtime data store via Supabase Transaction / Session Pooler)  
**Schema Version:** 003 (Authoritative Enterprise Runtime Schema)  
**Status:** Approved & Implemented  

---

## 1. Architectural Role of PostgreSQL

In previous iterations, the application suffered from a fragmented split-brain architecture where scheduled ingestion collectors wrote to PostgreSQL, while Vercel serverless API instances attempted to read or mutate ephemeral local JSON files (`news.json`, `feed_health.json`, `analyst_actions.json`).

Under the repaired enterprise architecture, **PostgreSQL is the single authoritative source of truth** for all platform runtime state:
- Intelligence articles & CVE advisories
- Feeds, sources registry, and measured operational health
- Periodic batch collection execution runs and audit logs
- Analyst incident triage, investigation notes, and status assignments
- Indicator of Compromise (IOC) extractions
- Synthesized AI briefings and executive digests
- System telemetry and ingestion pipeline heartbeats

---

## 2. Strict Date & Timestamp Semantics

To prevent date anomalies, false freshness metrics, and timezone skews:
1. `published_at` (TIMESTAMPTZ, Nullable):
   Represents the official publication timestamp asserted by the original threat report publisher. If missing or unparseable, this field remains `NULL`. Under no circumstances is `Date.now()` substituted.
2. `ingested_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()):
   Represents the exact UTC timestamp when the SOC ingestion collector retrieved, parsed, and validated the article.
3. `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()):
   Represents the database row insertion timestamp.
4. `date_anomaly` (BOOLEAN, NOT NULL, DEFAULT FALSE):
   If `published_at` exceeds current UTC time by more than 24 hours, `date_anomaly` is set to `TRUE`. The query layer excludes anomalous future dates from rolling time filters (`24h`, `7d`, `30d`), ensuring dashboard metrics are never skewed.

---

## 3. Relational Schema & Tables

### A. `threats` (Aliased as `intel_articles`)
Primary repository for ingested threat reports and intelligence items.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Stable immutable article ID |
| `title` | TEXT | NOT NULL | Article headline or advisory title |
| `summary` | TEXT | NULL | Extracted or sanitized snippet (capped at 500 chars) |
| `content` | TEXT | NULL | Full text content where licensed, else null |
| `source_name` | VARCHAR(255) | NOT NULL | Canonical publisher or feed name |
| `source_url` | TEXT | NOT NULL, UNIQUE | Original source URL (deduplication key) |
| `canonical_url` | TEXT | NULL | Canonical link for required attribution |
| `category` | VARCHAR(100) | DEFAULT 'General' | Publisher category |
| `intel_category`| VARCHAR(100) | DEFAULT 'needs-classification' | Taxonomy category |
| `severity` | VARCHAR(50) | DEFAULT 'Medium' | Normalized severity (Critical, High, Medium, Low, Informational) |
| `risk_score` | INTEGER | DEFAULT 0 | Computed risk score (0-100) |
| `published_at` | TIMESTAMPTZ | NULL | Authoritative publisher date |
| `ingested_at` | TIMESTAMPTZ | DEFAULT NOW() | Ingestion timestamp |
| `date_anomaly` | BOOLEAN | DEFAULT FALSE | Flag for future or corrupt dates |
| `is_simulated` | BOOLEAN | DEFAULT FALSE | Segregates demo/mock data |
| `environment` | VARCHAR(50) | DEFAULT 'production' | Deployment environment tag |
| `metadata` | JSONB | DEFAULT '{}' | Provenance, tags, MITRE IDs |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update time |

**Indexes:**
- `idx_threats_published_at` ON `threats(published_at DESC)`
- `idx_threats_ingested_at` ON `threats(ingested_at DESC)`
- `idx_threats_severity` ON `threats(severity)`
- `idx_threats_category` ON `threats(category)`
- `idx_threats_intel_category` ON `threats(intel_category)`
- `idx_threats_canonical_url` ON `threats(canonical_url)`
- `idx_threats_env_simulated` ON `threats(environment, is_simulated)`

---

### B. `sources` & `source_health`
Maintains feed registry and measured operational health telemetry.

```sql
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    feed_url TEXT NOT NULL,
    canonical_url TEXT,
    website_url TEXT,
    category VARCHAR(100) DEFAULT 'General',
    language VARCHAR(10) DEFAULT 'en',
    publisher_domain VARCHAR(255),
    provenance VARCHAR(100) DEFAULT 'Curated',
    review_state VARCHAR(50) DEFAULT 'approved', -- approved, candidate, quarantined, retired
    enabled BOOLEAN DEFAULT TRUE,
    expected_interval_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_health (
    source_id VARCHAR(255) PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'unknown', -- unknown, healthy, degraded, failed, stale, disabled
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_http_status INTEGER,
    consecutive_failures INTEGER DEFAULT 0,
    average_latency_ms INTEGER,
    items_last_24h INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    latest_publication_at TIMESTAMPTZ,
    last_error TEXT,
    error_category VARCHAR(100),
    next_retry_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### C. `collection_runs`
Records batch collection execution performance and telemetry.

```sql
CREATE TABLE IF NOT EXISTS collection_runs (
    run_id VARCHAR(100) PRIMARY KEY,
    trigger VARCHAR(50) DEFAULT 'scheduled', -- scheduled, manual, webhook
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    state VARCHAR(50) NOT NULL DEFAULT 'running', -- running, completed, partial, failed
    sources_attempted INTEGER DEFAULT 0,
    sources_succeeded INTEGER DEFAULT 0,
    sources_failed INTEGER DEFAULT 0,
    sources_skipped INTEGER DEFAULT 0,
    http_304_count INTEGER DEFAULT 0,
    articles_parsed INTEGER DEFAULT 0,
    articles_accepted INTEGER DEFAULT 0,
    articles_rejected INTEGER DEFAULT 0,
    articles_deduplicated INTEGER DEFAULT 0,
    last_successful_fetch TIMESTAMPTZ,
    last_successful_article_write TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### D. `analyst_records` & `analyst_actions`
Stores analyst triage workflow states and immutable audit trails.

```sql
CREATE TABLE IF NOT EXISTS analyst_records (
    record_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'New', -- New, Under Review, Escalated, Resolved, Dismissed
    assignee VARCHAR(100),
    notes TEXT,
    dismissed_reason TEXT,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyst_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- STATUS_CHANGE, NOTE_ADDED, INCIDENT_ASSIGNED, RECORD_DISMISSED
    previous_state JSONB,
    new_state JSONB,
    performed_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### E. `ai_briefs`
Caches LLM and extractive executive briefings.

```sql
CREATE TABLE IF NOT EXISTS ai_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporting_window VARCHAR(20) NOT NULL, -- 24h, 7d, 30d, all
    headline TEXT NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    source_count INTEGER DEFAULT 0,
    generation_method VARCHAR(50) DEFAULT 'extractive', -- llm, extractive
    model VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Connection Pooling & Serverless Optimization

### Supabase Connection Configuration:
In a serverless environment (such as Vercel Edge/Serverless functions), creating ad-hoc direct database connections can quickly exhaust connection limits.
1. **Connection URL:**
   `postgresql://[USER]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`
   Using port `6543` routes traffic through the Supabase Supavisor transaction pooler.
2. **Client Pool Configuration (`server/db/db.js`):**
   ```javascript
   pool = new Pool({
       connectionString: DATABASE_URL,
       ssl: { rejectUnauthorized: false },
       max: 10,
       idleTimeoutMillis: 30000,
       connectionTimeoutMillis: 5000,
   });
   ```
3. **Graceful Disconnected Mode:**
   If no PostgreSQL environment variables are configured (e.g. during standalone testing or offline local development), `server/db/db.js` gracefully logs a warning and falls back to memory reads rather than crashing the HTTP server.

---

## 5. Migration Execution & Rollback Strategy

- **Migration Location:** `server/db/migrations/003_authoritative_runtime_schema.sql`
- **Execution:** Auto-applied during server boot via `runMigrations()` in `server/db/db.js`.
- **Idempotency:** All statements use `IF NOT EXISTS`, safe indexes, and `ON CONFLICT` clauses, ensuring zero data loss upon repeated deployments.
- **Rollback Considerations:**
  If a rollback is required, existing tables preserve `source_url` constraints. Schema rollbacks should drop views before modifying base column types.
