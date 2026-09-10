# CampusVibe Knowledge Base

**Start here.** This folder holds what the code does and why it is shaped that
way. If you are about to change a subsystem, read its document first — it exists
so you do not have to re-derive reasoning that was already worked out, and so you
do not undo a constraint whose purpose is not visible in the code.

Last updated: **2026-09-10**

```
.claude/docs/
├── README.md          this index
├── product.md         what the product is meant to do, area by area — shipped vs planned
├── architecture/      implementation docs — living, describe the code as it is today
├── decisions/         ADRs — dated, frozen, describe one choice at the moment it was made
│   └── README.md      the ADR index, and the decisions still waiting to be written
└── reviews/           product reviews — dated snapshots of one area, never updated
```

**[`product.md`](product.md) answers a different question from everything else
here.** The architecture docs say how a subsystem works and why; `product.md`
says whether a feature is something we have, something we decided to build, or
neither — the question that otherwise gets answered by guessing.

**Not everything lives here.** [`.claude/rules/`](../rules/) is the sibling
folder: six short, path-scoped files that load **automatically when you read a
matching source file**, so the traps for a subsystem arrive with the code rather
than waiting to be looked up. A doc explains a subsystem; a rule is the handful
of lines you must not get wrong while editing it. If you find yourself writing a
paragraph in a rule, it belongs in a doc instead.

Written and maintained under
[`implementation-docs`](../skills/implementation-docs/SKILL.md) (docs) and
[`adr.md`](../skills/implementation-docs/adr.md) (decisions). **Adding a document
without adding its line here makes it invisible** — nobody reads a folder, they
read an index.

**Every doc carries a `**Code as of:**` stamp** naming the commit its claims were
last checked against. `never` means it has not been reconciled with the code —
read it with the suspicion its own banner asks for. `node scripts/check-docs.mjs`
reports which docs are behind, and which areas changed without their doc
changing; the pre-push hook runs it as a notice and never blocks.

---

## Architecture — implementation docs

| Document | Covers | State |
|---|---|---|
| [`api-and-caching.md`](architecture/api-and-caching.md) | The `apiFetch` boundary, the three frontend data paths, Next's data cache and the rule that per-user data never enters it, the `@EntityGraph` N+1 fix, error-status mapping · **plus the storage-layer model: what owns what, where new data belongs, and why a client query library is deferred** | ✅ Live · read from the code and measured |
| [`ci-cd-pipeline.md`](architecture/ci-cd-pipeline.md) | GitHub Actions: the `ci.yml` orchestrator, the four reusable component workflows, tiering, the `ci-success` gate, CodeQL, Dependabot, `.dockerignore` · plus local CI parity (`scripts/verify.mjs`, `.githooks/pre-push`) | ✅ Conforms · **but nothing has run on GitHub yet** |
| [`llm-api-key-management.md`](architecture/llm-api-key-management.md) | How the OpenAI key flows from `docker/.env` and EB environment properties through `OpenAiProperties` without ever being logged or baked into an image | ⚠ Unverified against the standard |
| [`club-administration.md`](architecture/club-administration.md) | Club owners and admins: the `club_admin_assignments` model, the one-owner invariant, why `ROLE_CLUB_ADMIN` was deleted, per-request authorisation, and the `/manage/[clubId]` dashboard · the club-scoped workflows `user-roles.md` points at for detail** | ✅ Live · items 1–5 and 7–10 of the governance spec |
| [`club_admin_governance.md`](architecture/club_admin_governance.md) | The governance **specification** — administrator lifecycle, official-email trust anchor, invitations, ownership transfer and recovery, audit logs, notifications. Written before the code; items 6 and 11–15 are still unbuilt | 📐 **Superseded spec** — items 1–5 and 7–10 built; `club-administration.md` describes reality |
| [`user-roles.md`](architecture/user-roles.md) | The role model: two platform roles (`ROLE_USER`, `ROLE_ADMIN`) in the JWT, two club roles in `club_admin_assignments`, why they are stored and checked differently, and the platform-admin bypass | ✅ Live · rewritten from the code 2026-08-18 |
| [`authentication.md`](architecture/authentication.md) | The two sign-in methods (Google ID token, email + password), JWT issuing and per-request verification, bcrypt, the auth modal · measured endpoint behaviour · **14 known gaps incl. 4 security findings** | ✅ Live · rewritten from the code 2026-08-15 · **not security-reviewed** |
| [`user-profiles.md`](architecture/user-profiles.md) | Profile content and email preferences: why the profile is its own table rather than columns on `users`, why the write is a full-replace PUT and what that demands of the frontend, the slug-keyed interest catalogue and its foreign key, and the two places a social link is checked · **7 known gaps, incl. two visibility switches that currently control nothing** | ✅ Live · written with the code 2026-08-20 |
| [`search.md`](architecture/search.md) | Why hybrid semantic search (embeddings in pgvector + keyword rank) rather than the alternatives | ⚠ Pre-implementation design note |
| [`aws-deployment.md`](architecture/aws-deployment.md) | Production packaging for Elastic Beanstalk: the second Dockerfile and why it exists, `scripts/package-eb.mjs`, the JVM sizing for a 1 GiB instance, the PostgreSQL 15 pin, and the HTTPS-without-an-ALB resolution | ⚠ **Phase 1 only** · packaging verified locally; nothing runs on AWS yet |
| [`CampusVibe_AWS_Deployment_Guide.md`](architecture/CampusVibe_AWS_Deployment_Guide.md) | The AWS plan of record: target architecture and the six phases — packaging, RDS, S3, Elastic Beanstalk, the Vercel/Cloudflare front, CI/CD — written to be followed in order | 📐 **Plan, not as-built** · `aws-deployment.md` records what exists |

