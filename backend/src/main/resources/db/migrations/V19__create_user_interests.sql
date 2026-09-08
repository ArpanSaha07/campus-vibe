-- Interests, and the fixed vocabulary they are drawn from.
--
-- Two tables in one migration because they are one idea: the catalogue is
-- meaningless without the join, and the join is unenforceable without the
-- catalogue. The reference rows themselves go in V20, separate, so that
-- editing the list later never means editing a schema migration.
--
-- Why a catalogue at all, when subjects next door are free text? Because the
-- whole point of an interest is that two people who both picked it are
-- discoverable as the same thing. `Board games`, `board games` and
-- `Boardgames` are three groups of one. Subjects are never matched against
-- each other, so they pay no such cost.

-- Keyed on a slug rather than the label.
--
-- The label is what a person reads and is therefore the thing most likely to
-- change: the 76 entries seeded in V20 were invented for a campus audience and
-- have had no product review. With a label primary key, renaming `LGBTQ+` would
-- have to rewrite every user_interests row that referenced it, inside the same
-- migration, or orphan them. With a slug it is an UPDATE of one column in one
-- row and nobody's selections move.
CREATE TABLE IF NOT EXISTS interest_catalogue (
	slug TEXT PRIMARY KEY,

	-- What the picker shows. Free to change without touching anyone's choices.
	label TEXT NOT NULL,

	-- The Browse by category filter. A plain column rather than a second
	-- reference table: a category has no attributes of its own, nothing joins
	-- to it, and the only question ever asked is 'which interests are in it'.
	category TEXT NOT NULL,

	-- Presentation order within a category, so the picker is not at the mercy
	-- of whatever order Postgres returns rows in.
	sort_order INT NOT NULL
);

-- Interests are ordered as one list: category groups in the order the picker
-- shows them, entries in the order inside each group.
CREATE INDEX IF NOT EXISTS idx_interest_catalogue_order
	ON interest_catalogue (sort_order);

-- Who picked what.
--
-- The foreign key to interest_catalogue is the entire reason this feature has
-- a reference table instead of a TEXT column. Without it, `closed list` is a
-- claim the UI makes and any other API client can ignore, and the first
-- misspelled slug is invisible until somebody wonders why a filter returns
-- nothing.
CREATE TABLE IF NOT EXISTS user_interests (
	user_id BIGINT NOT NULL,
	interest_slug TEXT NOT NULL,
	PRIMARY KEY (user_id, interest_slug),

	CONSTRAINT fk_user_interests_profile FOREIGN KEY (user_id)
		REFERENCES user_profiles(user_id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	-- No ON DELETE CASCADE here, and that asymmetry is deliberate. Deleting a
	-- profile should take its choices with it; retiring an interest from the
	-- catalogue should NOT silently delete it from every profile that picked
	-- it. RESTRICT makes that attempt fail loudly, so retiring an entry is a
	-- decision someone makes on purpose rather than a side effect.
	CONSTRAINT fk_user_interests_catalogue FOREIGN KEY (interest_slug)
		REFERENCES interest_catalogue(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
);
