-- Club-scoped administrator assignments.
--
-- Replaces clubs.club_admin_id (added in V7), which allowed exactly one
-- administrator per club and drew no distinction between owning a club and
-- helping run it. Club authority is now a relationship between a user and a
-- specific club, not a property of the user's account.
--
-- See .claude/docs/architecture/club_admin_governance.md sections 3, 9 and 23.3.

CREATE TABLE IF NOT EXISTS club_admin_assignments (
	id                 BIGSERIAL PRIMARY KEY,
	club_id            TEXT   NOT NULL REFERENCES clubs(id) ON UPDATE CASCADE ON DELETE CASCADE,
	user_id            BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	role               TEXT   NOT NULL CHECK (role IN ('CLUB_OWNER', 'CLUB_ADMIN')),
	status             TEXT   NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED')),
	invited_by_user_id BIGINT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
	revoked_by_user_id BIGINT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
	created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	activated_at       TIMESTAMPTZ NULL,
	revoked_at         TIMESTAMPTZ NULL
);

-- Exactly one active owner per club. A partial unique index is the only way to
-- state this in PostgreSQL. Ownership transfer runs in one transaction, so in
-- normal operation the application has already guaranteed this and the index
-- catches only bugs and races -- which is precisely what it is for: a club left
-- with zero or two owners is not recoverable by the club itself.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_owner_per_club
	ON club_admin_assignments (club_id)
	WHERE role = 'CLUB_OWNER' AND status = 'ACTIVE';

-- One *live* assignment per (club, user). Live means PENDING or ACTIVE rather
-- than every row: a revoked administrator must be invitable again later, and
-- the REVOKED row has to survive for the audit trail, so a plain UNIQUE on
-- (club_id, user_id) would make re-inviting a returning exec impossible.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_assignment_per_club_user
	ON club_admin_assignments (club_id, user_id)
	WHERE status IN ('PENDING', 'ACTIVE');

-- "Which clubs does this user manage?" -- runs on every club-scoped
-- authorisation check, so it is the hottest query against this table.
CREATE INDEX IF NOT EXISTS idx_club_admin_assignments_user_active
	ON club_admin_assignments (user_id)
	WHERE status = 'ACTIVE';

-- "Who administers this club?" -- the Administrators tab, which lists revoked
-- rows too, hence status in the index rather than a WHERE clause.
CREATE INDEX IF NOT EXISTS idx_club_admin_assignments_club_status
	ON club_admin_assignments (club_id, status);

-- Carry the existing one-admin-per-club mapping across as active owners. This
-- is a data move that only makes sense between creating the table and dropping
-- the column, which is why it sits in a schema migration rather than a seeder.
INSERT INTO club_admin_assignments (club_id, user_id, role, status, created_at, activated_at)
SELECT c.id, c.club_admin_id, 'CLUB_OWNER', 'ACTIVE', NOW(), NOW()
FROM clubs c
WHERE c.club_admin_id IS NOT NULL;

ALTER TABLE clubs DROP COLUMN club_admin_id;
