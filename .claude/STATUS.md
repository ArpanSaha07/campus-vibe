# CampusVibe — status

**Code as of:** `0fc7773` · 2026-09-07 · branch `refactor/claude-setup`, off `develop` at `03f818c` — the last commit to touch product code.

Where the project actually is. Orient from this, **not from
[`todo.md`](TODO/todo.md)** — that is the full queue, this is the digest.
`/wrap-up` refreshes this file.

## Now (in order)

1. **P0 — creating a club leaves you unable to manage it.** `POST /api/v1/clubs` needs only `ROLE_USER` and grants the creator nothing, so the logo, banners and links the create form collects all 403 against `canManageClub`. A decision, not code: creator becomes `CLUB_OWNER`, or club creation moves behind admin approval.
2. **P2 — an event cannot be given a banner image from the UI.** Unlike a club, the creator *can* upload to an event they just made, so `POST /api/v1/events/{id}/images` is reachable and simply unwired ([BUG-006](bugs/bugs.md#bug-006)).
3. **Commit the secrets-management work** — steps 1–5 are complete and verified.
4. **P0 — backend CI runs JDK 17 and skips tests.** `_backend.yml` is rewritten; no workflow in this repo has ever run on GitHub, so the fix is unverified ([BUG-002](bugs/bugs.md#bug-002)).
5. **P0 — semantic-only search returns 0 results.** Embedding writes are proven fine; the fault is in `SearchRepository.hybridSearchEventIds` ([BUG-001](bugs/bugs.md#bug-001)).

## Open bugs that block

- [BUG-039](bugs/bugs.md#bug-039) High — image uploads name the S3 object from the browser's filename and check nothing about it; latent until a read path is wired, which is items 1 and 2 above.
- [BUG-038](bugs/bugs.md#bug-038) High — `Club.images` / `Event.images` lose every write if the CodeQL autofix is accepted.
- [BUG-001](bugs/bugs.md#bug-001) High — semantic-only search match returns 0 results; reproducing again as of 2026-08-20.
- [BUG-002](bugs/bugs.md#bug-002) High — backend CI on JDK 17 with `-DskipTests`; fix written, never executed.
- [BUG-003](bugs/bugs.md#bug-003) High — frontend route protection never executes; do not build on it.
- Lower: [BUG-004](bugs/bugs.md#bug-004), [BUG-006](bugs/bugs.md#bug-006), [BUG-007](bugs/bugs.md#bug-007), [BUG-018](bugs/bugs.md#bug-018).

## Watch out

- `Club.id` is an assigned slug, so `save` merges and hands back a *different* instance — two bugs in one method ([BUG-034](bugs/fixed_bugs.md#bug-034), [BUG-037](bugs/fixed_bugs.md#bug-037)); held by [`rules/backend-clubs.md`](rules/backend-clubs.md), fix proposed in [ADR-002](docs/decisions/ADR-002-club-id-is-an-assigned-slug.md).
- Never accept Copilot Autofix on CodeQL alerts 14/15 — returning a copy of an entity collection loses every upload ([BUG-022](bugs/fixed_bugs.md#bug-022), [BUG-023](bugs/fixed_bugs.md#bug-023)); [`rules/backend-java.md`](rules/backend-java.md).
- Widening a signature leaves call sites and tests behind, and javac stops at the first phase so a `testCompile` break hides ([BUG-036](bugs/fixed_bugs.md#bug-036)); [`rules/backend-java.md`](rules/backend-java.md).
- The Tomcat CVE lever is `<tomcat.version>` in `backend/pom.xml`, not a parent bump ([BUG-035](bugs/fixed_bugs.md#bug-035), [ADR-003](docs/decisions/ADR-003-tomcat-pinned-beyond-the-boot-bom.md)); [`rules/ci-and-build.md`](rules/ci-and-build.md).
- A migration already on `origin/develop` or `origin/main` is immutable — supersede it with the next `V` ([`rules/db-migrations.md`](rules/db-migrations.md)).

## Recently shipped

| Date | What landed |
|---|---|
| 2026-09-05 | `develop` compiles again and a club's category and interests persist at creation ([BUG-036](bugs/fixed_bugs.md#bug-036), [BUG-037](bugs/fixed_bugs.md#bug-037)) |
| 2026-09-04 | `feature/user-profile` merged into `develop` (`0357b78`) — 19 commits: club governance, profiles, taxonomy, the create forms |
| 2026-09-03 | Tomcat pinned to 10.1.59 past the BOM, clearing three CRITICALs ([BUG-035](bugs/fixed_bugs.md#bug-035)) |
| 2026-08-20 | Club and event create forms work end to end (`04ba5ac`); every vocabulary fetched, none hardcoded |
| 2026-08-20 | Taxonomy (`d1d915f`): V23–V30, the `taxonomy/` package, `ClubService.create(Club, category, interests)` — [ADR-001](docs/decisions/ADR-001-three-taxonomy-vocabularies.md) |
| 2026-08-20 | User profiles persist: V18–V21, a full-replace `PUT` and one shared profile load — [`user-profiles.md`](docs/architecture/user-profiles.md) |
| 2026-08-19 | `/profile` and `/profile/edit` — the profile page and five settings sections behind a rail |
| 2026-08-18 | Platform admins can manage every club; club governance items 5, 7–10 — [`club-administration.md`](docs/architecture/club-administration.md) |
| 2026-08-18 | `dev` profile and the admin bootstrap runner — the system can finally have a platform admin |
| 2026-08-16 | Mock clubs left Flyway for a `dev`-profile seeder (V12 supersedes V6) and club search embeddings fixed ([BUG-034](bugs/fixed_bugs.md#bug-034)) |

Older, with full write-ups: [`tasks-completed.md`](TODO/tasks-completed.md).
