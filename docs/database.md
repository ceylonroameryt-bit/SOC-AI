# Database Architecture & Schema Specification

## 1. Overview

The NO ENTRY platform relies on PostgreSQL (hosted via Supabase or standard PostgreSQL instance) as the single authoritative persistence engine.

All queries use parameterized statements (`$1, $2, ...`) through `server/db/db.js` to ensure SQL injection protection.

## 2. Entity Relational Model

```
                    ┌───────────────────────────┐
                    │       intel_sources       │
                    │  PK: id                   │
                    │  UK: url                  │
                    └─────────────┬─────────────┘
                                  │ 1:1
                                  ▼
┌─────────────────────────┐ ┌───────────────────────────┐
│     collection_runs     │ │       source_health       │
│  PK: run_id             │ │  PK: source_id (FK)       │
└───────────┬─────────────┘ └───────────────────────────┘
            │ 1:N
            ▼
┌─────────────────────────┐ ┌───────────────────────────┐
│   collection_results    │ │      intel_articles       │
│  PK: id                 │ │  PK: id                   │
│  FK: run_id, source_id  │ │  UK: canonical_url        │
└─────────────────────────┘ └─────────────┬─────────────┘
                                          │ 1:N
                                          ▼
                            ┌───────────────────────────┐
                            │  article_mitre_mapping    │
                            │  PK: id                   │
                            │  FK: article_id           │
                            └───────────────────────────┘
```

## 3. Schema Definitions

### `intel_sources`
Tracks configured intelligence collection nodes and their content usage rules.
```sql
CREATE TABLE IF NOT EXISTS intel_sources (
    id VARCHAR(120) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'rss',
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    description TEXT,
    expected_interval_minutes INT NOT NULL DEFAULT 60,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    permission_outcome VARCHAR(40) CHECK (permission_outcome IN ('permitted_for_intended_use', 'restricted', 'denied', 'pending')) DEFAULT 'pending',
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `source_health`
Maintains measured operational metrics for each source.
```sql
CREATE TABLE IF NOT EXISTS source_health (
    source_id VARCHAR(120) PRIMARY KEY REFERENCES intel_sources(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'healthy', 'degraded', 'failed', 'stale', 'disabled')),
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_http_status INT,
    consecutive_failures INT NOT NULL DEFAULT 0,
    consecutive_successes INT NOT NULL DEFAULT 0,
    average_latency_ms INT NOT NULL DEFAULT 0,
    items_last_24h INT NOT NULL DEFAULT 0,
    last_error TEXT,
    error_category VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `intel_articles`
Authoritative store of collected threat intelligence disclosures.
```sql
CREATE TABLE IF NOT EXISTS intel_articles (
    id VARCHAR(120) PRIMARY KEY,
    canonical_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    source_id VARCHAR(120),
    source_name VARCHAR(255) NOT NULL,
    intel_category VARCHAR(100) NOT NULL DEFAULT 'General Info',
    source_category VARCHAR(100),
    severity VARCHAR(30) NOT NULL DEFAULT 'Low' CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')),
    published_at TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_anomaly BOOLEAN NOT NULL DEFAULT false,
    content_snippet TEXT,
    full_content TEXT,
    classification_method VARCHAR(50) DEFAULT 'rule-based',
    classification_confidence NUMERIC(4,3),
    evidence_status VARCHAR(50) DEFAULT 'unassessed',
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    environment VARCHAR(30) NOT NULL DEFAULT 'production'
);
```

### `collection_runs`
Execution history and throughput audits for background collectors.
```sql
CREATE TABLE IF NOT EXISTS collection_runs (
    run_id VARCHAR(120) PRIMARY KEY,
    trigger VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    state VARCHAR(30) NOT NULL CHECK (state IN ('running', 'completed', 'failed', 'partial')),
    sources_attempted INT NOT NULL DEFAULT 0,
    sources_succeeded INT NOT NULL DEFAULT 0,
    sources_failed INT NOT NULL DEFAULT 0,
    sources_skipped INT NOT NULL DEFAULT 0,
    http_304_count INT NOT NULL DEFAULT 0,
    articles_parsed INT NOT NULL DEFAULT 0,
    articles_accepted INT NOT NULL DEFAULT 0,
    articles_rejected INT NOT NULL DEFAULT 0,
    articles_deduplicated INT NOT NULL DEFAULT 0,
    last_successful_fetch TIMESTAMPTZ,
    last_successful_article_write TIMESTAMPTZ,
    error TEXT
);
```

### `analyst_records` & `analyst_actions`
Incident workflow states and immutable action history.
```sql
CREATE TABLE IF NOT EXISTS analyst_records (
    record_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(40) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'action_required', 'closed')),
    notes TEXT DEFAULT '',
    assignee VARCHAR(120),
    dismissed_reason TEXT,
    created_by VARCHAR(120) DEFAULT 'analyst-1',
    updated_by VARCHAR(120) DEFAULT 'analyst-1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyst_actions (
    id SERIAL PRIMARY KEY,
    record_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    value TEXT,
    comment TEXT,
    analyst_id VARCHAR(120) NOT NULL DEFAULT 'analyst-1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `ai_briefs`
Cached AI-generated executive briefings to prevent runaway LLM costs.
```sql
CREATE TABLE IF NOT EXISTS ai_briefs (
    id SERIAL PRIMARY KEY,
    time_range VARCHAR(20) NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    key_threats JSONB DEFAULT '[]'::jsonb,
    critical_vulnerabilities JSONB DEFAULT '[]'::jsonb,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    sources_count INT NOT NULL DEFAULT 0,
    sources_used JSONB DEFAULT '[]'::jsonb,
    generation_method VARCHAR(50) NOT NULL DEFAULT 'rule-based',
    is_ai_generated BOOLEAN NOT NULL DEFAULT false,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4. Key Database Indexes
- `idx_articles_pub_date`: `intel_articles(published_at DESC)`
- `idx_articles_severity`: `intel_articles(severity)`
- `idx_articles_cat`: `intel_articles(intel_category)`
- `idx_articles_ingested`: `intel_articles(ingested_at DESC)`
- `idx_articles_sim`: `intel_articles(is_simulated)`
- `idx_source_health_status`: `source_health(status)`
- `idx_runs_started`: `collection_runs(started_at DESC)`
- `idx_analyst_actions_rec`: `analyst_actions(record_id, created_at DESC)`
- `idx_ai_briefs_range`: `ai_briefs(time_range, generated_at DESC)`

## 5. Migration Execution
Migrations are version-controlled in `server/db/migrations/`:
- `001_initial_schema.sql`: Base relational tables
- `002_add_taxonomy_and_evidence.sql`: Classification taxonomy and evidence validation
- `003_authoritative_source_of_truth.sql`: Source permissions, measured health, collection runs, AI briefs

To execute migrations against production:
```bash
psql $DATABASE_URL -f server/db/migrations/003_authoritative_source_of_truth.sql
```
