---
description: Flyway migrations — immutability once shared, numbering, and what does not belong in one
paths:
  - "backend/src/main/resources/db/migrations/**"
---

# Flyway migrations

**Read [`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md)
before changing anything here.** It is mandatory, not a suggestion.

- **Next number:** the highest across your tree **and** `origin/develop` and
  `origin/main`, plus one — `V37` today. A stale branch otherwise hands you a
  number someone else has claimed, and since the two filenames differ git
  merges both without a conflict; Flyway then refuses to start.
- **A migration on `origin/develop` or `origin/main` is immutable.** It has
  already run somewhere. Supersede it with a new `V<n+1>__<intent>.sql`; never
  edit it in place — two files claiming V12 is what the V6 saga cost.
- **`scripts/hooks/guard-migrations.mjs` refuses both**, so neither depends on
  remembering. One you have written and not yet pushed stays editable.
- **A local database can hold a migration you edited before pushing.** Editable
  until pushed means a developer's own database may already have run the
  earlier draft. Arpan's compose database had run a `V12` named *remove mock club
  seed data* that was renamed before commit: Flyway refused to start on a
  checksum mismatch, and the schema had silently stopped at V12. **Do not
  `flyway repair` that** — it records the new checksum without running the new
  file, so the committed V12's table never exists and later migrations fail.
  Reset the volume (`docker compose down -v`). Found 2026-09-13.
- **One responsibility per file.**
- **A JPA `@OrderColumn` list rewrites its value column row by row.** Choosing a
  new banner swaps two keys between positions, so a unique constraint on
  `(event_id, url)` must be `DEFERRABLE INITIALLY DEFERRED` or every swap fails
  halfway, and the primary key moves to `(event_id, sort_order)`. V34 backfills
  `sort_order` from physical row order so no existing banner changes. (ADR-015)
- **No mock data in a migration.** The `dev` seeder owns that
  (`SKILL.md:152-169`) — a migration runs in every environment, including the
  ones you did not mean.
- **No real email addresses, even inside a comment.**
  `scripts/lint-migrations.mjs` fails the push. A real address in a V13 comment
  is the reason that script exists.
- **Derived columns are not written by SQL.** Search embeddings come from the
  indexing path; a migration that backfills one writes a value nothing
  maintains. Reindex instead. (BUG-034)
- **Structure changes need a migration; content changes do not**
  (`SKILL.md:276-285`). Add a column, yes. A user editing their profile, no.
- **A migration that deletes seeded rows must spare rows something was built
  on.** `events.organizer_id` and `club_images.club_id` both `ON DELETE
  CASCADE`, so an unqualified `DELETE FROM clubs` takes a developer's events
  with it. `V32` guards with `NOT EXISTS` on events and assignments. (BUG-041)
- **Recording a deviation as retired, when nothing retired it, hides it for
  months.** `database-lifecycle/SKILL.md` claimed V12 removed V6's mock clubs;
  V12 creates `club_admin_assignments` and no migration removed them until V32.
  Check the file, not the note. (BUG-041)
