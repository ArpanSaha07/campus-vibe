# ADR-002 — Club keeps its assigned slug id and implements Persistable

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-07
**Raised by:** the knowledge-base audit, after the same trap produced a second
bug in the same method. No meeting; `.claude/team/` was removed in `cef6a07`.
**Approved by:** — (pending)
**Implemented in:** — (added when the work lands)

## Context

`Club.java:20-21` declares an assigned identifier and nothing else:

```java
@Id
private String id; // slug
```

No `@GeneratedValue`, and `Club` does not implement `Persistable`. Spring Data's
`SimpleJpaRepository.save` asks `isNew()` before choosing a branch, and with an
assigned id and no `Persistable` that question is answered by testing the id for
null. A brand-new club already has its slug, so it reads as *not new* and `save`
takes the `em.merge()` branch — which copies state onto a **different** managed
instance and returns it, leaving the argument detached.

`Event.java:21-23` is `@GeneratedValue(strategy = GenerationType.IDENTITY)`, so
`EventService` takes the `persist()` branch and the object handed in is the
object persisted. The two services read almost identically and behave
oppositely, which is why `EventService` is not evidence that the pattern is
safe.

This has now cost two defects in one method, five weeks apart, each found by a
failing test rather than by review:

- [BUG-034](../../bugs/fixed_bugs.md#bug-034) (2026-08-16) — *when* the insert
  ran. `indexClub` writes the embedding through a raw `JdbcTemplate` update,
  which is not a JPA query and triggers no flush, so it matched zero rows.
  Fixed by calling `saveAndFlush` at `ClubService.java:71`.
- [BUG-037](../../bugs/fixed_bugs.md#bug-037) (2026-09-05) — *which object* you
  are holding. The category and interest slugs were applied to `club` after the
  write, so they landed on the detached copy and a club created with a category
  kept none. Fixed by setting them before the write.

Both fixes are at the call site, so both leave the trap armed for the next
caller. The commit that fixed the second one said so in its own body
(`03f818c`): *the underlying trap stays armed; `Club` could implement
`Persistable` and answer `isNew()` honestly, which would remove this surprise
for every future caller.* It is queued as a **P2** at `todo.md:55` and has been
queued, unactioned, since.

## Options considered

### A. Implement `Persistable<String>` with a transient new-flag — recommended

`Club implements Persistable<String>`, a `@Transient boolean isNew = true`, and
a `@PostPersist @PostLoad` callback that clears the flag. `save()` then takes
the `persist()` branch and returns the same instance it was given.

Costs: it touches the write path for every club, so it wants its own commit and
its own test — one that asserts `save` returns the identical reference, since
that is the property being bought. The residual risk is a `Club` constructed by
hand for an *update*, which would default the flag to true and try to persist an
existing row; `ClubService.update` does not hit it, because it loads through
`findClub` and mutates a managed instance rather than calling `save`.

### B. Surrogate IDENTITY id, slug demoted to a unique column

Matches `Event` and removes the class of surprise rather than this instance of
it.

Costs: nine tables carry a `clubs(id)` foreign key — `club_admin_assignments`
(V12), `club_ownership_transfers` (V16), `club_interests` (V25), `club_images`
(V2), `users.managed_club_id` (V2), `events` (V3), `user_followed_clubs` (V4),
`approved_club_admins` (V5) and `club_admin_requests` (V7). On top of that:
the public route `frontend/app/(main)/clubs/[clubId]`, `ClubDTO`, and the field
list in `contracts/api-dto-fields.json` that a test on each side asserts
against. A data migration, a contract change and a routing change, to solve a
problem that option A solves with one `implements` and a flag.

### C. Leave it, and write the trap down where the code is read

A line in `.claude/rules/backend-clubs.md` naming the merge behaviour and both
bug ids, loaded when a session reads `ClubService.java`.

Costs: the trap has already fired twice under exactly this arrangement, and
neither time did anyone read a note first — a test caught it. This is a
mitigation rather than a fix. It is also worth doing **whichever option wins**,
so it is not really an alternative to A or B.

## Decision

Option A, subject to approval. Option C ships regardless, as a rule rather than
as the answer.

## Consequences

- `save()` returns what was passed, so a caller who sets a field after it is
  right rather than silently wrong. That is the whole point.
- `Club` gains persistence-framework state that is not domain state — a
  transient flag that exists only to answer a Spring Data question.
- `saveAndFlush` is still required, for the unrelated reason in BUG-034: the
  search index is written through JDBC and needs the row to exist. Option A is
  not a licence to go back to `save()`.
- Nothing is foreclosed. Option B stays available if a second assigned-id
  entity ever makes the general fix worth its migration.

## Revisit when

A second entity is given an assigned identifier — at that point the surprise is
a pattern rather than a quirk, and B becomes worth its cost. Also revisit if a
club slug ever needs to be editable in the product; every one of the nine
foreign keys is already `ON UPDATE CASCADE`, so the database supports it today
and only the id strategy is in question.
