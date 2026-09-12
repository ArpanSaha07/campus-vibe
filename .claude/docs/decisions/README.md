# Architecture Decision Records

An ADR records **one decision at the moment it was made**, and is then frozen. A
change of mind gets a *new* ADR that supersedes it — never an edit, because
editing destroys the record of what was believed at the time. The template, the
numbering rule and the evidence standard live in
[`adr.md`](../../skills/implementation-docs/adr.md).

**Status starts at `Proposed`, and only Arpan moves it to `Accepted`.** An
`Accepted` record he never approved is a process failure, not a shortcut.
Accepting one changes nothing about where it lives: the file stays here under
the same name, frozen, and the only edit it takes afterwards is its
`Implemented in:` link.

**An accepted ADR's `Revisit when` section is the part nobody reads at the right
moment**, because no ADR loads automatically — `rules/` load with the code they
govern, ADRs are read only when somebody comes looking. So every live trigger is
mirrored twice: as a line in the path-scoped rule that loads with the code which
would trip it, and, where it is foreseeable work, as an item in
[`todo.md`](../../TODO/todo.md). The **Reopens when** column of the ADR table in
[`../README.md`](../README.md) lists them all with the rule file that carries
each. The reasoning stays here; only the trigger travels.

**Adding a record without adding its row here makes it invisible** — nobody
reads a folder, they read an index.

---

## The records

