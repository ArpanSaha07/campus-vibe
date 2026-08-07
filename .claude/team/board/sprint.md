# Sprint board — in flight now

**Only work that is actually in progress.** The backlog is
[`todo.md`](../../TODO/todo.md); defects are [`bugs.md`](../../bugs/bugs.md).
Every row here links back to one of those — this board never invents work.

Last updated: **2026-08-06**

| # | Task | Owner | Status | Due | Source |
|---|---|---|---|---|---|
| — | *(nothing assigned yet — the team was built today)* | | | | |

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
   Owner would be `ai-eng` with `backend`.
2. **Push `ci/github-actions` and confirm a green run.** Owner `devops`.
   Blocked on the BUG-001 decision above.
3. **ADR on JWT transport (BUG-003).** `localStorage` vs httpOnly cookie. Needs a
   decision *before* code — `security` proposes, `backend` and `frontend` cost it
   out. This is the natural first `/kickoff`.
4. **BUG-005 — query-embedding cache + search rate limiting.** Owner `ai-eng`.
5. **Backfill the Docker environment doc.** Owner `devops`.
