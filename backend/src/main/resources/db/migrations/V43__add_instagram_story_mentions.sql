-- The accounts a story or post mentions or tags (mention stickers, tagged
-- users, a post's co-authors), lowercased handles without @. Kept so a story
-- read again later, when the fetcher's answer is gone, still gives Claude the
-- same context, and so an event's host can be checked against them.
ALTER TABLE instagram_stories
    ADD COLUMN IF NOT EXISTS mentions JSONB NOT NULL DEFAULT '[]'::jsonb;
