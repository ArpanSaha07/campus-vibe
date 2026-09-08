-- What kind of organisation a club is.
--
-- A vocabulary of its own, deliberately not the interest catalogue. That list
-- is written at the grain of `Chess` and `Web development` -- reasonable things
-- for a person to like, strange things to call an organisation. A club is not a
-- hobby. See .claude/docs/decisions/interests_and_categories.md, decision D1.
--
-- One category per club, so `clubs.category_slug` is a column rather than a
-- join table. These thirteen are broad and close to mutually exclusive, which
-- is what makes browsing by category a clean grouping instead of a list where
-- most clubs appear three times. What a club is *about* is a separate axis
-- entirely -- club_interests, added in V25 -- and that is the axis that finds a
-- departmental society for somebody searching for tech.
--
-- Keyed on a slug rather than the label, the same reasoning as
-- interest_catalogue: the label is the part that gets reworded, and a label key
-- would move every club that referenced it.

CREATE TABLE IF NOT EXISTS club_categories (
	slug TEXT PRIMARY KEY,
	label TEXT NOT NULL,

	-- Presentation order, spaced by ten so an entry can be slotted between two
	-- others without renumbering the rest.
	sort_order INT NOT NULL
);

-- Nullable, and it has to be.
--
-- Every club in the database predates this column, so there is no value that
-- could be filled in for them and no default that would be true. An
-- uncategorised club is an ordinary state -- it means nobody has said yet --
-- and the club form is where that gets fixed, one club at a time.
ALTER TABLE clubs
	ADD COLUMN IF NOT EXISTS category_slug TEXT NULL;

-- RESTRICT rather than CASCADE or SET NULL: retiring a category that clubs are
-- still filed under should fail loudly and make somebody re-file them, not
-- quietly strip the classification off every club that used it.
ALTER TABLE clubs
	ADD CONSTRAINT fk_clubs_category FOREIGN KEY (category_slug)
		REFERENCES club_categories(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT;

-- The directory query: every club in one category.
CREATE INDEX IF NOT EXISTS idx_clubs_category
	ON clubs (category_slug);
