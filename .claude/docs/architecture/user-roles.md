# User Roles & Authorisation (CampusVibe)

**Date:** rewritten 2026-08-18 (first version 2026-08-06) · **Branch:**
`feature/user-roles` · **Authors:** implementing agent
**Status:** ✅ Live — every rule described here is enforced by code that runs,
and the club half was exercised against the running stack.

**Code as of:** the uncommitted working tree that adds platform-admin access to
club dashboards. Everything else described here is committed.

> **This file was rewritten on 2026-08-18 and the previous version was wrong.**
> It described three platform roles, one club admin per club, a
> `clubs.club_admin_id` column and a `/club-dashboard` route — none of which
> exist. It also mixed a product specification for unbuilt dashboards into a
> description of shipped code. The spec content now lives in
> [`club_admin_governance.md`](club_admin_governance.md) and
> [`todo.md`](../../TODO/todo.md); this file describes only what runs.

**`V7__multi_role_rbac.sql:1` cites the old path `.claude/user-roles.md` and
always will.** Flyway checksums the whole file, so editing one comment in an
applied migration causes `Migration checksum mismatch` on every existing
database. The stale path is the cheaper of the two costs. See
[`database-lifecycle/SKILL.md`](../../skills/database-lifecycle/SKILL.md).

---

## In one paragraph

CampusVibe has two kinds of authority and they work differently on purpose.
**Platform roles** — `ROLE_USER` and `ROLE_ADMIN` — describe the account, travel
in the sign-in token, and change only when a human deliberately changes them.
**Club roles** — `CLUB_OWNER` and `CLUB_ADMIN` — describe a relationship with one
particular club, live in a database table, and are looked up fresh on every
single request, so removing somebody takes effect on their next click rather
than whenever their login expires. A platform admin can manage every club
without holding a club role in any of them. The one thing worth knowing before
changing anything here: there is no `ROLE_CLUB_ADMIN` and there must never be
one again — the reason is in *Design decisions*, and it is the single most
important decision in this area.

---

## Read this before you change anything here

- **The files that carry the logic:** `user/RoleName.java` (the two platform
  roles), `clubadmin/ClubRole.java` (the two club roles),
  `security/ClubPermissionService.java` (every club-scoped answer),
  `security/SecurityFilterChainConfig.java` (the URL rules), `jwt/JWTUtil.java`
  (what a token carries).
- **Do not add a club role to `RoleName`, or a club id to the JWT.** Both look
  like obvious optimisations and both reintroduce the same defect: a claim
  minted at sign-in outlives the access it names. `V14__remove_global_club_admin_role.sql`
  exists to undo exactly that.
- **Matcher order in `SecurityFilterChainConfig` is load-bearing.**
  `/api/v1/clubs/**` is `permitAll` for GET, so any club sub-path that must not
  be public has to be listed *above* that block. Four already are; a fifth added
  below it would silently become world-readable.
- **The club half is documented separately.**
  [`club-administration.md`](club-administration.md) covers assignments,
  invitations, ownership transfer and the audit log. This file covers the role
  model those things sit on. [`authentication.md`](authentication.md) covers how
  a token is obtained in the first place.
- **Frontend role checks are visibility only, everywhere, without exception.**
  `app/lib/user.tsx` says so in a comment and there is no counter-example in the
  codebase. Anything that looks like a frontend authorisation decision is a bug.

---

## Overview

**Platform roles are attributes of an account.** They live in `roles` and
`user_roles` (created by `V7`), are loaded eagerly onto `User`, and are turned
into Spring authorities by `User.getAuthorities()`, which maps each role name to
a `SimpleGrantedAuthority`. That is what makes `@PreAuthorize("hasRole('ADMIN')")`
work. They are copied into the JWT at sign-in and read from it on every
subsequent request — which is acceptable precisely because they change rarely
and only by deliberate human action.

**Club roles are relationships.** A row in `club_admin_assignments` says *this
user, in this club, holds this role, and it is currently active*. Nothing about
club management is stored on the account, nothing is copied into a token, and
every check is a fresh indexed lookup. This is what lets one person own the
robotics club while helping run the film society, and what makes removal
immediate.

**The two meet in `ClubPermissionService`.** Every club-scoped endpoint routes
through it. It answers from the assignments table, with one exception: a
platform `ROLE_ADMIN` short-circuits to true. That claim *is* read from the
token, which is fine — it describes the account rather than a relationship, and
it is granted and revoked by a human rather than by the club lifecycle.

