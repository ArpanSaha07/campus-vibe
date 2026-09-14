# A club's official email is seeded at creation

**Status:** shipped 2026-09-10 · **Date:** 2026-09-10

> **The work matched this spec.** Two things worth naming: `/manage/[clubId]`
> needed no change at all — it was read first and already did exactly what the
> decision requires — and `clubService.test.ts` was added, which the spec did
> not call for. The form tests stop at `createClubWithMedia`, so the POST body
> `createClub` builds had no coverage and could have dropped the address with
> every suite green.

> Written after the decisions rather than before them: every question this
> spec would have asked was put to Arpan on 2026-09-10 with `AskUserQuestion`
> and answered, and he then asked for the work to continue. It is here because
> the next session needs the record, not because anything is still open.

## Goal

A club has its official email from the moment it exists. Today `official_email`
is unwritable at creation — `ClubCreateRequest` has no field for it, deliberately
— and only a platform admin can set it afterwards through `PATCH
/clubs/{clubId}/official-email`. So every club starts without the address its
own recovery and administrator-change notices depend on, and somebody has to go
back and add it by hand, for every club, forever. After this ships the contact
email already collected by the create form seeds it: on the admin path at
creation, and on the proposal path when approval creates the club.

## Out of scope

- **Letting club owners and admins edit it** — Arpan, 2026-09-10, choosing this
  over the alternative he first described. Editing stays `hasRole('ADMIN')`, so
  the property `club_admin_governance.md` §6 gives the address survives: the
  channel used to recover a club is held outside the control of whoever
  currently controls the club, and a takeover cannot repoint it. **No
  owner/club-admin edit UI is to be built.** The cost is accepted: a club
  wanting its own official email corrected has to ask an admin.
- **A new dashboard panel.** `/manage/[clubId]` already shows the address and
  its verified state to the whole management team and draws the edit control for
  a platform admin alone, with a sentence saying why. It was read on 2026-09-10
  and needs no change.
- **The verification round trip.** Still blocked on SES. A seeded address is
  unverified like any other, which is what makes this safe to do at all.
- **Merging the two fields.** `social_links.email` and `official_email` stay
  distinct columns with distinct rules — see *Decisions taken*.
- **Backfilling existing clubs.** No migration, no data change. Clubs created
  before this keep a null official email until an admin sets one.

## Decisions taken

- **Seed, do not merge** — Arpan, 2026-09-10. The form's contact email fills
  both `social_links.email` and `official_email` at creation, and the two are
  independent from then on: editing the public contact address later must not
  move the recovery anchor. `Club.java:36-42` records why they are distinct —
  one is public and owner-editable, the other is not.
- **Editing stays platform-admin-only** — Arpan, 2026-09-10. See *Out of scope*.
- **A seeded address is unverified**, exactly as an administratively written one
  is. [ADR-006](../docs/decisions/ADR-006-official-email-verified-only-by-round-trip.md)
  is untouched: only redeeming a link mailed to the address may stamp
  `official_email_verified_at`, and there is no stamp at creation to inherit or
  clear.
- **`ClubCreateRequest` gains the field**, against the note on it that says
  there is deliberately none. That note's reasoning — *writing it must always
  clear its verified stamp, which is what `setOfficialEmail` is for* — is about
  a club that already exists and already has a stamp. At creation there is
  neither, so the reasoning does not reach this case. The note is amended rather
  than deleted, because the rule it states is still true everywhere else.
- **The address is normalised the way `ClubAdminService.setOfficialEmail`
  normalises it** — trimmed and lowercased. Addresses are compared
  case-insensitively across the application, and a club seeded with `Hello@x`
  that an admin later re-sets as `hello@x` must not read as a change of address.
- **The proposal path reads the address out of the proposal's stored
  `social_links`** rather than carrying a second copy of it in its own column.
  There is one address on that form and duplicating it invites the two to
  disagree.

## Open questions

None.

## Files expected to change

No migration. `clubs.official_email` and `official_email_verified_at` have
existed since V13.

**Backend** — mapped to `club-administration.md` and `user-roles.md`:

- `club/ClubCreateRequest.java` — the field, `@Email @Size`, and the amended
  note.
- `club/ClubController.java` — `create` sets it on the `Club` **before**
  `createOwnedBy`, alongside name and description. Set on the argument, never on
  what comes back: `Club.id` is assigned, so `saveAndFlush` merges and returns a
  different instance ([BUG-037](../bugs/fixed_bugs.md#bug-037)). No signature
  change to `createOwnedBy` — widening one leaves call sites and tests behind
  ([BUG-036](../bugs/fixed_bugs.md#bug-036)).
- `club/ClubSocialLinks.java` — `officialEmailFrom(json)`, which reads the
  contact address out of a stored links object, and the shared normaliser both
  paths use.
- `clubadmin/ClubCreationRequestService.java` — `approve` seeds it from the
  proposal's links.
- `club/ClubService.java` — the `CLUB_CREATED` audit entry carries the seeded
  address, through `ClubAuditService.metadata` so a null one is simply absent.
  A club's recovery address is a governance fact and the log is where §6 expects
  to find who set it.
- Tests: an admin creating a club with a contact email gets an official email,
  unverified; an approved proposal carries its address onto the club; a club
  created without one still has null; a seeded address is lowercased; and the
  existing rule that only a platform admin may *change* it still holds.

**Frontend** — mapped to `club-administration.md`:

- `app/lib/services/clubService.ts` — `createClub` sends the contact email as
  `officialEmail`. The proposal path sends nothing new: the address is already
  inside the `socialLinks` JSON it posts.
- `app/components/club/CreateClubForm.tsx` — the header comment saying
  `official_email` is *never* set at creation, which stops being true, and the
  contact-email field's hint, which can now say where the address goes.
- No change to `/manage/[clubId]`.

Docs and rules: `docs/architecture/club-administration.md`,
`rules/backend-clubs.md`.

## Verification

```
node scripts/verify.mjs --full
```

Then in the running stack:

1. As an admin, create a club with a contact email — `/manage/[clubId]` shows
   that address as the official email, marked **not verified**.
2. As an ordinary user, propose a club with a contact email; approve it as an
   admin — the created club shows the same address, unverified.
3. Create a club with the contact email left blank — the official email is
   absent, and the panel says *Not set yet*.
4. As the club's owner, confirm the panel shows the address and offers **no**
   edit control, with the sentence explaining who to ask.
5. As an admin, change it from the panel and confirm it still reads unverified.

## To update at wrap-up

- `docs/architecture/club-administration.md` — official email is seeded at
  creation on both paths, and the `Code as of:` stamp.
- `rules/backend-clubs.md` — a line if the seeding introduces a trap.
- `TODO/todo.md` — close the P1; `TODO/tasks-completed.md` and the `STATUS.md`
  shipped line.
- **No ADR.** Nothing here reverses a recorded decision: ADR-006 is untouched,
  and the `ClubCreateRequest` note is amended in place because its reasoning
  never covered creation. If that reading is wrong, it is Arpan's to say.
- Mark this spec `Status: shipped`.
