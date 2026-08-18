# Club Administration & Authorisation (CampusVibe)

**Date:** 2026-08-17, extended 2026-08-18 (twice) · **Branch:** `feature/user-roles` ·
**Authors:** implementing agent (backend, frontend, tests)
**Status:** ✅ Live — migrations applied against real PostgreSQL, endpoints and
dashboard verified in the running stack.

**Code as of:** the uncommitted working tree adding the activity log; ownership
transfer and the admin bootstrap are committed ahead of it.

The spec this implements is
[`club_admin_governance.md`](club_admin_governance.md). That file is the
*design*, written before the code and covering fifteen MVP items. **This file
describes what actually shipped, which is items 1–5 and 7–10 of that list.**
Where the two disagree, this one describes reality.

---

## In one paragraph

Running a club is no longer something your account *is*, it is a relationship
you have with one particular club. Before this, a club had a single admin
recorded on the club row, and that person carried a permanent `ROLE_CLUB_ADMIN`
badge on their account. Now a club can have one owner and any number of admins,
one person can help run several clubs, and the badge is gone entirely — the
permission is looked up per request, so removing someone takes effect on their
very next click instead of whenever their login expires. On top of that data
model sits a club-management dashboard at `/manage/[clubId]`, and an owner can
now build their own team from it: invite an administrator by email address —
whether or not that address has a CampusVibe account yet — and remove one, or
cancel an invitation, from the same list. The invitee accepts by signing in and
clicking Accept at `/invitations`; there is no token in the link, because the
session proves more than a forwarded secret would. An owner can also hand the
club on: they offer it to one of their admins, choose whether they stay or
leave, and the successor accepts on that same screen — at which point one
transaction demotes one and promotes the other, so the club is never left with
nobody or two people in charge. All of it lands in an activity log the whole
team can read and nobody can rewrite — the database refuses an update or a
delete on that table outright, so the guarantee does not rest on the application
behaving itself.

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
- **`club_audit_logs` is append-only, enforced by a trigger.** `UPDATE` and
  `DELETE` raise an exception (§22). Tests reset it with `TRUNCATE`, which
  fires statement-level triggers only — that is the intended and only escape
  hatch, and nothing in the application issues it. The table has no foreign
  keys, so the history outlives the club and the accounts it names.
- **The ordering inside `ClubOwnershipService.accept` is deliberate.** The old
  owner is demoted *and flushed* before the new one is promoted, because
  `one_active_owner_per_club` is a partial unique index and PostgreSQL checks
  those per statement — a partial index cannot be DEFERRABLE, so there is no
  moment when two rows may both be owners. Measured: removing the flushes still
  passes today, because Hibernate happens to emit the updates in the order they
  were dirtied. That is not a guarantee. Do not "simplify" them away.
- **The security boundary of the invitation flow is one `if`.**
  `ClubAdminService.claimableBy` refuses to let an account with an unconfirmed
  address answer an invitation. Sign-up does not require confirming an address
  (`campusvibe.auth.require-verified-email` is off by default), so without that
  line, registering the invitee's address first is enough to steal their
  invitation. Covered by
  `anUnconfirmedAccountCannotClaimAnInvitationToItsAddress`.
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
them, handing over ownership. That split is what keeps a single compromised
club-admin account from becoming two — an admin can edit an event, but cannot
bring in an accomplice. Neither can change the club's official email — that is a
platform-admin act, so the club's recovery channel cannot be captured by whoever
currently controls the club.

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

**`V17__create_club_audit_logs.sql`** — the activity log, plus the
`refuse_club_audit_log_mutation` trigger that makes it append-only. No foreign
keys anywhere in the table, deliberately: a key would make the history only as
durable as the thing it describes, and a club being deleted is when its history
is most worth having. `metadata` is `jsonb`, mapped as `Map<String, String>` so
every value is already something safe to display.