---

## File-by-file breakdown

### Platform roles

**`user/RoleName.java`** — the enum, now `ROLE_USER` and `ROLE_ADMIN` only. Its
javadoc records why the third value was deleted; that comment is the primary
source and this document is the secondary one.

**`user/Role.java`**, **`user/RoleRepository.java`** — the entity for a row in
`roles`, looked up by name. Reference data, seeded by `V7`.

**`user/User.java`** — holds the roles as an eager `Set<Role>` (eager because
`getAuthorities()` is called outside any session), exposes `hasRole(RoleName)`
for service-layer checks and `getAuthorities()` for Spring Security. The
collection is returned as an unmodifiable view with an `addRole` mutator, so
`getRoles().add(...)` fails loudly rather than silently detaching from
Hibernate.

**`jwt/JWTUtil.java`** — issues a token whose subject is the user id, with
`email` and `roles` claims and a 15-day expiry. **No club ids, no permissions,
no profile data.** Ownership is always checked against the database.

**`bootstrap/AdminBootstrapRunner.java`** — how the first `ROLE_ADMIN` comes
into existence, since every admin path is behind `hasRole('ADMIN')` and there is
deliberately no unauthenticated endpoint to mint one. Grants only, never
revokes. See [`club-administration.md`](club-administration.md) and the
[`database-lifecycle`](../../skills/database-lifecycle/SKILL.md) skill.

### Club roles

**`clubadmin/ClubRole.java`** — `CLUB_OWNER` / `CLUB_ADMIN`. Enum order is
load-bearing: `ClubAdminService` sorts by it to put the owner first.

**`clubadmin/AssignmentStatus.java`** — `PENDING` / `ACTIVE` / `REVOKED` /
`EXPIRED`. Only `ACTIVE` grants anything.

**`clubadmin/ClubAdminAssignment.java`** — the row that *is* the club role.
Documented in full in [`club-administration.md`](club-administration.md).

### Where the two are enforced

**`security/ClubPermissionService.java`** — three questions, and every
club-scoped endpoint asks one of them:

| Method | True for | Guards |
|---|---|---|
| `canManageClub` | active owner · active admin · platform admin | the club page, its events, its team list, its activity log |
| `isClubOwner` | active owner · platform admin | inviting, removing, ownership transfer |
| `canManageEvent` | whoever `canManageClub` the event's organiser | event-scoped endpoints |

**`security/SecurityFilterChainConfig.java`** — URL-level rules, evaluated in
order. The shape that matters: a `permitAll` block makes `GET /api/v1/clubs/**`
public, and four club sub-paths are pulled back to `authenticated()` *above* it
— `/admins`, `/ownership-transfer`, `/audit-logs` and `/managed`. Everything not
listed falls through to `anyRequest().authenticated()`, which is why the
club-scoped POST and DELETE methods need no line of their own.

**`user/UserDetailsServiceImpl.java`** — *not read during this rewrite; listed
here so its absence is not mistaken for an oversight.*

### Frontend

**`app/types/index.ts`** — `Role` is `USER` / `ADMIN`. `ClubRole` is a separate
type, deliberately not part of the same enum. `ManagedClub.role` is nullable,
for a platform admin managing a club they hold no role in.

**`app/lib/user.tsx`** — `hasRole`, `isAdmin`, `isRegularUser`. There is
deliberately **no `isClubAdmin(user)`**, and the comment where it used to be
explains why: no property of the user object can answer *may they manage a
club*, because the answer depends on which club.

**`app/lib/managed-clubs-context.tsx`** — asks the server which clubs the caller
manages, holds the answer once for the app, and fails closed. This is what
replaced the deleted role check.

**`app/lib/manage-club-context.tsx`** — the one club the current
`/manage/[clubId]` screen is about, resolved by the layout from
`GET /clubs/{id}/managed` so that a platform admin — who is on nobody's managed
list — can open a dashboard.

