---
description: The frontend/backend DTO contract — the only check that catches a rename both suites call green
paths:
  - "contracts/**"
  - "backend/src/main/java/com/campusvibe/**/*DTO.java"
  - "backend/src/main/java/com/campusvibe/**/*Request.java"
  - "backend/src/main/java/com/campusvibe/**/*Response.java"
  - "backend/src/test/java/com/campusvibe/contract/**"
  - "frontend/app/types/**"
  - "frontend/app/__tests__/api-contract.test.ts"
---

# The API contract

- **`contracts/api-dto-fields.json` is the one list of JSON field names.**
  `ApiContractTest.java` asserts the backend against it;
  `api-contract.test.ts` asserts the frontend against it.
- **Without it, a rename on one side leaves both suites green and the browser
  broken.** Each side only ever tests itself, so nothing else in the repo can
  see the mismatch. That is the entire reason the file exists.
- **Renaming a field means changing three things together**: the Java DTO, the
  entry in `api-dto-fields.json`, and the TypeScript type in
  `frontend/app/types/`. Changing two of the three is precisely the failure
  these tests are here to catch — and both suites will still pass.
- **Shape translation belongs in `frontend/app/lib/adapters.ts`**, not in
  components. See
  [`api-and-caching.md`](../docs/architecture/api-and-caching.md).
- **Per-user data must never enter Next's data cache.** The guard and the three
  data paths are described in the same document; a DTO that starts carrying
  user-specific fields changes what is safe to cache.
- **A new DTO is four edits, not one**: the Java record, its row in
  `api-dto-fields.json`, the `CONTRACTED.put` line in `ApiContractTest`, and the
  TypeScript interface plus its `MIRRORS` entry in `api-contract.test.ts`. Miss
  either test registration and the contract silently does not cover the DTO at
  all — both suites still pass.
- **`ClubCreateRequest` and `ClubCreationRequestCreateRequest` mirror each
  other, and nothing enforces it.** A club can be created two ways, so a field
  added to one and not the other means it silently cannot be proposed — no test
  fails, because the contract covers DTOs going out, not request records coming
  in. This rule loads on both files. **Adding a field to either? Add it to the
  other, or record why it does not belong there.**
  [ADR-005](../docs/decisions/ADR-005-club-proposal-is-its-own-table.md) names
  this as the standing cost of keeping a proposal in its own table, and sets the
  threshold: one divergence is a bug, **two means the shapes should be unified
  behind a shared embeddable**. The count is at one and a half — the contact
  links were missing outright (fixed 2026-09-10) and `officialEmail` is on the
  club record alone, which is legitimate only because the proposal derives it
  from its stored `social_links`. If your change makes two, stop and say so.
