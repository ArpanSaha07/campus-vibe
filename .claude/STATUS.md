# CampusVibe — status

**Code as of:** `0065af8` · 2026-09-09 · branch `feature/club-governance`. The club ownership spine is **written and verified but uncommitted** — 29 files changed plus 14 new ones in the working tree.

Where the project actually is. Orient from this, **not from
[`todo.md`](TODO/todo.md)** — that is the full queue, this is the digest.
`/wrap-up` refreshes this file.

## Now (in order)

1. **Review and commit the club ownership spine** — it is finished and verified but sits uncommitted, and it is the largest thing in the tree. `/generate-commit-message` has written the message.
2. **P0 — semantic-only search returns 0 results.** Embedding writes are proven fine; the fault is in `SearchRepository.hybridSearchEventIds`. Re-confirmed reproducing 2026-09-09 on clean `HEAD`, so it is the one red test in `verify --full` and is **not** caused by the club work ([BUG-001](bugs/bugs.md#bug-001)).
3. **P0 — backend CI runs JDK 17 and skips tests.** `_backend.yml` is rewritten; no workflow in this repo has ever run on GitHub, so the fix is unverified ([BUG-002](bugs/bugs.md#bug-002)).
4. **P1 — a club cannot be edited after creation, from anywhere.** Now the most visible gap: an owner installed by the new approval flow still cannot give their club a logo, because `/manage/[clubId]` has no editor and there is no `updateClub` in the frontend. Every endpoint already exists ([BUG-043](bugs/bugs.md#bug-043)).
5. **P2 — an event cannot be given a banner image from the UI.** `POST /api/v1/events/{id}/images` is reachable and simply unwired ([BUG-006](bugs/bugs.md#bug-006)) — but wiring it now also needs an event **read** path, which clubs got and events did not ([BUG-042](bugs/bugs.md#bug-042)).
6. **Commit the secrets-management work** — steps 1–5 are complete and verified.

## Open bugs that block

- [BUG-039](bugs/bugs.md#bug-039) High — image uploads name the S3 object from the browser's filename and check nothing about it. **No longer latent:** the club read path landed 2026-09-09, so every missing control is now on a live path. Arpan's call was ship then fix.
- [BUG-044](bugs/bugs.md#bug-044) High — `Club.images` / `Event.images` lose every write if the CodeQL autofix is accepted.
- [BUG-001](bugs/bugs.md#bug-001) High — semantic-only search match returns 0 results; reproducing again as of 2026-08-20.
- [BUG-002](bugs/bugs.md#bug-002) High — backend CI on JDK 17 with `-DskipTests`; fix written, never executed.
- [BUG-003](bugs/bugs.md#bug-003) High — frontend route protection never executes; do not build on it.
- Lower: [BUG-004](bugs/bugs.md#bug-004), [BUG-006](bugs/bugs.md#bug-006), [BUG-007](bugs/bugs.md#bug-007), [BUG-018](bugs/bugs.md#bug-018), [BUG-042](bugs/bugs.md#bug-042), [BUG-043](bugs/bugs.md#bug-043).

## Watch out

- `Club.id` is an assigned slug, so `save` merges and hands back a *different* instance — two bugs in one method ([BUG-034](bugs/fixed_bugs.md#bug-034), [BUG-037](bugs/fixed_bugs.md#bug-037)); held by [`rules/backend-clubs.md`](rules/backend-clubs.md), fix proposed in [ADR-002](docs/decisions/ADR-002-club-id-is-an-assigned-slug.md).
- Never accept Copilot Autofix on CodeQL alerts 14/15 — returning a copy of an entity collection loses every upload ([BUG-022](bugs/fixed_bugs.md#bug-022), [BUG-023](bugs/fixed_bugs.md#bug-023)); [`rules/backend-java.md`](rules/backend-java.md).
- **`ClubService.create` no longer exists** — `createOwnedBy` is the only way to make a club, and a null owner means born ownerless, which only the dev seeder may pass ([ADR-004](docs/decisions/ADR-004-two-paths-create-a-club.md)); [`rules/backend-clubs.md`](rules/backend-clubs.md).
- **A stored S3 key is not a URL, and `next/image` throws on one *during render*** — no `onError` can catch it, so one bad row takes a whole page down ([BUG-040](bugs/fixed_bugs.md#bug-040)); [`rules/frontend.md`](rules/frontend.md).
- **A deviation recorded as fixed is one nobody re-checks.** `DevDataSeeder` never ran for three weeks because a skill file credited a migration that does not exist ([BUG-041](bugs/fixed_bugs.md#bug-041)); [`rules/db-migrations.md`](rules/db-migrations.md).
- **Bug ids have now collided twice.** Grep *both* `bugs.md` and `fixed_bugs.md` for the next free id before filing — `BUG-038` was issued to two different bugs, and the open one is now `BUG-044`.
- Widening a signature leaves call sites and tests behind, and javac stops at the first phase so a `testCompile` break hides ([BUG-036](bugs/fixed_bugs.md#bug-036)); [`rules/backend-java.md`](rules/backend-java.md).
- The Tomcat CVE lever is `<tomcat.version>` in `backend/pom.xml`, not a parent bump ([BUG-035](bugs/fixed_bugs.md#bug-035), [ADR-003](docs/decisions/ADR-003-tomcat-pinned-beyond-the-boot-bom.md)); [`rules/ci-and-build.md`](rules/ci-and-build.md).
- A migration already on `origin/develop` or `origin/main` is immutable — supersede it with the next `V` ([`rules/db-migrations.md`](rules/db-migrations.md)).

## Recently shipped

| Date | What landed |
|---|---|
| 2026-09-09 | **The club ownership spine.** Two creation paths and neither leaves a club ownerless: a platform admin creates directly and becomes owner, an ordinary user proposes and approval installs them, in one transaction ([ADR-004](docs/decisions/ADR-004-two-paths-create-a-club.md), [ADR-005](docs/decisions/ADR-005-club-proposal-is-its-own-table.md)). `ClubService.create` deleted in favour of `createOwnedBy`. `PATCH /clubs/{id}/official-email` for platform admins, always leaving it unverified ([ADR-006](docs/decisions/ADR-006-official-email-verified-only-by-round-trip.md)). The admin dashboard gained the Create a club control it never had, and one merged Pending requests list. Closes the standing P0 |
| 2026-09-09 | An uploaded club logo took the `/clubs` page down — `next/image` throws on an S3 object key during render, where `onError` cannot catch it. Fixed at both ends, and clubs got the media read path nothing had ever had ([BUG-040](bugs/fixed_bugs.md#bug-040)) |
| 2026-09-09 | `DevDataSeeder` had never once run: V6 still inserted the eight clubs it was written to replace, so every seeded club carried a NULL embedding. V32 retires them and the guard is now per club ([BUG-041](bugs/fixed_bugs.md#bug-041)) |
| 2026-09-08 | The Docker smoke test asserted on `GET /clubs/my-club`, deleted on this branch, so it read 404 and blocked every merge; retargeted at `/users/me/managed-clubs` and taught to name a missing route for what it is ([BUG-038](bugs/fixed_bugs.md#bug-038)) |
| 2026-09-08 | Four `js/unused-local-variable` CodeQL alerts cleared — the dead `isChecking`, `loaded`, `setToken` and `act` bindings deleted rather than wired up |
| 2026-09-07 | `.claude/` rebuilt so a fresh session gets the load-bearing context automatically: path-scoped [`rules/`](rules/), this file injected at session start, and hooks enforcing migrations and commit subjects. Orientation for a club feature measured at 20,852 bytes against 109,556 before — [`tasks-completed.md`](TODO/tasks-completed.md) carries the table |
| 2026-09-05 | `develop` compiles again and a club's category and interests persist at creation ([BUG-036](bugs/fixed_bugs.md#bug-036), [BUG-037](bugs/fixed_bugs.md#bug-037)) |
| 2026-09-04 | `feature/user-profile` merged into `develop` (`0357b78`) — 19 commits: club governance, profiles, taxonomy, the create forms |
| 2026-09-03 | Tomcat pinned to 10.1.59 past the BOM, clearing three CRITICALs ([BUG-035](bugs/fixed_bugs.md#bug-035)) |
| 2026-08-20 | Club and event create forms work end to end (`04ba5ac`); every vocabulary fetched, none hardcoded |

Older, with full write-ups: [`tasks-completed.md`](TODO/tasks-completed.md).
