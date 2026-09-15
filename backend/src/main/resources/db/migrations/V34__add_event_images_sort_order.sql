-- Gives an event's photos a stored order.
--
-- The first photo is the event's banner, chosen by the club (2026-09-15), so
-- order is now data. event_images had no order column: Postgres returned the
-- rows in physical order, which holds only until freed space is reused, and a
-- chosen banner could then silently change. Event.images maps this column with
-- @OrderColumn(name = "sort_order").
--
-- Schema only; no rows are added or removed.

ALTER TABLE event_images ADD COLUMN sort_order INTEGER;

-- Backfill from the physical order the rows are read in today, so no existing
-- event's banner changes when this runs.
UPDATE event_images ei
SET sort_order = ordered.position
FROM (
    SELECT ctid AS row_id,
           ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY ctid) - 1 AS position
    FROM event_images
) ordered
WHERE ei.ctid = ordered.row_id;

ALTER TABLE event_images ALTER COLUMN sort_order SET NOT NULL;

-- The key moves to (event_id, sort_order), which is how Hibernate addresses an
-- indexed list's rows.
ALTER TABLE event_images DROP CONSTRAINT event_images_pkey;
ALTER TABLE event_images ADD CONSTRAINT event_images_pkey PRIMARY KEY (event_id, sort_order);

-- One key per event is still refused, but checked at commit. Reordering rewrites
-- url row by row, so choosing a new banner briefly holds the same key in two
-- positions; an immediate check would fail every swap halfway through.
ALTER TABLE event_images
    ADD CONSTRAINT uq_event_images_event_url UNIQUE (event_id, url)
    DEFERRABLE INITIALLY DEFERRED;
