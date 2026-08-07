# CampusVibe Knowledge Base

**Start here.** This folder holds what the code does and why it is shaped that
way. If you are about to change a subsystem, read its document first — it exists
so you do not have to re-derive reasoning that was already worked out, and so you
do not undo a constraint whose purpose is not visible in the code.

Last updated: **2026-08-06**

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

---

## Architecture — implementation docs

| Document | Covers | State |
|---|---|---|
| [`ci-cd-pipeline.md`](architecture/ci-cd-pipeline.md) | GitHub Actions: the `ci.yml` orchestrator, the four reusable component workflows, tiering, the `ci-success` gate, CodeQL, Dependabot, `.dockerignore` | ✅ Conforms · **but nothing has run on GitHub yet** |
| [`llm-api-key-management.md`](architecture/llm-api-key-management.md) | How the OpenAI key flows from `docker/.env` and EB environment properties through `OpenAiProperties` without ever being logged or baked into an image | ⚠ Unverified against the standard |
| [`user-roles.md`](architecture/user-roles.md) | RBAC: the three roles, multi-role support, JWT claims, endpoint authorisation. **Cited as authority by four source files** | ⚠ Part spec, part as-built |
| [`authentication.md`](architecture/authentication.md) | Email + verification-code login, Google OAuth via Google Identity Services, client-id handling | ⚠ Written as a plan; may not match the code |
| [`search.md`](architecture/search.md) | Why hybrid semantic search (embeddings in pgvector + keyword rank) rather than the alternatives | ⚠ Pre-implementation design note |

**On the ⚠ marks.** Four of these five predate the documentation standard and
were moved into this folder on 2026-08-06 without being re-verified against the
code. Each carries a banner saying exactly what is and is not trustworthy about
it. They were moved rather than left scattered because one folder that is
honestly labelled beats four loose files nobody knows to look for. Rewriting them
is tracked in [`todo.md`](../TODO/todo.md) under **Docs**.

**Not yet written:** the Docker development environment (the `compose watch` and
multi-stage Dockerfile work), the frontend architecture, and the club/event
domain model.

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
