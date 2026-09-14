-- A proposal carries the club's contact links.
--
-- The propose path collected name, description, category, interests and a
-- message, and dropped the four things every club page shows -- so a club born
-- by proposal arrived with an empty contact block and its new owner had to go
-- and add what nobody had asked them for.
--
-- One TEXT column holding JSON, mirroring clubs.social_links (V2) rather than
-- four columns. The duplication is deliberate and is the standing cost ADR-005
-- names: a proposal describes a club that does not exist yet, so a field a club
-- has must be added here too or it silently cannot be proposed. Mirroring the
-- column exactly is what lets ClubCreationRequestService.approve carry the
-- value across without translating it.
--
-- Nullable, no default, no backfill: every proposal submitted before this
-- migration was submitted without links, and NULL says exactly that. An empty
-- JSON object would claim the requester was asked and left it blank.
--
-- What may be stored here is not enforced in SQL. A CHECK constraint cannot
-- express `every value is a http or https URL`, and a weaker one would read as
-- a guarantee it does not give. ClubSocialLinks.normalise is the control, on
-- both write paths -- see .claude/specs/2026-09-10-proposal-social-links.md and
-- ADR-004.

ALTER TABLE club_creation_requests
	ADD COLUMN IF NOT EXISTS social_links TEXT;

COMMENT ON COLUMN club_creation_requests.social_links IS
	'JSON: {email, website, facebook, instagram}. Mirrors clubs.social_links; '
	'carried onto the club at approval. Validated by ClubSocialLinks.normalise, '
	'never in SQL.';
