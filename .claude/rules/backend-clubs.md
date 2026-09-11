---
description: Club, club-governance, seed and taxonomy code — the assigned-id merge trap, the taxonomy contract, and the ADR triggers that fire here
paths:
  - "backend/src/main/java/com/campusvibe/{club,clubadmin,seed,taxonomy}/**"
  - "backend/src/test/java/com/campusvibe/{club,clubadmin,taxonomy}/**"
---

# Clubs, seeding and taxonomy

**`clubadmin/` was added to the paths above on 2026-09-10.** Half the rules
below govern code that lives there — `createOwnedBy`'s callers, the seeded
`official_email`, the proposal that carries a club's links — and none of them
loaded when that code was opened. A rule that does not load is a rule nobody
reads.

- **`Club.id` is an assigned `String` slug** — `Club.java:20-21`, no
  `@GeneratedValue`, and `Club` does not implement `Persistable`. Spring Data's
  `isNew()` therefore answers false for a brand-new club, so `save` and
  `saveAndFlush` take the `em.merge()` branch and return a **different** managed
  instance. The object you passed in stays detached. (BUG-037, ADR-002)
- **Set every field before the write, then use only the returned instance.**
  `ClubService.java:86-118`. Tagging `club` after `saveAndFlush` writes to the
  detached copy and persists nothing — that is exactly what BUG-037 was.
- **`saveAndFlush`, never `save`.** `indexClub` writes the embedding through
  `JdbcTemplate`, which is not a JPA query: it triggers no flush and checks no
  update count, so it silently matches zero rows. (BUG-034)
- **`Event.id` is `IDENTITY`** (`Event.java:21-23`), so `EventService` takes the
  `persist()` branch. It reads almost identically and behaves oppositely — it is
  not evidence that this pattern is safe. (BUG-034)
- **`createOwnedBy(Club, category, interests, User owner, User createdBy)` is
  the only way to create a club.** `create` was deleted, not kept beside it, so
  no path can produce an ownerless club (ADR-004). A null category and an empty
  interest list are still legitimate; that is how pre-V23 clubs seed.
  `DevDataSeeder` is a caller and was missed once already (BUG-036).
- **A null `owner` means born ownerless, and only the dev seeder may pass it.**
  It leaves two demo clubs unowned so the club-admin claim queue has something
  to act on locally. Nothing reachable from an HTTP request may pass null.
- **The owner assignment is written against the instance `saveAndFlush`
  returned**, never the argument — same reason as the tagging rule above.
- **`MAX_CLUB_INTERESTS = 8` is load-bearing** (`ClubService.java:30`). An
  uncapped tag list matches every student and degrades everyone's results.
- **In `update`, clear and refill `interestSlugs` — never reassign it**
  (`ClubService.java:128-155`). Swapping the `PersistentSet` out makes Hibernate
  delete and reinsert every row. Re-index *after* the tags change, not before.
- **Three vocabularies, and events get no category at all** — ADR-001.
- **`clubs.logo` and `club_images.url` hold an S3 object *key*, not a URL.**
  They are read back through `GET /clubs/{id}/logo` and `/images/{index}`, which
  address by index precisely so no caller can name an arbitrary object. A key
  that reaches `next/image` throws during render and takes the page down.
  (BUG-040)
- **Keys are `clubs/{id}/logos/{uuid}.{ext}` and `clubs/{id}/images/{uuid}.{ext}`,
  built only by `MediaKeys`** — rows from before 2026-09-11 still hold
  `clubs/{id}/logo-{filename}`, so never parse a key's shape. Replacing a logo
  deletes the old object *after* `updateLogo` commits and only if
  `MediaKeys.belongsToClub` says it is this club's; deleting inside the
  transaction leaves the row pointing at nothing when the commit fails.
  (BUG-039)
- **`DevDataSeeder` is idempotent per club, not wholesale.** It skipped for
  months because V6 had already inserted eight clubs, so it had never run and
  every seeded club had a null embedding. V32 retires those rows; do not restore
  a `count() > 0` guard. (BUG-041)
- **`clubs.social_links` is never written raw — go through
  `ClubSocialLinks.normalise`.** Both writers do (`ClubService.update`,
  `ClubCreationRequestService.create`), and it validates, canonicalises and
  re-serialises, so the column holds four known keys or NULL. It was stored as
  sent until 2026-09-10 and two of those values reach an `href` on the public
  club page, so a `javascript:` link was a script waiting for a click
  (BUG-048). A new writer that skips it reopens exactly that.
- **`official_email` is seeded at creation, and only `hasRole('ADMIN')` may
  change it.** Both creation paths fill it from the form's contact email; the
  two columns are independent from then on, so nothing that edits
  `social_links.email` may touch it. Seeding does not make it the club's own to
  edit — that is the §6 separation, and it was put to Arpan and kept.
- **Instagram is a handle in, a URL out** — `WebLinks.normaliseInstagram`. Do
  not run it through `WebLinks.normalise`: it has no scheme, so a handle would
  be read as a bare host. The handle pattern is checked *before* the URL is
  built by concatenation, which is the only thing making that join safe.
- **The `Persistable` fix is proposed in ADR-002 and not yet decided.** It
  changes the write path for every club, so it is never a rider on another fix.

## Accepted decisions that reopen on a condition

These are the triggers from ADR-004, ADR-005 and ADR-006, put where the code
that would trip them is read. The reasoning stays in the ADR; if a trigger has
fired, **stop and say so** rather than deciding it alone — reopening an accepted
decision is a new ADR, and only Arpan flips a status.

- **Adding a field to `ClubCreateRequest`? Add it to the proposal too, or record
  why not.** The two shapes duplicate each other by design, and
  [ADR-005](../docs/decisions/ADR-005-club-proposal-is-its-own-table.md) says
  one divergence is a bug, two means unifying them behind a shared embeddable.
  **The count is at one and a half:** the contact links were missing from the
  proposal entirely (fixed 2026-09-10), and `officialEmail` now sits on
  `ClubCreateRequest` alone — legitimately, since the proposal derives it from
  its stored `social_links`, but the shapes have diverged again. The next one
  makes it two.
- **A reviewer wanting to preview a proposed club as a club page is ADR-005's
  first genuinely awkward requirement.** There is no `clubs` row to render, and
  the answer is to build the preview from the proposal — not to relax the rule
  that no row exists before approval.
- **Never add a *mark as verified* control for `official_email`,** however much
  it would unblock the §17 notices.
  [ADR-006](../docs/decisions/ADR-006-official-email-verified-only-by-round-trip.md)
  forecloses an administrative override by name: it is the rejected option
  wearing a different label, and it gets reached for exactly when someone is
  impatient. Verified means a link mailed to the address was redeemed, and until
  SES lands nothing is verified, which is accurate rather than broken.
- **When SES lands, build the round trip** — the table shape is already recorded
  in ADR-006 so it is not re-derived, and its redeem endpoint's matcher must sit
  **above** the broad public-GET block in `SecurityFilterChainConfig`.
- **A club whose proposal nobody reviews holds its slug forever**
  ([ADR-005](../docs/decisions/ADR-005-club-proposal-is-its-own-table.md)), and
  nothing tells the requester anything at all
  ([ADR-004](../docs/decisions/ADR-004-two-paths-create-a-club.md)). Both are
  queued in [`todo.md`](../TODO/todo.md); the second stops being a consequence
  and becomes a bug the day notifications exist.
