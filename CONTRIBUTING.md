# Contributing to CampusVibe

How work gets from an idea to `develop`. Read it once before your first PR;
the rules are short because the repo checks most of them for you.

## Day one

1. Clone, then turn the git hooks on — once per clone, or none of them run:

   ```bash
   git config core.hooksPath .githooks
   ```

   They check commit subjects, warn about docs that drifted, and run
   `scripts/verify.mjs` before every push.

2. Run the stack locally. Copy `docker/.env.example` to `docker/.env` and ask
   Arpan for the values. Then:

   ```bash
   cd backend && ./mvnw package && cd ..     # the image copies this jar
   cd docker && docker compose watch          # frontend, backend, pgvector db
   ```

   Use `watch` rather than `up`: with plain `up`, a recreated backend
   container can silently run an old jar. The `dev` profile seeds demo clubs.

3. Read, in this order: [`.claude/CLAUDE.md`](.claude/CLAUDE.md),
   [`docs/STATUS.md`](docs/STATUS.md),
   [`docs/product.md`](docs/product.md),
   [`docs/design-guidelines.md`](docs/design-guidelines.md) and the
   decisions index, [`docs/decisions/README.md`](docs/decisions/README.md).

You have GitHub *Write* access. You do not need production AWS access, and the
`.claude/` setup stops Claude from making AWS changes.

## How a feature flows

1. **Discuss it with Arpan.** Agree what it is and roughly how.
2. **Brainstorm with Claude.** Share the discussion, explore the options.
3. **Write the spec with `/start`.** It reads the relevant docs, asks about
   anything undecided, and writes `docs/specs/<date>-<slug>.md`.
4. **Wait for Arpan to approve the spec.** Send it to him as its own PR or
   message. **Do not write code before he approves it** — only Arpan approves
   a spec, and review compares your PR against the approved version. Code
   written against a draft is at your own risk.
5. **Build it on a branch** cut from `develop`. Commit small, push daily.
6. **Test it locally** (below).
7. **Open the PR into `develop`** with `/open-pr`, which drafts the title and
   the description for you.
8. **Fix what the checks and the Claude review find**, then ask Arpan for
   review.
9. **Run `/wrap-up`** before final approval, so STATUS, TODO and docs change
   in the same PR.
10. **Arpan merges.** Only Arpan merges, into `develop` and into `main`.

## Branch names

A suggestion, not a rule — nothing checks it:

```
<owner>/<type>/<slug>
```

`owner` is `arpan` or your GitHub handle; `type` is a commit type (`feat`,
`fix`, `refactor`, `test`, `docs`, `chore`); `slug` is a few lowercase words.
For example `arpan/feat/club-pinned-events`. Putting the owner first makes it
easy to see whose branch is whose.

## Testing before your PR merges

There is no shared staging server, so prove it locally:

- **Run the feature** in the local Docker stack and try it as a student and as
  a club owner, whichever applies.
- **Write tests:** Jest and React Testing Library for UI, JUnit for services,
  Testcontainers integration tests for repositories and endpoints. Every
  behaviour in the spec gets a test; every bug fix gets a regression test.
- **Run the integration tests yourself.** CI does not run them at the moment
  (BUG-063), so `node scripts/verify.mjs --all --full` is the only place they
  run. Plain `node scripts/verify.mjs` is what the pre-push hook runs.
- **Put the evidence in the PR:** what you ran, what you saw, and a
  screenshot or short clip for UI changes.

## The PR

- **Into `develop`**, never `main`. `develop` to `main` is Arpan's release PR.
- **Title:** `type(scope): summary`, the same as a commit subject — the squash
  merge uses it. Example: `feat(clubs): let owners pin an event`.
- **Description:** fill in the template. `/open-pr` does this from your
  session; it leaves a TODO wherever only you know the answer.
- **Size:** aim for under 4,000 changed lines (lockfiles not counted). Bigger
  work splits well as migration and backend, then the API contract, then UI.

## What runs on your PR

| Check | What it does | Blocks merge |
|---|---|---|
| `CI` | Secret scan, backend and frontend builds and unit tests, contract tests, migration lint, Docker images, Trivy | Yes |
| Code owners | Requests Arpan on `contracts/`, backend `security/`, `.github/`, `.claude/rules/`, the decisions and the product doc | Yes |
| Arpan's approval | One approval on every PR into `develop` | Yes |
| `PR checks` | Warns about a non-semantic title, an unfilled template, or over 4,000 lines | No, warnings only |
| Claude review, step 1 | Bugs and `CLAUDE.md` rule breaks, as inline comments | No, but fix what it finds |
| Claude review, step 2 | Lists anything outside your spec; suggests a title and drafts a description if they are missing | No, but answer it |

The Claude review runs when the PR opens. To run it again after changes,
close and reopen the PR. CodeQL's security analysis runs later, on Arpan's
release PR from `develop` into `main`.

## Rules

- Never push to `main`, `develop`, or someone else's branch. Never force-push a
  branch someone else is using.
- Never use `--no-verify`. A red hook means stop and ask.
- Never edit a migration that is already on `develop` or `main`. Use the
  `database-lifecycle` skill for migrations and seed data.
- DTO field changes go through `contracts/api-dto-fields.json` and both
  contract tests.
- No new dependency, table, endpoint or service unless the spec names it.
- Reuse shared components and existing services before writing new ones.
- Never commit secrets, `.env` files or real user data.

## Working with Claude

- You own every line you push, including the ones Claude wrote. Read the full
  diff before pushing, and do not push code you could not explain in review.
- Claude does not decide product or architecture questions. If it raises one,
  put it in the spec for Arpan.
- The `.claude/` folder loads the same rules into your sessions as into
  Arpan's, so Claude follows the project's conventions by default.

## When you are stuck

Stuck for two hours, or after three attempts: ask Arpan, with what you tried.
Asking early is expected.