**`V16__create_club_ownership_transfers.sql`** — a handover waiting on the
successor. Could not be a PENDING `CLUB_OWNER` row in
`club_admin_assignments`, because the successor is already an ACTIVE
`CLUB_ADMIN` there and `one_live_assignment_per_club_user` forbids a second
live row for the same person in the same club. Carries `outgoing_becomes`,
which no assignment row has anywhere to put, and two CHECKs — a transfer has
two distinct parties, and `resolved_at` is set exactly when the status is not
PENDING.

**`V15__invite_club_admins_by_email.sql`** — drops `NOT NULL` from `user_id`,
adds `invited_email`, and adds two CHECK constraints plus a partial unique index
on `(club_id, lower(invited_email))`. The nullability is what lets an invitation
name someone who has not signed up yet; the constraints are what stop that from
weakening anything — a row must name somebody, and an `ACTIVE` row must name an
*account*, never just a mailbox.

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

**`ClubAdminService.java`** — `listManagedClubs`, `listAdmins`,
`assignFirstOwner` (which refuses a club that already has an owner), and the
invitation lifecycle: `invite`, `listInvitations`, `acceptInvitation`,
`declineInvitation`, `revoke`. Performs no authorisation of its own with one
stated exception — `claimableBy`, which decides whether an invitation belongs to
the caller, because no `@PreAuthorize` expression can answer that without the
row in hand.

**`ClubAuditService.java`** — the one place audit entries are written (§35).
Writes join the caller's transaction rather than opening their own: an action
that happened without being logged is a hole in the record, and one logged
without happening is a lie. Also serves the paged read.

**`ClubAuditLog.java`**, **`ClubAuditAction.java`**, **`AuditEntityType.java`**,
**`ClubAuditLogDTO.java`**, **`ClubAuditLogRepository.java`** — the entity, the
eight actions recorded so far, and a repository with no update or delete on it.
The DTO carries the raw action and metadata rather than a rendered sentence, so
fixing the wording is a frontend change.

**`ClubOwnershipService.java`** — `offer`, `cancel`, `cancelTransfersTo`,
`accept`, `decline`. Its own service, per §34, because it is the only thing in
the application that moves authority between two people; everything in it
exists to make that one act atomic.

**`ClubOwnershipTransfer.java`**, **`TransferStatus.java`**,
**`OwnershipTransferDTO.java`**, **`OwnershipTransferRequest.java`** — the
entity with its `OutgoingOwner` nested enum, the four outcomes, and the two
wire shapes. The request takes a user id rather than an address, because
ownership can only pass to an existing admin.

**`ClubInvitationDTO.java`**, **`ClubAdminInviteRequest.java`** — the invitee's
view of an invitation, and the owner's request to create one. The request record
carries *only* an address: with no `role` field there is no payload that could
ask for `CLUB_OWNER`.

**`ClubAdminController.java`** — seven endpoints across three roots, which is
why there is no class-level `@RequestMapping`. Under `/clubs/{clubId}/admins`:
`GET` the team (`canManageClub`), `POST .../invitations` and
`DELETE .../{assignmentId}` (both `isClubOwner`). Under `/users/me`:
`managed-clubs`, `club-invitations`, and accept/decline on a single invitation —
none of which take a user id from the URL, so one user cannot enumerate or
answer another's.

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

**`.../admins/page.tsx`** — the team list, plus the owner's invite form and a
remove control on every row but the owner's. A pending invitation is a row in
the same list rather than a section of its own: the owner's question is "who is
on my team", and someone invited last Tuesday who has not answered belongs in
that answer.

**`.../activity/page.tsx`** — the club's history, newest first, with Load more.
`describe()` turns an entry into a sentence in the browser, so the wording lives
beside the rest of the copy and an entry written a year ago is described in
today's words. It has a default branch for an action this build does not know
about — a newer backend, or a retired action — because showing the raw name
beats crashing the page.

**`app/(protected)/invitations/page.tsx`** — where the invitation email lands.
Outside `/manage` deliberately: the person opening the link may manage nothing
at all, and `/manage` is not in their navbar.

