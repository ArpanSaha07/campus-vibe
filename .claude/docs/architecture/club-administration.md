# Club Administration & Authorisation (CampusVibe)

**Date:** 2026-08-17 · **Branch:** `feature/user-profile` ·
**Authors:** implementing agent (backend, frontend, tests)
**Status:** ✅ Live — migrations applied against real PostgreSQL, endpoints and
dashboard verified in the running stack.

**Code as of:** dcbe55d (plus the uncommitted working tree this document
describes; the change is not yet committed).

The spec this implements is
[`club_admin_governance.md`](club_admin_governance.md). That file is the
*design*, written before the code and covering fifteen MVP items. **This file
describes what actually shipped, which is items 1–4 of that list.** Where the two
disagree, this one describes reality.

---

## In one paragraph

Running a club is no longer something your account *is*, it is a relationship
you have with one particular club. Before this, a club had a single admin
recorded on the club row, and that person carried a permanent `ROLE_CLUB_ADMIN`
badge on their account. Now a club can have one owner and any number of admins,
one person can help run several clubs, and the badge is gone entirely — the
permission is looked up per request, so removing someone takes effect on their
very next click instead of whenever their login expires. What is built so far is
the *reading* half: the new data model, the authorisation rewrite, and a
club-management dashboard at `/manage/[clubId]` showing the club's numbers, its
events and its team. Inviting admins, removing them, transferring ownership and
the activity log are not built yet — the Administrators screen lists people but
has no buttons.

---

## Read this before you change anything here

- **`club_admin_assignments` is the only source of club authority.** Not the
  JWT, not a role. `ClubPermissionService.canManageClub` is the one function
  every club-scoped endpoint routes through.
- **The files that carry the logic:**
  `security/ClubPermissionService.java` (who may do what),
  `clubadmin/ClubAdminService.java` (reads and the first-owner grant),
  `clubadmin/ClubAdminAssignment.java` (the state machine),
  `V12__create_club_admin_assignments.sql` (the invariants).
- **The invariant that is easy to break:** exactly one `ACTIVE` `CLUB_OWNER` per
  club. It is held by a partial unique index *and* by a service-layer check.
  Both are tested; do not remove either. The service check gives a message a
  user can act on, the index survives a race between two approvals.
- **Integration tests need Docker.** `*IT` runs on real PostgreSQL + pgvector
  (`PostgresTestContainer`) with `ddl-auto: validate`, so an entity that drifts
  from a migration fails a test instead of a container boot. `*Test` unit suites
  are still H2 and still fast.
- **Do not reintroduce a club-admin role claim,** however convenient. The
  reason is in `V14__remove_global_club_admin_role.sql` and is the single most
  important decision in this change.
