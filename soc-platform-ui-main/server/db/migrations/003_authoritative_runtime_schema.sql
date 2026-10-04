-- ==============================================================================
-- MIGRATION 003: Authoritative PostgreSQL Runtime Schema for NO ENTRY / SOC-AI
-- Ensures PostgreSQL is the single source of truth across all serverless instances
-- ==============================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Enhance or Create threats table
CREATE TABLE IF NOT EXISTS threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source_name VARCHAR(150) NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    canonical_url TEXT,
    category VARCHAR(50) DEFAULT 'General',
    intel_category VARCHAR(50) DEFAULT 'needs-classification',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) DEFAULT 'Medium',
    risk_score INT DEFAULT 0,
    published_at TIMESTAMPTZ, -- Nullable! Never fabricate Date.now() when publisher date is missing
    ingested_at TIMESTAMPTZ DEFAULT NOW(), -- Exact collection timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(), -- Database row insertion timestamp
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_anomaly BOOLEAN DEFAULT FALSE,
    is_simulated BOOLEAN DEFAULT FALSE,
    environment VARCHAR(20) DEFAULT 'production',
    raw_metadata JSONB DEFAULT '{}'
);

-- Ensure columns exist if table was previously created with older schema
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'canonical_url') THEN
        ALTER TABLE threats ADD COLUMN canonical_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'intel_category') THEN
        ALTER TABLE threats ADD COLUMN intel_category VARCHAR(50) DEFAULT 'needs-classification';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'ingested_at') THEN
        ALTER TABLE threats ADD COLUMN ingested_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'date_anomaly') THEN
        ALTER TABLE threats ADD COLUMN date_anomaly BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'is_simulated') THEN
        ALTER TABLE threats ADD COLUMN is_simulated BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'environment') THEN
        ALTER TABLE threats ADD COLUMN environment VARCHAR(20) DEFAULT 'production';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'threats' AND column_name = 'raw_metadata') THEN
        ALTER TABLE threats ADD COLUMN raw_metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_published ON threats(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_ingested ON threats(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_category ON threats(category);
CREATE INDEX IF NOT EXISTS idx_threats_intel_category ON threats(intel_category);
CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source_name);
CREATE INDEX IF NOT EXISTS idx_threats_canonical ON threats(canonical_url);
CREATE INDEX IF NOT EXISTS idx_threats_created ON threats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_simulated ON threats(is_simulated);

-- 3. Sources Registry Table
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(150) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    url TEXT UNIQUE NOT NULL,
    feed_url TEXT,
    canonical_url TEXT,
    category VARCHAR(50) DEFAULT 'General',
    source_type VARCHAR(50) DEFAULT 'Feed',
    publisher_domain VARCHAR(150),
    provenance VARCHAR(100) DEFAULT 'Publisher RSS/API',
    expected_interval_minutes INT DEFAULT 60,
    enabled BOOLEAN DEFAULT TRUE,
    review_state VARCHAR(30) DEFAULT 'approved',
    permission_outcome VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);
CREATE INDEX IF NOT EXISTS idx_sources_review_state ON sources(review_state);
CREATE INDEX IF NOT EXISTS idx_sources_category ON sources(category);

-- 4. Source Measured Health Table
CREATE TABLE IF NOT EXISTS source_health (
    source_id VARCHAR(150) PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('unknown', 'healthy', 'degraded', 'failed', 'stale', 'disabled')) DEFAULT 'unknown',
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_http_status INT,
    consecutive_failures INT DEFAULT 0,
    consecutive_successes INT DEFAULT 0,
    items_last_24h INT DEFAULT 0,
    items_total INT DEFAULT 0,
    average_latency_ms INT,
    latest_publication_at TIMESTAMPTZ,
    last_error TEXT,
    error_category VARCHAR(50),
    next_retry_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_health_status ON source_health(status);
CREATE INDEX IF NOT EXISTS idx_source_health_last_success ON source_health(last_success_at DESC);

