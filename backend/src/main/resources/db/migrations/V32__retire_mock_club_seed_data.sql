-- Retires the eight mock clubs V6 inserted, so the dev seeder can own them.
--
-- WHY THIS IS NEEDED NOW. `DevDataSeeder` was written in August to replace
-- V6's raw INSERTs, for two stated reasons: Flyway runs everywhere, so
-- production would ship with fake clubs and stock photography; and a raw INSERT
-- bypasses the service layer, so `clubs.embedding` -- written by
-- `SearchIndexService` as a side effect of the normal create path -- is never
-- populated, leaving all eight invisible to the semantic half of hybrid search.
--
-- **The replacement never happened.** No migration ever removed V6's rows, so
-- on a cold start V6 inserts eight clubs, and the seeder's guard (`skip if any
-- club exists`) then skips. Verified 2026-09-09 on a `docker compose down -v`
-- boot: eight clubs, `count(*) FILTER (WHERE embedding IS NULL)` = 8, and the
-- log line `Dev seed: 8 club(s) already present; skipping`. The seeder has
-- therefore never run, and `database-lifecycle/SKILL.md` was wrong to record
-- this as retired by V12 -- V12 creates `club_admin_assignments`.
--
-- The club-governance work makes it matter beyond the embeddings: since
-- ADR-004 a club is born with an owner, and the seeder is what gives six of the
-- eight a demo owner while leaving two ownerless so the club-admin claim queue
-- still has something to act on locally. None of that runs while V6's rows are
-- sitting in the way.
--
-- WHY A NEW MIGRATION RATHER THAN EDITING V6. V6 is applied on origin/develop
-- and origin/main, which makes it immutable; deleting the file would fail
-- Flyway validation with `Detected applied migration not resolved locally`.
-- Superseding is the documented way out.
--
-- IN PRODUCTION this is simply the cleanup V6 always needed: the `dev` profile
-- is off, the seeder does not run, and the mock clubs are gone for good.

-- Only the eight V6 inserted, and only where nothing has been built on them.
--
-- The guards matter because `events.organizer_id` and `club_images.club_id`
-- both cascade on delete: an unqualified DELETE would silently destroy events a
-- developer had created against `coding-club` while testing. A club that
-- somebody has attached an event to, or claimed ownership of, is no longer mock
-- data -- it is work, and it stays. On a genuinely fresh database neither guard
-- matches anything and all eight go, which is the case that matters.
--
-- club_images rows go with the clubs, by the ON DELETE CASCADE in V2.
DELETE FROM clubs c
WHERE c.id IN (
        'coding-club',
        'photography-society',
        'drama-troupe',
        'debate-club',
        'music-ensemble',
        'science-club',
        'entrepreneur-hub',
        'chess-club'
    )
  AND NOT EXISTS (SELECT 1 FROM events e WHERE e.organizer_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM club_admin_assignments a WHERE a.club_id = c.id);
