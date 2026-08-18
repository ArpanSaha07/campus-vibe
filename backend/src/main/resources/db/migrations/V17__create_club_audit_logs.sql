-- An append-only record of who did what to a club.
--
-- Multiple people can now manage one club, so "who removed Michael" and "who
-- handed this club to Sarah" stopped being answerable from the state alone: an
-- assignment row says what is true now, never who made it true or when. That is
-- the gap this closes.
--
-- See .claude/docs/architecture/club_admin_governance.md sections 19 to 22.

CREATE TABLE IF NOT EXISTS club_audit_logs (
	id            BIGSERIAL PRIMARY KEY,

	-- NO FOREIGN KEY, deliberately -- not to clubs, and not to users below.
	--
	-- A foreign key would mean the history is only as durable as the thing it
	-- describes: deleting a club would take with it the record of how it was
	-- run, which is the moment that record is most worth having. An audit log
	-- is a statement about the past, not a live reference to the present, so it
	-- outlives both the club and the accounts involved.
	club_id       TEXT   NOT NULL,

	-- Who did it. Nullable only because a platform-level action may not have a
	-- club administrator behind it; every club-scoped action records one.
	actor_user_id BIGINT NULL,

	-- The actor's name AT THE TIME, copied rather than joined. Two reasons: the
	-- entry still reads correctly after the account is deleted or renamed, and
	-- "Sarah removed Michael" should say what it said that day even if Sarah
	-- has since changed her display name.
	actor_name    TEXT   NOT NULL,

	action        TEXT   NOT NULL,
	entity_type   TEXT   NOT NULL,

	-- TEXT, not BIGINT: entity ids across this application are a mix of
	-- numeric (events, assignments) and slug (clubs), and an audit row should
	-- be able to name any of them.
	entity_id     TEXT   NULL,

	-- Context for rendering the line: the other person's name, what the
	-- outgoing owner chose, and so on. Snapshotted for the same reason
	-- actor_name is. Never secrets or tokens (section 20).
	metadata      JSONB  NULL,

	created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The dashboard query: this club's entries, newest first, a page at a time.
-- id rather than created_at as the tiebreaker and the paging cursor -- two
-- actions inside one transaction share a timestamp to the microsecond, and a
-- cursor that cannot separate them either repeats a row or skips one.
CREATE INDEX IF NOT EXISTS idx_club_audit_logs_club_recent
	ON club_audit_logs (club_id, id DESC);

-- "What has this person done?" -- section 20 asks for it, and it is the query a
-- dispute actually starts from.
CREATE INDEX IF NOT EXISTS idx_club_audit_logs_actor
	ON club_audit_logs (actor_user_id);

-- Append-only, enforced by the database rather than by convention.
--
-- Section 22 requires that club administrators cannot delete their own audit
-- trail. Leaving that to "the repository exposes no delete method" makes it
-- true until someone adds one, and the person most motivated to add one is the
-- person the rule exists to constrain.
--
-- Note this does NOT block TRUNCATE, which fires statement-level triggers only.
-- That is the intended escape hatch: the integration suites reset the table
-- between tests, and nothing in the application issues TRUNCATE.
CREATE OR REPLACE FUNCTION refuse_club_audit_log_mutation()
	RETURNS TRIGGER AS $$
BEGIN
	RAISE EXCEPTION 'club_audit_logs is append-only (attempted %)', TG_OP
		USING HINT = 'Audit history cannot be edited or deleted. See governance section 22.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS club_audit_logs_are_append_only ON club_audit_logs;

CREATE TRIGGER club_audit_logs_are_append_only
	BEFORE UPDATE OR DELETE ON club_audit_logs
	FOR EACH ROW EXECUTE FUNCTION refuse_club_audit_log_mutation();
