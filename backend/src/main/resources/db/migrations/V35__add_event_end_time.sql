-- Gives every event an end time.
--
-- Until now an event held only its start, so nothing could tell a running
-- event from an ended one: search dropped an event the moment it began, and
-- the dashboards filed a running event under past. From here an event is still
-- attendable while end_time > now(), and ongoing while
-- date_time <= now() < end_time (Arpan, 2026-09-15).
--
-- Schema only; no rows are added or removed.

ALTER TABLE events ADD COLUMN end_time TIMESTAMPTZ;

-- Existing events never recorded a length. Two hours is the length Google
-- Calendar export already assumed for every one of them, so no existing event
-- appears to change when this runs.
UPDATE events SET end_time = date_time + INTERVAL '2 hours';

ALTER TABLE events ALTER COLUMN end_time SET NOT NULL;

-- An event ends after it starts, and lasts at most 14 days (Arpan, 2026-09-15).
-- EventService refuses both with a 400 first; these catch any other writer.
ALTER TABLE events
    ADD CONSTRAINT chk_events_end_after_start CHECK (end_time > date_time);
ALTER TABLE events
    ADD CONSTRAINT chk_events_at_most_14_days CHECK (end_time <= date_time + INTERVAL '14 days');

-- Every still-attendable read filters on end_time.
CREATE INDEX idx_events_end_time ON events (end_time);
