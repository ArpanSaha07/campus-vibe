# Club ownership spine

**Status:** draft · **Date:** 2026-09-08

## Goal

Every club has exactly one owner from the moment it exists, and there are two
ways to get there. A platform admin creates a club directly and becomes its
owner; an ordinary user fills in the same form and it becomes a *proposal*,
which the admin approves to create the club and install the requester as its
owner in one transaction. Today neither works: `POST /api/v1/clubs` needs only
`ROLE_USER` and grants the creator nothing, so the logo, banner images and
social links the form collects all 403 against `canManageClub` — the open P0 —
and ownership arrives only by approving a claim on a club that already exists.
After this ships, a club is never born ownerless, an owner can immediately do
everything `canManageClub` guards, and a platform admin can also write a club's
`official_email`, which has been unwritable since V13 landed and is why the §17
security notices and the §6 invite verification step are both dead code.

## The two paths

```
platform admin                         ordinary user
  POST /api/v1/clubs                     POST /api/v1/club-creation-requests
  hasRole('ADMIN')                       hasRole('USER')
    -> INSERT clubs                        -> club_creation_requests, PENDING
    -> CLUB_OWNER, ACTIVE (them)           -> NO row in clubs
    -> manage immediately                  -> slug reserved while pending

                                         admin approves
                                           -> INSERT clubs
                                           -> CLUB_OWNER, ACTIVE (requester)
                                           -> one transaction
```

Handing a club to someone else is unchanged and already shipped: invite them as
a `CLUB_ADMIN`, then offer ownership through `ClubOwnershipService`.

## Out of scope