**`app/components/manage/ManageSidebar.tsx`**, **`ClubRoleBadge.tsx`** — the
rail and the owner/admin chip.

**`app/(protected)/club-dashboard/page.tsx`** — now a redirect to `/manage`.

**`app/components/Navbar.tsx`**, **`app/lib/user.tsx`**,
**`app/types/index.ts`** — `isClubAdmin` deleted, `Role.CLUB_ADMIN` deleted, nav
gating moved onto the managed-clubs list. The navbar also grew a counted
`Invitations` link, shown only while there is something to answer; someone
invited before they managed anything has no other route in, since `/manage` is
hidden from them.

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
| Invitations are PENDING rows in `club_admin_assignments`, not a second table | An invitation and an assignment differ by one field; acceptance is a status change rather than a copy between tables that could half-fail | The separate `club_admin_invitations` table §23.4 offers | Two tables to keep in step, and a window where a row exists in both or neither |
| An invitation may name an address with no account | The incoming treasurer is frequently not on CampusVibe in August; a user picker can only offer accounts that already exist | Existing accounts only | The owner is told to go and chase a signup before they can do the thing they came to do |
| Claiming an invitation requires a confirmed address | Sign-up does not require confirming one, so the address on an account proves nothing by itself | Matching the account's email string alone | Registering someone's address first is enough to steal their invitation |
| The audit log is append-only by database trigger | §22 requires that a club admin cannot delete the entry recording what they did | Repository discipline — expose no delete | The guarantee lives in code review, and the person likeliest to add a delete is the one the rule constrains |
| `club_audit_logs` has no foreign keys | A key makes the history only as durable as what it describes, and a club being deleted is when its history matters most | `club_id REFERENCES clubs ON DELETE CASCADE` | Deleting a club destroys the record of how it was run |
| Actor and target names are snapshotted, not joined | The line must still read after the account is renamed or deleted, and should say what it said that day | Joining `users` at read time | A rename silently rewrites history; a deleted account blanks it |
| A pending transfer is its own table, not a PENDING CLUB_OWNER row | The successor already holds a live assignment row, which `one_live_assignment_per_club_user` makes unique per (club, user) | Relaxing that index to include `role` | "One live relationship per person per club" stops holding, and the invitation logic that leans on it gets subtler |
| Ownership passes only to an existing active admin | The successor has already accepted an invitation, so they proved their address and agreed to be involved | Offering to any address, like invitations | "Should this person help run the club" and "should they own it" collapse into one click |
| The outgoing owner picks whether they stay | §8 asks for it, and the graduating case and the continuing-exec case are genuinely different | Always demote to CLUB_ADMIN | Someone handing over because they are leaving stays listed on a club they left |
| Acceptance is an authenticated POST, with no token in the link | The session proves identity; a mailed token proves only that its holder read the message | A `CLUB_ADMIN_INVITATION` purpose on `AuthTokenService` | A forwardable, inbox-resident credential, plus `issue()` deleting one club's invitation when a second club sends one |

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

**Removal and cancelling an invitation are one endpoint.** They are the same act
on the same row — the status it was in decides only which email goes out. Two
endpoints would mean two authorisation checks and two chances to get one wrong.

**Addressed by assignment id, not user id.** §33 sketches
`DELETE /clubs/{clubId}/admins/{userId}`. An invitation to an address with no
account has no user id and still has to be cancellable, so the assignment id —
the only identifier every row on the list actually has — is what the endpoint
takes. The club in the path is checked against the row rather than trusted: the
`@PreAuthorize` cleared the caller for *that* club, so without the check an
owner of one club could revoke in another by sending its assignment id.

**Owner rows are refused to everybody, platform admins included.** An owner
removing themselves leaves nobody who can invite anyone (§36); an owner removed
by someone else is an ownership change in disguise. Both belong in transfer,
which ends one role and starts the other in a single transaction. The platform
admin's escape hatch is §15's recovery workflow, which is not built.

