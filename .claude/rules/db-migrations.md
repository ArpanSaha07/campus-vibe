---
description: Flyway migrations — immutability once shared, numbering, and what does not belong in one
paths:
  - "backend/src/main/resources/db/migrations/**"
---

# Flyway migrations

**Read [`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md)
before changing anything here.** It is mandatory, not a suggestion.

- **Next number:** the highest across your tree **and** `origin/develop` and
  `origin/main`, plus one — `V30` today. A stale branch otherwise hands you a
  number someone else has claimed, and since the two filenames differ git
  merges both without a conflict; Flyway then refuses to start.
- **A migration on `origin/develop` or `origin/main` is immutable.** It has
  already run somewhere. Supersede it with a new `V<n+1>__<intent>.sql`; never
  edit it in place — two files claiming V12 is what the V6 saga cost.
- **`scripts/hooks/guard-migrations.mjs` refuses both**, so neither depends on
  remembering. One you have written and not yet pushed stays editable.
- **One responsibility per file.**
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
