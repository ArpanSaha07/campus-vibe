# ADR-026 — Adobe S3Mock replaces MinIO as the S3 stand-in for tests and compose

**Status:** Accepted 2026-11-24 (Arpan)
**Date:** 2026-11-24
**Decided in:** a `/start` session, 2026-11-24 — [spec](../specs/2026-11-24-s3mock-replaces-minio.md)
**Participants:** Claude · **Approved by:** Arpan, 2026-11-24
**Implemented in:** `fix(ci): run integration tests again on s3mock` on `fix/integration-tests`, 2026-11-25 — `S3MockTestContainer.java`, `docker/docker-compose.yml`, `_backend.yml`, `_docker.yml`; add the sha once it reaches `develop`
**Supersedes:** [ADR-011](ADR-011-minio-replaces-fakes3.md)

## Context

[ADR-011](ADR-011-minio-replaces-fakes3.md) made MinIO the object store for
local, CI and the media ITs. MinIO can no longer be pulled: quay.io answers
401 for `minio/minio` and `minio/mc` without credentials, and Docker Hub has
no copy ([BUG-063](../bugs/bugs.md#bug-063)). Upstream stopped publishing
community images in October 2025 and has since archived the repository, so
this will not come back.

Every IT starts the store through `AbstractIntegrationTest`
(`MinioTestContainer.java:53`), and the compose backend waits on `minio-init`
(`docker/docker-compose.yml:183`). Since 2026-09-30 CI has therefore run no
ITs (`_backend.yml:68`) and never started the stack (`_docker.yml:103`). A
green PR proves unit tests only.

What the store must do is small. The application calls three operations,
`putObject`, `getObject` and `deleteObject` (`s3/S3Service.java`), and the
tests add `createBucket`. Uploads stream through the API
([ADR-010](ADR-010-uploads-stream-through-the-api.md)), so nothing presigns,
and the bucket CORS rule was removed 2026-09-12
([`connecting-s3.md`](../architecture/connecting-s3.md)).

Checked 2026-11-24 by an anonymous manifest request to Docker Hub, the way a
CI runner pulls: every candidate below answered 200; quay.io MinIO answered 401.

## Options considered

### A. Adobe S3Mock (`adobe/s3mock:5.2.3`) — chosen

Adobe's S3 test double, Apache 2.0, Docker Hub verified publisher, 5.2.3
released 2026-09-19. Its README marks `CreateBucket`, `PutObject`,
`GetObject` and `DeleteObject` supported. It creates buckets at startup from
`COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS`, so compose needs no init
container and no `mc`. HTTP on 9090. Java 17 target, below our 25.

ADR-011 rejected it in favour of MinIO *on capability rather than
correctness*: a thinner story for CORS and for a presign-capable future. Both
reasons are spent — CORS is removed and ADR-010 rejected presigning.

Costs: it is a test double, not a store anyone runs in production, so it can
agree with itself where real S3 would not. It has no browser console (MinIO's
9001 goes). It keeps files only when told to
(`COM_ADOBE_TESTING_S3MOCK_STORE_RETAIN_FILES_ON_EXIT`).

### B. RustFS (`rustfs/rustfs:1.0.6`)

The closest MinIO drop-in: a real server, Apache 2.0, the same 9000/9001
ports and a console, so ADR-011's real-store argument survives intact.

Not taken: 1.0 only since September 2026 with fast release churn, and compose
would still need a bucket-init step (`amazon/aws-cli` pulls). A young server
chosen for realism trades the failure we have for a different one.

### C. The `pgsty/minio` community fork

A rebuild of MinIO's source with `pgsty/mc` beside it. The smallest diff —
three image names — and ADR-011 would stand.

Not taken: one maintainer, last release 2026-08-04, and its upstream is
archived. It is the same single point of failure that produced BUG-063.

### D. SeaweedFS (`chrislusf/seaweedfs`)

Mature, Apache 2.0, updated daily. Not taken: an S3 gateway and an identities
file to configure, reports of weaker S3 edge-case coverage than MinIO, and
the most setup of any option for three operations.

### E. LocalStack

Not an option any more: since 2026-03-23 its image needs an auth token tied
to an account, which is a CI secret to add for the same three operations.

## Decision

`adobe/s3mock`, pinned to an exact version, replaces MinIO in the IT
container and in `docker/docker-compose.yml`; `minio-init` is deleted; the IT
and stack blocks commented out for BUG-063 are restored. The backend is
unchanged: `S3Config` still builds one real `S3Client`, and only the endpoint
it is pointed at changes.

## Consequences

- CI runs the ITs and starts the stack again, which is the point.
- The production code path still executes in every IT: an `S3Client` over
  HTTP with path-style addressing. What ADR-011 bought over `FakeS3` is kept.
- Realism drops one step. A behaviour where real S3 and S3Mock differ will
  not show until production. With three plain operations that surface is
  small, but it is not zero.
- `MediaKeys.assertSafeKey` stays our only traversal guard (BUG-039). S3Mock
  stores objects on its own filesystem, so the guard matters as much as ever.
- Local developers lose the MinIO console, and a local `docker/.env` naming
  `http://minio:9000` must change, since it overrides the compose default.

## Revisit when

- The code needs an S3 feature S3Mock lacks or fakes — presigned URLs,
  bucket policies, object lock, real encryption.
- A defect reaches production that a real store would have caught.
- S3Mock stops publishing to Docker Hub or goes a year without a release.
- RustFS has a year of stable releases, if realism is wanted back.
