-- ==============================================================================
-- MIGRATION 003: Authoritative PostgreSQL Single Source of Truth
-- Creates comprehensive relational schema for:
--  1. intel_sources & canonical permission contract
--  2. source_health (measured telemetry: unknown, healthy, degraded, failed, stale, disabled)
--  3. intel_articles & IOC relationships with stable IDs and date validation
--  4. collection_runs & collection_results
--  5. analyst_records & analyst_actions (audit history)
--  6. threat_alerts & incident_clusters
--  7. ai_briefs & system_state
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── 1. INTEL SOURCES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intel_sources (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    url TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    source_type VARCHAR(50) DEFAULT 'Feed',
    provenance VARCHAR(100) DEFAULT 'Publisher RSS/API',
    expected_interval_minutes INT DEFAULT 60,
    is_enabled BOOLEAN DEFAULT TRUE,
    permission_outcome VARCHAR(40) CHECK (permission_outcome IN ('permitted_for_intended_use', 'restricted', 'denied', 'pending')) DEFAULT 'pending',
    rules JSONB DEFAULT '{
        "fetchingPermitted": true,
        "cachingPermitted": true,
        "storingPermitted": true,
        "summarizingPermitted": true,
        "aiProcessingPermitted": true,
        "displayingPermitted": true,
        "exportingPermitted": false,
        "commercialUsePermitted": false
    }'::jsonb,
    requirements JSONB DEFAULT '{
        "attributionRequired": true,
        "originalLinkRequired": true,
        "retentionDaysLimit": 90,
        "rateLimitPerMinute": 30,
        "maxSummaryLength": 500
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intel_sources_enabled ON intel_sources(is_enabled);
CREATE INDEX IF NOT EXISTS idx_intel_sources_category ON intel_sources(category);
CREATE INDEX IF NOT EXISTS idx_intel_sources_perm ON intel_sources(permission_outcome);

-- ── 2. SOURCE HEALTH (Real measured telemetry) ───────────────────────────────
CREATE TABLE IF NOT EXISTS source_health (
    source_id VARCHAR(100) PRIMARY KEY REFERENCES intel_sources(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('unknown', 'healthy', 'degraded', 'failed', 'stale', 'disabled')) DEFAULT 'unknown',
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_http_status INT,
    consecutive_failures INT DEFAULT 0,
    consecutive_successes INT DEFAULT 0,
    average_latency_ms INT DEFAULT 0,
    items_last_24h INT DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_health_status ON source_health(status);
CREATE INDEX IF NOT EXISTS idx_source_health_success ON source_health(last_success_at);

-- ── 3. INTEL ARTICLES (Authoritative Intelligence Store) ─────────────────────
CREATE TABLE IF NOT EXISTS intel_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source_id VARCHAR(100) REFERENCES intel_sources(id) ON DELETE SET NULL,
    source_name VARCHAR(150) NOT NULL,
    source_url TEXT,
    canonical_url TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    source_category VARCHAR(50),
    intel_category VARCHAR(50) DEFAULT 'needs-classification',
    secondary_topics TEXT[] DEFAULT '{}',
    content_type VARCHAR(50) DEFAULT 'unknown',
    evidence_status VARCHAR(30) CHECK (evidence_status IN ('verified', 'unverified-claim', 'advisory', 'unassessed', 'insufficient-evidence')) DEFAULT 'unassessed',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) DEFAULT 'Informational',
    published_at TIMESTAMPTZ, -- Nullable if publisher timestamp is missing
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_anomaly BOOLEAN DEFAULT FALSE,
    classification_method VARCHAR(50) DEFAULT 'rule-based',
    classification_confidence INT DEFAULT 70,
    classification_reason TEXT,
    taxonomy_version VARCHAR(20) DEFAULT 'v1.0',
    is_simulated BOOLEAN DEFAULT FALSE,
    environment VARCHAR(20) DEFAULT 'production',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON intel_articles(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON intel_articles(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_severity ON intel_articles(severity);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON intel_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_intel_category ON intel_articles(intel_category);
CREATE INDEX IF NOT EXISTS idx_articles_simulated ON intel_articles(is_simulated, environment);
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON intel_articles USING gin (title gin_trgm_ops);

-- Backward-compatibility: Sync existing threats table or view if threats exists
CREATE TABLE IF NOT EXISTS threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source_name VARCHAR(100) NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) DEFAULT 'Medium',
    risk_score INT DEFAULT 0,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. EXTRACTED IOCS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iocs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES intel_articles(id) ON DELETE CASCADE,
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('IPv4', 'Domain', 'CVE', 'SHA256', 'MD5', 'URL')),
    value TEXT NOT NULL,
    reputation_score INT DEFAULT NULL,
    is_malicious BOOLEAN DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iocs_val ON iocs(value);
