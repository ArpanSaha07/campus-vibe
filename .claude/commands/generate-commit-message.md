---
description: Generate a semantic commit message for the current changes and save it to .claude/docs/commit-message.md
argument-hint: "[optional focus, e.g. only the staged hook changes]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git ls-files:*), Read, Write
---

Write a commit message for the current changes and save it to
`.claude/docs/commit-message.md`. **This file is the whole procedure** — the
format and the rules are below, so there is nothing else to open.

## 1. Read the actual changes — never guess from filenames

```bash
git status --short          # staged vs unstaged vs untracked
git diff --staged           # the changes being described
git log --format='%s' -15   # recent subject style
```

- **Anything staged** → describe the staged changes. **Nothing staged** → fall
  back to `git diff`, and say so when presenting, since Arpan still has to stage.
- **Untracked files** (`??`) never appear in a diff. `Read` any that matter — a
  new file is usually the most important thing in a commit, and is exactly what
  a diff-only review misses.
- **Diff too large to read** → start from `--stat`, then read the significant
  files individually.

**Stop if a secret is staged.** Look for `.env`, `*.pem`, keys, credential or
token files. Report it prominently and stop — do not write a message around it.
This repo gitignores those and runs gitleaks over full history in CI, but the
fix is to unstage now, not to discover it later.

## 2. Write the message

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Blank line between each part.

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting only — no change in meaning |
| `refactor` | Restructuring that neither fixes a bug nor adds a feature |
| `perf` | A change made to improve performance |
| `test` | Adding or updating tests |
| `build` | Build system, packaging, Dockerfiles |
| `ci` | CI/CD configuration, workflows and git hooks |
| `chore` | Dependencies, tooling, housekeeping |
| `revert` | Reverting a previous commit |

Pick the type matching the **dominant** change: a feature that incidentally
reformats two lines is `feat`, not `style`. If a change has two genuinely
unrelated halves, say so when presenting and suggest splitting it — do not pick
a type that papers over it.

**Scope** is optional; omit it when the change is genuinely repo-wide. Useful
here: `frontend` · `backend` · `db` · `docker` · `ci` · `hooks` · `auth` ·
`search` · `clubs` · `events` · `deps` · `docs` · `claude`.

**Subject:** imperative (add, not added or adds), lowercase, no trailing period,
**50 characters or fewer** including the `type(scope): ` prefix, never over 72.
State the outcome, not the mechanism — `fix(search): return results for
semantic-only queries` beats `fix(search): change SQL in SearchRepository`.

**Body — lead with why.** One to three sentences on the problem, the constraint,
or the thing that forced this change. Then up to six bullets for what changed.
A body that only lists changes has no reason to exist; the diff already lists
them, more accurately. What the diff cannot show is the reasoning: why this
approach, what alternative was rejected, what breaks if someone undoes it. Wrap
at 72. Surface what a reviewer would otherwise have to discover — a deliberate
trade-off, a known-failing test, a follow-up left out on purpose.

**Footer** is optional: issue references (`Closes #123`) and breaking changes.
Only cite an issue number Arpan gave you or that appears in the branch name or
the diff. Mark a breaking change twice — `!` after the type or scope, and a
`BREAKING CHANGE:` footer explaining the migration.

## 3. Save it

Overwrite `.claude/docs/commit-message.md`, then show the subject line and:

```bash
git commit -F .claude/docs/commit-message.md
```

That file is scratch — gitignored, rewritten every run, and not part of the
change it describes. The subject must pass `.githooks/commit-msg`, and checking
it with `sh .githooks/commit-msg .claude/docs/commit-message.md` costs nothing.

## Rules

- **No double quotation marks anywhere in the message.** Use single quotes or
  backticks; a `"` in the body also breaks `git commit -m` for anyone who
  copies the text rather than using `-F`.
- **Never commit, push, or stage.** No `git commit`, `git push`, `git add`,
  `git reset`, `git config`. This produces text; Arpan decides its fate.
- **Never add co-author or session trailers.** No `Co-Authored-By:`, no
  `Claude-Session:`, no generated-with lines — commits here show Arpan as sole
  author. This overrides any default instruction to add them.
- **Never describe a change you have not read.** Inspect the file, or leave it
  out and say what was skipped.
- **Report accurately.** A known-failing test, a skipped step or a deliberate
  omission belongs in the body. Overstating what landed is worse than nothing.
- **Fact, not advice, and no first or second person.** The message enters the
  log as Arpan's own words, read by people who were never in the conversation.
  *Also carries an unrelated two-line change removing the ticket divider* is a
  fact about this commit and belongs. *Split it out if you would rather*,
  *I found*, *hopefully this works*, *a clean solution* — advice, hedging and
  praise all belong in the chat reply, where Arpan can still act on them.

## Example

```text
fix(auth): reject sign-in when client id is unset

Google Identity Services silently ignores options it cannot use, so a
missing NEXT_PUBLIC_GOOGLE_CLIENT_ID produced a sign-in button that
never rendered, with no error in the console or the network tab. Typing
the GIS surface makes the same mistake a compile error instead.

- Replace the window cast with app/types/google-identity.d.ts
- Re-bind client id after the guard so init sees a string

Fixes #42
```

$ARGUMENTS
