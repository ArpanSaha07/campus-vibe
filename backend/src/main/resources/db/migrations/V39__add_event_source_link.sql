-- Where an imported event came from, so a student can open it on Instagram.
-- source_url is the permanent link (the post, or the account's profile for a
-- story). A story's own link works only until it expires, so it is kept apart
-- with its expiry and EventMapper picks whichever is still alive.
-- NULL on every event typed into CampusVibe.

ALTER TABLE events ADD COLUMN IF NOT EXISTS source_url TEXT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_story_url TEXT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_story_expires_at TIMESTAMPTZ NULL;

-- These reach an href on public pages, so only https links are ever stored.
ALTER TABLE events ADD CONSTRAINT chk_events_source_url_https
    CHECK (source_url IS NULL OR source_url LIKE 'https://%');
ALTER TABLE events ADD CONSTRAINT chk_events_source_story_url_https
    CHECK (source_story_url IS NULL OR source_story_url LIKE 'https://%');