- **Binding elsewhere:**
  [`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md) for
  any further migration, [`design-guidelines.md`](../../design-guidelines.md)
  for the dashboard UI, and `contracts/api-dto-fields.json` — two DTOs were
  added there and both test suites assert against it.
- **[`user-roles.md`](user-roles.md) is now actively wrong** about
  `ROLE_CLUB_ADMIN` and about `Club.club_admin_id`. Its banner already says not
  to trust it; this document supersedes it on everything club-related.

---

## Overview

Three ideas carry the whole design.

**Authority is a relationship, not an attribute.** A row in
`club_admin_assignments` says *this user, in this club, holds this role, and it
is currently active*. Nothing about club management is stored on the user. This
is what lets one person own the robotics club while helping run the film
society, which the previous `clubs.club_admin_id` column could not express at
all.

**Authority is read fresh on every request.** The old model put
`ROLE_CLUB_ADMIN` in the JWT, so an administrator removed from a club kept
working access until their token expired — they could go on editing events for
hours. Every check now hits an indexed existence query instead. That is a
deliberate trade of a database round trip for correctness, and it is the reason
`RoleName` has only two values.

**Owner and admin differ only in who they can change.** Both manage the club
page and its events. Only the owner touches people: inviting admins, removing
them, handing over ownership. Neither can change the club's official email —
that is a platform-admin act, so the club's recovery channel cannot be captured
by whoever currently controls the club.

Clubs launch with nobody in charge. The first owner arrives through the existing
club-admin-request queue: a student asks, a platform admin approves, and the
approval writes an active `CLUB_OWNER` assignment. Every later change of hands
is meant to be an ownership transfer, which is not built yet.

---

## File-by-file breakdown

### Migrations

**`V12__create_club_admin_assignments.sql`** — creates the table, its two
partial unique indexes and two lookup indexes, backfills every existing
`clubs.club_admin_id` as an active owner, then drops that column. The backfill
sits in a schema migration rather than a seeder because it only makes sense
between creating the table and dropping the column.

**`V13__add_club_official_email.sql`** — adds `clubs.official_email` and
`official_email_verified_at`, both nullable. Nullable because every existing
club predates the column.

**`V14__remove_global_club_admin_role.sql`** — deletes `ROLE_CLUB_ADMIN` from
`user_roles` and then `roles`. V7 inserts that row and cannot be edited, so on a
fresh database it is created there and removed here.

### Backend — `com.campusvibe.clubadmin`

**`ClubRole.java`** — `CLUB_OWNER` / `CLUB_ADMIN`. Enum order is load-bearing:
`ClubAdminService` sorts by it to put the owner first.

**`AssignmentStatus.java`** — `PENDING` / `ACTIVE` / `REVOKED` / `EXPIRED`. Only
`ACTIVE` grants anything; the rest exist so history survives.

**`ClubAdminAssignment.java`** — the entity, plus `activate()` and
`revoke(revokedBy)`, which keep the status and its timestamp in step. `club` and
`user` are lazy `@ManyToOne`; `invitedByUserId` and `revokedByUserId` are plain
`Long`s deliberately, so authorisation does not load two more associations.

**`ClubAdminAssignmentRepository.java`** — the hot path is
`existsByClubIdAndUserIdAndStatus`, an existence check that hits the partial
index and loads no entity. The two list queries carry `@EntityGraph` to avoid
N+1s.

**`ClubAdminService.java`** — `listManagedClubs`, `listAdmins`, and
`assignFirstOwner`, which refuses a club that already has an owner. Performs no
authorisation of its own; callers arrive pre-cleared by `@PreAuthorize`.

**`ClubAdminController.java`** — `GET /api/v1/clubs/{clubId}/admins` and
`GET /api/v1/users/me/managed-clubs`. No class-level `@RequestMapping` because
the two paths sit under different roots on purpose: the second never takes a
user id from the URL.

**`ClubAdminDTO.java`**, **`ManagedClubDTO.java`** — both added to
`contracts/api-dto-fields.json`. `ManagedClubDTO` is separate from `ClubDTO`
specifically so `officialEmail` cannot leak onto a public club page.

**`ClubAdminRequestService.java`** (modified) — `approve` now calls
`assignFirstOwner` instead of granting a role and stamping `club_admin_id`, and
records the approving admin. `create` refuses clubs that already have an owner.

### Backend — elsewhere

**`security/ClubPermissionService.java`** — rewritten. `canManageClub` for
content, `isClubOwner` for people, `canManageEvent` delegating through the
event's organiser. Platform `ROLE_ADMIN` bypasses all three.

**`security/SecurityFilterChainConfig.java`** — one matcher added,
`GET /api/v1/clubs/*/admins → authenticated()`, placed *above* the `permitAll`
block. Order is the whole point: `/api/v1/clubs/**` is public, so without this
line a club's roster of names and emails would be world-readable.

**`user/RoleName.java`** — `ROLE_CLUB_ADMIN` removed.

**`club/Club.java`**, **`ClubRepository.java`**, **`ClubService.java`**,
**`ClubController.java`** — `clubAdminId` and everything reading it removed;
`officialEmail` added. `GET /clubs/my-club` deleted, superseded by
`/users/me/managed-clubs`.

### Frontend

**`app/lib/managed-clubs-context.tsx`** — holds the managed-club list once for
the app and exposes `roleIn` / `isOwnerOf`. Loads eagerly once auth settles,
unlike `FollowedClubsProvider` which waits for a consumer, because the navbar
consumes it on every page. Fails closed.

**`app/(protected)/manage/page.tsx`** — the club picker; redirects straight
through when the user manages exactly one club.

**`app/(protected)/manage/[clubId]/layout.tsx`** — the shell: club identity,
role badge, sidebar, and the access check. `use(params)` because `params` is a
promise in Next 16.

**`app/(protected)/manage/[clubId]/page.tsx`** — Overview: three stat tiles, the
next four events, and the official-email panel.

**`.../events/page.tsx`** — upcoming/past tabs. Date-based, because `events` has
no status column.

**`.../admins/page.tsx`** — the team list, read-only, with a role-aware note
explaining who can change it.

**`app/components/manage/ManageSidebar.tsx`**, **`ClubRoleBadge.tsx`** — the
rail and the owner/admin chip.

**`app/(protected)/club-dashboard/page.tsx`** — now a redirect to `/manage`.

**`app/components/Navbar.tsx`**, **`app/lib/user.tsx`**,
**`app/types/index.ts`** — `isClubAdmin` deleted, `Role.CLUB_ADMIN` deleted, nav
gating moved onto the managed-clubs list.

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| Authority lives in `club_admin_assignments` only | One admin per club, and no way to express one person managing two clubs | Keeping `club_admin_id` and adding a side table | Multi-admin clubs become unrepresentable again |
| `ROLE_CLUB_ADMIN` deleted outright | A role claim in a JWT outlives the access it names, so a removed admin keeps working | Keeping it as a derived flag, synced from assignments | The revocation window returns, and the flag can silently drift from the table |
| Per-request database lookup | Same as above | Trusting token claims and accepting staleness | Revocation stops being immediate |
| Platform `ADMIN` bypasses club scope | Someone must be able to fix an abandoned club | Making platform admins hold assignments too | No recovery path when a club has no owner |
| `official_email` is admin-only, enforced by omission from `ClubUpdateRequest` | The recovery channel must not be capturable by whoever controls the club | A runtime role check inside the update path | One forgotten check exposes it; with no field, there is no path to forget |

### Task-specific

**Two partial unique indexes, not one plain UNIQUE.** `one_active_owner_per_club`
is `UNIQUE (club_id) WHERE role = 'CLUB_OWNER' AND status = 'ACTIVE'`, so
historical owner rows do not collide with the sitting one.
`one_live_assignment_per_club_user` covers `PENDING` and `ACTIVE` only — a plain
`UNIQUE (club_id, user_id)` would make it impossible to re-invite a returning
exec without destroying the record of their earlier removal, which §7 requires
keeping.

**Owner-first ordering happens in Java, not SQL.** `role` is
`@Enumerated(STRING)`, so `ORDER BY role` sorts the text and puts *CLUB_ADMIN*
above *CLUB_OWNER* — the opposite of what is wanted. This was a real failing
test, not a hypothetical. `ClubAdminService.listAdmins` sorts by enum ordinal
instead; a stable sort preserves the SQL `created_at` order within each role.

**Approval refuses rather than replaces.** `assignFirstOwner` throws if the club
already has an owner, so a platform admin working through a stale queue cannot
depose a sitting owner by clicking approve. Covered by
`approvingAStaleRequestCannotDeposeTheSittingOwner`.

**The dashboard is `/manage/[clubId]`, not `/club-dashboard`.** The club id has
to be in the URL now that a user may manage several, so that a link to one
club's Events is shareable. The old path redirects rather than 404s, and
temporarily rather than permanently — a permanent redirect is cached by browsers
and hard to undo.

**Frontend shows the same 'you don't manage this club' message for a missing
club and a forbidden one.** Telling an outsider that a club exists but is closed
to them is more than they need.

---

## Known deviations, gaps and blockers

- ~~The database half of the single-owner invariant is untested.~~ **Closed
  2026-08-17**, later the same day: every `*IT` now runs on real PostgreSQL +
  pgvector through `PostgresTestContainer`, with Flyway enabled and
  `ddl-auto: validate`. Both partial unique indexes are covered by
  `databaseRefusesASecondActiveOwner`,
  `databaseAllowsANewOwnerOnceTheOldRowIsRevoked` and
  `databaseRefusesTwoLiveAssignmentsForOneUser`. Running the ITs now needs a
  working Docker daemon; the `*Test` unit suites still do not.
- **MVP items 5–15 are not built.** No invitations, no removal, no ownership
  transfer, no audit log, no notifications, no annual review, no recovery. The
  Administrators screen is a list with no actions.
- **No platform-admin UI for `official_email`.** The column exists and nothing
  can write it. Every club has `NULL` today, so the official-email verification
  in §6 has nothing to verify against — which is why invitations were scoped to
  invitee-acceptance-only.
- **`events` has no lifecycle status,** so the Events tab splits by date.
  Queued as P1 in `todo.md`; the trap recorded there is that every public read
  path must filter on status or drafts leak.
- **No club admin can currently exist through the product.** Creating one needs
  a platform `ADMIN` to approve a request, and there is still no admin account —
  the bootstrap runner is unbuilt. Verification for this work used a direct
  database insert, since removed.
- **`user-roles.md` now contradicts the code** in more places than its banner
  admits. It still describes `ROLE_CLUB_ADMIN`, `club_admin_id` and
  `/club-dashboard`.
- Pre-existing and untouched: `SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords`
  still fails ([BUG-001](../../bugs/bugs.md#bug-001)).

## Possible improvements

1. **A stale backend image can silently run old code** (P2, queued). Not caused
   by this change, but this change is what made it bite: `backend/Dockerfile`
   copies a host-built jar, and `develop.watch` only syncs a fresh one while
   `docker compose watch` is running. Recreating the container any other way
   boots the jar baked in at image-build time — which, against a database the
   newer jar has already migrated, fails as
   `Schema-validation: missing column [club_admin_id] in table [clubs]`. The
   error names the symptom and not the cause. Workaround today:
   `docker compose build backend` after any `mvn package`.
2. **Admin bootstrap runner** (P1, unblocked, already queued) — until it exists
   the first-owner path cannot be exercised through the product at all.
3. **Invitations + removal** (next slice) — needs `AuthTokenService` extended
   with club-scoped purposes; that service already has the right token
   discipline (CSPRNG, hash-at-rest, single use, expiry).
4. **Audit log** (blocked on nothing, but worth doing with removal and transfer,
   since those are the actions most worth recording).
5. **Fold `revokedByUserId` into the audit log** once it exists — the field
   duplicates what an audit entry would hold, and was kept only because there is
   nowhere else to record who removed whom.

## Change log

- 2026-08-17 — created, covering MVP items 1–4 of
  [`club_admin_governance.md`](club_admin_governance.md): the assignment table,
  the two club roles, the one-owner invariant, the authorisation rewrite, and
  the read-only `/manage/[clubId]` dashboard. Implementing agent.
- 2026-08-17 — integration tests moved onto real PostgreSQL + pgvector
  (`PostgresTestContainer`, `application-it.yml`), with `ddl-auto: validate`.
  Closes the untested-invariant gap this document reported the same day, and
  corrects an overstatement in it: `SearchIT` and `SearchRateLimitIT` were
  *already* on Testcontainers, so the migrations did run — what was missing was
  schema validation against the entities, which is the check that catches drift
  like the dropped `club_admin_id`. Implementing agent.
