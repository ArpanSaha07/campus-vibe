# Teammate PR workflow: contributing guide, code owners, PR checks

**Status:** shipped 2026-11-23 (approved by Arpan the same day) · **Date:** 2026-11-23

## Goal

A second developer can join, open PRs into `develop`, and be guided by the repo
rather than by Arpan repeating himself. After this ships: `CONTRIBUTING.md`
says how work flows (discuss, `/start` spec, wait for Arpan's approval, build,
test in Docker locally, PR into `develop`); `.github/CODEOWNERS` puts Arpan on
every PR touching the sensitive paths; a short PR template asks for the spec
link and the testing evidence; PRs into `develop` get the full `CI` gate, the
Claude review with a spec-scope checklist, and three warning-only checks (title,
template, size); and a new `/open-pr` skill drafts a semantic title and a filled
template locally, with the Claude review job as the fallback when a PR arrives
without them.

## Out of scope

- **A CI gate on spec approval.** Approval stays a written rule in
  `CONTRIBUTING.md` and `/start`; Arpan checks it in review (Arpan, 2026-11-23).
- **Any branch-name check.** `<owner>/<type>/<slug>` is a suggestion in
  `CONTRIBUTING.md` and the PR template only (Arpan, 2026-11-23).
- **Blocking on title, template or size.** All three only warn.
- **A staging backend, Vercel preview wiring, Playwright.** The teammate tests
  in the local `docker compose` stack (Arpan, 2026-11-23).
- **Restoring integration tests in CI** — that is BUG-063, its own unit.
- **Changing `Protect main`** or the checks on PRs into `main`.
- **Applying the `Protect develop` ruleset.** It is a repository setting; this
  unit writes the exact settings into `ci-cd-pipeline.md` and Arpan applies them.

## Decisions taken

- The teammate's PRs target `develop`; `develop` to `main` stays Arpan's release PR — Arpan.
- Spec approval is enforced softly: `CONTRIBUTING.md` and `/start` say no code before Arpan approves; no CI check — Arpan.
- Suggested branch pattern `<owner>/<type>/<slug>`, mentioned, never enforced or checked — Arpan.
- PR size: warn over 4,000 changed lines, never block — Arpan.
- PR-title and template checks warn only, never block — Arpan.
- Title, template and size checks run on PRs into `develop` only — Arpan.
- `develop` gets the full gate: `develop` added to `ci.yml`'s and `claude-code-review.yml`'s `pull_request.branches`; a `Protect develop` ruleset requiring `CI`, 1 approval and code-owner review, with Arpan on the bypass list so his own PRs still merge — Arpan.
- Auto-fill both ways: a local `/open-pr` skill, plus a CI fallback in the Claude review job that comments a suggested title and a drafted body when the title is not semantic or the template is unfilled; *How I tested* is left as a TODO for the author, never invented — Arpan.
- `/open-pr` follows the `/generate-commit-message` pattern: it writes the title and body to a gitignored scratch file and prints the `gh pr create --base develop` command; it never pushes or opens the PR itself, per the CLAUDE.md hard rule — follows the existing pattern.
- CODEOWNERS paths, all owned by `@ArpanSaha07`: `contracts/`, `backend/src/main/java/com/campusvibe/security/`, `.github/`, `.claude/rules/`, `.claude/docs/decisions/`, `.claude/docs/product.md` — Arpan named the areas; the paths are their locations in the tree.
- The new warning checks live in their own workflow, `pr-checks.yml`, whose check name is never `CI` (the reason is in `ci.yml`'s header) — follows `rules/ci-and-build.md`.
- The 4,000 lines are additions + deletions, excluding lockfiles — Arpan, 2026-11-23.
- `security` in CODEOWNERS is backend `security/` only; the frontend auth files and auth controllers are not included — Arpan, 2026-11-23.
- `Protect develop` requires branches to be up to date (`strict_required_status_checks_policy: true`), as `Protect main` does — Arpan, 2026-11-23.
- The spec-scope checklist and the title and body fallback run as a second `claude-code-action` step in the review job, not as extra text on the plugin command — Arpan, 2026-11-23.

## Open questions

None.

## Files expected to change

- `CONTRIBUTING.md` — new, repo root
- `.github/CODEOWNERS` — new
- `.github/pull_request_template.md` — new
- `.github/workflows/pr-checks.yml` — new: title, template, size; warnings only
- `.github/workflows/ci.yml` — `develop` added to `pull_request.branches`; header comments that say only `main`
- `.github/workflows/claude-code-review.yml` — `develop` trigger, spec-scope checklist, title and body fallback
- `.claude/skills/open-pr/SKILL.md` — new
- `.gitignore` — the `/open-pr` scratch file
- `.claude/docs/architecture/ci-cd-pipeline.md` — the `develop` gate, `pr-checks.yml`, the `Protect develop` settings (mapped to `.github/workflows/` in `scripts/docs-map.json`)
- `.claude/rules/ci-and-build.md` — a line: `pr-checks.yml` must never emit `CI` and stays warning-only
- `.claude/CLAUDE.md` — the map gains `CONTRIBUTING.md` and `/open-pr`
- `.claude/skills/start/SKILL.md` — step 4 says the spec goes to Arpan as its own PR or message, and no code until he approves

## Verification

```bash
node scripts/verify.mjs
node scripts/check-docs.mjs
node scripts/check-links.mjs
```

Then on GitHub, from a throwaway branch with a PR into `develop`:

1. `CI` runs the full gate and the Claude review runs.
2. A title like `Fixed stuff`, an empty template, and a diff over 4,000 lines
   each produce a warning annotation, and `PR checks` still reports success.
3. The Claude review comments a suggested semantic title and a drafted body,
   with *How I tested* marked TODO, and lists any change outside the linked spec.
4. A change under `contracts/` requests review from `@ArpanSaha07`.
5. After Arpan applies `Protect develop`: the teammate cannot merge without
   approval; Arpan can merge his own PR through the bypass.

Locally: `/open-pr` on a branch with a spec writes a title that passes
`sh .githooks/commit-msg` and a body with every template section filled.

## To update at wrap-up

- `ci-cd-pipeline.md` — the new section above, and its status line
- `rules/ci-and-build.md` — the `pr-checks.yml` line
- `STATUS.md` — shipped line; *Now* gains applying `Protect develop` (Arpan's step)
- `TODO/tasks-completed.md` — this unit
- `docs/README.md` — no new architecture doc expected; confirm
- This spec — `Status: shipped`