**`app/components/ProtectedRoute.tsx`** — authentication only. It checks that
somebody is signed in; it makes no role decision.

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| `ROLE_CLUB_ADMIN` deleted outright (`V14`) | A role claim in a JWT outlives the access it names, so a removed administrator keeps working access until their token expires | Keeping it as a derived flag synced from assignments | The revocation window returns, and the flag can silently drift from the table |
| Club authority read from the database per request | Same as above | Trusting token claims and accepting staleness | Revocation stops being immediate — the whole point of the club-roles work |
| Platform roles stay in the JWT | They describe the account, change rarely, and only by deliberate human action, so staleness is bounded and acceptable | Reading them per request too | An extra query on every request to solve a problem that does not exist here |
| Platform `ADMIN` bypasses club scope | Somebody must be able to run a club with no owner, and to fill in club details before any owner exists | Giving platform admins real assignments in every club | Hundreds of synthetic rows to maintain, and 'who actually runs this club' stops being answerable from the table |
| The JWT carries no club ids or permissions | Same staleness argument, plus a token is a poor place for data that grows | Embedding a managed-club list | Token size grows with membership, and every membership change needs a re-issue |
| Frontend role checks are visibility only | The browser is not a trust boundary | Trusting the frontend for low-risk reads | One forgotten backend check becomes an exposure rather than a redundancy |

### Task-specific

**`ManagedClubDTO.role` is nullable rather than gaining a `PLATFORM_ADMIN`
value.** A platform admin's authority is a property of their account, not a
relationship with the club. Adding `PLATFORM_ADMIN` to `ClubRole` would let
every `role == CLUB_OWNER` comparison in the codebase quietly disagree about
whether it counts. Null forces each caller to decide explicitly, and
`ClubRoleBadge` renders it as a distinct *Platform admin* chip rather than
pretending they own the club.

**Creating a club is `hasRole('USER')`, not `hasRole('ADMIN')`.** Any
authenticated user may create a club page; managing it afterwards requires an
assignment, which arrives through the club-admin-request queue. Cited from
`ClubController.java`.

**`user_roles` has `(user_id, role_id)` as its primary key.** That is what makes
the bootstrap runner's grant idempotent rather than merely tidy: a duplicate
grant would throw and take startup with it, so the runner checks first.

---

## Known deviations, gaps and blockers

- **Admin-only endpoints are still few.** Today `hasRole('ADMIN')` guards only
  the club-admin-request queue (list, approve, reject) and
  `POST /api/v1/search/reindex`. The Admin Dashboard described in
  [`todo.md`](../../TODO/todo.md) — managing users, moderating events, creating
  clubs from an admin surface — is not built, so the role is currently narrower
  in practice than the model implies.
- **There is no way to grant or revoke `ROLE_ADMIN` through the product.** The
  bootstrap runner grants at startup from an environment variable and never
  revokes; taking the role away means a database statement. Fine while there is
  one administrator, and the first thing to build if there is ever a second.
- **No moderator or faculty-advisor role, and no granular permissions.**
  Deliberately: §43 of the governance spec rules out granular club permissions,
  and nothing yet needs a platform role between user and admin.
- **`user/UserDetailsServiceImpl.java` is undocumented above** — it was not read
  during this rewrite, and naming it as unread is more useful than guessing from
  its filename.
- **This document previously claimed to be binding on the role model while
  being wrong about it.** Anything that read it between 2026-08-17 and
  2026-08-18 and acted on the club-role sections acted on fiction.

## Possible improvements

1. **An admin surface for platform roles** (unscheduled, wants a second
   administrator to exist first) — promote and demote from the Admin Dashboard,
   with the same audit treatment club actions now get.
2. **Audit platform-role changes.** `club_audit_logs` records club actions;
   granting `ROLE_ADMIN` — the most consequential change available — is recorded
   only in a startup log line. Blocked on nothing; worth doing with improvement 1.
3. **Shorten the JWT lifetime.** Fifteen days is generous for a token whose
   platform-role claims cannot be revoked before expiry. Trade-off is re-auth
   frequency; wants the refresh-token decision in
   [`authentication.md`](authentication.md) settled first ([BUG-003]).

## Change log

- 2026-08-06 — moved here from `.claude/user-roles.md`, unverified against the
  code. Main session.
- 2026-08-17 — superseded banner added after `ROLE_CLUB_ADMIN` was deleted and
  club authority moved to `club_admin_assignments`. Implementing agent.
- 2026-08-18 — **rewritten against the code.** Two platform roles and two club
  roles, how each is stored and checked, the platform-admin bypass, and the
  frontend's visibility-only role. The unbuilt-dashboard specification that made
  up roughly half the previous file was dropped rather than carried forward —
  it is a product spec, and this is an implementation doc. Implementing agent.
