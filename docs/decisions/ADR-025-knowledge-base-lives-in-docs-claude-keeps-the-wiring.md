# ADR-025 — The knowledge base lives in root `docs/`; `.claude/` keeps only Claude Code's wiring

**Status:** Accepted 2026-11-23
**Date:** 2026-11-23
**Decided in:** the `chore/doc-restructure` session, no spec (see Consequences)
**Participants:** main session · **Choices made by:** Arpan, in the session, 2026-11-23
**Implemented in:** `docs/` (moved from `.claude/`), `scripts/check-links.mjs`,
`scripts/check-docs.mjs`, `scripts/hooks/session-context.mjs`,
`.github/CODEOWNERS`, `.claude/CLAUDE.md`; 2026-11-23, uncommitted

## Context

Everything the project knows about itself — `STATUS.md`, `product.md`,
architecture docs, ADRs, reviews, specs, the TODO queue, the bug logs and the
design guidelines — lived under `.claude/`. That folder is Claude Code's
configuration directory. Arpan wants other coding agents, and teammates
without an agent, to find the same documentation; a tool-specific dot folder
is the last place either looks.

Not everything under `.claude/` is documentation. `rules/` is loaded by
Claude Code itself: each file's `paths:` frontmatter attaches it to matching
source files, and only files in `.claude/rules/` are read that way. Skills,
commands and `settings.json` (the `SessionStart`, migration and AWS hooks) are
likewise Claude Code features.

## Decision

1. **The knowledge base moves to a root `docs/` folder, flat:** `STATUS.md`,
   `product.md`, `design-guidelines.md`, `README.md` (the index),
   `architecture/`, `decisions/`, `reviews/`, `specs/`, `TODO/`, `bugs/`.
   The intermediate `.claude/docs/` level is gone, not reproduced as
   `docs/docs/`.
2. **`.claude/` keeps only what Claude Code executes:** `CLAUDE.md`, `rules/`,
   `skills/`, `commands/`, `settings.json`. Rules stay because moving them
   ends their automatic loading.
3. **`CONTRIBUTING.md` stays at the repo root**, beside `README.md`: GitHub
   finds it in root, `docs/` or `.github/`, but people and agents look at the
   root first, and it is the entry point that sends a reader into `docs/`.
4. **Scratch files stay at `.claude/docs/commit-message.md` and
   `.claude/docs/pr-body.md`** — gitignored, written by Claude skills, and not
   knowledge.
5. **Path consumers follow the move**, not the other way round:
   `check-links.mjs` scans a list (`.claude/`, `docs/`, `CONTRIBUTING.md`)
   instead of one root, `check-docs.mjs` and `session-context.mjs` read
   `docs/`, CODEOWNERS owns `/docs/decisions/` and `/docs/product.md`.

## Alternatives rejected

- **Leave everything in `.claude/`.** Rejected: invisible to other agents and
  easy for a person browsing the repo to miss.
- **Move `rules/` to `docs/` too.** Rejected: Claude Code loads path-scoped
  rules only from `.claude/rules/`; elsewhere the `paths:` block is inert text
  and the traps stop arriving with the code. Other agents can be pointed at
  the files instead.
- **A symlink between `docs/` and `.claude/`.** Rejected: on Windows git
  checks symlinks out as plain text files unless `core.symlinks` is enabled
  with the right privilege, so it would break on this machine and possibly a
  teammate's.
- **Move `CONTRIBUTING.md` into `docs/`.** Rejected as above (decision 3).

## Consequences

- **Other agents still get no map.** `CLAUDE.md` is read only by Claude Code.
  The natural next step, not taken here, is a root `AGENTS.md` carrying the
  map and hard rules, with `CLAUDE.md` importing it and keeping the Claude-only
  parts; it should name each `.claude/rules/` file and the paths it covers.
- **Comments in migrations V12–V33 still cite `.claude/docs/…`** and must stay
  stale: those files are applied on RDS, and any edit changes the checksum
  Flyway validates on start.
- **Dated records keep old paths** — `tasks-completed.md` is append-only, and
  the bug logs, shipped specs, earlier ADRs (ADR-024 names
  `.claude/docs/decisions/` as a CODEOWNERS path) and the `ci-cd-pipeline.md`
  changelog record what was true when written.
- **`ci.yml`'s `code` filter needed no change**: `docs/` holds only Markdown,
  which `!**/*.md` already excludes. A non-Markdown file added to `docs/`
  would run the full suite — the safe direction.
- **No spec was written.** The move began before a `/start` session; this ADR
  is the record of the choices.
