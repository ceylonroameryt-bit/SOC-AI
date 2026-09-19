-- ==============================================================================
-- MIGRATION 002: Evidence, Telemetry Runs & Analyst Workflow Persistence
-- Safe, additive migration supporting:
-- 1. Source definitions & collection runs (real measured telemetry)
-- 2. Threat assessments & evidence tracking
-- 3. Analyst actions & audit logging (workflow status, notes, review)
-- 4. Organization watchlists & relevance matching
-- 5. Deduplication and Event grouping
-- ==============================================================================

-- 1. Sources Registry (provenance & schedule)
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    url TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    source_type VARCHAR(50) DEFAULT 'Feed',
    provenance VARCHAR(50) DEFAULT 'Publisher RSS/API',
    expected_interval_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_category ON sources(category);

-- 2. Collection Runs Telemetry (per-source execution evidence)
CREATE TABLE IF NOT EXISTS collection_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id VARCHAR(100) REFERENCES sources(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_ms INT NOT NULL,
    http_status INT,
    outcome VARCHAR(20) CHECK (outcome IN ('success', 'failure', 'partial', 'timeout')) NOT NULL,
    items_received INT DEFAULT 0,
    items_accepted INT DEFAULT 0,
    items_rejected INT DEFAULT 0,
    error_category VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_source ON collection_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_collection_runs_started ON collection_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_runs_outcome ON collection_runs(outcome);

-- 3. Threat Assessments & Evidence Tracking
-- Keeps severity, evidence assessment, and priority independently represented
CREATE TABLE IF NOT EXISTS threat_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    content_type VARCHAR(50) DEFAULT 'unknown',
    intel_category VARCHAR(50) DEFAULT 'needs-classification',
    secondary_topics TEXT[] DEFAULT '{}',
    evidence_status VARCHAR(30) CHECK (evidence_status IN ('verified', 'unverified-claim', 'advisory', 'unassessed', 'insufficient-evidence')) DEFAULT 'unassessed',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) DEFAULT 'Informational',
    priority VARCHAR(20) CHECK (priority IN ('P1 - Critical', 'P2 - High', 'P3 - Medium', 'P4 - Low', 'Informational', 'Unassessed')) DEFAULT 'Unassessed',
    priority_reason TEXT,
    why_it_matters TEXT,
    assessment_method VARCHAR(50) DEFAULT 'rule-based',
    confidence INT DEFAULT 70,
    mitre_techniques JSONB DEFAULT '[]',
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    analyst_id VARCHAR(100),
    analyst_notes TEXT,
    is_analyst_override BOOLEAN DEFAULT FALSE,
    taxonomy_version VARCHAR(20) DEFAULT 'v1.0'
);

CREATE INDEX IF NOT EXISTS idx_assessments_threat ON threat_assessments(threat_id);
CREATE INDEX IF NOT EXISTS idx_assessments_category ON threat_assessments(intel_category);
CREATE INDEX IF NOT EXISTS idx_assessments_priority ON threat_assessments(priority);

-- 4. Analyst Actions & Workflow State
CREATE TABLE IF NOT EXISTS analyst_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    action_type VARCHAR(30) CHECK (action_type IN ('status_change', 'note_added', 'assignee_changed', 'category_override', 'dismissed', 'report_added')) NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    analyst_id VARCHAR(100) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_actions_threat ON analyst_actions(threat_id);
CREATE INDEX IF NOT EXISTS idx_analyst_actions_created ON analyst_actions(created_at DESC);

-- 5. Organization Watchlists & Interests
CREATE TABLE IF NOT EXISTS organization_watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) DEFAULT 'default-org',
    interest_type VARCHAR(30) CHECK (interest_type IN ('technology', 'supplier', 'threat_actor', 'industry', 'region', 'keyword')) NOT NULL,
    term TEXT NOT NULL,
    notes TEXT,
    match_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, interest_type, term)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_org ON organization_watchlists(org_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_term ON organization_watchlists(term);

-- 6. Event Grouping & Multi-Source Synthesis
CREATE TABLE IF NOT EXISTS event_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_key VARCHAR(150) UNIQUE NOT NULL, -- e.g. cve-2024-3400 or normalized entity slug
    title TEXT NOT NULL,
    summary TEXT,
    primary_cve VARCHAR(50),
    actor_name VARCHAR(100),
    target_sector VARCHAR(100),
    report_count INT DEFAULT 1,
    first_reported_at TIMESTAMPTZ NOT NULL,
    last_reported_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_groups_cve ON event_groups(primary_cve);
CREATE INDEX IF NOT EXISTS idx_event_groups_updated ON event_groups(last_reported_at DESC);

-- Enable RLS
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on sources" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read on assessments" ON threat_assessments FOR SELECT USING (true);
CREATE POLICY "Public read on event_groups" ON event_groups FOR SELECT USING (true);
CREATE POLICY "Public read on collection_runs" ON collection_runs FOR SELECT USING (true);

CREATE POLICY "Backend full on sources" ON sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on collection_runs" ON collection_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on assessments" ON threat_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on analyst_actions" ON analyst_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on watchlists" ON organization_watchlists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Backend full on event_groups" ON event_groups FOR ALL USING (true) WITH CHECK (true);
