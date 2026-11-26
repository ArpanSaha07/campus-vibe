-- A club admin turned on auto-import for this account from the club dashboard.
--
-- Separate from `enabled` because scheduled runs take only the first
-- `max-accounts` enabled sources by priority (the seeded McGill list). An
-- opted-in source is fetched on every scheduled run on top of that cap, so a
-- club that connects its own account is never ranked out of its own import.
ALTER TABLE instagram_sources
    ADD COLUMN IF NOT EXISTS club_opted_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_instagram_sources_club_opted_in
    ON instagram_sources (club_opted_in) WHERE club_opted_in;
