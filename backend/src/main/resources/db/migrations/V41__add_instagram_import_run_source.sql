-- The one account a club's Import now run imported; NULL for a scheduled run
-- over the whole watch list. Lets the club dashboard show its own run, and
-- only its own, instead of any run that holds the import lease.
ALTER TABLE instagram_import_runs
    ADD COLUMN IF NOT EXISTS source_id BIGINT NULL REFERENCES instagram_sources (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_import_runs_source
    ON instagram_import_runs (source_id, started_at DESC) WHERE source_id IS NOT NULL;
