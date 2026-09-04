-- What an event is, and what it is about -- two axes, two vocabularies.
--
-- See .claude/docs/decisions/interests_and_categories.md, decisions D2 and D3.
--
-- There is deliberately NO event category taxonomy and no events.category_id.
-- An event answers two questions instead:
--
--   what kind of thing is it   -> event_formats, below, events only
--   what is it about           -> interest_catalogue, shared with students
--                                 and clubs
--
-- Format is events-only because `Workshop` and `Panel` are meaningless as a
-- student interest. Topic is shared because an event subject and a student
-- interest are the same kind of word, and keeping a parallel list of event
-- topics would be two lists that must agree with nothing checking that they
-- do -- the failure this project already shipped once with INTEREST_CATEGORIES.
--
-- The consequence worth knowing: matching a student to an event is a direct
-- join on shared slugs, with no mapping table, exactly as it is for clubs.

CREATE TABLE IF NOT EXISTS event_formats (
	slug TEXT PRIMARY KEY,
	label TEXT NOT NULL,

	-- The picker heading. Plain text, not a foreign key, because unlike the
	-- interest groups nothing is ever tagged with a format *group* -- an event
	-- is a Workshop, never a Learning. No row points at it, so there is
	-- nothing for a key to protect.
	group_label TEXT NOT NULL,

	sort_order INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_formats_order
	ON event_formats (sort_order);

CREATE TABLE IF NOT EXISTS event_format_assignments (
	event_id BIGINT NOT NULL,
	format_slug TEXT NOT NULL,
	PRIMARY KEY (event_id, format_slug),

	CONSTRAINT fk_event_format_assignments_event FOREIGN KEY (event_id)
		REFERENCES events(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	-- RESTRICT on the vocabulary side, CASCADE on the owner side, matching
	-- user_interests and club_interests throughout this schema.
	CONSTRAINT fk_event_format_assignments_format FOREIGN KEY (format_slug)
		REFERENCES event_formats(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_event_format_assignments_slug
	ON event_format_assignments (format_slug);

-- Topics point straight at interest_catalogue, and may name either a single
-- interest or one of the twelve groups V26 promoted to rows -- the parent_slug
-- self-reference is what makes that a single foreign key rather than two
-- nullable columns and a CHECK.
CREATE TABLE IF NOT EXISTS event_topic_assignments (
	event_id BIGINT NOT NULL,
	interest_slug TEXT NOT NULL,
	PRIMARY KEY (event_id, interest_slug),

	CONSTRAINT fk_event_topic_assignments_event FOREIGN KEY (event_id)
		REFERENCES events(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	CONSTRAINT fk_event_topic_assignments_interest FOREIGN KEY (interest_slug)
		REFERENCES interest_catalogue(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
);

-- The reverse lookup the recommender runs: given the slugs a student picked,
-- which events carry them.
CREATE INDEX IF NOT EXISTS idx_event_topic_assignments_slug
	ON event_topic_assignments (interest_slug);
