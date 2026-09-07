---
description: Flyway migrations — immutability once shared, numbering, and what does not belong in one
paths:
  - "backend/src/main/resources/db/migrations/**"
---

# Flyway migrations

**Read [`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md)
before changing anything here.** It is mandatory, not a suggestion.

- **Next number:** `ls | sort -V | tail -1`, plus one. Highest today is `V30`.
- **A migration that exists on `origin/develop` or `origin/main` is
  immutable.** It has already run somewhere. Supersede it with a new
  `V<n+1>__<intent>.sql`; never edit it in place. Two files claiming V12 is what
  the V6 saga cost, and Flyway refuses to start until one of them goes.
  `scripts/hooks/guard-migrations.mjs` refuses the edit rather than trusting
  anyone to remember; one you have written and not yet pushed stays editable.
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
