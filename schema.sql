-- ==============================================================================
-- NO ENTRY — Threat Intelligence Platform Schema (PostgreSQL / Supabase / Neon)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==============================================================================
-- 2. THREATS TABLE (Ingested Threat Intelligence & RSS Feeds)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source_name VARCHAR(100) NOT NULL,
    source_url TEXT UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')) DEFAULT 'Medium',
    risk_score INT DEFAULT 0,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ultra-fast filtering & timeline querying
CREATE INDEX IF NOT EXISTS idx_threats_severity ON threats(severity);
CREATE INDEX IF NOT EXISTS idx_threats_published ON threats(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_category ON threats(category);
CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source_name);
CREATE INDEX IF NOT EXISTS idx_threats_title_trgm ON threats USING gin (title gin_trgm_ops);

-- ==============================================================================
-- 3. EXTRACTED INDICATORS OF COMPROMISE (IOCs)
-- ==============================================================================
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

-- Index for instant IOC searching & deduplication
CREATE INDEX IF NOT EXISTS idx_iocs_value ON iocs(value);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(type);
CREATE INDEX IF NOT EXISTS idx_iocs_threat_id ON iocs(threat_id);

-- ==============================================================================
-- 4. MITRE ATT&CK MAPPING TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS threat_mitre_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    tactic_id VARCHAR(20) NOT NULL,    -- e.g. TA0040 (Impact)
    tactic_name VARCHAR(100) NOT NULL,
    technique_id VARCHAR(20) NOT NULL, -- e.g. T1486 (Data Encrypted for Impact)
    technique_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(threat_id, tactic_id, technique_id)
);

CREATE INDEX IF NOT EXISTS idx_mitre_tactic ON threat_mitre_mapping(tactic_id);
CREATE INDEX IF NOT EXISTS idx_mitre_technique ON threat_mitre_mapping(technique_id);

-- ==============================================================================
-- 5. DE-DUPLICATED INCIDENT CLUSTERS (AI Clustering)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS incident_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    item_count INT DEFAULT 1,
    summary TEXT,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link table between clusters and threats
CREATE TABLE IF NOT EXISTS cluster_threats (
    cluster_id UUID REFERENCES incident_clusters(id) ON DELETE CASCADE,
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    PRIMARY KEY(cluster_id, threat_id)
);

-- ==============================================================================
-- 6. SIEM EXTERNAL INGESTION & AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS alert_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_source VARCHAR(100) NOT NULL, -- e.g. Wazuh, Suricata, Snort, API
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    broadcast_status JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_severity ON alert_logs(severity);
CREATE INDEX IF NOT EXISTS idx_alert_logs_created ON alert_logs(created_at DESC);

-- ==============================================================================
-- 7. HELPER VIEWS FOR REALTIME ANALYTICS & DASHBOARD
-- ==============================================================================

-- Severity Breakdown View
CREATE OR REPLACE VIEW v_severity_stats AS
SELECT 
    severity,
    COUNT(*) AS count
FROM threats
WHERE published_at >= NOW() - INTERVAL '30 days'
GROUP BY severity;

-- Top MITRE Techniques View
CREATE OR REPLACE VIEW v_top_mitre_techniques AS
SELECT 
    technique_id,
    technique_name,
    tactic_name,
    COUNT(*) AS hit_count
FROM threat_mitre_mapping
GROUP BY technique_id, technique_name, tactic_name
ORDER BY hit_count DESC;

-- Optional: Enable Realtime on Supabase
-- ALTER PUBLICATION supabase_realtime ADD TABLE threats, alert_logs;
