# /refresh-docs — find stale docs by the commits that touched their code, and update the ones Arpan picks

**Status:** draft · **Date:** 2026-11-16

## Goal

Running `/refresh-docs` prints a ranked table of every stale doc in scope: its
`Code as of:` stamp, how many commits since that stamp touched the code it
describes, and a verdict (*re-stamp* when none did, *update* when some did).
Arpan picks which to handle. For each one picked, the command reads only the
diffs since the stamp in that doc's paths, revises the affected sections per
[`implementation-docs`](../skills/implementation-docs/SKILL.md), and moves the
stamp to HEAD. Today `scripts/check-docs.mjs` only *reports* raw commits behind
(`authentication.md: 161 commit(s) behind`), which overstates drift, ignores
`product.md` and `docs/README.md`, and nothing acts on what it finds.

## Out of scope

- `STATUS.md` — `/wrap-up` owns it. `docs/reviews/` — point-in-time records,
  frozen. `todo.md`, specs, ADRs, rules.
- Any AWS call. Account facts in the runbooks are not re-verified.
- Fixing everything in one run without a pick.
- Re-verifying a whole doc or every `file:line` cite; only the diffs since the stamp.
- Docs stamped `never` — still skipped, as `check-docs.mjs:169` does today.
- CI running the checker (`todo.md:419`, accepted as uncovered).

## Decisions taken

All by Arpan, 2026-11-16, in the session that wrote this spec.

- Scope: `docs/architecture/*.md`, `docs/product.md`, `docs/README.md`.
- Staleness signal: relevant commits only — `git log <stamp>..HEAD` over the
  paths `docs-map.json` maps to the doc. Zero relevant commits means re-stamp.
- Action: report a ranked table, Arpan picks, then update the picked docs.
- Mechanism: extend `scripts/check-docs.mjs` (a machine-readable mode with
  per-doc relevant commits); the command calls it. One detector for the hooks
  and the command.
- Unmapped docs: add `docs-map.json` entries for `aws-deployment.md`,
  `CampusVibe_AWS_Deployment_Guide.md`, `club_admin_governance.md`,
  `connecting-beanstalk-to-rds.md` and `pausing-production.md`. `product.md`
  and `docs/README.md` are judged by `feat`/`fix` commits, and by docs added
  under `docs/`, since their stamp.
- AWS: code only. A runbook with an old `Account read` date is flagged as
  needing a separate read-only account check under `rules/aws-handling.md`.
- Depth: read the diffs since the stamp, revise affected sections, re-stamp.
- Name: `/refresh-docs`, in `.claude/commands/refresh-docs.md`.
- No ADR: the mechanism was chosen above and does not cut across other
  subsystems.

## Open questions

1. **Does the text report the hooks print change too?** Proposed: no — the new
   mode is additive (`--json`), and `pre-commit` / `pre-push` output stays as
   it is. Switching the text to relevant counts is the other option.
2. **How old is a stale `Account read` date?** Proposed: older than 30 days.
3. **A doc with a relevant commit count of zero but a stamp far behind:**
   re-stamp silently in the pick list, or show it at all? Proposed: show it,
   verdict *re-stamp*, at the bottom of the table.

None blocks the `docs-map.json` entries; 1 blocks the script change.

## Files expected to change

- `scripts/check-docs.mjs` — the new mode; scope widened to `product.md` and
  `docs/README.md`.
- `scripts/docs-map.json` — five new `docs` entries.
- `.claude/commands/refresh-docs.md` — new, in the shape of
  `generate-commit-message.md`.
- Mapped doc: [`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md)
  (`docs-map.json:85-86` maps `check-docs.mjs` to it).

## Verification

```bash
node scripts/check-docs.mjs                 # text output unchanged (if Q1 = no)
node scripts/check-docs.mjs --json          # parses; every in-scope doc present
git log --oneline <stamp>..HEAD -- <paths>  # by hand, for two docs: counts match
node scripts/check-links.mjs --strict       # no dead links from the new map entries
node scripts/verify.mjs --all               # the hooks component still green
```

Then run `/refresh-docs` once: the table appears, and picking one re-stamp
verdict moves only that doc's stamp.

## To update at wrap-up

- [`ci-cd-pipeline.md`](../docs/architecture/ci-cd-pipeline.md) — the checker's
  new mode, and the command beside it.
- [`docs/README.md`](../docs/README.md) — the stamp paragraph names `/refresh-docs`.
- [`implementation-docs`](../skills/implementation-docs/SKILL.md) — where it
  says to run `check-docs.mjs`, point to `/refresh-docs` for acting on it.
- `STATUS.md` shipped line; `tasks-completed.md`.
