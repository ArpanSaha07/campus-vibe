# S3Mock replaces MinIO, and the ITs run in CI again

**Status:** shipped 2026-11-25 on `fix/integration-tests` · approved 2026-11-24 (Arpan) · **Date:** 2026-11-24

> **As built, 2026-11-25.** Every decision below held. Open question 1 was
> settled by running: the image has busybox `wget` and no `curl`, so the
> compose healthcheck uses `wget`; S3Mock answered unsigned requests, so it
> checks no credentials; both the IT container and compose wait on the
> bucket path, which answers 200 only once the bucket exists. One drift: the
> IT container also takes its bucket from
> `COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS` rather than a
> `createBucket` call, so `S3MockTestContainer` builds no client of its own.
> No IT failed for a reason other than the store, so nothing was filed.
> Verification: the anonymous pull and `verify.mjs --all --full` passed (340
> ITs); the stack came up and a logo round-tripped. `docker logout` was not
> run, to keep Arpan's session; the pull was of an image not in the cache.
> The PR run is still to come, and BUG-063 stays open until it is green.

## Goal

CI runs the integration tests and starts the compose stack again, both of
which have been off since 2026-09-30 because MinIO's images stopped pulling
([BUG-063](../bugs/bugs.md#bug-063)). After this ships, the IT container and
local compose run `adobe/s3mock`, both pull without a login, and a green PR
again proves the ITs pass, not just the unit tests. BUG-063 closes on that
green run.

## Out of scope

- Any change to backend main code. `S3Config`, `S3Service` and `MediaKeys`
  stay as they are; only where the endpoint points changes.
- Production. It uses real S3 and is not touched.
- Fixing ITs that fail for a reason other than the store. They have been off
  in CI for two months, so some may have rotted; those are filed as bugs, not
  fixed here (see Decisions taken).
- Presigned URLs or any other new S3 feature.

## Decisions taken

- **Adobe S3Mock is the replacement** — Arpan, 2026-11-24, from RustFS, the
  `pgsty/minio` fork and SeaweedFS. Recorded as
  [ADR-026](../decisions/ADR-026-s3mock-replaces-minio.md), accepted by
  Arpan 2026-11-24; it supersedes ADR-011.
- **A plain `GenericContainer`, not the Testcontainers module** — Arpan,
  2026-11-24. No new test dependency and no Kotlin runtime; the class keeps
  the shape `PostgresTestContainer` has.
- **Local uploads survive `docker compose down`** — Arpan, 2026-11-24. A
  named volume holds S3Mock's store root, with
  `COM_ADOBE_TESTING_S3MOCK_STORE_RETAIN_FILES_ON_EXIT=true`, as
  `minio_data` did for MinIO.
- **An IT that fails for a reason other than the store is filed in
  `bugs.md`, and the unit stops there** — Arpan, 2026-11-24. Fixing it is a
  later unit.
- The compose service is named `s3mock`, so the endpoint is
  `http://s3mock:9090`.
- The image is pinned to an exact version (`5.2.3` today), never `latest`,
  and the same tag is used by the IT container and compose — as ADR-011 kept
  MinIO's two tags equal.
- `minio-init` is deleted; the bucket comes from
  `COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS`.
- Both `TEMP 2026-09-30` blocks are restored together, as
  `rules/ci-and-build.md` requires: the IT branch in `_backend.yml`, and
  *Start the stack* through *Smoke test the API* in `_docker.yml`, with the
  Trivy image name at `_docker.yml:291` put back.

## Open questions

1. **Not settled by the README, settled by running:** whether the image has
   `curl` or `wget` for a compose healthcheck (else `service_started` plus
   the backend's own retry), which path to wait on in the IT container, and
   whether S3Mock checks credentials. No decision needed from Arpan unless
   the answer forces one.

## Files expected to change

- `backend/src/test/java/com/campusvibe/MinioTestContainer.java` → renamed
  `S3MockTestContainer.java`; `AbstractIntegrationTest.java`, its only user
- `docker/docker-compose.yml` (the `minio` and `minio-init` services, the
  backend's `depends_on` and `AWS_S3_ENDPOINT` default, the volume)
- `docker/.env.example` (endpoint and comments)
- `.github/workflows/_backend.yml`, `.github/workflows/_docker.yml`;
  `_database.yml:114` comment
- Not `scripts/verify.mjs`: `--full` already runs the ITs
  (`verify.mjs:327`), so restoring `_backend.yml` ends the drift the rule
  describes without touching the script
- Comments naming MinIO in `S3Config.java`, `S3Service.java`,
  `MediaKeys.java`, `ClubController.java`, `application*.yml`,
  `ClubMediaIT.java`, `MediaKeysTest.java` — prose only
- Mapped docs: [`ci-cd-pipeline.md`](../architecture/ci-cd-pipeline.md),
  [`connecting-s3.md`](../architecture/connecting-s3.md),
  `.claude/skills/s3-media/SKILL.md`
- Rules: `ci-and-build.md` (the no-ITs bullet), `backend-java.md` (the
  MinIO line under BUG-039), `aws-handling.md`

Arpan's own `docker/.env` (gitignored) sets `AWS_S3_ENDPOINT=http://minio:9000`
and must be edited by hand to `AWS_S3_ENDPOINT=http://s3mock:9090`, or the
backend keeps pointing at a store that no longer exists.

## Verification

```bash
# the image pulls with no login
docker logout && docker pull adobe/s3mock:5.2.3
# the full suite, ITs included, against S3Mock
node scripts/verify.mjs --all --full
# the stack: comes up, then a club logo uploads and reads back byte-identical
docker compose -f docker/docker-compose.yml up -d --build
```

Then a PR whose `Backend / Build and test` runs the ITs and whose
`Docker / Build images and run the stack` starts the stack and passes the
smoke test — both green.

## To update at wrap-up

- ADR-026 `Implemented in:`; ADR-011's status to *Superseded by ADR-026*,
  and its rows in `docs/decisions/README.md` and `docs/README.md`
- [BUG-063](../bugs/bugs.md#bug-063) to `fixed_bugs.md`, citing the green run
- `rules/ci-and-build.md`, `rules/backend-java.md`, `rules/aws-handling.md`
- `ci-cd-pipeline.md`, `connecting-s3.md`, `s3-media/SKILL.md`
- The `todo.md` item at line 38 to `tasks-completed.md`
- STATUS.md: ITs back on in CI