- **Event lifecycle.** `EventService.update`, delete, and the
  `DRAFT`/`PUBLISHED`/`ARCHIVED` column stay queued. The club dashboard's Events
  tab is not made end-to-end here ([BUG-006](../bugs/bugs.md#bug-006)).
- **Platform-admin management from the UI.** No promote or demote control, no
  account list. `APP_BOOTSTRAP_ADMIN_EMAIL` plus a restart stays the only way to
  mint a platform admin — Arpan, 2026-09-08.
- **Ownership recovery** (governance item 15) and the **expiry sweeps** for
  stale invitations and handovers (items 5 and 8 follow-ups). Note a club
  proposal has no expiry either, for the same reason and with the same cost.
- **The owner-invitation endpoint is dropped** — Arpan, 2026-09-08. It was the
  admin's proactive route onto an ownerless club; with every new club born
  owned, only the eight V6 seeded clubs are ownerless and the claim queue
  already covers them. Consequence: an ownerless club gets an owner only when
  somebody asks for it. Nothing else in this spec depended on it.
- **Audit call sites** for club-page and event edits (items 9 and 10
  follow-ups). The actions added here are logged; the existing gaps stay.
- **[BUG-039](../bugs/bugs.md#bug-039)** — S3 object keys taken from the
  browser's filename with no validation. Wiring the logo upload makes it
  reachable rather than latent. Arpan's call, 2026-09-08: ship, fix next.
- **Notification separation** (items 11 to 13), blocked on a mail system. A
  requester is therefore not emailed when their proposal is approved or
  rejected; they find out by looking.
- **The official-email verification round trip** — Arpan, 2026-09-08: recorded
  here, built alongside the AWS SES work queued as P2 under Security. This unit
  ships the admin write only, so an address lands unverified and the panel at
  `manage/[clubId]/page.tsx:131` goes on saying so, which is true. **The shape
  when it is built**, so it is not re-derived: a new `club_email_verifications`
  table — `club_id`, the `address` the link was sent to, `token_hash`,
  `expires_at`, `used_at` — rather than extending `auth_tokens`, whose
  `user_id` is `NOT NULL` (V11:10) and whose `issue` deletes previous tokens
  per *user*. A club inbox is not a user and may have no account at all.
  Recording the address on the row is what lets a later change of address
  invalidate the old proof instead of carrying it over. The redeem endpoint is
  `permitAll` and its matcher must sit **above** the public-GET block.

## Decisions taken

- **Two creation paths, both ending in an owner** — Arpan, 2026-09-08. To be
  recorded as [ADR-004](../docs/decisions/ADR-004-two-paths-create-a-club.md),
  **written 2026-09-08 before any code**, since it settles the decision
  `decisions/README.md` lists as waiting to be written and closes what
  `STATUS.md` item 1 has been holding open. The rejected alternative — any
  `ROLE_USER` creating a club directly and becoming its owner — is what the
  first draft of this spec assumed, and is superseded here.
- **`POST /api/v1/clubs` moves to `hasRole('ADMIN')`.** It is no longer the
  path an ordinary user takes, so leaving it open would be a second, unreviewed
  way to create a club.
- **A platform admin who creates a club becomes its owner** — Arpan,
  2026-09-08. No `ownerEmail` branch on create. They invite the intended person
  as `CLUB_ADMIN` and hand over through the shipped transfer flow.
- **A proposal is its own table, not a club row with a status column** — Arpan,
  2026-09-08. No club exists until approval, so no public read path can leak an
  unapproved club. The rejected alternative needs `ClubRepository`,
  `SearchRepository`, `SearchIndexService` and every listing to filter, and
  missing one publishes the club — the same trap that makes the event-status
  item P1.
- **The slug is reserved at submission and re-checked inside the approval
  transaction** — Arpan, 2026-09-08. A partial unique index over pending
  proposals gives the second requester an error at the moment the form already
  checks name availability; the re-check is one line and covers the race a
  reservation cannot.
- **One merged queue on the admin dashboard** — Arpan, 2026-09-08. Proposals
  and claims render as a single Pending requests list, each row saying which
  kind it is, even though the two have different approve semantics underneath.
- **The claim flow stays.** A student asking for one of the eight ownerless V6
  seeded clubs is still a real request. With every new club born owned, that
  flow now applies to those eight and nothing else.
- **The eight seeded clubs stay ownerless, and nothing backfills them** —
  Arpan, 2026-09-08. They are mock data that `todo.md` already queues for
  retirement once a dev seeder exists, and a platform admin can manage them
  today through the `ROLE_ADMIN` bypass without owning anything, so an owner
  row would add a visible administrator listing and block the claim queue —
  `ClubAdminRequestService.create` refuses a club that has an owner — while
  buying nothing. Ownership is exercised against clubs created from the admin
  dashboard instead. Rejected on the way: a data migration, which cannot work —
  Flyway runs before `AdminBootstrapRunner`, so on a cold start there is no
  admin row to assign to and the INSERT would match nothing silently.
- **`ClubAdminInviteRequest` is untouched.** With the owner invitation dropped,
  nothing adds a `role` field to it, so the property
  `club-administration.md:246` records — that no payload can ask for
  `CLUB_OWNER` — survives exactly as written.
- **A proposal carries only text, and the form shows no image controls at all
  on that path** — Arpan, 2026-09-08. Slug, name, description, category,
  interests, message: exactly what `ClubCreateRequest` already carries, plus the
  message. Logo and banner images need a club id and an S3 key, neither of which
  exists before approval, so the requester adds them from `/manage/[clubId]`
  once they are the owner. No disabled upload control and no note promising it
  later — the field is simply absent.
- **A rejection carries no reason** — Arpan, 2026-09-08. Matches
  `ClubAdminRequest`, which has no reason field and whose `reject` takes none.
- **`official_email` is written by platform admins only** — already the design
  in `club_admin_governance.md` §6, so a club's recovery channel cannot be
  captured by whoever currently controls the club.
- **`official_email_verified_at` is stamped only when somebody opens the club
  inbox and clicks Accept on a link mailed to that address** — Arpan,
  2026-09-08. Not when an admin types it: the admin is naming a third party's
  mailbox, usually copied from a message, which proves nothing about whether
  mail arrives there. The round trip itself is deferred (see *Out of scope*).
- **`setOfficialEmail` always writes `official_email_verified_at = NULL`** —
  the code consequence of the line above, and the reason it matters *now*.
  Today the column is NULL everywhere so this looks like a no-op; once
  verification exists, an admin correcting a typo must not inherit the proof
  that belonged to the previous address. Cheap to get right now, a security bug
  to retrofit later.

## Open questions

None. Everything above was decided by Arpan on 2026-09-08.

## Files expected to change

**Migration — V31**, `V31__create_club_creation_requests.sql`. Read
[`database-lifecycle/SKILL.md`](../skills/database-lifecycle/SKILL.md) first; it
is mandatory for any schema change. Shape:

- `club_creation_requests` — `id`, `user_id` (FK `users`), `proposed_slug`,
  `name`, `description`, `category_slug` (FK `club_categories`), `message`,
  `status` CHECK in PENDING/APPROVED/REJECTED, `requested_at`, `reviewed_at`,
  `reviewed_by_user_id`, `created_club_id` (FK `clubs`, nullable — records what
  the approval produced, so *which club did this become* is answerable).
- `club_creation_request_interests` — the child table, FK to
  `interest_catalogue`, mirroring how `club_interests` stores a club's tags.
- `CREATE UNIQUE INDEX one_pending_proposal_per_slug ON
  club_creation_requests (lower(proposed_slug)) WHERE status = 'PENDING'` — the
  reservation.
- A CHECK that `reviewed_at` is set exactly when `status <> 'PENDING'`, the
  pattern V16 already uses for transfers.

**Contract — `contracts/api-dto-fields.json` does change** after all, gaining
`ClubCreationRequestDTO`. Both suites assert against it, and the edit belongs in
the same commit as the code ([`rules/contracts.md`](../rules/contracts.md)).
`ClubInvitationDTO` and `ClubAdminDTO` already carry `role`, and
`ManagedClubDTO` already carries `officialEmail` and `officialEmailVerified`, so
nothing else in that file moves.

**Backend** — mapped to `club-administration.md` and `user-roles.md`:

- `club/ClubService.java` — `create` writes the owner assignment. **Trap:**
  `Club.id` is an assigned slug, so `save` goes through `em.merge` and returns a
  different instance ([BUG-034](../bugs/fixed_bugs.md#bug-034),
  [BUG-037](../bugs/fixed_bugs.md#bug-037),
  [ADR-002](../docs/decisions/ADR-002-club-id-is-an-assigned-slug.md)); the
  assignment must be written against the returned instance, after
  `saveAndFlush`. Widening the signature to take the creator leaves call sites
  and tests behind ([BUG-036](../bugs/fixed_bugs.md#bug-036)).
- `club/ClubController.java` — `create` becomes `hasRole('ADMIN')` and passes
  the authenticated principal.
- `clubadmin/ClubCreationRequestService.java`, `...Controller.java`, the entity,
  `RequestStatus` reuse, and `ClubCreationRequestDTO` — the new proposal
  lifecycle: `create`, `list`, `approve`, `reject`. Approval calls
  `ClubService.create` then `assignFirstOwner` in one transaction.
- `clubadmin/ClubAdminService.java` — `setOfficialEmail`.
- `clubadmin/ClubAdminController.java` — `PATCH /clubs/{clubId}/official-email`,
  `hasRole('ADMIN')`.
- `clubadmin/ClubAuditAction.java` — actions for club created and owner
  installed.
- `security/SecurityFilterChainConfig.java` — a matcher for
  `/api/v1/club-creation-requests`, placed **above** the broad public-GET block,
  the way `GET /clubs/*/admins` already is. First match wins; below it, the
  proposal queue would be world-readable.
- Tests: an admin creating a club owns it; a non-admin gets 403 on
  `POST /clubs`; a proposal creates no club row; approval creates both rows and
  is atomic; a second pending proposal for the same slug is refused; a
  proposal whose slug was taken by a direct create between submission and
  approval fails with a message rather than a 500; a club owner cannot write
  `official_email`.

**Frontend** — mapped to `club-administration.md` and `api-and-caching.md`:

- the club create form — branches on `isAdmin`. The admin path creates directly
  and keeps the logo, images and social-link fields, which now work. The
  proposal path submits and says so, and **renders no image fields at all**.
- `app/lib/club.tsx` — the admin create call chains logo, images and social
  links; a new `club-creation-requests.tsx` for the proposal calls.
- `app/lib/managed-clubs-context.tsx` — refresh after create and after an
  approval, or the new owner has no Manage link until a reload.
- `app/(protected)/admin/page.tsx` — the merged queue: both request kinds in one
  list, sorted by date, each row labelled and approving through its own
  endpoint.
- `app/(protected)/manage/[clubId]/page.tsx` — the official-email panel becomes
  editable for platform admins. Its comment at `:122-124` says it states the
  fact rather than offering a field that would be refused; that reasoning
  changes and the comment goes with it.
- Somewhere for a requester to see their own pending proposal. Smallest honest
  option is a line on `/manage` when they hold no clubs; flag if you want a
  screen.

Docs and rules mapped to those paths:
`docs/architecture/club-administration.md`, `docs/architecture/user-roles.md`,
`rules/backend-clubs.md`, `rules/db-migrations.md`, `rules/contracts.md`.

## Verification

```
node scripts/verify.mjs                     # what CI runs
./mvnw -B verify -f backend/pom.xml         # ITs on real PostgreSQL, ddl-auto validate
npm test --prefix frontend                  # includes the contract test
```

Then in the running stack, with a second non-admin account alongside
`sahaarpan550@gmail.com`:

1. As admin, create a club with a logo, banner and social links — land on it as
   owner, all three saved, no 403.
2. As the ordinary user, open the same form — **no image fields are rendered** —
   and submit. No club appears on `/clubs`, no row lands in `clubs`, and the
   proposal shows in the admin queue.
3. Submit a second proposal for the same slug from a third account — refused at
   submission with a sentence.
4. Approve the first: the club appears, the requester is its owner, and they can
   upload a logo from `/manage/[clubId]`.
5. Reject the second and confirm no club row was created.
6. As admin, invite an admin by email, accept from the other account, remove
   them; then set an `official_email` and confirm the club owner cannot.
7. `/manage/[clubId]/activity` shows the new entries.
8. The eight seeded clubs are untouched — still ownerless, still claimable
   through the request queue, no assignment rows written for them.
9. `docker compose down -v && docker compose up` — V31 applies from an empty
   schema and the stack boots.

## To update at wrap-up

- **ADR-004, ADR-005 and ADR-006 are written** (2026-09-08, before any code) and
  indexed in both `docs/decisions/README.md` and `docs/README.md`; the
  club-creation row is removed from the waiting-to-be-written table. All three
  are `Proposed` — **only Arpan moves a Status to Accepted**. Add the
  `Implemented in:` link to each once the work lands; that is the one edit an
  accepted ADR ever receives.
- `docs/architecture/club-administration.md` — the two paths, the proposal
  table, the official-email write, and its
  `Code as of:` stamp.
- `docs/architecture/user-roles.md` — clubs are no longer born ownerless.
- `rules/backend-clubs.md` — a line if the `saveAndFlush` ordering trap bites
  again, carrying the bug id.
- `TODO/todo.md` — close the club-creation P0; mark governance item 6
  **half done** (the admin write ships, the §6 verification round trip does
  not) and add the round trip to the AWS SES item under Security, carrying the
  `club_email_verifications` shape recorded above. Note that
  [BUG-039](../bugs/bugs.md#bug-039) is now reachable rather than latent, and
  that club proposals have no expiry. Also correct `todo.md:143`, which says V6
  inserts *sixteen* mock clubs — it inserts eight, in the first of its two
  INSERT statements.
- `TODO/tasks-completed.md` and the `STATUS.md` shipped line.
- Mark this spec `Status: shipped`.