| # | Date | Status | Decides | Implemented in |
|---|---|---|---|---|
| [ADR-001](ADR-001-three-taxonomy-vocabularies.md) | 2026-08-20 | 📝 Proposed — awaiting Arpan | Three naming vocabularies and only three: one shared `interest_catalogue` behind student interests, club tags **and** event topics · 13 `club_categories` · 22 events-only `event_formats` · **events get no category taxonomy at all** | [`user-profiles.md`](../architecture/user-profiles.md) — the interests half only; the club and event halves are unbuilt |
| [ADR-002](ADR-002-club-id-is-an-assigned-slug.md) | 2026-09-07 | 📝 Proposed — awaiting Arpan | `Club` keeps its assigned slug id and implements `Persistable`, so `save()` stops silently merging and handing back a different instance · rejected a surrogate id (nine foreign keys, a route and the DTO contract) and rule-only mitigation | — not yet built |
| [ADR-003](ADR-003-tomcat-pinned-beyond-the-boot-bom.md) | 2026-09-07 | 📝 Proposed — awaiting Arpan | `<tomcat.version>` is overridden past the Boot BOM until a parent manages 10.1.58 or newer · rejected a Boot 4 migration as a CVE remedy and a Trivy suppression outright | `backend/pom.xml` — shipped 2026-09-03 |
| [ADR-004](ADR-004-two-paths-create-a-club.md) | 2026-09-08 · **amended 2026-09-10** | ✅ Accepted 2026-09-10 | Two paths create a club and neither leaves it ownerless: a platform admin creates directly and becomes owner, an ordinary user proposes and approval installs them · rejected open creation with creator-as-owner, admin-only creation, and an `ownerEmail` branch on create | `ClubService.createOwnedBy` (`create` deleted), `clubadmin/ClubCreationRequest*` — 2026-09-09 |
| [ADR-005](ADR-005-club-proposal-is-its-own-table.md) | 2026-09-08 | ✅ Accepted 2026-09-10 | A proposal lives in `club_creation_requests` and no `clubs` row exists until approval · rejected a status column on `clubs`, whose four filter sites publish an unapproved club if one is missed · slug reserved at submission and re-checked in the approval transaction | `V31__create_club_creation_requests.sql` — 2026-09-09 |
| [ADR-006](ADR-006-official-email-verified-only-by-round-trip.md) | 2026-09-08 | ✅ Accepted 2026-09-10 | `official_email_verified_at` is stamped only by redeeming a link mailed to that address, never by an administrative write · `setOfficialEmail` always nulls it · the round trip ships with SES, in a new `club_email_verifications` table rather than `auth_tokens` | `ClubAdminService.setOfficialEmail` — the admin-write half, 2026-09-09. The round trip is **not** built |
| [ADR-007](ADR-007-uploaded-media-is-streamed-by-the-api.md) | 2026-09-09 | 📝 Proposed — awaiting Arpan | Uploaded media is streamed by the API rather than handed out as a presigned or public S3 URL · images addressed by **index**, never by key · an uploaded SVG is never served as `image/svg+xml` · the frontend reaches it through a same-origin `/media/**` rewrite, not an absolute API URL · rejected presigned URLs (`FakeS3` cannot presign) and a public bucket + CDN (nothing provisioned) | `ClubController.logo`/`.image`, `adapters.ts`, `next.config.ts` — clubs only, 2026-09-09 ([BUG-040](../../bugs/fixed_bugs.md#bug-040)) |
| [ADR-008](ADR-008-netty-pinned-beyond-the-boot-bom.md) | 2026-09-11 | 📝 Proposed — awaiting Arpan | `<netty.version>` is overridden past the Boot BOM, by the same lever ADR-003 uses for Tomcat · rejected excluding `netty-nio-client`, which nothing executes, because an `S3AsyncClient` would then fail at runtime · rejected a Trivy suppression | `backend/pom.xml` — 2026-09-11 ([BUG-050](../../bugs/fixed_bugs.md#bug-050)) |
| [ADR-009](ADR-009-aws-guardrails-enforced-by-a-hook.md) | 2026-09-08 | 📝 Proposed — awaiting Arpan | AWS policy is enforced by a fail-closed `PreToolUse` hook covering both the CLI and the boto3 MCP path, allowlisted rather than blocklisted · rejected prose alone (a rule loads on a file read; AWS work starts with a command) and a `permissions.deny` list (no conditions, so the S3 carve-out is inexpressible) | `scripts/hooks/guard-aws.mjs` — shipped 2026-09-08 |
| [ADR-010](ADR-010-uploads-stream-through-the-api.md) | 2026-09-12 | ✅ Accepted 2026-09-12 | Uploaded media is **written** by the API as ADR-007 has it **read** by the API · presigned `PUT` rejected because the backend never sees the bytes, so BUG-039's content sniffing could not run before the object lands · `reference.md` §9 is a decided-against model, not a gap | nothing changes — ratifies `ClubController` / `EventController` as shipped |
| [ADR-011](ADR-011-minio-replaces-fakes3.md) | 2026-09-12 | ✅ Accepted 2026-09-12 | MinIO is the object store for local, CI and the media ITs · `FakeS3` **deleted**, and the commented `adobe/s3mock` block with it · `aws.s3.mock` deleted rather than set false, so the client is never chosen by a boolean · BUG-039's traversal guard moves to `MediaKeys.assertSafeKey` · `commons-io` falls out with the stub | `s3/S3Config.java`, `docker/docker-compose.yml`, `MinioTestContainer` — 2026-09-12 |
| [ADR-012](ADR-012-one-media-bucket-with-prefixes.md) | 2026-09-12 | ✅ Accepted 2026-09-12 | One media bucket, `campusvibe-prod-media`, separated by key prefix rather than one bucket per media kind · no key changes and nothing migrates, since `MediaKeys` already writes the §7 prefixes · no IAM change and no new spend, since the EC2 role's inline grant already names exactly this bucket · rejected two buckets and rejected two properties pointing at one | `s3/MediaBucket.java`, `application.yml` — 2026-09-12 ([BUG-051](../../bugs/bugs.md#bug-051)) |
| [ADR-013](ADR-013-ses-mail-over-smtp-credentials.md) | 2026-09-12 | 📝 Proposed — awaiting Arpan | Production mail is sent through SES's SMTP interface with SMTP credentials · the key is fenced: created by Arpan in the console, `ses:SendRawEmail` on the domain identity only, stored in two EB properties · rejected the SES v2 API through the instance role for the first deployment, and deferring mail | — not yet built; [`connecting-ses.md`](../architecture/connecting-ses.md) §7–§8 |

**ADR-004 carries two in-place amendments, both dated 2026-09-10 and both
against the frozen-record rule above.** Arpan decided each knowingly:

1. **Scope.** The record said a club proposal is *text only*, and the reasoning
   behind it — no club id, no S3 key — only ever applied to images. The four
   contact links now ship on a proposal, so the sentence described a scope that
   no longer holds.
2. **Fact.** It named the eight ownerless clubs seeded by `V6` as the permanent
   exceptions to *every club has an owner*. `V32` retired those rows the day
   after the ADR shipped, and `DevDataSeeder` now leaves exactly two unowned on
   purpose, recreated on every cold start under the `dev` profile alone.

Neither touches the decision the record exists for, both are marked where they
sit rather than folded into the original prose, and a reversal of the
*decision* would still get its own numbered ADR. **Two amendments is the
ceiling** — a third would mean this record is being maintained rather than
frozen, and the honest answer at that point is a superseding ADR.

**ADR-001 holds seven decisions rather than one**, against `adr.md`'s
one-per-file rule, and argues the exception in its own header: they are a single
interlocking choice about how this platform names things, so each is unreadable
alone. A reversal of any one of them gets its own numbered ADR.

---

## Waiting to be written

Each of these constrains future work and has a real alternative, which is the
`adr.md` bar. None is recorded anywhere durable today — they sit in a queue item
or a bug that will be closed and lost.

| Decision | Forced by | Where it sits today |
|---|---|---|
| How the JWT reaches the browser — `localStorage` or an httpOnly cookie | [BUG-003](../../bugs/bugs.md#bug-003) — frontend route protection never executes, and two of its three stated causes may be stale after the Next 16 upgrade | `bugs.md`, open |
| Whether to adopt shadcn/ui alongside the bespoke Tailwind v4 tokens | New UI surfaces keep re-deciding it per component | Nowhere |
| The deployment target and container registry | Elastic Beanstalk config exists under `docker/`; nothing is provisioned | [`CampusVibe_AWS_Deployment_Guide.md`](../architecture/CampusVibe_AWS_Deployment_Guide.md), as a plan rather than a decision |

---

## Decided without an ADR

Recorded where the decision was made rather than here, because each was forced
by a defect rather than chosen between attractive alternatives. Listed so a
later session does not read the silence as *nobody decided*.

- **`saveAndFlush`, never `save`, in `ClubService`** — [BUG-034](../../bugs/fixed_bugs.md#bug-034).
  `indexClub` writes through `JdbcTemplate`, which neither flushes the persistence
  context nor checks its update count, so an unflushed insert silently indexed
  nothing.
- **Set a club's taxonomy *before* `saveAndFlush`, rather than tagging the
  returned instance after** — [BUG-037](../../bugs/fixed_bugs.md#bug-037). The
  reordering was chosen over re-tagging because `Club.id` is assigned, so `save`
  goes through `em.merge()` and returns a *different* managed instance; the
  argument stays detached. The underlying id strategy is [ADR-002](ADR-002-club-id-is-an-assigned-slug.md).
- **`ROLE_CLUB_ADMIN` deleted outright in `V14`** —
  [`user-roles.md`](../architecture/user-roles.md), which records the rejected
  option and its cost: a role claim in a JWT outlives the access it names, so a
  removed administrator keeps working access until their token expires.
