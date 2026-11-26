-- The Instagram account actually hosting an event that another club reposted.
-- Clubs often share each other's posters in their stories; the event belongs
-- to the host's club, not the one that shared it.
--
-- host_handle is set only when the handle Claude names also appears in the
-- story itself: a mention or tag, the caption, or the text in the image.
-- host_checked says the candidate has been through that check, so rows from
-- before this column existed can be checked once, and their events moved.
ALTER TABLE instagram_event_candidates
    ADD COLUMN IF NOT EXISTS host_handle TEXT NULL
        CHECK (host_handle ~ '^[a-z0-9._]{1,30}$'),
    ADD COLUMN IF NOT EXISTS host_checked BOOLEAN NOT NULL DEFAULT FALSE;
