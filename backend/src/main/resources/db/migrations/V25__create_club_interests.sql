-- What a club is about, as opposed to what kind of organisation it is.
--
-- The second axis, and the one that does the finding. Thirteen category labels
-- cannot answer `show me tech clubs` at any multiplicity: even filed under both
-- Departmental and a hypothetical Technology, a student after AI clubs or
-- robotics clubs still has nothing to filter on. The vocabulary is too coarse
-- by design. So a club carries one category (V23) and several tags, and the
-- tags are what a search reaches.
--
-- See .claude/docs/decisions/interests_and_categories.md, decision D7.
--
-- These are interest_catalogue rows -- the same vocabulary students pick their
-- own interests from, and deliberately so. A club's topics and a person's
-- interests are the same kind of word: `Robotics` is both something a student
-- is into and something a club is about. That makes `clubs you might like` a
-- direct join on shared slugs with no mapping layer:
--
--   SELECT club_id, COUNT(*) AS overlap
--   FROM club_interests
--   WHERE interest_slug IN (:the users interest slugs)
--   GROUP BY club_id ORDER BY overlap DESC;
--
-- Events do NOT share this table, and the difference is principled rather than
-- arbitrary: an event also needs format words -- Workshop, Panel -- which are
-- meaningless as a student interest. A club has no format.

CREATE TABLE IF NOT EXISTS club_interests (
	club_id TEXT NOT NULL,
	interest_slug TEXT NOT NULL,
	PRIMARY KEY (club_id, interest_slug),

	CONSTRAINT fk_club_interests_club FOREIGN KEY (club_id)
		REFERENCES clubs(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	-- RESTRICT on the vocabulary side, CASCADE on the owner side, matching
	-- user_interests. Deleting a club takes its tags with it; retiring an
	-- interest that clubs are tagged with must fail loudly rather than silently
	-- stripping it from every club that used it.
	CONSTRAINT fk_club_interests_catalogue FOREIGN KEY (interest_slug)
		REFERENCES interest_catalogue(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
);

-- The reverse lookup, which is the one the recommender runs: given the slugs a
-- student picked, which clubs carry them. The primary key indexes
-- (club_id, interest_slug) and so cannot serve a query keyed on the slug alone.
CREATE INDEX IF NOT EXISTS idx_club_interests_slug
	ON club_interests (interest_slug);
