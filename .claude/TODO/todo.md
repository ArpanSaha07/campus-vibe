# CampusVibe — TODO

Last updated: **2026-08-20** · Branch: `feature/user-profile`

Project knowledge — what the code does and why — lives in
[`.claude/docs/`](../docs/README.md). Read that index before changing a
subsystem; this file is the work queue, not the reasoning.

**Finished work lives in [`tasks-completed.md`](tasks-completed.md)** — it is
not gone, it is filed. Check there before building something that sounds like
it may already exist. A digest of the last ten items is at the foot of this
file, so *what just shipped* is answerable without opening it.

Priorities: **P0** blocking / broken · **P1** next up · **P2** planned · **P3** backlog
Bug references point at [`bugs.md`](../bugs/bugs.md) (open) and
[`fixed_bugs.md`](../bugs/fixed_bugs.md) (resolved).

---

## Next up (in order)

1. **Commit the secrets-management work** — Steps 1-5 are complete and verified. See [Recently completed](tasks-completed.md#completed-work-log).
2. **P0** — Fix backend CI: JDK 17 → 25, and stop skipping tests ([BUG-002](../bugs/bugs.md#bug-002)).
3. **P0** — Fix semantic search returning 0 results ([BUG-001](../bugs/bugs.md#bug-001)).
4. **P1** — Step 6 of the LLM key work: query-embedding cache + rate limiting ([BUG-005](../bugs/bugs.md#bug-005)).
5. **P1** — Decide JWT transport (localStorage vs httpOnly cookie) and fix route protection ([BUG-003](../bugs/bugs.md#bug-003)).
6. **P1** — Backfill club embeddings with `POST /api/v1/search/reindex`, now that an admin account exists. All 8 clubs have `embedding IS NULL`, so the semantic half of club search matches nothing.
7. **P0** — Two auth findings from the 2026-08-15 review, both small: fail closed on a blank `GOOGLE_CLIENT_ID` ([BUG-030](../bugs/bugs.md#bug-030)) and check `email_verified` ([BUG-031](../bugs/bugs.md#bug-031)). See [Security](#security).

---

## P0 — Blocking

- [ ] **Backend CI cannot pass — fix written, never executed.** `backend-ci.yml` set up JDK 17 while the project needs Java 25, and ran `-DskipTests`, so no backend test had ever run in CI — which is why a non-compiling merge and a failing search test both slipped through. **The workflow was rewritten** (`_backend.yml`: JDK 25, `./mvnw -B verify`, never `-DskipTests`). **Left open deliberately: no workflow in this repo has run on GitHub yet**, so the fix is unverified and [BUG-002](../bugs/bugs.md#bug-002) is still OPEN. Close both on a green run, not on the diff.
- [ ] **Semantic search returns nothing for meaning-only matches.** Pre-existing; 1 of 40 tests failing. Embedding *writes* are proven fine, so the fault is in `SearchRepository.hybridSearchEventIds`. ([BUG-001](../bugs/bugs.md#bug-001))

---

## Backend / Features

- [ ] **P1** Add `EventService.update(...)` — there is currently no update path at all, so events can never be edited, and their embeddings go stale. Mirror `ClubService.update`, which correctly re-indexes. ([BUG-006](../bugs/bugs.md#bug-006))
- [ ] **P1** Finish the authentication workflow (listed as *In Progress* in `claude.md`): passwordless email-code login, persistent login.
- [ ] **P1** Apply the `User.java` collection pattern to `Club.images` and `Event.images` — unmodifiable view plus an `addImages` mutator — and add the tests neither path has. **Do not accept Copilot Autofix on CodeQL alerts 14 and 15**: it returns a copy, which detaches `getImages().addAll(keys)` from Hibernate and loses every uploaded logo and banner silently. That exact fix already broke saving events for a day ([BUG-022](../bugs/fixed_bugs.md#bug-022)). ([BUG-023](../bugs/bugs.md#bug-023))
- [ ] **P1** **Event lifecycle status — `DRAFT` / `PUBLISHED` / `ARCHIVED`.** `events` has no status column today (`Event.java`), so the club dashboard can only split by `date_time` into upcoming and past, and there is no way to draft an event before announcing it or to retire one without deleting it. Deliberately kept out of the club-governance work on 2026-08-17 so that feature stayed scoped; it is the next thing the club dashboard's Events tab needs.

  **The work:** migration adding `events.status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))` (default `PUBLISHED` so every existing row stays visible), an `EventStatus` enum on `Event`, a publish/unpublish/archive action on `EventService`, and status tabs on `/manage/[clubId]/events`.

  **The trap that makes this P1 rather than P2:** *every* public read path must filter to `PUBLISHED`, or drafts leak onto the homepage, the club page, and search. That means `EventRepository` list queries, `SearchRepository.hybridSearchEventIds`, and `SearchIndexService` (a draft should not be indexed at all, and archiving should evict it). Getting the column in without covering all four is worse than not having it. Pair it with `EventService.update` (BUG-006), which is a prerequisite anyway — there is no update path to set the status through.
- [ ] **P2** Club Dashboard API: create / edit / delete events for the admin's own club; banner and logo upload. *(Authorisation for these landed 2026-08-17 — `@clubPermissionService.canManageClub` now covers every club admin, not just one per club. What is still missing is `EventService.update` above, delete, and the upload endpoints being reachable from `/manage/[clubId]`.)*
- [ ] **P2** Admin Dashboard API: create clubs, manage users, moderate events. *(Assigning the first club owner is done — approving a club-admin request writes the `CLUB_OWNER` assignment. Setting `official_email` is listed under Club governance.)*
- [ ] **P2** **Nothing can change an account's email address.** `/profile/edit/account` renders the field and its Save commits locally. Needs a confirm-the-new-address round trip, not a straight update — `auth_tokens` (V11) already carries the machinery and would gain an `EMAIL_CHANGE` purpose, and the address is the login identifier, so an unverified change locks the account out. *(The other half of that screen now works: `PATCH /api/v1/users/me` renames an account, 2026-08-20. Only the email is still local.)*
- [ ] **P2** **Account closure has no endpoint.** The confirmation panel on `/profile/edit/account` is built and its destructive button is deliberately `disabled` with a note, because the nearest wired action is sign-out and that would tell someone their data was gone while every row of it remained. Overlaps the GDPR item under Security. An owner cannot leave a club without handing it on, so closure has to refuse or force a transfer first.
- [ ] **P3** Notifications.
- [ ] **P3** Ticket purchasing flow.
- [ ] **P3** Move `application-test.yml` from `src/main/resources` to `src/test/resources` so test config stops shipping in the production jar. ([BUG-007](../bugs/bugs.md#bug-007))

## Club governance

Spec: [`club_admin_governance.md`](../docs/architecture/club_admin_governance.md)
(15 MVP items) · As-built:
[`club-administration.md`](../docs/architecture/club-administration.md)

**Items 1–4 shipped 2026-08-17**, **items 5, 7, 8, 9 and 10 shipped
2026-08-18** — assignment table, the two club roles, the one-owner invariant,
administrator listing, the `/manage/[clubId]` dashboard,
invite/accept/decline/remove, ownership transfer, and the append-only activity
log. The rest, in the spec's order:

- [ ] **P1** *(item 6)* **Platform-admin UI for `official_email`.** The column
  landed in V13 and **nothing can write it**, so every club has `NULL`. Two
  things are already written and waiting on it: the §17 security notices in
  `ClubAdminService.notifyClubInbox` fire only when a club has an address, and
  the official-email verification step §6 puts in the middle of the invite flow
  was skipped for the same reason. Small, and it unblocks the security half of
  items 5 and 8.
- [ ] **P2** *(item 5, follow-up)* **Expire stale invitations.** `EXPIRED` is in
  `AssignmentStatus` and nothing sets it. A PENDING row grants nothing, so this
  is tidiness rather than exposure — but it holds the
  `one_live_invite_per_club_email` slot, so an owner who mistypes an address has
  to cancel before re-inviting. Wants a TTL and a sweep; natural to pair with
  the audit log, which is where the sweep should be recorded.
- [ ] **P2** *(item 8, follow-up)* **Expire stale handovers**, alongside the
  invitation expiry below. An offer nobody answers sits PENDING forever and
  holds the club's one transfer slot; the owner can withdraw it, but nothing
  does so on its own.
- [ ] **P2** *(items 9–10, follow-up)* **Log club-page edits and event changes.**
  The audit log covers administration and ownership only, so a club with a stable
  team has an empty Activity tab — and §21's own UI example shows exactly the
  entries that are missing. `ClubAuditService.record` and the `CLUB` / `EVENT`
  entity types already exist; what is needed is call sites in `ClubService` and
  `EventService`. Pairs with `EventService.update` (BUG-006), which has to touch
  those paths regardless.
- [ ] **P3** *(items 11–13)* **Notification separation.** Club-operational mail
  to the official club email, personal mail to the user, optional personal
  copies for admins, and the §17 security notices that cannot be opted out of.
  Blocked on the notification system generally, which does not exist.
- [ ] **P3** *(item 14)* **Annual administrator review.** Prompt only — never
  auto-remove anyone on a date (§43).
- [ ] **P3** *(item 15)* **Platform-admin ownership recovery.** Needs
  `official_email` to be real first, and needs an admin account to exist.

## Frontend / Features

- [ ] **P1** Fix route protection — `proxy.tsx` is never executed by Next.js (wrong filename *and* wrong export name), and it reads a cookie while the JWT lives in localStorage. Decide the token transport first; a half-wired guard is worse than none. ([BUG-003](../bugs/bugs.md#bug-003))
- [ ] **P2** Fix `NEXT_PUBLIC_*` in the **production** Docker build — values are inlined at build time, so the deployed frontend ships them empty. Needs `ARG`/`ENV` before `npm run build` plus compose `build.args`. No longer affects local dev, which now builds the `dev` stage and reads them at runtime. ([BUG-004](../bugs/bugs.md#bug-004))
- [x] **P0** ~~Build password reset, or take the screen down~~ — **built 2026-08-15**, see Security.
- [ ] **P2** Converge the two Google sign-in implementations. `GoogleAuthButton` (auth modal, custom-styled, forwards to a hidden GIS button) and `OAuthButtons` (the `/login` page, Google's own rendered button) now both call `initialize`, and GIS keeps only the last config registered. They never mount together today, so nothing is broken — but the `/login` page should adopt `GoogleAuthButton` and `OAuthButtons` should go.
- [ ] **P3** Point the remaining `/login` links at the auth modal. The Footer's Sign up / Log in and `ProtectedRoute`'s redirect still navigate to the `/login` page, so the app has two different-looking ways to sign in. The navbar and the save-event heart already open the modal.
- [ ] **P1** Add an "I'm going" control so users can actually RSVP. `POST`/`DELETE /api/v1/users/me/rsvps` are live and tested, but nothing in the UI calls them yet, so the Going tab can only be populated through the API. Natural home is the event detail page, beside the existing save heart.
- [ ] **P2** Refresh the My events list after the heart is toggled. `EventLikeButton` updates its own state optimistically, so un-saving on the Saved tab leaves the card visible until reload.
- [ ] **P2** Give `EventInstance` a real end time. `buildGoogleCalendarUrl` currently assumes every event runs two hours, because Google needs a start/end pair and the model has no end. Every "Add to calendar" link is that guess until the backend carries one.
- [ ] **P3** Whole-list calendar export ("Add to calendar" for a full tab). Needs an .ics feed — a Google template link carries exactly one event, which is why that control lives on each card rather than in the page header.
- [ ] **P2** Category filtering on the events listing.
- [ ] **P2** Wire Club Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Wire Admin Dashboard UI to the backend once those endpoints exist.
- [ ] **P2** Bookmark UI. `EventLikeButton` posts to `/saved-events` but starts from `initiallySaved={false}` unless the caller knows better, so a saved event still shows an empty heart on the events listing. Same fix as the follow button: a provider holding the saved ids, filled from `GET /api/v1/users/me/events`.
- [ ] **P3** Show the live follower count on club cards and the club page. `Club.followers` is accurate now that follows move it, but `ClubCard` has its count commented out and the club page's number never refreshes after a follow — the provider only tracks ids.
- [ ] **P2** **The club page's event tabs still render mock data.** `ClubEventTabs` is wired to the shared pill component but `app/(main)/clubs/[clubId]/page.tsx` passes `popularEvents` for *both* upcoming and past, so the two tabs show the same eight fixtures and the counts are the same number twice. `listEventsByClub(clubId)` already exists and is what `/manage/[clubId]/events` uses — this is a call site, not a feature. Also un-comment the `followers · events` line the page currently has commented out.
- [ ] **P2** **Profile photo upload.** `ProfileAvatar` draws the first initial and `/profile/edit` says in words that uploads are not available, rather than showing a disabled button. There is no avatar column on `users` or on `user_profiles` to fall back from. S3 is already wired for club logos and event banners, so this is the same path with a different owner.
- [ ] **P2** **The public profile view does not exist.** `showInterests` and `showSocialLinks` persist as of 2026-08-20 and govern how a profile looks *to other people* — but `/profile` only ever shows you your own, where you always see everything. **Both switches therefore still control nothing.** Decide the route (`/users/[id]`?), what a visitor may see, and add the public read endpoint. Note that its `permitAll` matcher has to sit *above* the broad public-GET block in `SecurityFilterChainConfig`, the way `/api/v1/interests` does — first match wins.
- [ ] **P2** **Events and users should draw on one shared list of categories and interests, and today there are three.** Decided 2026-08-20. What exists now: `event_categories` (V3) is free text with no key and no constraint — the mock rows use `Dating`, `Research`, `Food`; the homepage tiles are a separate hardcoded list of eight in `CategoriesSectionMainPage.tsx` (`Music`, `Nightlife`, `Holidays`, `Dating`, `Hobbies`, `Business`, `Food & Drink`, `Performing & Visual Arts`) which link to `/events?q=<name>`, a **search query rather than a category filter**; and `interest_catalogue` (V19/V20) is the only one of the three with a stable key and a foreign key behind it.

  **The work:** point `event_categories.category` at `interest_catalogue(slug)`, decide what happens to the values already stored (none of the three current ones are catalogue slugs, and the seeded events come from `V6`), replace the homepage tiles with a read of `GET /api/v1/interests` so the eight are drawn from the list rather than invented beside it, and turn the tile links into a real filter instead of a text search. `user_preferred_categories` — which would have been a fourth vocabulary — was dropped in `V22__drop_user_preferred_categories.sql`.

  **The catalogue is the one to keep**, because it is the only one that can be pointed at: it has slugs, so renaming a label moves nobody's data, and a foreign key can enforce membership. Expect its 76 entries to need revisiting for the events half — a list written for *what a student is into* is not automatically the right list for *what kind of event this is*, and `Study groups` and `Nightlife` are not the same kind of word.

- [ ] **P3** **Interests are stored and never read.** They persist against a real catalogue as of 2026-08-20 (`interest_catalogue`, V20) with a foreign key behind them — but nothing reads the chosen values: no filtering, no ranking, no suggestion. The copy on that screen promises we will use them to suggest clubs and events, which is still untrue. Natural pair with the search work, since `search` already has the embedding machinery.
- [ ] **P3** Custom header style in `layout.tsx`. *(from `frontend/README.md`)*
- [ ] **P3** Apply `EventCard`'s stretched-link pattern to `MyEventCard`. Only its stub content links to the event, so the image and padding are still dead. Same fix: `relative` root, `after:absolute after:inset-0` on the title `<Link>`, and the heart/calendar controls lifted above it — they cannot be nested inside the `<a>`.
- [ ] **P3** Stop event cards overlapping in the event section. *(from `frontend/README.md`)*
- [ ] **P3** Restrict club title input to alphanumeric + spaces on create. *(from `frontend/README.md`)*
- [ ] **P3** `images` and `categories` are still N+1 on the events list — two statements per event, from the `@ElementCollection` copies in `EventMapper`. Pre-dates the `organizerName` work and is the whole remaining per-event cost (2 of the 13 statements above, times the event count). A batch size or a second entity graph would flatten it.
- [ ] **P3** Event detail page still shows a static "Save your spot" button and no recurrence. RSVP wiring is tracked above; recurrence has no field in the model at all, so the old hardcoded "Every week on Sunday" line was dropped rather than faked.

## AI & Search

Architecture reference: [`.claude/docs/architecture/llm-api-key-management.md`](../docs/architecture/llm-api-key-management.md) · [`.claude/skills/llm-integration/SKILL.md`](../skills/llm-integration/SKILL.md)

- [ ] **P1** *(Step 6)* Cache query embeddings — Caffeine, bounded + TTL. Highest-leverage cost fix: document embeddings persist in pgvector, but every search re-embeds the query, including identical repeats.
- [ ] **P1** *(Step 6)* Per-IP rate limiting on the search endpoints, returning `429`, enforced **before** the provider call. Required because search is deliberately public. ([BUG-005](../bugs/bugs.md#bug-005))
- [ ] **P1** *(Step 6)* Cap query length before embedding.
- [ ] **P1** *(Step 6)* Set a hard monthly budget cap on the OpenAI project — the only control that bounds the loss from a leaked key. Use **separate OpenAI projects per environment**.
- [ ] **P2** *(Step 6)* Add a `gitleaks` pre-commit hook and enable GitHub secret-scanning push protection.
- [ ] **P3** Introduce `LlmClient` / `PromptTemplateService` / `AIController` — **only when the first generative feature lands**. Embeddings are not generative; SKILL.md says not to scaffold speculatively. The `com.campusvibe.ai` package and `OpenAiProperties` are the foundation these plug into.
- [ ] **P3** Candidate generative features once the layer exists: event summarisation, event description generation, recommendations, moderation assistance.
- [ ] **P3** Multi-provider support (`AnthropicLlmClient`, etc.) — do not add before a feature requires it.

## Database Lifecycle & Seeding

Reference: [`.claude/skills/database-lifecycle/PLAN.md`](../skills/database-lifecycle/PLAN.md) (audit + implementation sequence) · [`SKILL.md`](../skills/database-lifecycle/SKILL.md) (rules)

Ordered — each task unblocks the ones below it. *(Step N)* maps to PLAN.md's
Implementation Sequence.

- [x] **P1** ~~Integration tests ran on H2, so entity/migration drift was never caught~~ — **done 2026-08-17.** Every `*IT` now runs against real PostgreSQL + pgvector via `PostgresTestContainer`, with Flyway on and `ddl-auto: validate`. Plain `*Test` unit suites stay on H2 and need no Docker.
- [ ] **P2** **`docker compose up` can silently run a stale backend jar.** `backend/Dockerfile` does `COPY backend/target/campusvibe-0.0.1-SNAPSHOT.jar`, and the `develop.watch` rule syncs that jar in — but **only while `docker compose watch` is actually running**. Recreate the container any other way and it falls back to whatever jar was baked into the image, with no warning. On 2026-08-17 that produced `Schema-validation: missing column [club_admin_id] in table [clubs]`: an image jar from three days earlier meeting a database the newer jar had already migrated. Nothing about the error names the real cause.

  **Options:** build the jar inside the Dockerfile (multi-stage, slower but self-consistent); or stamp the jar's build time into `/actuator/info` and have the healthcheck or a compose profile compare it; or, cheapest, document `docker compose build backend` as a required step after any `mvn package` and say so in the README. The failure is confusing enough — and now reachable on every migration — to be worth more than a docs line.

- [ ] **P1** **Backfill club embeddings.** All 8 clubs have `embedding IS NULL`, so the semantic half of club search cannot match anything — only the keyword path works today. A single `POST /api/v1/search/reindex` once an admin exists. Distinct from [BUG-001](../bugs/bugs.md#bug-001) (events, repository-level) but the symptoms look identical, so confirm embeddings are non-null *before* debugging ranking.
- [ ] **P2** *(Step 3)* **Dev seeder** (`seed/DevDataSeeder.java`). `@Profile("dev")`, idempotent — skip when clubs already exist. Port the 8 clubs out of V6 and create them **through the service layer** so `SearchIndexService` populates `clubs.embedding` on write; that is precisely why a programmatic seeder is mandated over seed SQL. Verify with `docker compose down -v && docker compose up -d`, then `count(embedding) = count(*)` on `clubs`.
- [ ] **P2** *(Step 4)* **Retire `V6__insert_mock_clubs.sql`.** Only after the seeder reproduces the same data. Do **not** delete the file — Flyway aborts with `Detected applied migration not resolved locally: 6` and the app will not boot. Supersede it with `V9__remove_mock_club_seed_data.sql`. Locally `docker compose down -v` is cleaner; ship V9 only if V6 ever reached another environment.
- [ ] **P2** **Tests** — migrations apply from an empty schema; the seeder creates no duplicates and does not run under `test` or `prod`. *(The bootstrap half is done: `AdminBootstrapRunnerIT` covers idempotency across two runs, promoting an existing non-admin, refusing to create a password-less account, and never revoking.)*
- [ ] **P2** *(Step 5)* **Production posture** — before the first EB deploy: `SPRING_PROFILES_ACTIVE=prod` so `DevDataSeeder` cannot run, and `APP_BOOTSTRAP_ADMIN_ENABLED=false` once the admin exists.
- [ ] **P3** **Keep reference data out of schema migrations.** `V7__multi_role_rbac.sql` creates the RBAC tables *and* inserts the three role rows. It is applied, so leave it alone — but split the two concerns in every migration from here on.

## Infrastructure & CI/CD

- [ ] **P1** **Re-run the full tier and get it green past the Trivy gate.** Ran 2026-08-07: the **frontend image scanned clean**, confirming BUG-016 on GitHub, and the gate then failed on the **backend** — four fixable CRITICALs in `app/app.jar`, all from `spring-boot-starter-parent` 3.5.5 ([BUG-019](../bugs/fixed_bugs.md#bug-019)). Parent bumped to 3.5.16, which is the first 3.5.x carrying both fixes. **Replayed end-to-end locally 2026-08-08** once Docker Desktop was up — fail-fast secret guard, `compose build`/`up`, all three health waits, the API smoke tests, the production frontend image on :3001, and the Trivy gate itself with the same Trivy 0.73.0: **both images 0 fixable CRITICAL, exit 0**. So the gate is no longer the open question; what remains unproven is only that a clean Ubuntu runner agrees. Note the old prediction that it would then **fail on [BUG-001](../bugs/bugs.md#bug-001) no longer holds** — the full suite ran **42/42** here, `SearchIT` included, and that bug no longer reproduces on this machine. It is deliberately still open, because nothing explains why it stopped; this run is the arbiter.
- [ ] **P1** **Triage the nine red dependency PRs.** Nothing tracked them until 2026-08-07. Three fail the **fast** tier and so are genuine breaking majors: `#22` eslint-config-next 16, `#21` eslint 10, `#20` lucide-react 1.28 (`frontend`). Two fail both tiers: `#17` Spring Boot 4.1.0, `#15` maven-minor-patch (`backend`). Four fail only the full tier — `#19`, `#18`, `#16`, `#14` — and are probably BUG-001 rather than the bumps (`devops` to confirm). This is Dependabot's ungrouped-majors design working exactly as intended. **Note `#15` now overlaps [BUG-019](../bugs/fixed_bugs.md#bug-019):** the Spring Boot parent went to 3.5.16 by hand to clear the Trivy gate, so `#15` will rebase down to its remaining six updates — the hard-pinned, BOM-free block (`awssdk:s3`, `commons-io`, `jjwt`, the Google clients) that is the actual reason the maven entry exists.
- [ ] **P0** **BLOCKER — possibly lifted, and that needs confirming before anything is built on it.** Branch protection went on 2026-08-07 and `CI` is a required check, so a single red test makes every PR unmergeable, the nine Dependabot ones included. The measurement on record (2026-08-05, **40 tests, 39 pass**) had `SearchIT.semanticSearchMatchesMeaningWithoutSharedKeywords:163` as the one failure. **Re-measured 2026-08-08: `./mvnw -B verify` is 42/42 green** — 16 unit (the 2 actuator cases included) + 26 integration, nothing red anywhere in the full tier. [BUG-001](../bugs/bugs.md#bug-001) no longer reproduces, and a Boot 3.5.5 control run in a worktree rules out the [BUG-019](../bugs/fixed_bugs.md#bug-019) bump as the cause; **why it stopped failing is unknown**. So: do **not** apply the `@Disabled("BUG-001: …")` quarantine that was the fallback plan — it would disable a passing test and destroy the evidence. Push and read the full tier instead. If it is green there too, this item and BUG-001 both close; if it is red on Ubuntu, that difference is itself the diagnosis.
- [ ] **P2** **Tighten the Trivy gate** in `_docker.yml` once *both* base-image baselines are known. It reports fixable HIGH+CRITICAL and fails only on fixable CRITICAL. **Both baselines are now measured (2026-08-08), and the answer is that the gate cannot move yet.** Frontend prod: **0 fixable HIGH, 0 CRITICAL**. Backend: **0 CRITICAL but 10 fixable HIGH** — `libexpat` and `p11-kit`/`p11-kit-trust` from `eclipse-temurin:25-jdk-alpine` (`os-pkgs`), and in the jar `commons-io` 2.11.0 → 2.14.0 (**our own hard pin**, CVE-2024-47554), `org.postgresql` 42.7.11 → 42.7.12, and five netty artifacts all needing 4.1.136.Final. Full table in [BUG-019](../bugs/fixed_bugs.md#bug-019). Three things to do before the gate tightens, in this order: **(a)** establish whether the S3 client in use is synchronous — `dependency:tree` shows every netty artifact entering via `awssdk:s3` → `netty-nio-client`, the *async* transport, so if nothing calls it an `<exclusion>` deletes six of the ten findings rather than chasing versions; **(b)** bump `commons-io`, which is ours alone and years stale; **(c)** re-measure, then decide whether the base-image HIGHs have a published fix. Only then flip `--severity CRITICAL` to `HIGH`.
- [ ] **P1** **Record and decide on the Vercel deployment ([BUG-018](../bugs/bugs.md#bug-018)).** Discovered 2026-08-07 only because a preview build failed. Three things, in order: write a `vercel.json` so the root directory and build command are in version control rather than the dashboard; list which `NEXT_PUBLIC_*` keys are set in which Vercel environments (**key names in the docs, never values**); and decide whether the Vercel check should be a required status check on `main` alongside `CI` — if a failed deploy should block a merge, requiring it is the only thing that makes that true. Also worth asking whether preview deployments should exist yet at all: they build against no backend, so a preview is a frontend shell pointed at nothing.
- [ ] **P1** **Fix [BUG-004](../bugs/bugs.md#bug-004) — `NEXT_PUBLIC_*` build args.** Note this is now a **Docker-only** bug: on Vercel these come from project environment variables and are probably correct, so fixing one does nothing for the other ([BUG-018](../bugs/bugs.md#bug-018)). Promoted from P2 on 2026-08-07: `_docker.yml` now builds *and boots* the production image on every full-tier run, so CI is actively producing an artifact with an empty API URL and an empty Google client id. The smoke test only asks for HTTP 200 on `/`, which an empty API URL still returns, so nothing catches it. Two `ARG`/`ENV` lines before `npm run build` in the `builder` stage plus matching `build.args` in compose. BUG-016 rewrote the `runner` stage and deliberately left `builder` alone.
- [ ] **P2** Extend `_database.yml` once the dev seeder lands: assert `DevDataSeeder` does **not** run under the `prod` profile, and that `count(embedding) = count(*)`.
- [ ] **P3** Consider **build-once / promote-one-artifact**. `_docker.yml` builds its own jar rather than consuming `_backend.yml`'s artifact, because `needs: backend` would serialise the jobs and break on a frontend-only PR. The clean fix needs a registry, so it belongs with CD.
- [ ] **P3** **Docker layer caching in `_docker.yml`** — considered on 2026-08-16 and deliberately skipped, recorded so it is not re-derived from scratch. Every run builds cold. The `--target runner` frontend build is the slow part and is the one worth caching, but doing it properly means `docker/setup-buildx-action` plus `build-push-action` with `cache-to: type=gha` (the raw CLI cannot see `ACTIONS_RUNTIME_TOKEN` from a `run:` step). Caching the *compose* build additionally needs `cache_from: [type=gha]` entries in `docker-compose.yml` — a CI-only concern leaking into the file developers run locally, where `type=gha` does nothing but warn. Judgement: the trigger rework already cut this job's frequency by roughly half, so ~1 minute more for two new actions and a new failure mode is not the best next move. Revisit if the docker job becomes the thing people wait on.
- [ ] **P3** **Re-audit the 2026-08-07 banner at the top of [`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md).** A dated note now marks it as partly overtaken — `main` is no longer unmergeable, BUG-016/017 are confirmed on GitHub, and the tiering it describes is gone — but it was not re-read line by line during the 2026-08-16 trigger rework. Either fold the still-true parts into the body or date-stamp it as history.
- [ ] **P1** **CD prerequisites — none of these exist yet, which is why CD was scoped out** ([BUG-008](../bugs/fixed_bugs.md#bug-008) closed by deleting the stub rather than filling it in). All four are needed before a deploy workflow is worth writing:
  1. An AWS account and an Elastic Beanstalk environment (`docker/Dockerrun.aws.json` still carries the literal `<your-backend-image>:latest` placeholder).
  2. A GitHub OIDC role + trust policy — see the next item.
  3. A registry decision: GHCR or ECR.
  4. A Vercel project + deploy token, if the frontend goes there rather than to EB.
- [ ] **P1** Use **GitHub OIDC** (`aws-actions/configure-aws-credentials` with `role-to-assume`) for AWS auth in CI. Do not add long-lived `AWS_ACCESS_KEY_ID` repo secrets. No LLM key should ever enter CI.
- [ ] **P2** First Elastic Beanstalk deployment — follow [`docker/EB-DEPLOYMENT.md`](../../docker/EB-DEPLOYMENT.md) for the environment-property list.
- [ ] **P2** Attach an IAM instance role granting S3 access, so the default credential chain resolves in production (`s3/S3Config.java` already expects this).
- [ ] **P3** Migrate secrets from EB environment properties to **AWS Secrets Manager** as the app grows. Reachable via `spring-cloud-aws-starter-secrets-manager` + `spring.config.import` with **no feature-code changes** — that is the point of routing everything through `OpenAiProperties` and placeholders now.

## Security

**Every item below came out of the 2026-08-15 authentication review. Full
reasoning, measured endpoint behaviour and the complete gap list are in
[`authentication.md`](../docs/architecture/authentication.md) — read that before
picking one up. It was not reviewed by `security`; these are one engineer's
findings.**

- [ ] **P1** **Rate-limit `/api/v1/auth/forgot-password` — do this BEFORE SES, not after.** `AuthRateLimitFilter.LIMITED_PATHS` covers `/login`, `/register`, `/google` and `/email-status`. It does **not** cover `/forgot-password`, which is `permitAll` and sends one email per call. With the logging sender that is harmless, which is why it was never noticed. Point it at SES and the same endpoint becomes unbounded outbound mail to any address anyone names: your bill, your sending quota, and — because a stranger can have their inbox filled on demand — your SES reputation, which is the thing AWS suspends you over. Add the path to `LIMITED_PATHS`; the per-IP budget already exists and needs no new machinery. Consider a per-address budget too, since the per-IP one does not stop a distributed flood at one victim. Note `/resend-verification` is authenticated so it is a smaller problem, but it is the same shape.

- [ ] **P2** **Wire up AWS SES.** Decided 2026-08-16 (matches the planned Elastic Beanstalk deploy). `SmtpMailSender` and `MailConfig` already do the right thing when `spring.mail.host` is set, so the SMTP interface needs **no application code** — `email-smtp.<region>.amazonaws.com:587` plus SES SMTP credentials (which are *derived* in the SES console, not your AWS access keys) into the `SPRING_MAIL_*` env vars that `docker-compose.yml:74-77` already passes through. What actually needs doing:

  - **AWS side.** Verify a sender identity — a domain with Easy DKIM (3 CNAMEs) + SPF if you have one, otherwise a single email identity, accepting that From: shows a personal address and unaligned SPF/DKIM sends a good share to spam. Then **request production access**: every new account is sandboxed to *verified recipients only*, 200/day. That request is the long pole (~24h, and can come back asking for detail), so start it first. Set up bounce/complaint notifications to SNS — SES suspends sending above 5% bounces or 0.1% complaints, and password-reset mail to mistyped addresses guarantees bounces.
  - **`MAIL_FROM`** defaults to `no-reply@campusvibe.local`, a non-routable domain. Must become the verified identity or nothing sends.
  - **`APP_BASE_URL`** must be the public frontend URL. Wrong value produces mail that looks perfect and links to `localhost:3000`.
  - **Move the send out of the transaction.** `AuthenticationService.register` (`:119`) and `requestPasswordReset` (`:191`) are `@Transactional` and call `mailSender.send` inside. Today that is a no-op write to a log; with SES it pins a database connection across a network round trip on the signup path. `register` is worse: the send happens *before* `respondWithToken`, so anything that rolls the transaction back leaves a live verification link for a user that no longer exists. Move to an `AFTER_COMMIT` transaction listener.
  - **Give the swallowed exception a voice.** `SmtpMailSender` catches everything and logs — correct for forgot-password, since throwing would leak whether an address exists and 500 the caller. But it means a misconfigured SES is invisible outside the log, and during the sandbox period *every* send to a real user fails that way. Add a counter or a health signal so silent total failure is detectable.
  - **Leave `management.health.mail.enabled: false` off.** Tempting to switch on now that mail is real; do not. It makes `/actuator/health` depend on SES reachability, so an SES incident pulls the app out of the load balancer — punishing an outage that is not ours with one that is.
  - **Optional follow-up:** switch to the SES v2 API via the AWS SDK (already a dependency for S3, `pom.xml:157`). Buys IAM-role auth on EB instead of static SMTP credentials in env, plus a message id and a real error surface. Not needed to make it work.

- [ ] **P3** **Decide whether to turn on `AUTH_REQUIRE_VERIFIED_EMAIL`.** Blocked on SES above: switching it on before mail actually sends would lock every new user out of their own account.

- [ ] **P1** **Nothing can be revoked, and the token sits in `localStorage`.** *(Step 4 of the 2026-08-15 sequence — written down here rather than built, at Arpan's direction.)* Three facts that only make sense together: `auth-context.logout` clears `localStorage` and nothing else, so the JWT stays valid for the rest of its **15 days**; there is no refresh token, so shortening that lifetime would just log everyone out more often; and the token is readable by any script on the page, with no CSP to narrow that. Deleting the user is currently the only revocation, and it works only because `JWTAuthenticationFilter` re-reads the user from the database on every request. **Do the three as one piece of work, not separately** — the storage decision ([BUG-003](../bugs/bugs.md#bug-003)) determines whether a refresh token can live in an httpOnly cookie, which determines whether CSRF has to come back on (it is disabled today, correctly, for a bearer-token API). Sketch: short access token (15-30 min), refresh token in an httpOnly + Secure + SameSite cookie, a `refresh_tokens` table keyed by a hash so logout and 'sign out everywhere' can revoke, rotation on use with reuse detection. Trigger: before any real-user launch, or immediately if a token is ever suspected leaked.
- [ ] **P3** **Facebook / Meta sign-in.** Requested 2026-08-15. Low priority, and deliberately sequenced *after* the `auth_provider` migration above — adding a third identity provider while the schema still cannot tell providers apart would make the identity model worse, not better.
- [ ] **P3** Auth event audit log (sign-in, failure, reset, role change). Cheap to add; most valuable once there is traffic worth reading.
- [ ] **P3** Account deletion and data export. Needed before any real-user launch under GDPR-like rules; no legal deadline yet.
- [ ] **P3** **Triage the standing CodeQL alerts that are not defects.** Eight new alerts on [PR #31](https://github.com/ArpanSaha07/campus-vibe/pull/31) were fixed in code on 2026-08-16 ([BUG-032](../bugs/fixed_bugs.md#bug-032), [BUG-033](../bugs/fixed_bugs.md#bug-033)); what remains is the set that is *correct as written* and needs dismissing with a reason, so the queue stops hiding real findings behind noise. Three groups: **(a)** `java/sensitive-log` **and** `java/log-injection`, both on `LoggingMailSender` (alerts 33 and 34) — dismiss them together, same bean, same reason. It logs reset links on purpose, which is the entire reason the bean exists, and `Logs.safeBlock` deliberately preserves newlines because the body is printed as a block; a barrier that keeps `\n` cannot satisfy a newline-sanitiser query, so no rewrite clears 34 without destroying the feature. The per-line `| ` prefix is the real mitigation and static analysis cannot see it. **(b)** `js/empty-password-in-configuration-file` on `application-test.yml` — H2 in-memory, user `sa`, no password, which is the standard for it. **(c)** `java/internal-representation-exposure` on `Club.images` / `Event.images` — accepting the offered autofix here **breaks every write**, which is already logged as [BUG-023](../bugs/bugs.md#bug-023); dismiss it explicitly so nobody accepts it later. Dismissal is a repo-level action on the Security tab, so it is Arpan's call rather than something to do unasked.
- [ ] **P3** Clear the four `js/unused-local-variable` alerts (`useCreateClubForm.ts`, `auth-context.tsx`, `GoogleProvider.tsx`, `auth-context.test.tsx`). Dead bindings, not defects — worth doing in one pass while touching those files rather than on their own.
- [ ] **P2** Authorisation review for the Club Dashboard and Admin Dashboard endpoints as they are built — enforce server-side, never rely on UI restrictions.
- [ ] **P2** Rotate the local dev `JWT_SECRET` before any real deployment, and use a *different* value in production.

## Docs

- [x] **P2** ~~Make doc staleness visible instead of relying on memory~~ — **done 2026-08-14.** `scripts/docs-map.json` maps code paths to architecture docs; `scripts/check-docs.mjs` reports any area that changed without its doc changing, plus how many commits each doc's `**Code as of:**` stamp is behind. Wired into `.githooks/pre-push` as a **notice, never a block** — a stale doc does not break the build, and a blocking check would only teach us to reach for `--no-verify`, which also skips the tests. The four docs that have never been reconciled with the code are stamped `never` rather than given a sha, so the report stays signal.
- [x] **P3** ~~Root `README.md` claims infrastructure that does not exist~~ — **done 2026-08-14.** It listed Playwright, Prettier and Webpack (none in the manifests) and a live Vercel + Elastic Beanstalk deployment (CI deploys nothing). Split into **Built and working** and **Planned**, with a status line saying nothing is deployed yet. It is the public pitch, a different audience from `.claude/docs/` — conflating the two is why it drifted.
- [ ] **P3** **Five links point at `.claude/team/`, which does not exist.** `CHARTER.md`, `ROSTER.md`, `ROUTINES.md`, `WORKING-AGREEMENT.md` and `../commands/ask.md` are referenced from the *Agentic team* entries. Pre-existing — they were already broken in the committed file, not introduced by the todo/completed split. Either the folder was never committed or it was removed; decide which, then restore it or drop the references.
- [ ] **P3** **Reconsider a client query library (TanStack Query or similar) after the cookie migration.** **Decided 2026-08-15: not now**, reasoning in [`api-and-caching.md`](../docs/architecture/api-and-caching.md). Not for clubs/events/search — those are Server Components on Next's data cache already, so a query library there would move rendering off the server to get a cache that exists. The real case is the client surface: `followed-clubs-context.tsx` hand-rolls ~200 lines of `useQuery` + optimistic `useMutation`, four client pages repeat `useState`/`useEffect`/error-flag, and a **second** bespoke provider is queued below for saved events. Deferred because the `localStorage` JWT is *why* those pages are client-rendered at all — fix [BUG-003](../bugs/bugs.md#bug-003) first and several become Server Components, changing what is left to serve. **Trigger:** the cookie migration landing, or a third hand-rolled client cache being about to be written.
- [ ] **P2** **Call `revalidateTag` from the write paths.** The tags already exist, so this is small. Today, creating an event does not evict the events list — it stays stale for up to five minutes. Trigger: the first real club admin, or the first complaint that a new event does not appear.
- [x] **P2** ~~Write the user-profile implementation doc~~ — **done 2026-08-20.** [`user-profiles.md`](../docs/architecture/user-profiles.md), with its row in `docs/README.md` and an entry in `scripts/docs-map.json`, which previously mapped `com/campusvibe/user/` to no doc at all. Written alongside the backend rather than after it, so what it keeps is the reasoning that shaped the code: why the profile is its own table, why the write is a full-replace PUT and what that demands of the frontend, why interests get a foreign key and subjects do not, and why a social link is checked in two places. Carries seven known gaps.
- [ ] **P3** **Check the McGill faculty list and the interest catalogue.** Twelve faculties and schools remain in `frontend/app/lib/profile-options.ts`, transcribed from the university's own listing rather than fetched — and faculties do get renamed, Dentistry having become *Dental Medicine and Oral Health Sciences* recently. The interest catalogue **moved to the database on 2026-08-20** (76 entries, 12 categories, `V20__insert_interest_catalogue.sql`) and still has had no product review at all. Revising it is now a migration rather than an edit to a constant — cheap, because `user_interests` keys on the slug and not the label, so renaming what people read moves nobody's choices.
- [ ] **P2** **Look at `/profile` and `/profile/edit` in a browser, at both breakpoints.** Still never rendered, now across three commits, every one shipped on a green `verify` — which proves they compile, not that they work. Raised from P3 because these screens now write to a database. The checks that matter most: that editing the bio in one section and the degree in another loses neither (the whole reason `ProfileProvider` exists), that the picker populates from `GET /api/v1/interests`, and that a refused save shows the server's own sentence. Then the layout — the two-column split at `lg`, the sticky identity card, the mobile rail that scrolls sideways, and the interests grid at 76 pills.
- [ ] **P3** **Add a row for [`ai-planner.md`](../docs/architecture/ai-planner.md) to the docs index.** The file exists but is absent from `docs/README.md`, so nothing points at it. Left undescribed rather than guessed at from the filename.
- [x] **P1** ~~Re-verify [`user-roles.md`](../docs/architecture/user-roles.md) against the code and split it into a spec and an as-built description~~ — **done 2026-08-18.** Rewritten from the code to the [`implementation-docs`](../skills/implementation-docs/SKILL.md) standard: two platform roles in the JWT, two club roles in `club_admin_assignments`, why they are stored and checked differently, and the platform-admin bypass. The split happened by *dropping* the spec half rather than moving it — roughly half the old file was a product specification for unbuilt dashboards, which `club_admin_governance.md` and this queue already cover better. `docs-map.json` said it covered *three roles*; corrected. Still open below: `security` has not reviewed it.
- [ ] **P2** **Have `security` review [`user-roles.md`](../docs/architecture/user-roles.md).** Rewritten from the code on 2026-08-18 by the agent that also wrote most of the authorisation it describes, which is the same conflict flagged for `authentication.md` below. The claims most worth an independent read: that platform roles are safe to keep in the JWT while club roles are not, and that the four `authenticated()` matchers above the `permitAll` block cover every club sub-path that must not be public.
- [ ] **P2** **Have `security` review [`authentication.md`](../docs/architecture/authentication.md).** It was rewritten from the code on 2026-08-15 and carries 14 known gaps including four security findings, but the agent that wrote it also wrote the code it describes. A finding list that has not been read by anyone else is a first draft.
- [ ] **P2** **Rewrite [`authentication.md`](../docs/architecture/authentication.md)** to the [`implementation-docs`](../skills/implementation-docs/SKILL.md) standard. It currently describes endpoints as *Required* rather than existing, so it reads as a plan. Blocked in part on [BUG-003](../bugs/bugs.md#bug-003) — the JWT transport decision should be an ADR first, then the doc describes what shipped.
- [ ] **P2** **Rewrite [`search.md`](../docs/architecture/search.md)** against `com.campusvibe.search`. Keep the existing design note as the rejected-alternatives record. Best done *after* [BUG-001](../bugs/bugs.md#bug-001) is fixed, so the doc describes working behaviour rather than a bug.
- [ ] **P2** **Write the Docker development environment doc** — `docs/architecture/docker-environment.md`. Nothing records why the frontend image has a `dev` stage, why backend watch uses `sync+restart` on the jar rather than `rebuild`, or why the `db` watch rule is near-inert. That reasoning currently survives only in [BUG-013](../bugs/fixed_bugs.md#bug-013) and in compose comments.
- [ ] **P3** **Verify [`llm-api-key-management.md`](../docs/architecture/llm-api-key-management.md)** against the shipped `com.campusvibe.ai` package and add the standard sections.
- [ ] **P3** Update the root `README.md` — it claims a Vercel + Elastic Beanstalk CI/CD pipeline that does not exist yet.
- [ ] **P3** Update the *Current Progress* section of `.claude/claude.md` once the secrets work is committed.
- [ ] **P3** Delete the empty `CLAUDE.md` at the repo root — created accidentally by `/memory`, 0 bytes, untracked. The real project instructions are `.claude/claude.md`.

---

## Agentic team

Charter and rules: [`.claude/team/CHARTER.md`](../team/CHARTER.md) ·
[`ROSTER.md`](../team/ROSTER.md) ·
[`WORKING-AGREEMENT.md`](../team/WORKING-AGREEMENT.md)

- [ ] **P1** **Verify the team after restarting Claude Code.** `.claude/agents/` is scanned at session start, so nine of the twelve have never run. Checks: `/ask ai-eng "why does BUG-001 return zero results?"` cites real `file:line`; a follow-up `/ask` continues the *same* agent rather than cold-starting; `staff-eng` returns `REQUEST-CHANGES` or `BLOCK` on a deliberately flawed patch; each agent refuses work outside its charter and names the right owner.
- [ ] **P1** **Commit and push the team, then create the two routines.** Cloud routines clone the GitHub repo, so `main` must contain `.claude/team/` and `.claude/agents/` or they fail on first run. Then confirm the Claude GitHub App can reach the repo (`/web-setup`), decide whether the digest routine may open a PR, and create both from the prompts in [`ROUTINES.md`](../team/ROUTINES.md).
- [ ] **P2** **Run one real `/kickoff` before trusting the process** — the JWT transport decision (BUG-003) is the natural candidate: architectural, currently blocking, and it should end in the first ADR. Judge the cost against the value before making it routine.
- [ ] **P3** **Reconsider the Opus/Sonnet split after that kickoff.** Seven of twelve are Opus, and a full kickoff spawns six-plus agents. `pm`, `design` and `sparring` are the ones to re-examine first.

---

---

## Recently shipped

The last ten, one line each. Full write-ups, and everything older, in
[`tasks-completed.md`](tasks-completed.md).

| Date | What landed |
|---|---|
| 2026-08-20 | User profiles persist: V18-V21, `user_profiles` / `user_interests` / `user_notification_preferences` plus a slug-keyed interest catalogue, a full-replace `PUT` and one shared profile load so the editor cannot erase itself — [`user-profiles.md`](../docs/architecture/user-profiles.md) |
| 2026-08-19 | `/profile/edit` — five settings sections behind a rail, Save disabled until something changes, interests picker, McGill program fields; a complete UI over memory, nothing persists yet |
| 2026-08-19 | `/profile` — identity card, About with berry-outlined program pills, social icons, and two blocks through to My clubs and My events; the old stub outside `(protected)` deleted |
| 2026-08-19 | One `ClubEventTabButtons` component for the Upcoming/Past pills, adopted by the manage dashboard, the club page and `/my-events`; counts passed as numbers so `null` can mean loading |
| 2026-08-19 | Navbar links reordered by role, desktop and mobile identical; mobile's admin link no longer points at the wrong route |
| 2026-08-18 | Platform admins can manage every club: dashboards load from `GET /clubs/{id}/managed`, and a Manage pill on the club card links straight in |
| 2026-08-18 | Club governance items 9–10: append-only `club_audit_logs` (V17, enforced by trigger) and the Activity tab in the manage sidebar — [`club-administration.md`](../docs/architecture/club-administration.md) |
| 2026-08-18 | `dev` profile (`application-dev.yml`, `SPRING_PROFILES_ACTIVE` in compose) and the admin bootstrap runner — the system can finally have a platform admin, which unblocks `/search/reindex` and the Admin Dashboard track |
| 2026-08-18 | Club governance item 8: ownership transfer — `club_ownership_transfers` (V16), the outgoing owner chooses whether they stay, one transaction demotes and promotes — [`club-administration.md`](../docs/architecture/club-administration.md) |
| 2026-08-18 | Club governance items 5 and 7: invite an admin by address (V15 — nullable `user_id`, `invited_email`), accept/decline at `/invitations`, remove and cancel from the Administrators tab — [`club-administration.md`](../docs/architecture/club-administration.md) |
