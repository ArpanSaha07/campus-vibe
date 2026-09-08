# ADR-005 — A club proposal is its own table, not a pending club row

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-08
**Raised by:** [`2026-09-08-club-ownership-spine.md`](../../specs/2026-09-08-club-ownership-spine.md).
Follows [ADR-004](ADR-004-two-paths-create-a-club.md), which creates the need
for a proposal store. Decided by Arpan on 2026-09-08.
**Approved by:** — (pending)
**Implemented in:** — (added when the work lands)

## Context

[ADR-004](ADR-004-two-paths-create-a-club.md) gives ordinary users a path that
submits a club for approval rather than creating one. That proposal has to live
somewhere between submission and review, and the existing request table cannot
hold it: `ClubAdminRequest.club_id` is `NOT NULL`
(`ClubAdminRequest.java:28-29`) and points at a club that already exists, which
is exactly what a proposal does not have.

The proposal carries what `ClubCreateRequest` carries — slug, name, description,
category, interests — plus a message. All of it is text, so nothing about the
payload forces a particular store.

What does force the decision is that `Club.id` is the slug, and a club row is
public the moment it exists. `GET /api/v1/clubs` is unauthenticated, the clubs
grid and the homepage read it, and `SearchIndexService` indexes on write.

## Options considered

### A. A club row now, with a status column gating visibility

Add `clubs.status` with `PENDING`/`APPROVED`, insert the club at submission, and
filter it out of everything public until approved. Cheapest to write: one
column, one migration, no new entity, and approval is a status update rather
than an insert.

Rejected on the filtering burden, which is not one place but four:
`ClubRepository`'s list queries, `SearchRepository`, `SearchIndexService` — a
pending club should not be embedded at all — and every listing page. Missing any
one of them publishes an unapproved club under a name nobody has reviewed. This
is the same trap the event-status item in `todo.md` is P1 rather than P2 for,
recorded there as *getting the column in without covering all four is worse than
not having it*. The failure is also silent and reads as normal: the club simply
appears.

A second cost: the slug is taken as soon as the row exists, so a rejected
proposal leaves a `clubs` row that either lingers holding the name or has to be
deleted, and deleting clubs has its own consequences — `club_audit_logs` has no
foreign keys precisely so history outlives the club.

### B. Extend `club_admin_requests` to hold both kinds

Make `club_id` nullable, add the proposal columns, and keep one queue. One
service and one admin screen.

Rejected: the table would mean two different things depending on whether
`club_id` is null — a claim on an existing club, or a proposal for one that does
not exist — with different approve semantics behind one status field. Every
query would carry a null check that encodes which kind it wants. The merged
admin queue that Arpan asked for is a presentation concern, and is achieved by
the frontend reading two endpoints and rendering one list.

### C. A dedicated `club_creation_requests` table — chosen

The proposal is its own row with its own lifecycle, and no `clubs` row exists
until approval. Approval inserts the club and the `CLUB_OWNER` assignment in one
transaction.

Costs a migration, an entity, a service, a controller, a DTO and a contract
entry — more code than option A by a clear margin.

## Decision

A club proposal lives in a new `club_creation_requests` table, with a
`club_creation_request_interests` child table mirroring how `club_interests`
stores a club's tags. No row is written to `clubs` until an admin approves.
Approval creates the club and the owner assignment in one transaction and
records the resulting club id on the request, so *which club did this become* is
answerable afterwards.

The proposed slug is **reserved at submission** by a partial unique index over
pending rows, and **re-checked inside the approval transaction**. The
reservation gives the second requester an error at the moment the form already
checks name availability; the re-check covers the race a reservation cannot, and
the collision would otherwise surface as a primary-key violation on `clubs` at
the worst possible moment.

## Consequences

**Easier.** Every public read path is untouched, so an unapproved club cannot
leak by omission — the failure mode option A would have made possible does not
exist. `clubs` continues to mean *a real club*, which keeps counts, search and
the taxonomy work honest. A rejected proposal leaves no club row to clean up.

**Harder.** More code than a status column, and the proposal duplicates the
shape of a club creation payload — so a new field on `ClubCreateRequest` has to
be added in two places or it silently cannot be proposed. That duplication is
the standing maintenance cost of this choice, and is the first thing to check
when the club model grows.

**Foreclosed.** There is no way to look at a proposed club as a club — no
preview URL, no draft page — because there is no row to render. If a reviewer
ever needs to see the club page before approving, that is built from the
proposal, not by relaxing this decision.

**Note on the reservation.** A pending proposal holds its slug indefinitely,
because proposals have no expiry. A club nobody reviews therefore blocks that
name for everyone. This is the same shape as the stale-invitation item already
queued in `todo.md`, and wants the same sweep.

## Revisit when

- Proposals need a reviewer-facing preview of the club page, which is the first
  requirement this shape makes genuinely awkward.
- The duplication between `ClubCreateRequest` and the proposal columns causes a
  field to be added to one and not the other. One occurrence is a bug; two means
  the shapes should be unified behind a shared embeddable.
- Event drafts land. If `events` gains a status column and that proves clean in
  practice, the argument in option A deserves re-reading — though note the
  asymmetry: an event belongs to a club that already exists and is already
  authorised, where a proposed club has neither.