**On the ⚠ marks.** These predate the documentation standard and were moved into
this folder on 2026-08-06 without being re-verified against the code. Each
carries a banner saying exactly what is and is not trustworthy about it. They
were moved rather than left scattered because one folder that is honestly
labelled beats four loose files nobody knows to look for. Rewriting them is
tracked in [`todo.md`](../TODO/todo.md) under **Docs**. `authentication.md` was
the first of them to be done, on 2026-08-15, `user-roles.md` the second, on
2026-08-18; `llm-api-key-management.md` and `search.md` remain.

**Not yet written:** the Docker development environment (the `compose watch` and
multi-stage Dockerfile work), the frontend architecture beyond its data layer,
and the club/event domain model.

**`architecture/ai-planner.md` exists on disk but has no row above.** It was not
read while this index was last updated, and describing it from its filename would
be a guess. Someone who knows it should add its line.

## Decisions — ADRs

| Document | Decides | Status | Reopens when |
|---|---|---|---|
| [`ADR-002`](decisions/ADR-002-club-id-is-an-assigned-slug.md) | Whether `Club.id` stays an assigned slug and gains `Persistable`, moves to a surrogate generated id, or is left alone with a rule · the `em.merge` trap that has now cost two bugs in one method | 📝 Proposed 2026-09-07 — awaiting Arpan | Whenever `save` on a club is touched. Not yet decided, so nothing reopens — it is waiting to be settled. |
| [`ADR-003`](decisions/ADR-003-tomcat-pinned-beyond-the-boot-bom.md) | Pinning `<tomcat.version>` past the Spring Boot BOM rather than migrating to Boot 4 or suppressing the scanner · the condition for removing the override | 📝 Proposed 2026-09-07 — already shipped in `backend/pom.xml` | A parent POM manages Tomcat 10.1.58 or newer, at which point the override comes out. `rules/ci-and-build.md` carries it. |
| [`ADR-004`](decisions/ADR-004-two-paths-create-a-club.md) | How a club comes into being: an admin creates and owns, or a user proposes and approval installs them as owner · why open creation and admin-only creation were both rejected · what a club being born owned forecloses | ✅ Accepted 2026-09-10 | A student waiting on review becomes the complaint, or one admin becomes the bottleneck — the fix is auto-approval under a trust signal, **not** open creation · **notifications exist**, at which point *nothing tells the requester* becomes a bug. `rules/backend-clubs.md` + `todo.md`. |
| [`ADR-005`](decisions/ADR-005-club-proposal-is-its-own-table.md) | Where a club proposal lives before approval · the four filter sites a status column on `clubs` would have needed, and what happens when one is missed · slug reservation and the re-check | ✅ Accepted 2026-09-10 | A field is added to `ClubCreateRequest` and not to the proposal — **one is a bug, two means unifying the shapes**, and the count is at one and a half · a reviewer needs a preview of the club page. `rules/contracts.md` (loads on both records) + `rules/backend-clubs.md`. |
| [`ADR-006`](decisions/ADR-006-official-email-verified-only-by-round-trip.md) | What *verified* means for a club's official email, and why an administrative write is not it · the two rules binding on code shipping before the round trip exists | ✅ Accepted 2026-09-10 | **SES lands** — the trigger to build the round trip, and the point the deferral is spent · anyone proposes a *mark as verified* control or bulk-marking, which is the rejected option renamed. `rules/backend-clubs.md` + `todo.md`. |
| [`ADR-007`](decisions/ADR-007-uploaded-media-is-streamed-by-the-api.md) | How an uploaded image reaches a browser: the API streams it, addressed by **index** rather than by key, behind a same-origin `/media/**` rewrite · why an uploaded SVG is never served as `image/svg+xml` · rejected presigned URLs and a public bucket | 📝 Proposed 2026-09-09 — awaiting Arpan | A second media consumer appears (events, avatars), or S3 becomes reachable from the browser — presigned URLs were rejected because `FakeS3` cannot presign, which changes if the store does. |
| [`ADR-001`](decisions/ADR-001-three-taxonomy-vocabularies.md) | Seven decisions on how this platform names things: three vocabularies, one shared topic list behind student interests, club tags **and** event topics, 13 club categories, 22 events-only formats · **events get no category taxonomy at all** · what that costs and when to reopen it | 📝 Proposed 2026-08-20 — awaiting Arpan | Nothing yet — still awaiting a decision. Its own header records when to reopen the taxonomy. |

