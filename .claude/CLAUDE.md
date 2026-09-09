# CampusVibe

A university event platform. Students discover what is happening on and around campus,
follow clubs, bookmark events, export them to Google Calendar and get an AI-planned
schedule. Clubs run their own page and their events from a dashboard. Platform admins
create clubs and hand them to their owners. Built for university students and student
clubs, McGill first.

Where the project is right now: [`STATUS.md`](STATUS.md), printed at the start of every
session. Product scope by area, shipped versus planned: [`docs/product.md`](docs/product.md).

**Roles.** `ROLE_USER` in the JWT is everyone. Club owner and club admin are *per club*,
in `club_admin_assignments`, never in the token; platform `ROLE_ADMIN` bypasses the
club-scoped checks — [`docs/architecture/user-roles.md`](docs/architecture/user-roles.md).

## The stack, and the choices with consequences

- **Next.js App Router + TypeScript + Tailwind** — a newer Next than your training data;
  read `node_modules/next/dist/docs/` before writing app code.
- **Spring Boot + Spring Security + JWT + Flyway**, layered Controller → Service → Repository.
- **PostgreSQL with pgvector** — search is hybrid, keyword rank plus OpenAI embeddings;
  that extension is why the compose image is not stock `postgres`.
- **One DTO contract, asserted twice** — `contracts/api-dto-fields.json` lists the JSON field
  names; a test on each side checks it, or a rename goes green on both suites and broken live.
- **Local is `docker compose`** (frontend, backend, db); production is Vercel plus Elastic
  Beanstalk (Docker), RDS and S3 — none of it live yet.
- **Tests:** Jest + React Testing Library, JUnit + Testcontainers ITs, the contract pair.
## Where the code lives

```
campusvibe/
├── frontend/      # Next.js application
├── backend/       # Spring Boot API; Flyway migrations in src/main/resources/db/migrations
├── contracts/     # The API contract: one list of JSON field names per DTO, asserted
│                  #   by a test on EACH side
├── docker/        # Compose, and where PostgreSQL is configured — the pgvector image
├── scripts/       # verify.mjs (runs what CI runs, locally) · check-docs.mjs + docs-map.json
├── .githooks/     # pre-push runs verify.mjs. Per clone: git config core.hooksPath .githooks
├── .github/       # ci.yml gates merges; branch-checks.yml is the push loop; _*.yml reusable
└── .claude/       # This file and the knowledge base it maps to: STATUS.md · rules/ ·
                   #   docs/ · TODO/ · bugs/ · skills/ · specs/
```

## How context reaches you

- **This file**, every session — the only one loaded unconditionally.
- **[`STATUS.md`](STATUS.md)** — a `SessionStart` hook prints it with the last commits and
  the working tree. If it did not arrive, read it. Either way, do not open `todo.md` to orient.
- **[`rules/`](rules/)** — seven short path-scoped files (`backend-clubs`, `backend-java`,
  `db-migrations`, `contracts`, `frontend`, `ci-and-build`, `aws-handling`) that load *when
  you read a matching source file*. Every bullet cites the bug or ADR it came from; that is
  where the traps are, so do not re-derive them. `aws-handling` is the exception that also
  binds work no file read announces — read it before the first AWS call of a session.
- **Skills** load on `/name` or when the work matches their description.
- `frontend/AGENTS.md` is written by `next dev`, not by us.

## The map — read the one file your task needs

| About to… | Read |
|---|---|
| Change how a subsystem works | [`docs/README.md`](docs/README.md) — the index, then the one doc it names |
| Change architecture, or pick between options | [`docs/decisions/README.md`](docs/decisions/README.md) — so a settled choice is not quietly remade |
| Ask what the product is meant to do | [`docs/product.md`](docs/product.md) |
| Pick up work, or check it was not already built | [`TODO/todo.md`](TODO/todo.md) is the queue — grep it, orient from `STATUS.md`; finished work is in [`TODO/tasks-completed.md`](TODO/tasks-completed.md) |
| Fix or report a defect | [`bugs/bugs.md`](bugs/bugs.md) (open) · [`bugs/fixed_bugs.md`](bugs/fixed_bugs.md) (resolved, with the reasoning) — grep, never read whole |
| Touch a migration, seed or role grant | [`skills/database-lifecycle/SKILL.md`](skills/database-lifecycle/SKILL.md) — **mandatory** |
| Build or restyle UI | [`design-guidelines.md`](design-guidelines.md) — binding on all UI work |
| Know what this unit of work agreed to | [`specs/`](specs/README.md) — one spec per feature, written by `/start` |
| Find the doc for code you touched | [`scripts/docs-map.json`](../scripts/docs-map.json); `node scripts/check-docs.mjs` reports what drifted |

## Hard rules

- **One feature at a time.** Stop at the feature boundary and say *run /wrap-up*; Arpan
  reviews, commits and pushes. Never run `git commit` or `git push`.
- **Never assume a decision** — taken or still open. Ask, with `AskUserQuestion`.
- Start non-trivial work with `/start`; it writes the spec Arpan approves before code.
- Read the subsystem doc **and** the decisions index before changing either.
- Choosing between real alternatives means writing a **Proposed** ADR; only Arpan flips a Status.
- A trap you hit, or a bug that lands, becomes a line in `rules/` carrying its bug id —
  not a paragraph in chat.
- Verify before pushing: `node scripts/verify.mjs` runs what CI runs. A red hook is
  stop-and-ask; `--no-verify` is never the answer.
- A migration already on `origin/develop` or `origin/main` is immutable.
- Three attempts without progress: stop and report.

## Before a unit of work ends

`/wrap-up` walks this in order, which is why you run it rather than remember it: shipped
line and stamp into [`STATUS.md`](STATUS.md) · the item into
[`TODO/tasks-completed.md`](TODO/tasks-completed.md) · bugs into [`bugs/`](bugs/bugs.md) ·
a choice into [`docs/decisions/`](docs/decisions/README.md) · a trap into [`rules/`](rules/)
· the reasoning into [`docs/architecture/`](docs/README.md) per `implementation-docs` · the
spec marked shipped.

## Conventions

- Commit subjects are `type(scope): summary`, enforced by a `commit-msg` hook;
  `/generate-commit-message` writes one.
- No double quotes in `.claude/` prose; claims cite `file:line`.
- DTO renames go through `contracts/api-dto-fields.json` and both contract tests.
- Reuse before adding: shared components, existing services, typed DTOs on both sides.
