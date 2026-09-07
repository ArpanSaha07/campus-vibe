---
description: Workflows, git hooks, build scripts and the pom — what gates what, and which levers are exhausted
paths:
  - ".github/**"
  - ".githooks/**"
  - "scripts/**"
  - "backend/pom.xml"
  - "docker/**"
  - "backend/Dockerfile"
  - "frontend/Dockerfile"
---

# CI, hooks and the build

- **Tomcat CVEs: the parent-version lever is exhausted at 3.5.16.** Bump
  `<tomcat.version>` in `backend/pom.xml` instead, and re-check it on every
  parent bump. Spring Boot 4 is a framework migration, not a CVE remedy.
  (BUG-019, BUG-035, ADR-003)
- **Actions are pinned to commit shas, not tags.** Keep the `# vX.Y.Z` comment
  beside the sha when bumping one, or the next reader cannot tell what moved.
- **Never add `-DskipTests`.** (BUG-002)
- **`scripts/verify.mjs` mirrors `_frontend.yml` and `_backend.yml`.** Change a
  workflow and the script together — the moment they drift, local green stops
  meaning CI green, which is the only thing the script is for.
- **`ci.yml` gates pull requests, `branch-checks.yml` is the fast push loop, and
  `_*.yml` are reusable workflows that are never triggered directly.**
- **`--no-verify` is not a workflow.** `0357b78` went around the pre-push hook
  and put a backend that did not compile onto `develop`; CI found it minutes
  later, and clearing it took three more commits. If a hook is red, stop and
  ask. (BUG-036)
- **Hooks activate per clone:** `git config core.hooksPath .githooks` turns on
  all three — `pre-commit` (doc drift, advisory), `commit-msg` (semantic
  subjects, in pure `sh` so GUI clients honour it) and `pre-push`. Nothing here
  protects a colleague who has not run it.