CREATE INDEX IF NOT EXISTS idx_iocs_t ON iocs(type);
CREATE INDEX IF NOT EXISTS idx_iocs_art ON iocs(article_id);

-- ── 5. MITRE ATT&CK MAPPINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_mitre_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES intel_articles(id) ON DELETE CASCADE,
    tactic_id VARCHAR(20) NOT NULL,
    tactic_name VARCHAR(100) NOT NULL,
    technique_id VARCHAR(20) NOT NULL,
    technique_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, tactic_id, technique_id)
);

CREATE INDEX IF NOT EXISTS idx_art_mitre_tactic ON article_mitre_mapping(tactic_id);
CREATE INDEX IF NOT EXISTS idx_art_mitre_technique ON article_mitre_mapping(technique_id);

-- ── 6. COLLECTION RUNS & DETAILED RESULTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'cli'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    state VARCHAR(30) CHECK (state IN ('running', 'success', 'degraded', 'failed', 'cancelled')) NOT NULL DEFAULT 'running',
    sources_attempted INT DEFAULT 0,
    sources_succeeded INT DEFAULT 0,
    sources_failed INT DEFAULT 0,
    sources_skipped INT DEFAULT 0,
    http_304_count INT DEFAULT 0,
    articles_parsed INT DEFAULT 0,
    articles_accepted INT DEFAULT 0,
    articles_rejected INT DEFAULT 0,
    articles_deduplicated INT DEFAULT 0,
    last_successful_fetch TIMESTAMPTZ,
    last_successful_article_write TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_state ON collection_runs(state);
CREATE INDEX IF NOT EXISTS idx_collection_runs_started ON collection_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS collection_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES collection_runs(run_id) ON DELETE CASCADE,
    source_id VARCHAR(100) REFERENCES intel_sources(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'skipped', 'not_modified'
    http_status INT,
    latency_ms INT,
    articles_found INT DEFAULT 0,
    articles_ingested INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_results_run ON collection_results(run_id);
CREATE INDEX IF NOT EXISTS idx_collection_results_source ON collection_results(source_id);

-- ── 7. ANALYST WORKFLOW & AUDIT ACTIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyst_records (
    record_id VARCHAR(100) PRIMARY KEY,
    status VARCHAR(30) CHECK (status IN ('new', 'investigating', 'escalated', 'closed')) DEFAULT 'new',
    notes TEXT DEFAULT '',
    assignee VARCHAR(100),
    dismissed_reason TEXT,
    created_by VARCHAR(100) DEFAULT 'analyst-1',
    updated_by VARCHAR(100) DEFAULT 'analyst-1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyst_actions (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id VARCHAR(100) REFERENCES analyst_records(record_id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    analyst_id VARCHAR(100) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_actions_record ON analyst_actions(record_id);
CREATE INDEX IF NOT EXISTS idx_analyst_actions_created ON analyst_actions(created_at DESC);

-- ── 8. THREAT ALERTS (SIEM & Detection Ingestion) ────────────────────────────
CREATE TABLE IF NOT EXISTS threat_alerts (
    id VARCHAR(100) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) NOT NULL,
    source VARCHAR(100) NOT NULL,
    description TEXT,
    ioc JSONB DEFAULT '{}'::jsonb,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    is_simulated BOOLEAN DEFAULT FALSE,
    environment VARCHAR(20) DEFAULT 'production',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_alerts_sev ON threat_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_time ON threat_alerts(last_seen DESC);

-- ── 9. AI BRIEFS (Scheduled Precomputation & Controlled Cache) ───────────────
CREATE TABLE IF NOT EXISTS ai_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_range VARCHAR(20) NOT NULL DEFAULT '24h',
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_threats JSONB DEFAULT '[]'::jsonb,
    critical_vulnerabilities JSONB DEFAULT '[]'::jsonb,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    sources_count INT DEFAULT 0,
    sources_used JSONB DEFAULT '[]'::jsonb,
    generation_method VARCHAR(50) DEFAULT 'rule-based',
    is_ai_generated BOOLEAN DEFAULT TRUE,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_range_time ON ai_briefs(time_range, generated_at DESC);

-- ── 10. SYSTEM STATE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_state (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