**That file holds seven decisions rather than one**, against `adr.md`'s
one-per-file rule, and says in its own header why: they are a single
interlocking choice about one taxonomy, and the argument for each is the
argument for the others. A reversal of any one of them gets its own numbered
ADR.

**[`decisions/README.md`](decisions/README.md) indexes that folder** — the
records above, the four decisions still waiting to be written and what forces
each, and the ones settled inside a bug write-up rather than an ADR. Read it
before changing architecture, so a choice already made is not quietly remade.

---

## Reviews — dated snapshots

Neither living docs nor decisions. A review reads one area of the product
against the code on one day and says what is missing, so the gaps are counted in
one place instead of being rediscovered one at a time. **A review is never
updated** — it is true as of its date and its stamp says so. Work it finds
belongs in [`todo.md`](../TODO/todo.md), which is still the only queue.

| Review | Covers |
|---|---|
| [`2026-09-10-club-and-event-management.md`](reviews/2026-09-10-club-and-event-management.md) | Club and event management, the two dashboards and the notification layer under them: 27 gaps with the `file:line` for each, marked queued or new, plus 11 product decisions that block them. Written against `10efaa8` |

---

## Standards and specifications that live elsewhere

Knowledge, but not implementation docs. Listed here so this index stays the one
place to start.

| Where | What it binds |
|---|---|
| [`.claude/CLAUDE.md`](../CLAUDE.md) | The overview, the stack choices with consequences, the map and the hard rules. Loaded every session. |
| [`.claude/STATUS.md`](../STATUS.md) | Where the project is *now* — what is next, the blocking bugs, the traps, the last ten shipped. Printed at session start, refreshed by `/wrap-up`. Orient from this, not from `todo.md`. |
| [`.claude/rules/`](../rules/) | Six path-scoped files that load with the code they govern. A trap belongs here; a paragraph belongs in a doc. |
| [`.claude/specs/`](../specs/README.md) | One spec per feature, agreed before the code is written. |
| [`.claude/design-guidelines.md`](../design-guidelines.md) | The *ticket stock* design direction — colour tokens, typography, the perforation device. Cited from `globals.css` and `EventCard.tsx`; binding on all UI work. |
| [`.claude/skills/database-lifecycle/`](../skills/database-lifecycle/SKILL.md) | Flyway migrations, seeding, data ownership. Mandatory for any schema change. |
| [`.claude/skills/llm-integration/`](../skills/llm-integration/SKILL.md) | OpenAI clients, prompts, key handling, rate limiting. |
| [`.claude/skills/s3-media/`](../skills/s3-media/SKILL.md) | Club logos, event banners and profile images on S3: the private-bucket presigned model, object keys, credentials — and where the shipped code still departs from it. `reference.md` beside it is the full 38-section security model. |
| [`.claude/skills/start/`](../skills/start/SKILL.md) · [`wrap-up/`](../skills/wrap-up/SKILL.md) | The two ends of a unit of work: orient and agree a spec before code, record and verify after. |
| [`.claude/skills/frontend-design/`](../skills/frontend-design/SKILL.md) | Visual design method for new or reshaped UI. |
| [`.claude/skills/implementation-docs/`](../skills/implementation-docs/SKILL.md) | This knowledge base's own format. |
| [`.claude/TODO/todo.md`](../TODO/todo.md) | The backlog, P0–P3. Not knowledge — work. |
| [`.claude/bugs/bugs.md`](../bugs/bugs.md) · [`fixed_bugs.md`](../bugs/fixed_bugs.md) | The defect log. Evidence standard for the whole `.claude/` tree: claims cite `file:line`. |

`commit-message.md` also appears in this folder when `/commit-message` runs. It
is a scratch file, gitignored, and not part of the knowledge base.
