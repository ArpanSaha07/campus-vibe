# CampusVibe Team Charter

**Every agent reads this first, on every spawn.** You start with no memory of any
previous session. This file, your own `members/<you>.md`, and `digest/latest.md`
are how anything the team already learned reaches you.

Last updated: **2026-08-07**

> **State rots.** The *Where we actually are* and *What matters right now*
> sections below were wrong within a day of being written, because a push
> happened and nothing regenerated them. Run `/digest` — which spawns no
> agents — before trusting them, and fix them here when they drift. The
> *Standing constraints* at the bottom do not rot and can be trusted as-is.

---

## What we are building

CampusVibe is a university event platform — Eventbrite for one campus. Students
discover events happening this week and actually go; clubs get a dashboard to run
their events and their club page. Users are **students and student clubs**, not
enterprises, so the bar is *fast, obvious, and mobile-friendly* rather than
configurable.

Three roles, and every authenticated user has at least the first:
`ROLE_USER` → `ROLE_CLUB_ADMIN` (manages one assigned club) → `ROLE_ADMIN`.
The authority on this is
[`docs/architecture/user-roles.md`](../docs/architecture/user-roles.md).

Full product scope lives in [`.claude/claude.md`](../claude.md). Read it before
proposing anything that sounds like a new feature — it is probably already
planned, and probably has a priority.

## Where we actually are

Honest state, not the README's version:

- **Frontend UI is largely built** and unwired — homepage, event page, club page,
  profile, login. Next.js 16 + TypeScript + Tailwind v4, no component library.
- **Backend runs**: auth, clubs, events, club-admin requests, hybrid search, S3.
  Spring Boot on Java 25, Flyway V1–V8, PostgreSQL with pgvector.
- **CI runs on GitHub and the fast tier is green.** Verified 2026-08-07 on
  `00a0933` (`agentic-team-creation`): secret scan, frontend lint/type-check/
  test/build, backend build and test, migration lint, and the `CI` gate all
  passed. **The full tier has not run on this branch** — Docker and the
  real-migration job show `skipped`, which is correct for a branch push. So
  BUG-001 remains unproven in CI rather than disproven.
- **Nine open dependency PRs are red.** Three (`#22` eslint-config-next 16,
  `#21` eslint 10, `#20` lucide-react 1.28) fail the **fast** tier, so they are
  genuine breaking majors. That is Dependabot's ungrouped-majors design working.
- **Nothing is deployed.** No AWS account, no registry, no OIDC role.
- **40 backend tests, 39 pass.** The failure is BUG-001 and it is real.
- Local dev is `docker compose watch` — all three services live-reload.

## What matters right now

In order. This list is the tiebreaker when two tasks both look important.

1. **Triage the nine red dependency PRs.** They are real, they are unassigned,
   and three of them break the build outright. The pipeline found them at zero
   agent cost; leaving them unread wastes that.
2. **BUG-001 — semantic search returns nothing for meaning-only matches.** The
   embedding writes are proven fine, so the fault is in
   `SearchRepository.hybridSearchEventIds`. Open a PR from this branch to run
   the full tier and see it fail honestly.
3. **BUG-003 — decide JWT transport.** `localStorage` today; the product spec
   calls for secure cookies. Route protection is half-wired and cannot be fixed
   until this is settled. **This needs an ADR before any code.**
4. **BUG-005 — cache query embeddings and rate-limit search.** Search is public
   and re-embeds identical queries, so this is both a cost and an abuse hole.
5. **Finish the authentication workflow**, then wire the built UI to the API.

Current backlog: [`todo.md`](../TODO/todo.md) ·
Defects: [`bugs.md`](../bugs/bugs.md) · In flight: [`board/sprint.md`](board/sprint.md)

## How we work

- **Arpan decides.** Agents propose, challenge, plan and build. Go/no-go on any
  feature, any ADR, and any deployment is his, always.
- **One feature at a time**, then stop for review before starting the next.
  This is a standing instruction in `claude.md`, not a preference.
- **Evidence, not assertion.** Every claim about this codebase cites `file:line`.
  If you did not read the file, say so rather than inferring from its name.
- **Reasoning gets written down** in [`../docs/`](../docs/README.md) or it is
  lost — you will not remember it next session, and neither will anyone else.
- **Stuck three times on the same thing? Stop and say so.** Do not keep
  iterating. This is in `claude.md` and it applies to agents too.

Full rules: [`WORKING-AGREEMENT.md`](WORKING-AGREEMENT.md) ·
Who owns what: [`ROSTER.md`](ROSTER.md) ·
Automation: [`AUTOMATION.md`](AUTOMATION.md) · [`ROUTINES.md`](ROUTINES.md)

## What binds you

| Area | Authority |
|---|---|
| Anything visual | [`design-guidelines.md`](../design-guidelines.md) — the *ticket stock* direction, non-negotiable |
| Migrations, seeding | [`database-lifecycle`](../skills/database-lifecycle/SKILL.md) |
| OpenAI / any LLM call | [`llm-integration`](../skills/llm-integration/SKILL.md) |
| Documenting your work | [`implementation-docs`](../skills/implementation-docs/SKILL.md) |
| Recording a decision | [`adr.md`](../skills/implementation-docs/adr.md) |
| Everything else | [`.claude/claude.md`](../claude.md) |

## Standing constraints

Things that have already bitten this project. Do not rediscover them.

- **Never edit an applied Flyway migration.** Flyway checksums the whole file;
  changing one comment breaks every existing database.
- **`ci-success` in `ci.yml` is the single required check.** It runs
  `if: always()` and treats `skipped` as a pass. Changing that breaks merging
  repo-wide.
- **`NEXT_PUBLIC_*` is inlined at build time** in the production image, which
  passes no build args — so it ships empty (BUG-004). Dev is unaffected.
- **The backend test suite never runs the migration files** — H2 with
  `flyway.enabled: false`. Only `_database.yml` executes them.
- **No secret ever enters CI, a commit, or a log.** Not once, not temporarily.
