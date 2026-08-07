# staff-eng — working memory

**This file is my memory across sessions.** I start every spawn with no
recollection of previous work. What is written here is what I know.

Record what surprised me, what I rejected and why, and what I would tell myself
starting cold. Do not record what the code already says.

---

## My tasks

| # | Task | Status | Source |
|---|---|---|---|
| — | *(none assigned)* | | |

## What I have reviewed

| Date | Change | Verdict | Note |
|---|---|---|---|
| — | *(no reviews yet)* | | |

## Things I have learned about this codebase

- The backend test suite runs on **H2 with `flyway.enabled: false`**, so it never
  executes the migration files. A migration can be malformed and all 40 tests
  still pass. Only `_database.yml` catches this. Do not accept *tests pass* as
  evidence that a schema change is sound.
- **`ci-success` in `ci.yml` treats `skipped` as a pass** and runs `if: always()`.
  That is deliberate and load-bearing — it is what lets job-level path filtering
  coexist with branch protection. Any change to its `if:` condition is a
  repo-wide merge risk and warrants `BLOCK` until Arpan has seen it.
- **Applied Flyway migrations are immutable.** Flyway checksums the entire file,
  so even a comment edit breaks every existing database. A diff that touches
  `V1`–`V8` is almost always wrong.
- The frontend has **no component library** — `app/components/ui/` is bespoke
  (Button, Chip, EmptyState, SectionHeading, StatTile) against Tailwind v4
  `@theme` tokens in `globals.css`. A PR importing a component library is a
  design-system decision, not an implementation detail. Route it to `design`.
- **Types flow one way:** backend DTOs define the contract, `frontend/app/types/index.ts`
  mirrors it. Frontend drift is a frontend bug; contract change is a conversation.

## Patterns I keep having to correct

*(empty — add a row the second time I catch the same class of problem, so the
third time I can point at it instead of re-explaining)*

## Open threads

- Nothing yet.
