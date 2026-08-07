# Deadlines

Dated commitments. The scheduled deadline watch reads **this file only** — a date
written anywhere else is invisible to it.

Last updated: **2026-08-06**

Agents have no sense of elapsed time between sessions, so a deadline that is not
listed here does not exist as far as the team is concerned.

| Due | What | Owner | Status |
|---|---|---|---|
| — | *(none set yet)* | | |

---

## How to add one

One row per commitment. `Due` is an absolute date (`2026-08-20`), never
*next week* — a relative date read three sessions later means nothing.

Only Arpan sets a deadline. An agent may **propose** one and put it in
*Awaiting Arpan* on [`sprint.md`](sprint.md), but it is not real until he
confirms it.

## What the watcher does

Reads this file, compares each `Due` against today, and reports:

- **Overdue** — past due and not `done`.
- **Due within 3 days** — approaching.
- **Undated work in progress** — rows on `sprint.md` in `in-progress` with no
  deadline here, which is usually fine but worth seeing.

It reports. It does not reassign, reprioritise, or chase — those are Arpan's.
