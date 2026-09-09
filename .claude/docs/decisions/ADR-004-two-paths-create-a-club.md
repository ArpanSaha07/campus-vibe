# ADR-004 — Two paths create a club, and both end in an owner

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-08
**Raised by:** [`2026-09-08-club-ownership-spine.md`](../../specs/2026-09-08-club-ownership-spine.md),
the spec for the club-governance unit of work. No meeting; `.claude/team/` was
removed in `cef6a07`. Decisions taken by Arpan across four rounds on 2026-09-08.
**Approved by:** — (pending)
**Implemented in:** `ClubController.create`, `ClubService.createOwnedBy`, `clubadmin/ClubCreationRequest*` — shipped 2026-09-09, verified in `ClubCreationFlowIT`.

## Context

Creating a club leaves you unable to run it. `ClubController.java:63-65` guards
`POST /api/v1/clubs` with `hasRole('USER')` and the service grants the creator
nothing, so every follow-up call the create form wants to make —
`uploadLogo`, `uploadImages`, `update` for social links — is behind
`@clubPermissionService.canManageClub` and answers 403 to the person who just
made the club. The form was changed to say so rather than drop the values
silently; that is the open P0 and the first item in `STATUS.md`.

Authority itself is not the problem. `club_admin_assignments` (V12) models it
properly, the one-owner invariant is held by a partial unique index
(`V12:28-30`) *and* by a service check (`ClubAdminService.java:171-176`), and
`ClubPermissionService` looks it up per request with a platform-admin bypass at
`:56`, `:78` and `:91`. What is missing is any way for a club to *acquire* its
first owner other than `ClubAdminRequestService.approve`, which requires a
student to have asked for a club that already exists. `ClubAdminService.invite`
hardcodes `CLUB_ADMIN` (`:238`), so no payload anywhere installs an owner.

`decisions/README.md` has carried this as a decision waiting to be written since
2026-09-07, described there as *whether the creator of a club becomes its
`CLUB_OWNER` at create, or club creation moves behind admin approval*.

## Options considered

### A. Any signed-in user creates a club and becomes its owner

One transaction: insert the club, insert an `ACTIVE` `CLUB_OWNER` assignment for
the creator. Smallest change, closes the P0 directly, and the one-owner
invariant is never contended because a brand-new club has no owner to conflict
with.

Rejected because it makes club creation unreviewed. Anyone with an account mints
a club that is immediately public on `/clubs` and in search, and the platform
admin's only recourse is to notice and delete it afterwards. For a university
platform where a club page carries an implied claim to represent a real student
organisation, curation after the fact is the wrong way round. This was the
decision recorded in the first draft of the spec, and was superseded the same
day.

### B. All club creation moves behind admin approval

`POST /api/v1/clubs` becomes admin-only and ordinary users get nothing. Fully
reviewed, but it removes the ability for a student to start the process at all —
they would have to reach the platform admin out of band, which is not a
workflow, and it makes the admin the author of every club's description and
taxonomy.

### C. Two paths, both ending in an owner — chosen

`POST /api/v1/clubs` moves to `hasRole('ADMIN')`; the creating admin becomes the
club's owner. Ordinary users submit the same form to
`POST /api/v1/club-creation-requests`, which stores a proposal and creates no
club. Approving a proposal creates the club and installs the requester as its
`CLUB_OWNER` in one transaction.

The cost is a second creation path to build, test and document, and a proposal
store that did not exist — `club_admin_requests` cannot hold one, because its
`club_id` is `NOT NULL` (`ClubAdminRequest.java:28`) and references a club that
must already exist. Where a proposal lives is
[ADR-005](ADR-005-club-proposal-is-its-own-table.md).

### D. Two paths, with the admin naming an owner at creation

As C, but `POST /api/v1/clubs` takes an optional `ownerEmail` from an admin, so
the club is created ownerless with a pending `CLUB_OWNER` invitation and the
admin never becomes owner. One step instead of four for the *create a club for
somebody else* case.

Rejected: it puts a role branch inside `create` and needs an owner-invitation
endpoint, which in turn wants a `role` field on the invite payload —
`club-administration.md:246` records that `ClubAdminInviteRequest` carries only
an address specifically so that no payload can ask for `CLUB_OWNER`. Handing a
club on is already solved: invite as `CLUB_ADMIN`, then transfer through
`ClubOwnershipService`, which exists and is tested.

## Decision

Two paths create a club, and neither leaves it ownerless.

1. **A platform admin creates directly.** `POST /api/v1/clubs` requires
   `hasRole('ADMIN')`; the creating admin becomes the club's `CLUB_OWNER` in the
   same transaction. They can immediately upload a logo and banners and edit
   social links, because `canManageClub` now passes for them by assignment as
   well as by bypass.
2. **An ordinary user proposes.** `POST /api/v1/club-creation-requests`
   (`hasRole('USER')`) stores slug, name, description, category, interests and a
   message. No row is written to `clubs`. Approval creates the club and installs
   the requester as `CLUB_OWNER` in one transaction; rejection creates nothing
   and carries no reason.

Ownership moves between people only through the shipped transfer flow. No
endpoint installs an owner on a club that already has one, and
`assignFirstOwner` continues to refuse (`ClubAdminService.java:171-176`).

## Consequences

**Easier.** The P0 closes: a creator can immediately do everything
`canManageClub` guards, on both paths. Every club created from now on has
exactly one owner from birth, which makes *who is responsible for this club* a
question with an answer, and makes the eight ownerless V6 seeded clubs the only
exceptions that will ever exist.

**Harder.** Two creation paths mean two services, two controllers, two sets of
tests and a form that branches on `isAdmin`. A proposal cannot carry a logo — S3
needs a club id and there is no club yet — so images move to after approval, and
the proposal form shows no image fields at all.

**Foreclosed.** Ordinary users can no longer create a club that is immediately
public. That is the point, but it is a real reduction: a student now waits for a
human, and nothing notifies them when the wait ends, because notifications do
not exist. A proposal also has no expiry, so an unreviewed one sits forever
holding its slug reservation.

**Unchanged.** The claim flow stays for the eight seeded clubs. Platform
`ROLE_ADMIN` still bypasses club scope, so an admin can manage any club without
owning it — which is why the seeded eight are deliberately left ownerless rather
than backfilled to the admin. A data migration could not have done that anyway:
`AdminBootstrapRunner` is an `ApplicationRunner` and runs *after* Flyway, so on a
cold start there is no admin row for a migration to assign to.

## Revisit when

- A student's proposal waiting on a human becomes the complaint, rather than an
  unreviewed club being the risk. The fix would be auto-approval under some
  trust signal — a verified university address, say — not a return to option A.
- Club creation volume makes one admin the bottleneck.
- Notifications exist, at which point *nothing tells the requester* stops being
  a consequence of this decision and starts being a bug.
