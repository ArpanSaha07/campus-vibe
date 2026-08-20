-- The thirteen club categories.
--
-- Reference data, so Flyway owns it: it must exist identically in every
-- environment, it changes rarely, and no user action creates or destroys a row.
-- Its own file rather than the tail of V23, so that revising the list later is
-- a new migration and never an edit to an applied schema one.
--
-- Slugs drop the trailing `Clubs` that most labels carry -- it is redundant
-- inside a table called club_categories, and the label is what gets displayed
-- anyway.
--
-- Two entries are not organisation types and are meant to be catch-alls:
-- `off-campus` for groups that are not student societies at all, and `general`
-- for the ones that genuinely do not fit. A category list without an escape
-- hatch pushes people into filing things wrongly.

INSERT INTO club_categories (slug, label, sort_order) VALUES
	('athletic-and-recreational-sports', 'Athletic and Recreational Sports Clubs', 10),
	('charity-and-environment', 'Charity and Environment Clubs', 20),
	('community-outreach-and-volunteering', 'Community Outreach and Volunteering Clubs', 30),
	('fine-art-dance-and-performance', 'Fine Art, Dance, and Performance Clubs', 40),
	('health-and-wellness', 'Health and Wellness Clubs', 50),
	('language-and-publications', 'Language and Publications Clubs', 60),
	('leisure-activity-and-hobby', 'Leisure Activity and Hobby Clubs', 70),
	('networking-and-leadership-development', 'Networking and Leadership Development Clubs', 80),
	('political-and-social-activism', 'Political and Social Activism Clubs', 90),
	('religion-and-culture', 'Religion and Culture Clubs', 100),
	('departmental', 'Departmental Clubs', 110),
	('off-campus', 'Off-campus', 120),
	('general', 'General', 130)
-- Idempotent so a local `docker compose down -v` and rebuild, or any re-run
-- against a database that already holds these, is a no-op rather than a
-- duplicate-key failure.
ON CONFLICT (slug) DO NOTHING;
