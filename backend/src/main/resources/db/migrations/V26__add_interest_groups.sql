-- Promote the interest groups from a text label to real rows.
--
-- V19 gave interest_catalogue a `category` column holding a group name as free
-- text -- `Arts & culture`, `Tech`. That was enough while the groups only had
-- to head the sections of a picker. It stops being enough now that an event can
-- be tagged with a group: nothing can foreign-key to a text column, so
-- `Music` as a tag would have been an unvalidated string, which is the exact
-- shape this project has been removing everywhere else.
--
-- See .claude/docs/decisions/interests_and_categories.md, decision D3.
--
-- One table with a self-reference rather than a second interest_groups table.
-- Both were considered. The self-reference wins because an event topic tag has
-- to point at *either* a group or a single interest, and with two tables that
-- means two nullable columns and a CHECK on every join table that references
-- them, forever. With one table it is one foreign key.
--
-- Exactly two levels are intended: a group has no parent, an interest has one.
-- Postgres cannot express that as a CHECK without a subquery, so it is enforced
-- in the service layer instead; a three-level tree would break the rollup that
-- recommendation scoring relies on.

ALTER TABLE interest_catalogue
	ADD COLUMN IF NOT EXISTS parent_slug TEXT NULL;

ALTER TABLE interest_catalogue
	ADD CONSTRAINT fk_interest_catalogue_parent FOREIGN KEY (parent_slug)
		REFERENCES interest_catalogue(slug)
		ON UPDATE CASCADE
		-- RESTRICT, not CASCADE: deleting a group must not silently take its
		-- children with it. Retiring a group means re-parenting what is under
		-- it, deliberately.
		ON DELETE RESTRICT;

-- The twelve groups, as rows. `category` is still NOT NULL at this point, so
-- each group names itself; the column is dropped below once nothing needs it.
-- Their sort_order is read only against other groups -- ordering is applied
-- within a level, so overlapping with the leaves own numbering is harmless.
INSERT INTO interest_catalogue (slug, label, category, sort_order, parent_slug) VALUES
	('academic-career', 'Academic & career', 'Academic & career', 10, NULL),
	('arts-culture', 'Arts & culture', 'Arts & culture', 20, NULL),
	('music', 'Music', 'Music', 30, NULL),
	('sports-fitness', 'Sports & fitness', 'Sports & fitness', 40, NULL),
	('food-drink', 'Food & drink', 'Food & drink', 50, NULL),
	('games', 'Games', 'Games', 60, NULL),
	('community-causes', 'Community & causes', 'Community & causes', 70, NULL),
	('identity-community', 'Identity & community', 'Identity & community', 80, NULL),
	('languages', 'Languages', 'Languages', 90, NULL),
	('outdoors', 'Outdoors', 'Outdoors', 100, NULL),
	('tech', 'Tech', 'Tech', 110, NULL),
	('social', 'Social', 'Social', 120, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Hang the 76 existing interests off their group, matching on the label the
-- `category` column already holds. This is why the groups above are inserted
-- with exactly the labels V20 wrote.
UPDATE interest_catalogue AS child
SET parent_slug = parent.slug
FROM interest_catalogue AS parent
WHERE parent.parent_slug IS NULL
  AND child.parent_slug IS NULL
  AND child.slug <> parent.slug
  AND child.category = parent.label;

-- Every row is now either a group or hangs off one. A leaf that matched no
-- group would have been left with a NULL parent and silently become a
-- thirteenth group, so fail the migration instead of shipping that.
DO $$
DECLARE orphans INT;
BEGIN
	SELECT COUNT(*) INTO orphans
	FROM interest_catalogue
	WHERE parent_slug IS NULL
	  AND slug NOT IN ('academic-career', 'arts-culture', 'music', 'sports-fitness',
	                   'food-drink', 'games', 'community-causes', 'identity-community',
	                   'languages', 'outdoors', 'tech', 'social');
	IF orphans > 0 THEN
		RAISE EXCEPTION 'V26 left % interest rows without a group', orphans;
	END IF;
END $$;

-- The group name is now reachable through parent_slug, so the denormalised copy
-- goes. Two places holding the same fact is how they come to disagree.
ALTER TABLE interest_catalogue
	DROP COLUMN category;

-- The picker query: everything under one group, in order.
CREATE INDEX IF NOT EXISTS idx_interest_catalogue_parent
	ON interest_catalogue (parent_slug, sort_order);