**A declined invitation is REVOKED by the invitee, not deleted.** The four
statuses in §6.1 have no DECLINED, and adding one would mean a new CHECK
constraint for a distinction the `revoked_by_user_id` column already draws: the
invitee's own id there means declined, the owner's means cancelled.

**Everything is re-read when a transfer is accepted, not trusted from when it
was offered.** An offer can sit for days. The successor may have been removed
from the club since, and the sitting owner may no longer be the person who made
the offer. A transfer that promoted someone no longer on the team, or demoted
someone who is no longer the owner, would be worse than one that refuses — so
`accept` re-reads both assignment rows and refuses with a sentence if either has
moved.

**Removing an admin cancels a handover offered to them.** Otherwise the row sits
PENDING for a person who cannot accept it, holding the club's single transfer
slot against one that could complete. `ClubAdminService.revoke` calls
`ClubOwnershipService.cancelTransfersTo` for that reason.

**No transfer id in the club-scoped paths.** `POST`, `GET` and `DELETE` on
`/clubs/{clubId}/ownership-transfer` all address the club's one pending
handover, which `one_pending_transfer_per_club` guarantees is at most one. An id
in the path would be a second way to name the same row and a second thing to
check against the club.

**Invitations live on `ManagedClubsProvider` rather than fetching per page.**
The navbar needs the count on every page anyway, and accepting changes both the
invitation list and the club list, so one `refresh()` covers both. The two
requests run through `Promise.allSettled`, not `all` — an unreadable invitation
list must not make the app believe the user manages nothing.

---

## Known deviations, gaps and blockers

- **A transfer never expires.** An offer nobody answers stays PENDING forever and
  holds the club's one transfer slot, though the owner can withdraw it at any
  time. Same shape as the invitation-expiry gap, and worth fixing in the same
  change.
- ~~The database half of the single-owner invariant is untested.~~ **Closed
  2026-08-17**, later the same day: every `*IT` now runs on real PostgreSQL +
  pgvector through `PostgresTestContainer`, with Flyway enabled and
  `ddl-auto: validate`. Both partial unique indexes are covered by
  `databaseRefusesASecondActiveOwner`,
  `databaseAllowsANewOwnerOnceTheOldRowIsRevoked` and
  `databaseRefusesTwoLiveAssignmentsForOneUser`. Running the ITs now needs a
  working Docker daemon; the `*Test` unit suites still do not.
- ~~**MVP items 5–15 are not built.**~~ **Items 5, 7, 8, 9 and 10 landed
  2026-08-18** — invitation by address, acceptance, decline, removal,
  cancellation, ownership transfer, the audit log and the Activity tab. Still
  unbuilt: **items 6 and 11–15** — official-email verification, notification
  separation, annual review, platform-admin recovery.
- **Ownership transfer skips §8's official-email confirmation,** for the same
  reason invitations skip §6's: there is no address to confirm against. What
  remains is owner authorisation plus incoming acceptance, which is two of the
  three factors §8 asks for. The third arrives with item 6.
- **A platform admin cannot open any club's dashboard**, though the backend lets
  them call every endpoint on it. `ClubPermissionService` answers yes for
  `ROLE_ADMIN`, but the frontend guard in `manage/[clubId]/layout.tsx` checks
  the caller's *assignments*, and a platform admin has none — so `/manage/x`
  shows "You don't manage this club" while `curl` against the same club
  succeeds. Pre-existing, and invisible until 2026-08-18 when the bootstrap
  runner made a platform admin exist for the first time. It blocks nothing today
  and is the natural thing to settle alongside §15 recovery, which is the
  workflow that actually needs an admin inside a club they do not belong to.
- **The audit log records administration and ownership only.** Club-page edits
  and event changes are not logged, so a club whose team has been stable has an
  empty Activity tab — §21's own example shows both, and they arrive with
  `EventService.update` (BUG-006), which that work has to touch anyway.
- **There is still no way out of an ownerless club.** Transfer needs a sitting
  owner to start it, so a club whose owner's account is deleted, or which never
  had one, cannot acquire one except through the club-admin-request queue — and
  that path refuses a club that already has an owner. §15 recovery, which is the
  real answer, needs a platform admin to exist.
