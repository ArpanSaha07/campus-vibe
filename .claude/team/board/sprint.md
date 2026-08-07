# Sprint board — in flight now

**Only work that is actually in progress.** The backlog is
[`todo.md`](../../TODO/todo.md); defects are [`bugs.md`](../../bugs/bugs.md).
Every row here links back to one of those — this board never invents work.

Last updated: **2026-08-06**

| # | Task | Owner | Status | Due | Source |
|---|---|---|---|---|---|
| 1 | Triage PRs #22, #21, #20 — eslint-config-next 16, eslint 10, lucide-react 1.28. All three fail the **fast** tier, so they are breaking majors | `frontend` | assigned | — | Dependabot |
| 2 | Triage PRs #17, #15 — Spring Boot 4.1.0 and the maven-minor-patch group. Both tiers red | `backend` | assigned | — | Dependabot |
| 3 | Confirm PRs #19, #18, #16, #14 are full-tier-only failures caused by BUG-001, not by the bumps themselves | `devops` | assigned | — | Dependabot |

**Status vocabulary:** `assigned` · `in-progress` · `blocked` · `in-review` ·
`awaiting-arpan` · `done`. A row reaching `done` is deleted from this board and
recorded in [`todo.md`](../../TODO/todo.md) under *Recently completed*.

---

## Blocked

Nothing blocked.

## Awaiting Arpan

Nothing awaiting a decision.

---

## Queued next — not yet assigned

From [`CHARTER.md`](../CHARTER.md)'s priority list, in order. These become rows
above when Arpan gives a go-ahead.

1. **Decide BUG-001** — fix the hybrid search ranking, or quarantine the one
   failing test method so CI can go green. Blocks everything unverifiable.
   Owner `ai-eng` with `backend`. Start with `/ask ai-eng`.
2. **Push `ci/github-actions` and confirm a green run.** Owner `devops`.
   Blocked on the BUG-001 decision above.
3. **ADR on JWT transport (BUG-003).** `localStorage` vs httpOnly cookie. Needs a
   decision *before* code — `security` proposes, `backend` and `frontend` cost it
   out. **This is the natural first `/kickoff`:** it is architectural, it closes
   a door, and it currently blocks route protection entirely.
4. **BUG-005 — query-embedding cache + search rate limiting.** Owner `ai-eng`,
   policy from `security`.
5. **Backfill the Docker environment doc.** Owner `devops`.
6. **Open Graph tags on event and club pages.** Owner `growth` specifying,
   `frontend` implementing. Links pasted into a group chat — the actual
   distribution channel — currently show nothing.
