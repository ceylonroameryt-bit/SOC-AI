-- ==============================================================================
-- MIGRATION 005: TacticLens Phase 1 Multi-Tenant & Relevance Schema
-- Implements:
--  1. organizations & memberships with Row-Level Security (RLS)
--  2. tech_stack & assets catalogue
--  3. clusters & org_relevance risk scoring
--  4. cve_facts & KEV/EPSS tracking
--  5. triage_status & saved_views
--  6. alert_rules & channels
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. ORGANIZATIONS & TENANTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sector VARCHAR(100) DEFAULT 'Education',
    region VARCHAR(50) DEFAULT 'eu-west-2',
    plan VARCHAR(50) DEFAULT 'pro',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. USER MEMBERSHIPS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('owner', 'admin', 'analyst', 'viewer')) DEFAULT 'analyst',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- ── 3. TECH STACK & ASSETS (Per Org) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tech_stack (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vendor VARCHAR(150) NOT NULL,
    product VARCHAR(150) NOT NULL,
    cpe VARCHAR(255),
    version VARCHAR(100),
    internet_facing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, vendor, product, version)
);

CREATE INDEX IF NOT EXISTS idx_tech_stack_org ON tech_stack(org_id);
CREATE INDEX IF NOT EXISTS idx_tech_stack_vendor_product ON tech_stack(vendor, product);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    product_ref UUID REFERENCES tech_stack(id) ON DELETE SET NULL,
    ip_or_hostname VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);

-- ── 4. INCIDENT CLUSTERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clusters (
    id VARCHAR(100) PRIMARY KEY,
    title TEXT NOT NULL,
    summary_ai TEXT,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    article_count INT DEFAULT 1,
    cves TEXT[] DEFAULT '{}',
    vendors TEXT[] DEFAULT '{}',
    products TEXT[] DEFAULT '{}',
    cpes TEXT[] DEFAULT '{}',
    primary_tactic VARCHAR(50),
    primary_technique VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clusters_first_seen ON clusters(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_last_seen ON clusters(last_seen DESC);

-- ── 5. CVE FACTS (NVD, CISA KEV, FIRST EPSS) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cve_facts (
    cve VARCHAR(50) PRIMARY KEY,
    cvss_v31 NUMERIC(3, 1),
    cvss_vector VARCHAR(150),
    kev BOOLEAN DEFAULT FALSE,
    kev_added TIMESTAMPTZ,
    epss NUMERIC(6, 5),
    epss_pct NUMERIC(5, 2),
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cve_facts_kev ON cve_facts(kev);
CREATE INDEX IF NOT EXISTS idx_cve_facts_epss ON cve_facts(epss DESC);

-- ── 6. ORG RELEVANCE & DETERMINISTIC RISK SCORES ─────────────────────────────
CREATE TABLE IF NOT EXISTS org_relevance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(100) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    matched_products TEXT[] DEFAULT '{}',
    risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')) NOT NULL,
    auto_case_p1 BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_org_relevance_org_risk ON org_relevance(org_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_relevance_cluster ON org_relevance(cluster_id);

-- ── 7. TRIAGE STATUS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS triage_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(100) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    status VARCHAR(50) CHECK (status IN ('new', 'relevant', 'investigating', 'not_relevant', 'closed')) DEFAULT 'new',
    assignee VARCHAR(100),
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_triage_status_org ON triage_status(org_id, status);

-- ── 8. ALERT RULES & SAVED VIEWS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    severity_threshold VARCHAR(20) DEFAULT 'High',
    scope VARCHAR(50) DEFAULT 'stack', -- 'stack', 'sector', 'any'
    extra_conditions JSONB DEFAULT '{"requireKev": false, "minEpss": 0.0}'::jsonb,
    tactics TEXT[] DEFAULT '{}',
    channels JSONB DEFAULT '["email"]'::jsonb,
    quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "07:00"}'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(org_id);

CREATE TABLE IF NOT EXISTS saved_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    tql TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_org ON saved_views(org_id);

-- ── 9. ENABLE ROW-LEVEL SECURITY (RLS) ───────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_stack ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_relevance ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
