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
