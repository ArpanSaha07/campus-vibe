---
name: open-pr
description: Draft a pull request into develop for the current branch. Writes a semantic title and a description filled from the project's PR template, the branch's spec, the diff and the tests this session actually ran, saves it to .claude/docs/pr-body.md, and prints the gh pr create command. Use when a branch is ready for review, or when asked to open, draft or describe a PR.
allowed-tools: Read, Write, Glob, Grep, AskUserQuestion, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git fetch:*)
---

# Drafting a pull request into develop

This writes text. It never pushes, never opens the PR and never commits — the
author runs the command at the end. Same pattern as `/generate-commit-message`.

## 1. Read what the branch actually changes

```bash
git fetch origin develop
git status --short
git log --format='%h %s' origin/develop..HEAD
git diff --stat origin/develop...HEAD
git diff origin/develop...HEAD
```

- **Uncommitted changes** are not in the PR. Say so and stop, so the author
  commits first.
- **Size.** Count additions + deletions from `--stat`, leaving out lockfiles
  (`package-lock.json` and the like). Over 4,000 lines, say so and suggest a
  split — migration and backend, then the contract, then the UI. It is a
  warning, not a stop (Arpan, 2026-11-23).

## 2. Find the spec

The branch's spec is a file under `docs/specs/`: one the diff adds or
changes, or one the author names. If none, ask with `AskUserQuestion`. A
one-line fix or a dependency bump may use `n/a`.

Read it. If its **Status** is still `draft`, tell the author plainly: Arpan
has not approved it, and `CONTRIBUTING.md` says no code before approval. Draft
the PR anyway if they want; the review will flag it too.

Compare the diff with the spec's Goal, Decisions taken, Files expected to
change and Out of scope. Anything the diff does that the spec does not cover
goes in the checklist's *anything extra* line — never hidden.

## 3. Write the title

The squash merge makes the title the commit subject on `develop`, so it
follows `.githooks/commit-msg`: `type(scope): summary`, imperative, lowercase,
no full stop, 72 characters at most (50 preferred). State the outcome, not
the mechanism. **No quotation marks of either kind**, since it goes on a
command line.

Check it by writing the title alone into `.claude/docs/pr-body.md` for a
moment and running `sh .githooks/commit-msg .claude/docs/pr-body.md`; the body
overwrites it in step 5.

## 4. Write the body

Follow `.github/pull_request_template.md` section by section, without its
HTML comments:

- **Spec:** the path, as `Spec: docs/specs/<file>.md`.
- **What and why:** two to four sentences — what a student or club sees
  differently, and why. From the spec's Goal, not a file list.
- **How I tested:** only what **this session actually ran and saw**: the
  commands, the tests added, what was tried in the local `docker compose`
  stack. Tick a box only if it happened here. If the session ran nothing, ask
  the author with `AskUserQuestion` what they ran; if they do not say, write
  `TODO (author): what you ran and what you saw`. **Never invent a test run.**
- **Screenshots or clip:** for UI changes, `TODO (author): add a screenshot`;
  otherwise delete the section.
- **Checklist:** tick only what is true from the diff and the session.

## 5. Save and hand over

Overwrite `.claude/docs/pr-body.md` (gitignored scratch) with the body only.
Then show the title and the command:

```bash
git push -u origin HEAD
gh pr create --base develop --title '<title>' --body-file .claude/docs/pr-body.md
```

Say what still needs the author: TODOs left in the body, a draft spec, a size
warning, anything outside the spec.

## Rules

- Never `git push`, `git commit`, `gh pr create` or any GitHub write. The
  author runs them.
- Never claim a test, a check or a manual try that this session did not see.
- Base is always `develop`. Release PRs into `main` are Arpan's and are not
  drafted here.
