# ADR-024 — A teammate's PRs go into `develop`, gated by `CI` and Arpan's approval, guided by warnings

**Status:** Proposed — awaiting Arpan
**Date:** 2026-11-23
**Decided in:** the teammate PR workflow `/start` session, recorded in
[`2026-11-23-teammate-pr-workflow.md`](../../specs/2026-11-23-teammate-pr-workflow.md)
**Participants:** main session · **Choices made by:** Arpan, in the session, 2026-11-23
**Implemented in:** [`ci-cd-pipeline.md`](../architecture/ci-cd-pipeline.md) —
`pr-checks.yml`, `scripts/pr-checks.mjs`, `claude-code-review.yml`'s second
step, `.github/CODEOWNERS`, `CONTRIBUTING.md`, the `/open-pr` skill, the
`Protect develop branch` ruleset; 2026-11-23, uncommitted

## Context

A junior teammate joins. Arpan reviews and merges everything, and was worried
about two things: the volume of code to read, and the platform drifting from
his product ideas. Until now the repo had one author: `Protect main` required
0 approvals, and `CI` and the Claude review ran only on PRs into `main`, so a
PR into `develop` got nothing but the three-minute `branch-checks.yml`.

Each control below had a stricter and a lighter form. Arpan chose per control.

## Decision

1. **Target branch.** The teammate's PRs go into `develop`; `develop` to
   `main` stays Arpan's release PR. `ci.yml` and `claude-code-review.yml` run
   on PRs into both.
2. **Hard gates — only the ones GitHub enforces.** `Protect develop branch`
   requires `CI`, one approval, code-owner review, approval of the last push,
   conversation resolution and up-to-date branches; the repository admin role
   (Arpan) bypasses, because GitHub never lets an author approve his own PR.
   CODEOWNERS covers `contracts/`, backend `security/`, `.github/`,
   `.claude/rules/`, `.claude/docs/decisions/` and `.claude/docs/product.md`.
3. **Spec approval is a written rule, not a check.** `CONTRIBUTING.md` and
   `/start` say no code before Arpan approves the spec; the Claude review flags
   a spec still marked draft and any change outside it.
4. **Title, template and size warn, never block**, on PRs into `develop` only.
   The size guideline is 4,000 changed lines, lockfiles excluded.
5. **Branch names are a suggestion** (`<owner>/<type>/<slug>`), checked nowhere.
6. **Title and description are drafted for the author** — locally by
   `/open-pr`, and by the review's second step as a fallback — but testing
   evidence is never invented: *How I tested* is the author's.

## Alternatives rejected

- **A CI gate on spec approval** — a required check reading the linked spec
  from the base branch, so only a spec Arpan had merged could count. Rejected
  for now in favour of trust and review: more process than one teammate needs.
- **Blocking title, template and size checks** — rejected; a blocked PR waits
  on Arpan anyway, and warnings teach without stalling.
- **Enforcing the branch pattern with a ruleset regex** — rejected; it buys
  little that the PR author field does not already show.
- **Trunk-based PRs straight into `main`** — rejected; `main` stays equal to
  what is released, without needing feature flags first.
- **A staging backend for PR previews** — rejected for now on cost; the
  teammate tests in the local `docker compose` stack.

## Consequences

- Most of the guidance can be ignored: a PR with a draft spec, a bad title or
  6,000 lines can still be approved. The safeguard is Arpan's review, helped
  by the Claude review's spec comment.
- Hard gates live in GitHub settings, not the repo, so they can be wrong
  silently: the ruleset was first created with an empty target list.
- CodeQL still runs only on PRs into `main`, so a security finding in a
  teammate's code surfaces at the release PR, after it is on `develop`.

## Reopen when

- A merged PR turns out to have been built against an unapproved or changed
  spec — the trigger for the CI spec gate above.
- Warnings are routinely ignored, or PRs routinely exceed the size guideline.
- A second teammate joins, or anyone besides Arpan gets merge rights.
