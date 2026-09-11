-- Proposing a club that does not exist yet.
--
-- ADR-004 gives ordinary users a path that submits a club for approval rather
-- than creating one, and ADR-005 settles where that proposal lives. It is not a
-- club row with a status column: `clubs` is public the moment a row exists --
-- GET /api/v1/clubs is unauthenticated, the clubs grid and the homepage read
-- it, and SearchIndexService indexes on write -- so gating visibility would mean
-- filtering in four places (ClubRepository, SearchRepository, SearchIndexService
-- and every listing) and missing one publishes a club nobody reviewed.
--
-- It is not club_admin_requests either. That table's club_id is NOT NULL (V7:44)
-- and points at a club that already exists, which is exactly what a proposal
-- does not have. The two also approve differently: a claim installs an owner on
-- an existing club, a proposal creates the club first.
--
-- So: its own table, and no row in `clubs` until an admin approves. The merged
-- Pending requests list on the admin dashboard is a presentation concern, done
-- by the frontend reading both endpoints.
--
-- See .claude/docs/decisions/ADR-004-two-paths-create-a-club.md and
-- ADR-005-club-proposal-is-its-own-table.md.

CREATE TABLE IF NOT EXISTS club_creation_requests (
	id                  BIGSERIAL PRIMARY KEY,
	user_id             BIGINT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,

	-- What the club would be. The same fields ClubCreateRequest carries, because
	-- approval feeds them straight into ClubService.createOwnedBy -- plus the
	-- requester's message, which a club itself has no room for.
	--
	-- proposed_slug becomes clubs.id on approval. It is not a foreign key to
	-- anything: the whole point is that no club exists yet.
	proposed_slug       TEXT NOT NULL,
	name                TEXT NOT NULL,
	description         TEXT,

	-- RESTRICT, matching fk_clubs_category: retiring a category that a pending
	-- proposal names must fail loudly rather than silently blanking it.
	category_slug       TEXT NULL REFERENCES club_categories(slug)
	                        ON UPDATE CASCADE ON DELETE RESTRICT,

	message             TEXT,

	status              TEXT NOT NULL DEFAULT 'PENDING'
	                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
	requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	reviewed_at         TIMESTAMPTZ NULL,
	reviewed_by_user_id BIGINT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,

	-- What the approval produced, so `which club did this become` has an answer
	-- afterwards. Nullable: PENDING and REJECTED rows never have one.
	created_club_id     TEXT NULL REFERENCES clubs(id) ON UPDATE CASCADE ON DELETE SET NULL,

	-- Every reviewed proposal says when it was reviewed, and a pending one does
	-- not pretend to. The pattern V16 uses for transfers, and for the same
	-- reason: without it, a bug that forgets the timestamp is invisible until
	-- somebody asks how long the queue takes.
	CONSTRAINT club_creation_request_reviewed_at_matches_status
		CHECK ((status = 'PENDING') = (reviewed_at IS NULL)),

	-- A club id only exists once one was created, which only happens on approval.
	CONSTRAINT club_creation_request_created_club_only_when_approved
		CHECK (created_club_id IS NULL OR status = 'APPROVED')
);

-- The slug reservation.
--
-- Two students proposing `robotics` should collide at submission, where the form
-- is already checking name availability and can say so, rather than at approval
-- where the loser's proposal has been sitting in a queue for a week. lower() so
-- the reservation is case-insensitive, matching how a slug is derived.
--
-- It does not cover the race with a platform admin creating the same slug
-- directly, because that writes to `clubs` and this index cannot see it. The
-- approval transaction re-checks for exactly that.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_proposal_per_slug
	ON club_creation_requests (lower(proposed_slug))
	WHERE status = 'PENDING';

-- The admin queue: every pending proposal, oldest first.
CREATE INDEX IF NOT EXISTS idx_club_creation_requests_pending
	ON club_creation_requests (requested_at)
	WHERE status = 'PENDING';

-- "What have I proposed?" -- the requester's own view, which has no screen yet
-- (it lands in the notifications tab) but which the service reads to refuse a
-- second pending proposal from the same person.
CREATE INDEX IF NOT EXISTS idx_club_creation_requests_user
	ON club_creation_requests (user_id);

-- A proposal's tags, mirroring club_interests (V25) so approval is a straight
-- copy. Same FK directions and the same reasoning: CASCADE on the owner side,
-- RESTRICT on the vocabulary side.
CREATE TABLE IF NOT EXISTS club_creation_request_interests (
	request_id    BIGINT NOT NULL,
	interest_slug TEXT   NOT NULL,
	PRIMARY KEY (request_id, interest_slug),

	CONSTRAINT fk_ccr_interests_request FOREIGN KEY (request_id)
		REFERENCES club_creation_requests(id)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	CONSTRAINT fk_ccr_interests_catalogue FOREIGN KEY (interest_slug)
		REFERENCES interest_catalogue(slug)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
);
