-- The interest vocabulary itself.
--
-- Reference data, so Flyway owns it: it must exist identically in every
-- environment, it changes rarely, and no user action creates or destroys a row.
-- Its own migration rather than the tail of V19, so that revising the list
-- later is a new file and never an edit to an applied schema migration.
--
-- Transcribed from INTEREST_CATEGORIES in frontend/app/lib/profile-options.ts,
-- which was the only copy until now. Once GET /api/v1/interests is serving
-- these rows, that constant is deleted -- two lists that must agree and nothing
-- checking that they do is precisely the failure the API contract exists to
-- stop, and it should not be reintroduced one directory over.
--
-- These 76 entries were invented for a campus audience and have had no product
-- review. Expect to revise them; the slugs are what make that cheap.
--
-- sort_order is spaced by ten so an entry can be inserted between two others
-- without renumbering the rest.

INSERT INTO interest_catalogue (slug, label, category, sort_order) VALUES
	('study-groups', 'Study groups', 'Academic & career', 10),
	('research', 'Research', 'Academic & career', 20),
	('entrepreneurship', 'Entrepreneurship', 'Academic & career', 30),
	('networking', 'Networking', 'Academic & career', 40),
	('public-speaking', 'Public speaking', 'Academic & career', 50),
	('case-competitions', 'Case competitions', 'Academic & career', 60),
	('hackathons', 'Hackathons', 'Academic & career', 70),
	('career-fairs', 'Career fairs', 'Academic & career', 80),
	('theatre', 'Theatre', 'Arts & culture', 90),
	('film', 'Film', 'Arts & culture', 100),
	('photography', 'Photography', 'Arts & culture', 110),
	('painting', 'Painting', 'Arts & culture', 120),
	('creative-writing', 'Creative writing', 'Arts & culture', 130),
	('poetry', 'Poetry', 'Arts & culture', 140),
	('museums', 'Museums', 'Arts & culture', 150),
	('design', 'Design', 'Arts & culture', 160),
	('live-music', 'Live music', 'Music', 170),
	('choir', 'Choir', 'Music', 180),
	('jazz', 'Jazz', 'Music', 190),
	('classical', 'Classical', 'Music', 200),
	('djing', 'DJing', 'Music', 210),
	('open-mic', 'Open mic', 'Music', 220),
	('band', 'Band', 'Music', 230),
	('intramurals', 'Intramurals', 'Sports & fitness', 240),
	('running', 'Running', 'Sports & fitness', 250),
	('climbing', 'Climbing', 'Sports & fitness', 260),
	('yoga', 'Yoga', 'Sports & fitness', 270),
	('hockey', 'Hockey', 'Sports & fitness', 280),
	('soccer', 'Soccer', 'Sports & fitness', 290),
	('basketball', 'Basketball', 'Sports & fitness', 300),
	('swimming', 'Swimming', 'Sports & fitness', 310),
	('ski-snowboard', 'Ski & snowboard', 'Sports & fitness', 320),
	('cycling', 'Cycling', 'Sports & fitness', 330),
	('cooking', 'Cooking', 'Food & drink', 340),
	('baking', 'Baking', 'Food & drink', 350),
	('coffee', 'Coffee', 'Food & drink', 360),
	('food-tours', 'Food tours', 'Food & drink', 370),
	('potlucks', 'Potlucks', 'Food & drink', 380),
	('board-games', 'Board games', 'Games', 390),
	('video-games', 'Video games', 'Games', 400),
	('chess', 'Chess', 'Games', 410),
	('trivia', 'Trivia', 'Games', 420),
	('tabletop-rpgs', 'Tabletop RPGs', 'Games', 430),
	('volunteering', 'Volunteering', 'Community & causes', 440),
	('sustainability', 'Sustainability', 'Community & causes', 450),
	('mental-health', 'Mental health', 'Community & causes', 460),
	('mutual-aid', 'Mutual aid', 'Community & causes', 470),
	('human-rights', 'Human rights', 'Community & causes', 480),
	('fundraising', 'Fundraising', 'Community & causes', 490),
	('international-students', 'International students', 'Identity & community', 500),
	('lgbtq', 'LGBTQ+', 'Identity & community', 510),
	('faith-spirituality', 'Faith & spirituality', 'Identity & community', 520),
	('women-in-stem', 'Women in STEM', 'Identity & community', 530),
	('black-student-community', 'Black student community', 'Identity & community', 540),
	('indigenous-community', 'Indigenous community', 'Identity & community', 550),
	('french-conversation', 'French conversation', 'Languages', 560),
	('english-conversation', 'English conversation', 'Languages', 570),
	('language-exchange', 'Language exchange', 'Languages', 580),
	('spanish', 'Spanish', 'Languages', 590),
	('mandarin', 'Mandarin', 'Languages', 600),
	('hiking', 'Hiking', 'Outdoors', 610),
	('camping', 'Camping', 'Outdoors', 620),
	('canoeing', 'Canoeing', 'Outdoors', 630),
	('birdwatching', 'Birdwatching', 'Outdoors', 640),
	('gardening', 'Gardening', 'Outdoors', 650),
	('web-development', 'Web development', 'Tech', 660),
	('ai-machine-learning', 'AI & machine learning', 'Tech', 670),
	('data-science', 'Data science', 'Tech', 680),
	('cybersecurity', 'Cybersecurity', 'Tech', 690),
	('robotics', 'Robotics', 'Tech', 700),
	('open-source', 'Open source', 'Tech', 710),
	('make-friends', 'Make friends', 'Social', 720),
	('new-in-town', 'New in town', 'Social', 730),
	('karaoke', 'Karaoke', 'Social', 740),
	('movie-nights', 'Movie nights', 'Social', 750),
	('parties', 'Parties', 'Social', 760)
-- Idempotent so a local `docker compose down -v` and rebuild, or any re-run
-- against a database that already has these, is a no-op rather than a
-- duplicate-key failure.
ON CONFLICT (slug) DO NOTHING;
