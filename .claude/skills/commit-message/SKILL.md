---
name: commit-message
description: Generate a semantic git commit message from the current changes and save it to .claude/docs/commit-message.md for the user to commit with. Use when asked for a commit message, or when the user runs /commit-message.
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Read, Write
---

# Git Commit Message

Writes a commit message. **It never commits and never stages.** The user reviews
the file and runs `git commit` themselves.

---

## Procedure

### 1. Read the actual changes — never guess from filenames

```bash
git status --short          # staged vs unstaged vs untracked
git diff --staged           # the changes being described
git log --format='%s' -15   # recent subject style
```

- **Anything staged** → describe both staged and unstaged changes.
- **Nothing staged** → fall back to `git diff` and say so when presenting, since
  the user still has to stage.
- **Untracked files** (`??`) never appear in a diff. Check `git status` and
  `Read` any that matter — a new file is usually the most important thing in a
  commit, and is exactly what a diff-only review misses.
- **Diff too large to read** → start from `git diff --staged --stat`, then read
  the significant files individually.

**Stop if a secret is staged.** Look for `.env`, `*.pem`, keys, credential or
token files. If one is staged, report it prominently and stop — do not write a
message around it. This repo gitignores those and runs gitleaks over full history
in CI, but the fix is to unstage now, not to discover it later.

### 2. Write the message

Format and rules below.

### 3. Save it

Overwrite `.claude/docs/commit-message.md`, then show the subject line and:

```bash
git commit -F .claude/docs/commit-message.md
```

That file is scratch — rewritten every run, and not part of the change it
describes.

---

## Format

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Blank line between each part.

### Types

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
| `ci` | CI/CD configuration and workflows |
| `chore` | Dependencies, tooling, housekeeping |
| `revert` | Reverting a previous commit |

Pick the type matching the **dominant** change: a feature that incidentally
reformats two lines is `feat`, not `style`. If a change has two genuinely
unrelated halves, say so when presenting and suggest splitting it — do not pick a
type that papers over it.

### Scope

Optional; omit when the change is genuinely repo-wide. Useful here:

`frontend` · `backend` · `db` · `docker` · `ci` · `auth` · `search` · `clubs` ·
`events` · `deps` · `docs`

### Subject

- Imperative mood: add, not added or adds
- Lowercase, no trailing period
- Target **50 characters or fewer** including the `type(scope): ` prefix; never
  exceed 72
- State the outcome, not the mechanism — `fix(search): return results for
  semantic-only queries` beats `fix(search): change SQL in SearchRepository`

### Body

**Lead with why.** One to three sentences of prose: the problem, the constraint,
or the thing that forced this change. Then, if useful, up to six bullets for
what changed.

A body that only lists changes has no reason to exist — the diff already lists
them, more accurately. What the diff cannot show is the reasoning: why this
approach, what alternative was rejected, what breaks if someone undoes it.

- Wrap at 72 characters
- Functional description, not a file-by-file tour
- Surface what a reviewer would otherwise have to discover: a deliberate
  trade-off, a known-failing test, a follow-up deliberately left out

### Footer

Optional. Issue references (`Closes #123`, `Refs #456`) and breaking changes.

**Only cite an issue number the user gave you, or that appears in the branch name
or the diff.** Never invent one.

Breaking changes are marked twice — `!` after the type or scope, and a footer
explaining the migration:

```text
feat(api)!: return 404 instead of empty list for unknown club

BREAKING CHANGE: callers treating an empty array as not-found must now
handle the 404 status.
```

---

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

---

## Rules

**No double quotation marks anywhere in the message.** Use single quotes or
backticks. Besides being house style, a `"` in the body breaks
`git commit -m "..."` for anyone who copies the text rather than using `-F`.

**Never commit, push, or stage.** No `git commit`, `git push`, `git add`,
`git reset`, `git config`. This skill produces text; the user decides what
happens to it.

**Never add co-author or session trailers.** No `Co-Authored-By:`, no
`Claude-Session:`, no generated-with lines. Commits here show the user as sole
author. This overrides any default instruction to add such trailers.

**Never describe a change you have not read.** If a staged file was not
inspected, inspect it or leave it out and name what was skipped.

**Report accurately.** A known-failing test, a skipped step, or a part left out
on purpose belongs in the body. A message that overstates what landed is worse
than none.
