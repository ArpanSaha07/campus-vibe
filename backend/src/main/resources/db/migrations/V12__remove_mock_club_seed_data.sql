-- Retires the demo clubs inserted by V6__insert_mock_clubs.sql.
--
-- V6 is deliberately left in place. Deleting an applied migration file does not
-- undo it — the flyway_schema_history row remains and startup fails with
-- "Detected applied migration not resolved locally: 6", so the application will
-- not boot. A bad migration is retired by superseding it, never by deletion.
--
-- The same eight clubs are now created by seed/DevDataSeeder under the `dev`
-- profile, through ClubService, so clubs.embedding is populated on write. The
-- raw INSERTs in V6 never did that, which left every seeded club invisible to
-- the semantic half of hybrid search.
--
-- On a fresh production database V6 inserts these rows and V12 removes them
-- again, for a net effect of nothing. That is intended: production must not ship
-- with demo clubs, and the schema history must stay identical across
-- environments rather than branching per environment.
--
-- Cascade note: every foreign key pointing at clubs is ON DELETE CASCADE
-- (club_images, events, user_followed_clubs, club_admin_requests), so this also
-- removes anything hanging off these eight clubs. That is correct for demo data.

-- The club_admin_id guard protects a development or staging database where one
-- of these demo clubs was genuinely adopted by a club admin — deleting it would
-- cascade into that person's real events. Production is untouched by the guard:
-- the rows there are seconds old and have no admin assigned.
DELETE FROM clubs
WHERE id IN (
	'coding-club',
	'photography-society',
	'drama-troupe',
	'debate-club',
	'music-ensemble',
	'science-club',
	'entrepreneur-hub',
	'chess-club'
)
AND club_admin_id IS NULL;
