-- Event RSVPs: the user has confirmed they are going.
--
-- Saving and going are deliberately separate relations, not one status column.
-- A bookmark and a commitment are different promises: you can save an event
-- while deciding, then RSVP without losing the bookmark. user_saved_events
-- already carries the first half (V4); this adds the second.
CREATE TABLE IF NOT EXISTS user_event_rsvps (
	user_id BIGINT NOT NULL,
	event_id BIGINT NOT NULL,
	PRIMARY KEY (user_id, event_id),
	CONSTRAINT fk_user_event_rsvps_user FOREIGN KEY (user_id)
		REFERENCES users(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,
	CONSTRAINT fk_user_event_rsvps_event FOREIGN KEY (event_id)
		REFERENCES events(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE
);

-- The primary key already serves "what is this user going to". This covers the
-- other direction — "who is going to this event" — for attendee counts.
CREATE INDEX IF NOT EXISTS idx_user_event_rsvps_event ON user_event_rsvps (event_id);
