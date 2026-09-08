-- Handing a club to its next owner.
--
-- A transfer waits on the incoming owner to accept, so it needs somewhere to
-- live while it is pending. That could not be a PENDING CLUB_OWNER row in
-- club_admin_assignments: the successor must already be an ACTIVE CLUB_ADMIN of
-- the club, and one_live_assignment_per_club_user is UNIQUE (club_id, user_id)
-- WHERE status IN ('PENDING', 'ACTIVE') -- so a second live row for the same
-- person in the same club is exactly what that index forbids. Relaxing it to
-- include role would have given up the property that makes the invitation logic
-- simple: one live relationship per person per club.
--
-- So a pending transfer is its own thing, and club_admin_assignments is not
-- touched until the moment the transfer commits. Until then the sitting owner
-- is still the owner in every sense the authorisation path can see.
--
-- See .claude/docs/architecture/club_admin_governance.md sections 8, 9 and 26.

CREATE TABLE IF NOT EXISTS club_ownership_transfers (
	id               BIGSERIAL PRIMARY KEY,
	club_id          TEXT   NOT NULL REFERENCES clubs(id) ON UPDATE CASCADE ON DELETE CASCADE,

	-- Both recorded, because after the transfer the assignment rows no longer
	-- say who handed over to whom -- the old owner's row has become an admin
	-- row or a revoked one, and neither remembers why.
	from_user_id     BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	to_user_id       BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

	-- What becomes of the outgoing owner, chosen when the transfer is started
	-- (section 8). Stored rather than asked at acceptance time: it is the
	-- outgoing owner's decision about their own membership, and the incoming
	-- owner should not be the one making it.
	outgoing_becomes TEXT   NOT NULL CHECK (outgoing_becomes IN ('CLUB_ADMIN', 'REVOKED')),

	status           TEXT   NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
	created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	resolved_at      TIMESTAMPTZ NULL,

	-- A transfer to yourself would demote and promote the same row, which the
	-- service refuses with a sentence; this is the backstop.
	CONSTRAINT club_ownership_transfer_has_two_parties
		CHECK (from_user_id <> to_user_id),

	-- Every ended transfer says when it ended, and a pending one does not
	-- pretend to. Without this a bug that forgets the timestamp is invisible
	-- until someone asks how long a handover took.
	CONSTRAINT club_ownership_transfer_resolved_at_matches_status
		CHECK ((status = 'PENDING') = (resolved_at IS NULL))
);

-- At most one transfer in flight per club. Two pending transfers would race to
-- promote different people into the single owner slot, and whichever lost would
-- fail at one_active_owner_per_club with nothing to tell the loser why.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_transfer_per_club
	ON club_ownership_transfers (club_id)
	WHERE status = 'PENDING';

-- "Is anyone waiting for me to accept a club?" -- the successor's screen, which
-- runs on every page load through the managed-clubs provider.
CREATE INDEX IF NOT EXISTS idx_club_ownership_transfers_to_user_pending
	ON club_ownership_transfers (to_user_id)
	WHERE status = 'PENDING';
