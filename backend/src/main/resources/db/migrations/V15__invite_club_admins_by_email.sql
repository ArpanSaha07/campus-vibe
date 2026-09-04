-- Let a club owner invite an administrator by email address, whether or not
-- that address has a CampusVibe account yet.
--
-- V12 made user_id NOT NULL because every row it created was an existing
-- account being carried across from clubs.club_admin_id. An invitation is a
-- different thing: at the moment it is written, the person it names may not
-- exist in users at all. They sign up with that address afterwards and claim
-- it, which is when user_id is filled in.
--
-- The two CHECK constraints below are what stop that nullability from
-- weakening anything. A row must still name somebody, and the moment a row
-- grants authority it must name an account rather than a string of text.
--
-- See .claude/docs/architecture/club_admin_governance.md sections 6 and 23.4.
-- That section offered a separate club_admin_invitations table as the
-- alternative. A PENDING row here was chosen instead: the invitation and the
-- assignment share every field but one, and one table means acceptance is a
-- status change rather than a copy between tables that could half-fail.

ALTER TABLE club_admin_assignments
	ALTER COLUMN user_id DROP NOT NULL,
	ADD COLUMN IF NOT EXISTS invited_email TEXT NULL;

-- A row that names nobody could never be accepted, revoked or explained.
ALTER TABLE club_admin_assignments
	ADD CONSTRAINT club_admin_assignment_names_someone
		CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL);

-- Authority is always held by an account. An ACTIVE row without user_id would
-- be a permission granted to a mailbox, which nothing in the authorisation
-- path could evaluate -- ClubPermissionService looks up (club_id, user_id).
ALTER TABLE club_admin_assignments
	ADD CONSTRAINT club_admin_assignment_active_has_user
		CHECK (status <> 'ACTIVE' OR user_id IS NOT NULL);

-- One live invitation per (club, address), the email-side twin of
-- one_live_assignment_per_club_user.
--
-- That index cannot cover invitations to strangers: its key is user_id, and in
-- PostgreSQL NULLs are distinct in a unique index, so a hundred invitations to
-- the same unknown address would all sit there without colliding. Lowercased
-- because addresses are matched case-insensitively everywhere else in the
-- application -- Ada@x and ada@x are one mailbox, and inviting both would put
-- two rows in front of one person.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_invite_per_club_email
	ON club_admin_assignments (club_id, lower(invited_email))
	WHERE status IN ('PENDING', 'ACTIVE') AND invited_email IS NOT NULL;

-- "Which invitations are waiting for this address?" -- the invitee's screen,
-- which runs before they have an account and so cannot be keyed on user_id.
CREATE INDEX IF NOT EXISTS idx_club_admin_assignments_invited_email
	ON club_admin_assignments (lower(invited_email))
	WHERE status = 'PENDING' AND invited_email IS NOT NULL;
