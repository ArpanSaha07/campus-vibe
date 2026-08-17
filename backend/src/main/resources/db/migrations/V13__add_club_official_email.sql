-- The club's official email address.
--
-- This belongs to the organisation (robotics@ssmu.ca), not to whoever happens
-- to be running the club this year. It is the durable channel for verifying
-- administrator changes, delivering security notifications, and recovering a
-- club whose owner graduated without transferring ownership.
--
-- Distinct from the contact email inside clubs.social_links, which is the
-- public "get in touch" address a club owner may edit freely. Only a platform
-- ADMIN may write this column -- enforced by keeping it out of
-- ClubUpdateRequest entirely rather than by a runtime role check, so there is
-- no owner-facing code path that could reach it.
--
-- Nullable: every club that exists today predates the column, and the
-- administrator workflows degrade to invitee-acceptance-only rather than
-- refusing to run when it is absent.
--
-- Not UNIQUE: umbrella organisations legitimately share one inbox across
-- several affiliated clubs.
--
-- See .claude/docs/architecture/club_admin_governance.md section 5.

ALTER TABLE clubs
	ADD COLUMN IF NOT EXISTS official_email TEXT NULL,
	ADD COLUMN IF NOT EXISTS official_email_verified_at TIMESTAMPTZ NULL;