-- 5. Collection Runs Telemetry Table
CREATE TABLE IF NOT EXISTS collection_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(100) UNIQUE NOT NULL,
    trigger VARCHAR(30) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    state VARCHAR(30) CHECK (state IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',
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

CREATE INDEX IF NOT EXISTS idx_collection_runs_started ON collection_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_runs_state ON collection_runs(state);

-- 6. Analyst Records & Workflow Persistence
CREATE TABLE IF NOT EXISTS analyst_records (
    record_id VARCHAR(200) PRIMARY KEY,
    status VARCHAR(30) CHECK (status IN ('new', 'reviewing', 'action_required', 'closed')) DEFAULT 'new',
    notes TEXT DEFAULT '',
    assignee VARCHAR(150),
    dismissed_reason TEXT,
    created_by VARCHAR(150) DEFAULT 'system',
    updated_by VARCHAR(150) DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_records_status ON analyst_records(status);
CREATE INDEX IF NOT EXISTS idx_analyst_records_updated ON analyst_records(updated_at DESC);

-- 7. Analyst Action Audit History
CREATE TABLE IF NOT EXISTS analyst_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id VARCHAR(200) NOT NULL REFERENCES analyst_records(record_id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    analyst_id VARCHAR(150) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_actions_record ON analyst_actions(record_id);
CREATE INDEX IF NOT EXISTS idx_analyst_actions_created ON analyst_actions(created_at DESC);

-- 8. AI Briefings Cache
CREATE TABLE IF NOT EXISTS ai_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_range VARCHAR(20) NOT NULL, -- '24h', '7d', '30d', 'all'
    headline TEXT NOT NULL,
    content TEXT NOT NULL,
    sources_count INT DEFAULT 0,
    source_links JSONB DEFAULT '[]',
    generation_method VARCHAR(50) DEFAULT 'rule-based',
    is_ai_generated BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_range_generated ON ai_briefs(time_range, generated_at DESC);

-- 9. System Operational State
CREATE TABLE IF NOT EXISTS system_state (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Canonical Compatibility Views
DROP VIEW IF EXISTS intel_articles CASCADE;
CREATE OR REPLACE VIEW intel_articles AS 
    SELECT 
        id, title, summary, content, source_name, source_url, canonical_url,
        category, intel_category, severity, risk_score, published_at, ingested_at,
        created_at, updated_at, date_anomaly, is_simulated, environment
    FROM threats;

DROP VIEW IF EXISTS intel_sources CASCADE;
CREATE OR REPLACE VIEW intel_sources AS 
    SELECT 
        s.*,
        sh.status as health_status,
        sh.last_attempt_at,
        sh.last_success_at,
        sh.last_http_status,
        sh.consecutive_failures,
        sh.items_last_24h,
        sh.items_total,
        sh.average_latency_ms,
        sh.latest_publication_at,
        sh.last_error,
        sh.error_category
    FROM sources s
    LEFT JOIN source_health sh ON s.id = sh.source_id;

-- 11. Row-Level Security (RLS) Policies
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public read on threats" ON threats;
    DROP POLICY IF EXISTS "Public read on sources" ON sources;
    DROP POLICY IF EXISTS "Public read on source_health" ON source_health;
    DROP POLICY IF EXISTS "Public read on collection_runs" ON collection_runs;
    DROP POLICY IF EXISTS "Public read on analyst_records" ON analyst_records;
    DROP POLICY IF EXISTS "Public read on analyst_actions" ON analyst_actions;
    DROP POLICY IF EXISTS "Public read on ai_briefs" ON ai_briefs;
    DROP POLICY IF EXISTS "Public read on system_state" ON system_state;

    DROP POLICY IF EXISTS "Backend full on threats" ON threats;
    DROP POLICY IF EXISTS "Backend full on sources" ON sources;
    DROP POLICY IF EXISTS "Backend full on source_health" ON source_health;
    DROP POLICY IF EXISTS "Backend full on collection_runs" ON collection_runs;
    DROP POLICY IF EXISTS "Backend full on analyst_records" ON analyst_records;
    DROP POLICY IF EXISTS "Backend full on analyst_actions" ON analyst_actions;
    DROP POLICY IF EXISTS "Backend full on ai_briefs" ON ai_briefs;
    DROP POLICY IF EXISTS "Backend full on system_state" ON system_state;
END $$;

DROP POLICY IF EXISTS "Public read on threats" ON threats;
CREATE POLICY "Public read on threats" ON threats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on sources" ON sources;
CREATE POLICY "Public read on sources" ON sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on source_health" ON source_health;
CREATE POLICY "Public read on source_health" ON source_health FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on collection_runs" ON collection_runs;
CREATE POLICY "Public read on collection_runs" ON collection_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on analyst_records" ON analyst_records;
CREATE POLICY "Public read on analyst_records" ON analyst_records FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on analyst_actions" ON analyst_actions;
CREATE POLICY "Public read on analyst_actions" ON analyst_actions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on ai_briefs" ON ai_briefs;
CREATE POLICY "Public read on ai_briefs" ON ai_briefs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read on system_state" ON system_state;
CREATE POLICY "Public read on system_state" ON system_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Backend full on threats" ON threats;
CREATE POLICY "Backend full on threats" ON threats FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on sources" ON sources;
CREATE POLICY "Backend full on sources" ON sources FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on source_health" ON source_health;
CREATE POLICY "Backend full on source_health" ON source_health FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on collection_runs" ON collection_runs;
CREATE POLICY "Backend full on collection_runs" ON collection_runs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on analyst_records" ON analyst_records;
CREATE POLICY "Backend full on analyst_records" ON analyst_records FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on analyst_actions" ON analyst_actions;
CREATE POLICY "Backend full on analyst_actions" ON analyst_actions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on ai_briefs" ON ai_briefs;
CREATE POLICY "Backend full on ai_briefs" ON ai_briefs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Backend full on system_state" ON system_state;
CREATE POLICY "Backend full on system_state" ON system_state FOR ALL USING (true) WITH CHECK (true);
