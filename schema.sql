-- ==============================================================================
-- NO ENTRY — Threat Intelligence Platform Authoritative Schema (PostgreSQL / Supabase / Neon)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. THREATS TABLE (Authoritative Ingested Threat Intelligence)
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
    published_at TIMESTAMPTZ, -- Nullable: null if missing/invalid, never fake Date.now()
    ingested_at TIMESTAMPTZ DEFAULT NOW(), -- Exact collection timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(), -- Database row creation
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_anomaly BOOLEAN DEFAULT FALSE,
    is_simulated BOOLEAN DEFAULT FALSE,
    environment VARCHAR(20) DEFAULT 'production',
    raw_metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_published ON threats(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_ingested ON threats(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_category ON threats(category);
CREATE INDEX IF NOT EXISTS idx_threats_intel_category ON threats(intel_category);
CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source_name);
CREATE INDEX IF NOT EXISTS idx_threats_canonical ON threats(canonical_url);
CREATE INDEX IF NOT EXISTS idx_threats_created ON threats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_simulated ON threats(is_simulated);
CREATE INDEX IF NOT EXISTS idx_threats_title_trgm ON threats USING gin (title gin_trgm_ops);

-- 2. EXTRACTED INDICATORS OF COMPROMISE (IOCs)
CREATE TABLE IF NOT EXISTS iocs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    type VARCHAR(20) CHECK (type IN ('IPv4', 'Domain', 'CVE', 'SHA256', 'MD5', 'URL')),
    value TEXT NOT NULL,
    reputation_score INT DEFAULT NULL,
    is_malicious BOOLEAN DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(threat_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_iocs_value ON iocs(value);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(type);
CREATE INDEX IF NOT EXISTS idx_iocs_threat_id ON iocs(threat_id);

-- 3. MITRE ATT&CK MAPPING TABLE
CREATE TABLE IF NOT EXISTS threat_mitre_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    tactic_id VARCHAR(20) NOT NULL,
    tactic_name VARCHAR(100) NOT NULL,
    technique_id VARCHAR(20) NOT NULL,
    technique_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(threat_id, tactic_id, technique_id)
);

CREATE INDEX IF NOT EXISTS idx_mitre_tactic ON threat_mitre_mapping(tactic_id);
CREATE INDEX IF NOT EXISTS idx_mitre_technique ON threat_mitre_mapping(technique_id);

-- 4. SOURCES REGISTRY TABLE
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

-- 5. SOURCE MEASURED HEALTH TABLE
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

-- 6. COLLECTION RUNS TELEMETRY TABLE
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

-- 7. ANALYST WORKFLOW RECORDS & ACTIONS
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

-- 8. AI BRIEFS TABLE
CREATE TABLE IF NOT EXISTS ai_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_range VARCHAR(20) NOT NULL,
    headline TEXT NOT NULL,
    content TEXT NOT NULL,
    sources_count INT DEFAULT 0,
    source_links JSONB DEFAULT '[]',
    generation_method VARCHAR(50) DEFAULT 'rule-based',
    is_ai_generated BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_range ON ai_briefs(time_range, generated_at DESC);

-- 9. SYSTEM STATE
CREATE TABLE IF NOT EXISTS system_state (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. COMPATIBILITY VIEWS
CREATE OR REPLACE VIEW intel_articles AS SELECT * FROM threats;

CREATE OR REPLACE VIEW intel_sources AS 
    SELECT s.*, sh.status as health_status, sh.last_attempt_at, sh.last_success_at,
           sh.last_http_status, sh.consecutive_failures, sh.items_last_24h,
           sh.items_total, sh.average_latency_ms, sh.latest_publication_at,
           sh.last_error, sh.error_category
    FROM sources s
    LEFT JOIN source_health sh ON s.id = sh.source_id;

CREATE OR REPLACE VIEW v_severity_stats AS
    SELECT severity AS name, COUNT(*)::int AS count
    FROM threats
    WHERE is_simulated = false
    GROUP BY severity;

CREATE OR REPLACE VIEW v_category_stats AS
    SELECT category AS name, COUNT(*)::int AS count
    FROM threats
    WHERE is_simulated = false
    GROUP BY category;

-- 11. RLS POLICIES
ALTER TABLE threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE iocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_mitre_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on threats" ON threats FOR SELECT USING (true);
CREATE POLICY "Public read on iocs" ON iocs FOR SELECT USING (true);
CREATE POLICY "Public read on threat_mitre_mapping" ON threat_mitre_mapping FOR SELECT USING (true);
CREATE POLICY "Public read on sources" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read on source_health" ON source_health FOR SELECT USING (true);
CREATE POLICY "Public read on collection_runs" ON collection_runs FOR SELECT USING (true);
CREATE POLICY "Public read on analyst_records" ON analyst_records FOR SELECT USING (true);
CREATE POLICY "Public read on analyst_actions" ON analyst_actions FOR SELECT USING (true);
CREATE POLICY "Public read on ai_briefs" ON ai_briefs FOR SELECT USING (true);
CREATE POLICY "Public read on system_state" ON system_state FOR SELECT USING (true);

CREATE POLICY "Backend full on threats" ON threats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on iocs" ON iocs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on threat_mitre_mapping" ON threat_mitre_mapping FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on sources" ON sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on source_health" ON source_health FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on collection_runs" ON collection_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on analyst_records" ON analyst_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on analyst_actions" ON analyst_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on ai_briefs" ON ai_briefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on system_state" ON system_state FOR ALL USING (true) WITH CHECK (true);
