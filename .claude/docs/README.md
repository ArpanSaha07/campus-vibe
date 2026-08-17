# CampusVibe Knowledge Base

**Start here.** This folder holds what the code does and why it is shaped that
way. If you are about to change a subsystem, read its document first — it exists
so you do not have to re-derive reasoning that was already worked out, and so you
do not undo a constraint whose purpose is not visible in the code.

Last updated: **2026-08-14**

```
.claude/docs/
├── README.md          this index
├── architecture/      implementation docs — living, describe the code as it is today
└── decisions/         ADRs — dated, frozen, describe one choice at the moment it was made
```

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
| [`club-administration.md`](architecture/club-administration.md) | Club owners and admins: the `club_admin_assignments` model, the one-owner invariant, why `ROLE_CLUB_ADMIN` was deleted, per-request authorisation, and the `/manage/[clubId]` dashboard · **supersedes `user-roles.md` on everything club-related** | ✅ Live · items 1–4 of the governance spec |
| [`club_admin_governance.md`](architecture/club_admin_governance.md) | The governance **specification** — administrator lifecycle, official-email trust anchor, invitations, ownership transfer and recovery, audit logs, notifications. Written before the code; items 5–15 are still unbuilt | 📐 Spec, partially implemented |
| [`user-roles.md`](architecture/user-roles.md) | RBAC: JWT claims, endpoint authorisation, dashboards. **Now contradicts the code** — it still describes `ROLE_CLUB_ADMIN`, `club_admin_id` and `/club-dashboard`, all removed 2026-08-17 | ⛔ Stale on club roles — read `club-administration.md` instead |
| [`authentication.md`](architecture/authentication.md) | The two sign-in methods (Google ID token, email + password), JWT issuing and per-request verification, bcrypt, the auth modal · measured endpoint behaviour · **14 known gaps incl. 4 security findings** | ✅ Live · rewritten from the code 2026-08-15 · **not security-reviewed** |
| [`search.md`](architecture/search.md) | Why hybrid semantic search (embeddings in pgvector + keyword rank) rather than the alternatives | ⚠ Pre-implementation design note |

**On the ⚠ marks.** These predate the documentation standard and were moved into
this folder on 2026-08-06 without being re-verified against the code. Each
carries a banner saying exactly what is and is not trustworthy about it. They
were moved rather than left scattered because one folder that is honestly
labelled beats four loose files nobody knows to look for. Rewriting them is
tracked in [`todo.md`](../TODO/todo.md) under **Docs**. `authentication.md` was
the first of them to be done, on 2026-08-15; `llm-api-key-management.md`,
`user-roles.md` and `search.md` remain.

**Not yet written:** the Docker development environment (the `compose watch` and
multi-stage Dockerfile work), the frontend architecture beyond its data layer,
and the club/event domain model.

**`architecture/ai-planner.md` exists on disk but has no row above.** It was not
read while this index was last updated, and describing it from its filename would
be a guess. Someone who knows it should add its line.

## Decisions — ADRs

None yet. The first will be written when a `/kickoff` reaches a decision, or when
one of the open questions below is settled.

Open questions that will become ADRs when decided: JWT transport
([BUG-003](../bugs/bugs.md#bug-003)) · whether to adopt shadcn/ui alongside the
bespoke Tailwind v4 tokens · the deployment target and registry.

---

## Standards and specifications that live elsewhere

Knowledge, but not implementation docs. Listed here so this index stays the one
place to start.

| Where | What it binds |
|---|---|
| [`.claude/CLAUDE.md`](../CLAUDE.md) | Project overview, tech stack, roles, development guidelines. Read first, always. |
| [`.claude/design-guidelines.md`](../design-guidelines.md) | The *ticket stock* design direction — colour tokens, typography, the perforation device. Cited from `globals.css` and `EventCard.tsx`; binding on all UI work. |
| [`.claude/skills/database-lifecycle/`](../skills/database-lifecycle/SKILL.md) | Flyway migrations, seeding, data ownership. Mandatory for any schema change. |
| [`.claude/skills/llm-integration/`](../skills/llm-integration/SKILL.md) | OpenAI clients, prompts, key handling, rate limiting. |
| [`.claude/skills/frontend-design/`](../skills/frontend-design/SKILL.md) | Visual design method for new or reshaped UI. |
| [`.claude/skills/implementation-docs/`](../skills/implementation-docs/SKILL.md) | This knowledge base's own format. |
| [`.claude/TODO/todo.md`](../TODO/todo.md) | The backlog, P0–P3. Not knowledge — work. |
| [`.claude/bugs/bugs.md`](../bugs/bugs.md) · [`fixed_bugs.md`](../bugs/fixed_bugs.md) | The defect log. Evidence standard for the whole `.claude/` tree: claims cite `file:line`. |

`commit-message.md` also appears in this folder when `/commit-message` runs. It
is a scratch file, gitignored, and not part of the knowledge base.