- **Item 6, official-email verification, is deliberately skipped rather than
  done.** §6 puts a verification to the club's official address in the middle of
  the invitation flow. Every club's `official_email` is NULL and nothing can set
  one, so that step would verify against nothing. The flow is therefore
  invitee-acceptance-only, and the §17 security notices are written and wired
  but no-op until a club has an address. When the platform-admin screen lands,
  the notices start working with no further change; the verification step is the
  part that has to be added.
- **Invitations never expire.** `EXPIRED` exists in `AssignmentStatus` and
  nothing sets it. A PENDING row grants nothing, so a stale invitation is
  clutter rather than exposure — but it does hold the
  `one_live_invite_per_club_email` slot, so an owner who mistypes an address must
  cancel before re-inviting. A TTL and a sweep belong with the audit log.
- **Mail failures are invisible to the caller by design.** `MailSender`
  implementations must not throw, so an invitation returns 201 whether or not the
  message went out. Verified live on 2026-08-18: this machine's SMTP credentials
  fail authentication, the invite still succeeded, and the failure was logged by
  `SmtpMailSender`. That is the intended contract — but it means "the invitation
  was sent" in the UI means "the row exists", and a club whose invitee never
  received anything has no signal. Worth a delivery status once notifications
  exist.
- **No platform-admin UI for `official_email`.** The column exists and nothing
  can write it.
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
3. ~~**Invitations + removal**~~ — **done 2026-08-18**, and *without* extending
   `AuthTokenService`, which is what this entry originally proposed. Requiring
   the invitee to sign in and POST turned out to be both simpler and stronger
   than mailing a token: nothing forwardable, nothing sitting in an inbox, and no
   need for a context column on `auth_tokens` to stop two clubs' invitations to
   one person from deleting each other.
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
- 2026-08-18 — MVP items 9 and 10: the club activity log. `club_audit_logs`
  (V17) is append-only by database trigger, has no foreign keys so it outlives
  what it describes, and snapshots the actor's name so a rename cannot rewrite
  history. Eight administration and ownership actions are recorded through one
  `ClubAuditService`, inside the caller's transaction. The Activity tab is now
  in `ManageSidebar`, paged with a keyset cursor. 14 tests in `ClubAuditLogIT`,
  including that the database itself refuses an UPDATE or a DELETE — verified
  against the running stack with psql, not only through the application.
  Implementing agent.
- 2026-08-18 — MVP item 8: ownership transfer. `club_ownership_transfers` (V16)
  holds a handover while it waits, because the successor already has a live
  assignment row and the index forbids a second. The outgoing owner chooses
  whether they stay on as an admin or leave, and `accept` applies both halves in
  one transaction, demoting before promoting because
  `one_active_owner_per_club` is checked per statement. 23 tests in
  `ClubOwnershipTransferIT`; verified live including that a token issued before
  the transfer gains and loses the right powers immediately after it.
  Implementing agent.
- 2026-08-18 — MVP items 5 and 7: invite an administrator by address, accept,
  decline, remove, cancel. V15 makes `user_id` nullable and adds
  `invited_email`, so an invitation can name someone who has not signed up yet.
  Acceptance is an authenticated POST rather than a mailed token, and requires a
  confirmed address — the rule that stops an invitation being stolen by
  registering its address first. 26 tests in `ClubAdminInvitationIT`; the whole
  flow re-checked against the running stack, including that a token issued
  before removal stops working immediately after it. Implementing agent.
- 2026-08-17 — integration tests moved onto real PostgreSQL + pgvector
  (`PostgresTestContainer`, `application-it.yml`), with `ddl-auto: validate`.
  Closes the untested-invariant gap this document reported the same day, and
  corrects an overstatement in it: `SearchIT` and `SearchRateLimitIT` were
  *already* on Testcontainers, so the migrations did run — what was missing was
  schema validation against the entities, which is the check that catches drift
  like the dropped `club_admin_id`. Implementing agent.
