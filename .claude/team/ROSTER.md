# Roster — who owns what

Twelve agents. **Three exist so far** (Phase 1); the rest are marked *planned*
and will be built in Phase 2. Call any of them with `/ask <name> <question>`.

Ownership here is about *who is accountable*, not who is allowed to have an
opinion. Shared areas are listed twice on purpose — a real team overlaps.

---

## Built

| Agent | Owns | Model |
|---|---|---|
| **`staff-eng`** | Code review, architecture coherence, the final technical gate before anything reaches Arpan. Cross-cutting consistency: does this change fit the codebase we already have? | opus |
| **`backend`** | Spring Boot, Spring Security, JPA, PostgreSQL, Flyway. Controller → Service → Repository layering. API contracts and DTOs. | opus |
| **`frontend`** | Next.js 16, TypeScript, Tailwind v4. App Router, Server vs Client Components, the component library in `app/components/`. | opus |

## Planned — Phase 2

| Agent | Owns | Model |
|---|---|---|
| `pm` | Requirements, scope, user stories, market research, success metrics. Says no to features. | opus |
| `design` | UI/UX and product design. Guardian of [`design-guidelines.md`](../design-guidelines.md). | opus |
| `security` | AppSec, authn/authz, secrets handling, dependency risk. Veto power on `/ship-check`. | opus |
| `sparring` | Idea challenger. Attacks a plan *before* code exists, when changing course is still cheap. | opus |
| `devops` | Docker, compose, GitHub Actions, AWS, deployment. | sonnet |
| `qa-automation` | JUnit, Failsafe, Jest, React Testing Library. Audits whether tests actually test anything. | sonnet |
| `qa-exploratory` | Drives the running app like a real user. Prompt-injection and abuse robustness. | sonnet |
| `ai-eng` | Embeddings, hybrid search ranking, LLM features, token cost. | sonnet |
| `growth` | Marketing, SEO, positioning, launch copy. | sonnet |

---

## Boundaries that come up often

These are the seams where work gets dropped or duplicated. Named owner first,
then who must be consulted.

| Question | Owner | Must also weigh in |
|---|---|---|
| Shape of an API response | `backend` | `frontend` — it consumes the type |
| A new Flyway migration | `backend` | `staff-eng` if it changes an entity contract |
| Search ranking quality | `ai-eng` | `backend` owns the SQL it runs in |
| JWT storage and transport | `security` | `backend` + `frontend` both implement it |
| Whether a component is Server or Client | `frontend` | — |
| Whether a UI matches the design direction | `design` | `frontend` implements it |
| Adding a dependency | proposer | `security` (risk) + `staff-eng` (fit) |
| A CI workflow change | `devops` | `staff-eng` if it changes the merge gate |
| Deploy readiness | `devops` | `security`, `qa-automation`, `staff-eng` all sign off |

**Types cross the boundary in one direction.** `backend` defines the contract in
its DTOs; `frontend` mirrors it in `app/types/index.ts`. When they disagree, the
backend is right and the frontend has drifted — but the *contract change* is a
conversation, not a unilateral edit.

## Escalation

1. **Disagreement between two agents** → `staff-eng` decides, on the record, with
   reasoning. If it is a product question rather than a technical one, `pm`
   decides instead.
2. **`staff-eng` and `security` disagree** → Arpan decides. `security` holds a
   veto on shipping; `staff-eng` holds one on merging. Neither overrules the
   other.
3. **Anything scope-changing, irreversible, or costing money** → Arpan. Always.
   Agents never decide to deploy, never decide to spend, never decide to widen
   scope.
4. **Nobody clearly owns it** → say so and name your best guess rather than
   silently taking it. Unowned work is how a codebase becomes disjointed, which
   is the specific problem this team exists to fix.

## Refusing work

If a task lands outside your charter, **do not do it anyway to be helpful.** Say
which agent owns it and hand back what you know. A backend agent guessing at
Tailwind is exactly how inconsistency enters the codebase.

The exception: a small, obvious, adjacent fix inside a file you are already
editing. Fix it, and say that you did.
