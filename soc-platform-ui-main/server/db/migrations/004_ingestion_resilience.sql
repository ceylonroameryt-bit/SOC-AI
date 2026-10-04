-- ==============================================================================
-- MIGRATION 004: Ingestion Resilience, Deduplication, and Anomaly Tracking
-- Adds indexes and tracking fields for:
--  1. normalized_url (Layer 2 deduplication)
--  2. title_fingerprint (Layer 3 title deduplication)
--  3. date_anomaly (future-dated feed flagging)
-- ==============================================================================

DO $$
BEGIN
    -- Add columns to articles if they do not exist
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'articles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'normalized_url') THEN
            ALTER TABLE articles ADD COLUMN normalized_url TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'title_fingerprint') THEN
            ALTER TABLE articles ADD COLUMN title_fingerprint VARCHAR(64);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'date_anomaly') THEN
            ALTER TABLE articles ADD COLUMN date_anomaly BOOLEAN DEFAULT FALSE;
        END IF;

        CREATE INDEX IF NOT EXISTS idx_articles_normalized_url ON articles(normalized_url);
        CREATE INDEX IF NOT EXISTS idx_articles_title_fingerprint ON articles(title_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_articles_date_anomaly ON articles(date_anomaly);
    END IF;

    -- Add columns to intel_articles if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'intel_articles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intel_articles' AND column_name = 'normalized_url') THEN
            ALTER TABLE intel_articles ADD COLUMN normalized_url TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intel_articles' AND column_name = 'title_fingerprint') THEN
            ALTER TABLE intel_articles ADD COLUMN title_fingerprint VARCHAR(64);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'intel_articles' AND column_name = 'date_anomaly') THEN
            ALTER TABLE intel_articles ADD COLUMN date_anomaly BOOLEAN DEFAULT FALSE;
        END IF;

        CREATE INDEX IF NOT EXISTS idx_intel_articles_normalized_url ON intel_articles(normalized_url);
        CREATE INDEX IF NOT EXISTS idx_intel_articles_title_fingerprint ON intel_articles(title_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_intel_articles_date_anomaly ON intel_articles(date_anomaly);
    END IF;
END $$;
