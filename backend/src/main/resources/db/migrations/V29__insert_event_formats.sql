-- The twenty-two event formats.
--
-- Reference data, its own file, idempotent -- the same arrangement as V20 and
-- V24. Drafted from what a Montreal campus platform expects to host, not
-- derived from the interest catalogue: these are the words that describe the
-- *shape* of a gathering, and none of them is something a student would list
-- as an interest.
--
-- Note that `networking`, `volunteering` and `open-mic` also exist as slugs in
-- interest_catalogue. That is not a collision -- they are different tables
-- answering different questions. `Volunteering` the format is an afternoon
-- spent doing it; `Volunteering` the interest is caring about it.
--
-- Attribute words were deliberately left out: `Free food`, `Free entry` and
-- `Beginner friendly` are what students would really filter on, but they
-- describe neither the shape nor the subject of an event. If they are wanted
-- they belong here, as more rows, rather than as a third vocabulary.

INSERT INTO event_formats (slug, label, group_label, sort_order) VALUES
	('workshop', 'Workshop', 'Learning', 10),
	('talk', 'Talk', 'Learning', 20),
	('panel', 'Panel', 'Learning', 30),
	('info-session', 'Info session', 'Learning', 40),
	('study-session', 'Study session', 'Learning', 50),

	('social', 'Social', 'Social', 60),
	('party', 'Party', 'Social', 70),
	('game-night', 'Game night', 'Social', 80),
	('open-mic', 'Open mic', 'Social', 90),
	('trip', 'Trip', 'Social', 100),

	('competition', 'Competition', 'Competitive', 110),
	('hackathon', 'Hackathon', 'Competitive', 120),
	('tournament', 'Tournament', 'Competitive', 130),

	('performance', 'Performance', 'Showcase', 140),
	('screening', 'Screening', 'Showcase', 150),
	('exhibition', 'Exhibition', 'Showcase', 160),
	('fair', 'Fair', 'Showcase', 170),

	('networking', 'Networking', 'Community', 180),
	('fundraiser', 'Fundraiser', 'Community', 190),
	('volunteering', 'Volunteering', 'Community', 200),
	('general-meeting', 'General meeting', 'Community', 210),
	('orientation', 'Orientation', 'Community', 220)
ON CONFLICT (slug) DO NOTHING;
