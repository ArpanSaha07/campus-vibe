-- Fill the gaps the event vocabulary exposed.
--
-- Decision D3 requires every event topic to be an interest or an interest
-- group, so that tagging an event and stating a student interest draw on one
-- list and no mapping between them is ever needed. Holding the drafted event
-- topics up against the catalogue found 22 it could not express.
--
-- That is not an inconvenience, it is a hole in the profile screen: a campus
-- platform where an event can be about Finance or Careers, but no student can
-- say they are interested in either, is missing something. See
-- .claude/docs/decisions/interests_and_categories.md, decision D3.
--
-- Six of the 22 are NOT added here, because they already exist under another
-- name or at another level. Recording which, so nobody adds them later:
--
--   Technology  -> the group `tech`, relabelled below. A leaf would duplicate it.
--   Sports      -> the group `sports-fitness`.
--   Fitness     -> the group `sports-fitness`.
--   Black community  -> the existing `black-student-community`.
--   French      -> the existing `french-conversation`.
--   English     -> the existing `english-conversation`.
--
-- Leaving 16 genuinely new interests.

-- `Tech` was an informal heading when it only ever labelled a picker section.
-- It is now a slug an event can be tagged with, so it gets the full word. The
-- slug is untouched, which is the whole point of keying on slugs.
UPDATE interest_catalogue SET label = 'Technology' WHERE slug = 'tech';

-- sort_order starts at 1000 so these append to the end of their group rather
-- than interleaving with V20 own numbering, which runs to 760.
INSERT INTO interest_catalogue (slug, label, sort_order, parent_slug) VALUES
	-- Academic & career. The business and finance cluster is the largest gap:
	-- a management faculty exists and nothing in the catalogue spoke to it.
	('careers', 'Careers', 1000, 'academic-career'),
	('graduate-school', 'Graduate school', 1010, 'academic-career'),
	('business', 'Business', 1020, 'academic-career'),
	('finance', 'Finance', 1030, 'academic-career'),
	('consulting', 'Consulting', 1040, 'academic-career'),
	('marketing', 'Marketing', 1050, 'academic-career'),

	-- Tech. `web-development` was the only building-software entry; these two
	-- cover the students who do neither web nor research.
	('software-development', 'Software development', 1060, 'tech'),
	('engineering', 'Engineering', 1070, 'tech'),

	-- Arts & culture. Dance was simply absent, despite a whole club category
	-- being named for it.
	('dance', 'Dance', 1080, 'arts-culture'),
	('visual-art', 'Visual art', 1090, 'arts-culture'),

	('health-wellness', 'Health & wellness', 1100, 'sports-fitness'),

	-- Community & causes. `human-rights` and `mutual-aid` were there; the
	-- words most campus organising actually uses were not.
	('social-impact', 'Social impact', 1110, 'community-causes'),
	('politics', 'Politics', 1120, 'community-causes'),
	('activism', 'Activism', 1130, 'community-causes'),

	('equity-inclusion', 'Equity & inclusion', 1140, 'identity-community'),

	('travel', 'Travel', 1150, 'outdoors')
ON CONFLICT (slug) DO NOTHING;
