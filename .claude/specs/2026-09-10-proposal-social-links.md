# A proposal carries the club contact links

**Status:** shipped 2026-09-10 · **Date:** 2026-09-10

> **Where the work went beyond this spec**, all decided by Arpan on 2026-09-10
> and recorded here because the spec is the record of what was agreed:
>
> 1. **Instagram became a handle**, on the club form and the profile editor
>    both. Not in scope when this was approved; asked for while it was being
>    built. `WebLinks.normaliseInstagram` and the editor's strip-on-load are the
>    result, and `user-profiles.md` is now a mapped doc this unit changed.
> 2. **[BUG-049](../bugs/fixed_bugs.md#bug-049) was found and fixed** — the form
>    had no `noValidate`, so the browser blocked submit on an invalid
>    `type=email` and `clubValidator` never ran. Found because a test written
>    for this unit could not pass.
> 3. **The Instagram placeholder is Arpan's**, not the spec's: `yourclub002`,
>    with the field hint commented out in `CreateClubForm.tsx:340`.
> 4. **Seeding `official_email` from the same contact email was raised and
>    deferred** to its own unit, with its decisions already taken — see
>    [`todo.md`](../TODO/todo.md) under Club governance. Editing it stays
>    platform-admin-only; **no owner/club-admin edit UI is to be built.**

## Goal

An ordinary user proposing a club fills in the same four contact links a
platform admin does — contact email, website, instagram, facebook — they are
stored on the proposal, shown to the reviewer, and written onto the club by the
approval that creates it. Today the propose branch sends name, description,
category, interests and a message and nothing else
(`frontend/app/hooks/useCreateClubForm.ts:213`), because the whole links block
is rendered inside an `admin &&` gate
(`frontend/app/components/club/CreateClubForm.tsx:250`), so a club born by
proposal reaches its public page with an empty contact block and the new owner
has to go and add what they were never asked for.

A second thing is true afterwards: a club social link that is not http or https
is refused at the door. Today `ClubService.update:136-138` stores whatever
string arrives and `frontend/app/(main)/clubs/[clubId]/page.tsx:58` and `:68`
put it straight into an `href`, with nothing checking the scheme on either
side — the shape `ProfileLinks` already refuses on the profile side, and which
this unit would otherwise open to every signed-in user.

## Out of scope

- **The logo, still.** A proposal has no club id and no S3 key, so it would need
  a proposal-scoped key, a copy step at approval, a read endpoint for the queue
  and orphan cleanup for every abandoned proposal. It belongs to the club editor
  ([BUG-043](../bugs/bugs.md#bug-043)), which is the next P1 — Arpan,
  2026-09-09. Banner images likewise.
- **Making the contact email required on the propose path.** Required on the
  admin path only, as now.
- **How a club stores its links.** One JSON string in one column
  (`Club.java:34`), unchanged. No move to four columns, and no `ClubDTO` change.
- **The club editor**, and any way for a requester to edit a proposal after
  submitting it. A wrong link is fixed from `/manage/[clubId]` after approval.
- **A reviewer editing the links before approving.** Approve or reject, as now.
- **Proposal expiry.** Unchanged, and still nothing releases a stale slug
  reservation.

## Decisions taken

- **The links ship, the logo waits** — Arpan, 2026-09-09, reviewing the rebuilt
  create-club page ([`todo.md`](../TODO/todo.md), Club governance).
- **One `social_links TEXT` column on `club_creation_requests`**, mirroring
  `Club.socialLinks` rather than four columns — Arpan, 2026-09-09. Carried onto
  the club inside `ClubCreationRequestService.approve`.
- **The wire shape is a single JSON string**, on both
  `ClubCreationRequestCreateRequest` and `ClubCreationRequestDTO`, mirroring
  `ClubUpdateRequest.java:8` and `ClubDTO.java:12` rather than a typed nested
  object like `ProfileSocialLinksRequest` — Arpan, 2026-09-10. **Consequence:**
  validating the four values means parsing the string server-side into a
  four-field record, normalising, and re-serialising — so what lands in the
  column is our JSON rather than the client's, which is the good half of this
  choice. A string that is not parseable as that object is a 400.
- **Optional on the propose path** — Arpan, 2026-09-09. `clubValidator` keeps
  requiring the contact email in `create` mode alone
  (`frontend/app/lib/validators/clubValidator.ts:53-60`); a value that *is*
  typed is format-checked on both paths.
- **`ProfileLinks` is extracted to a shared package and applied to both club
  write paths** — Arpan, 2026-09-10. The proposal is the new caller;
  `ClubService.update` is the hole that already exists. **Consequence:** this
  unit fixes a defect it did not create, on a shipped method, and that fix gets
  a bug entry rather than passing silently. The logic itself does not change —
  scheme checked before `https://` is assumed, which is the whole security
  property (`ProfileLinks.java:20-26`) and has a test named after it.
- **The review queue shows the links, as anchors** — Arpan, 2026-09-10.
  `target=_blank rel=noopener noreferrer`, as the club page already does. Only
  safe because of the decision above; without the scheme check this would be
  putting an unvalidated `href` in front of an admin.

- **The contact email is checked as an email, not as a link** — Arpan,
  2026-09-10. Running `hello@yourclub.ca` through `normalise` yields
  `https://hello@yourclub.ca` — a valid URI with a userinfo part, so it would
  pass and be stored as nonsense. The three links are normalised; the email gets
  the shape check `clubValidator.ts:56` already uses, and a malformed one is a
  400 naming the field.
- **Instagram is collected as a handle and the URL is built server-side** —
  Arpan, 2026-09-10, on both the club form and the profile editor.
  `WebLinks.normaliseInstagram` strips a leading `@`, validates the handle
  against Instagram's own character rule, and returns
  `https://instagram.com/<handle>`; the stored value is still the full URL,
  because that is what an `href` needs. A pasted `instagram.com` URL is reduced
  to its handle rather than refused, and any other host is refused rather than
  quietly becoming an Instagram link that is not one. The profile editor strips
  the stored URL back to a handle on load, or the field would ask for
  `your_name` and be filled with a URL.
- **ADR-004 is amended in place rather than superseded** — Arpan, 2026-09-10.
  This is the exception to the frozen-record rule in `decisions/README.md`, made
  knowingly: the text-only rationale describes a scope that no longer holds, and
  a second ADR to say so would cost more than it records. The note on
  `ClubCreationRequestCreateRequest` is amended with it.

## Open questions

None. The two that were open on 2026-09-10 were answered by Arpan the same day
and are recorded above.

## Files expected to change

**Migration — V33.** `V32__retire_mock_club_seed_data.sql` is the highest
applied. Read [`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md)
first; it is mandatory for any schema change.

- `V33__add_club_creation_request_social_links.sql` — one nullable `TEXT`
  column, no default, matching `clubs.social_links` from V2. Nothing backfills:
  every existing proposal was submitted without links, and NULL says so.

**Backend** — mapped to `club-administration.md`, `api-and-caching.md` and
`user-profiles.md`:

- `common/WebLinks.java` — `ProfileLinks` moved out of `user.profile` and made
  public, logic untouched; `ProfileLinksTest` moves with it, including the test
  that pins the ordering. `UserProfileService.java:82-86` follows the rename.
- `club/ClubSocialLinks.java` — the four-field record plus the one function that
  parses the JSON string, normalises each value through `WebLinks`, and
  re-serialises. One place, because two services now write these links.
- `club/ClubService.java:136-138` — `update` normalises instead of storing raw.
- `clubadmin/ClubCreationRequest.java` — the `social_links` column.
- `clubadmin/ClubCreationRequestCreateRequest.java` — the field, `@Size`. Its
  class comment says text-only is a decision rather than an oversight; that is
  now true of the logo alone and the comment changes with it.
- `clubadmin/ClubCreationRequestDTO.java` — the field.
- `clubadmin/ClubCreationRequestService.java` — `create` normalises and stores;
  `approve` sets the links on the `Club` **before** handing it to
  `createOwnedBy`, never on what comes back, because `Club.id` is assigned and
  `saveAndFlush` goes through `em.merge` ([BUG-037](../bugs/fixed_bugs.md#bug-037),
  [ADR-002](../docs/decisions/ADR-002-club-id-is-an-assigned-slug.md)).
- `contracts/api-dto-fields.json:48-52` — `ClubCreationRequestDTO` gains
  `socialLinks`. `ApiContractTest` reads the record reflectively, so it needs no
  edit; the TypeScript side does ([`rules/contracts.md`](../rules/contracts.md)).
- Tests: links submitted on a proposal survive approval onto the club;
  `javascript:` is refused on the propose path; `javascript:` is refused on
  `PUT /clubs/{id}`, which is the pre-existing hole; a malformed JSON string is
  a 400, not a 500; a proposal with no links approves as before.

**Frontend** — mapped to `club-administration.md` and `api-and-caching.md`:

- `app/lib/links.ts` — `normaliseProfileLink` moves here under a neutral name;
  `components/profile/ProfileSocialLinks.tsx:2,41` and
  `__tests__/profile.test.ts` follow it. It stays a render guard, not a control.
- `app/types/index.ts` — `ClubCreationRequest.socialLinks: string | null`,
  `NewClubProposal` gains `ClubSocialLinks`, and the contract mirror in
  `__tests__/api-contract.test.ts:127` gains the key.
- `app/lib/club-creation-requests.ts` — `proposeClub` stringifies the links, the
  way `updateClubSocialLinks` already does (`clubService.ts:149`).
- `app/hooks/useCreateClubForm.ts:213` — the propose branch sends them.
- `app/components/club/CreateClubForm.tsx` — the links block leaves the
  `admin &&` gate; the logo stays inside it. Two comments there and the file
  header say the proposal path renders no links at all; all three change.
- `app/lib/validators/clubValidator.ts:53-60` — the email stays required in
  `create` mode; format is checked whenever a value is present.
- `app/(protected)/admin/page.tsx:233-240` — the proposal row renders the links.
- `app/__tests__/CreateClubForm.test.tsx` — a link typed on the propose path
  reaches the payload. The same trap the interests tests just closed: if this is
  not asserted, dropping the field leaves the file green.

Docs and rules mapped to those paths, from
[`docs-map.json`](../../scripts/docs-map.json):
`docs/architecture/club-administration.md`, `docs/architecture/api-and-caching.md`,
`docs/architecture/user-profiles.md`, `rules/backend-clubs.md`,
`rules/db-migrations.md`, `rules/contracts.md`.

## Verification

```
node scripts/verify.mjs                     # what CI runs
./mvnw -B verify -f backend/pom.xml         # ITs on real PostgreSQL, ddl-auto validate
npm test --prefix frontend                  # includes the contract test
```

**Run 2026-09-10:** all six `verify.mjs` steps pass. Backend units 73, frontend
228 in 21 suites, `ClubCreationFlowIT` 15 including the four added here. The
whole IT suite passes but for `SearchIT.semanticSearchMatchesMeaning...`, which
fails identically on a clean worktree at `31c7abb` — the open bug `bugs.md:44`
already records, re-confirmed the same way rather than assumed.

Then in the running stack, with a non-admin account alongside
`sahaarpan550@gmail.com`:

1. As the ordinary user, open the create form — the four link fields are there,
   **the logo control is not** — and submit with a website and an instagram
   handle typed bare, without a scheme.
2. The admin queue shows that proposal with both links, clickable, pointing at
   the https form of what was typed.
3. Approve it: the club page shows the same links, and the requester owns the
   club.
4. Submit a proposal with `javascript:alert(1)` in the website field — refused
   with a sentence naming the field, and no row is written.
5. As an admin, `PUT` the same value onto an existing club through the editor —
   refused the same way. This is the pre-existing hole.
6. Submit a proposal with every link blank — approves exactly as it does today.
7. `docker compose down -v && docker compose up` — V33 applies from an empty
   schema and the stack boots.

## To update at wrap-up

- `docs/architecture/club-administration.md` — a proposal is no longer
  text-only, and the `Code as of:` stamp.
- `docs/architecture/user-profiles.md` — the link normaliser it describes is now
  shared and has three callers, not one.
- `rules/backend-clubs.md` — one line: club social links are normalised before
  they are stored, on both write paths, carrying the bug id below.
- `bugs/fixed_bugs.md` — the unvalidated `href` on the club page, next id
  **BUG-048** (BUG-047 is the highest in use), recording that it predated this
  unit and was fixed here rather than found here.
- `bugs/fixed_bugs.md` and `rules/frontend.md` — **BUG-049**, found while
  building this: the create-club form had no `noValidate`, so a control with an
  invalid `type=email` or `type=url` value made the browser block submit
  entirely and show its own bubble. `clubValidator` never ran and its message
  beside the field was never written. The same reasoning `FormField` already
  records for `required` (`FormField.tsx:60-63`), missed one attribute over.
  It surfaced only when the contact email became optional on the proposal path,
  where a typo was then silently unsubmittable.
- `TODO/todo.md` — close the P1 under Club governance; leave the logo where it
  is, with BUG-043.
- **ADR-004** — amend the text-only rationale in place, per the decision above,
  and note in `decisions/README.md` that it was amended rather than frozen.
- `TODO/tasks-completed.md` and the `STATUS.md` shipped line.
- Mark this spec `Status: shipped`.
