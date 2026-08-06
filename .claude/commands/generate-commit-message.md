---
description: Generate a semantic commit message for the current changes and save it to .claude/docs/commit-message.md
argument-hint: "[optional focus, e.g. emphasise the CI changes]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Read, Write
---

Generate a git commit message for the current changes.

Follow `.claude/skills/commit-message/SKILL.md` exactly — it is the single source
of truth for the procedure, the semantic format, and the rules. Read it first if
it is not already in context.

The short version, so nothing is skipped:

1. Run `git status --short`, `git diff --staged`, and `git log --format='%s' -15`.
   Describe **only staged** changes if anything is staged; otherwise fall back to
   unstaged changes and say so. `Read` any untracked file that matters — new
   files never appear in a diff. If a secret is staged (`.env`, `*.pem`, keys),
   report it and stop.
2. Write a semantic message: `type(scope): subject`, imperative, lowercase, no
   trailing period, 50 characters or fewer.
3. **Lead the body with why** — one to three sentences on the problem or
   constraint that forced the change, then at most six bullets for what changed.
   A body that only lists changes is redundant with the diff. Wrap at 72.
4. Save it to `.claude/docs/commit-message.md` (overwrite), then show the subject
   line and tell the user to run:
   `git commit -F .claude/docs/commit-message.md`

Hard rules: **no double quotation marks anywhere in the message** — use single
quotes or backticks. Never run `git commit`, `git push`, `git add`, or
`git reset`. Never add `Co-Authored-By:`, `Claude-Session:`, or generated-with
trailers — commits here show the user as sole author. Never describe a file you
have not read.

$ARGUMENTS
