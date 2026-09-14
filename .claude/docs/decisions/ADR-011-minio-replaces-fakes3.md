# ADR-011 — MinIO replaces `FakeS3` as the local and CI object store

**Status:** ✅ Accepted 2026-09-12
**Date:** 2026-09-12
**Raised by:** the same unit as [ADR-010](ADR-010-uploads-stream-through-the-api.md).
Once uploads were settled, *what stands in for S3 locally* was the remaining
half of the queued question, and it is the half that decides whether local
development exercises the production code path at all.
**Approved by:** Arpan, 2026-09-12
**Implemented in:** `s3/S3Config.java`, `docker/docker-compose.yml`,
`MinioTestContainer` — this unit. `s3/FakeS3.java` deleted.

## Context

`aws.s3.mock` is true by default (`application.yml:52`) and false only under
the `prod` profile (`application-prod.yml:25`), so `S3Config.java:18-26` hands
back `FakeS3` in every environment anyone has ever run. **This project has
never constructed a real `S3Client`.** Local development, CI's Docker job and
the entire integration suite exercise a filesystem stub.

`FakeS3` implements `S3Client` over `~/.arpan/s3`, and the gap between it and
the thing it stands in for is not theoretical — it is
[BUG-039](../../bugs/fixed_bugs.md#bug-039). S3 treats a key as an opaque
string, so `..` in one is two characters. `FakeS3` joins the key onto a
directory, where `..` climbs, and an upload named `../../x` was a file write
anywhere the backend could reach. The stub was not a weaker S3; it was a
*different* thing with a vulnerability S3 does not have. It has carried a
`buildObjectFullPath` guard since, which is a guard against being a stub.

It has a second, quieter cost. `S3Config` has two branches and only one of them
has ever executed, so every behaviour real S3 has and `FakeS3` does not —
region resolution, credential chain, error shapes, `NoSuchBucket`,
`NoSuchKey` — is untested by construction. [BUG-051](../../bugs/bugs.md#bug-051)
is exactly that class of defect, and so is the wrong-region default this unit
found alongside it (`application.yml:48` says `us-east-1`;
`campusvibe-prod-media` is in `ca-central-1`).

## Options considered

### A. Keep `FakeS3`

Free, no container, and the media ITs run today without a Docker daemon for S3.

Rejected. Given ADR-010 keeps uploads server-side, `FakeS3` would have been
*sufficient* — it is not presign capability that rules it out. It is that the
production code path would stay unexecuted until production executes it, which
is how both S3 defects on the books arrived.

### B. `adobe/s3mock`

Already written into `docker-compose.yml:40-46` as a commented block with
`initialBuckets` set, so it was the cheapest thing to uncomment. A real S3 wire
protocol over HTTP, which is the property that matters.

Rejected in favour of C on capability rather than correctness: it is an
in-memory test double, and its story for CORS and for a presign-capable future
is thinner. Having two half-adopted stand-ins in one repository is itself the
problem, so the commented block is deleted rather than left as an alternative.

### C. MinIO — chosen

A production object store that speaks S3. A real `S3Client` with an endpoint
override talks to it, so `S3Config` collapses to one branch with one setting
changed: where the endpoint points.

## Decision

**MinIO is the object store for local development, for CI's Docker job and for
the media integration tests. `FakeS3` is deleted, and so is the commented
`adobe/s3mock` block — no stand-in for S3 remains in this repository except
MinIO.**

Three consequences of that are decisions in their own right, recorded here
because they are not obvious from the sentence above:

1. **`aws.s3.mock` is deleted, not set to false.** The client is no longer
   chosen by a boolean; it is always a real `S3Client`, and the only thing that
   varies is whether `aws.s3.endpoint` is set. Setting it means MinIO, with
   path-style addressing and the local credentials; leaving it unset means AWS,
   with the default credential provider chain. This retires the *`aws.s3.mock`
   fails open* item in [`todo.md`](../../TODO/todo.md) by removing the flag that
   could fail open: an environment started with the wrong profile now fails
   loudly against real S3 instead of quietly writing to its own disk.
2. **The traversal guard moves rather than disappearing.** `FakeS3` was
   carrying BUG-039's second line of defence in `buildObjectFullPath`, and
   MinIO will not carry it — a key is opaque to S3, which is the whole point.
   The check moves to `MediaKeys.assertSafeKey` and is enforced at
   `S3Service`'s three methods, so every key reaching the store is checked
   whether it was generated or read back from a database row.
3. **MinIO's root credentials are non-secret local values** in
   `docker-compose.yml` with an env override, handled exactly as the database
   password already is. They are not AWS credentials and
   [`rules/aws-handling.md`](../../rules/aws-handling.md)'s rule against writing
   AWS keys is not engaged — but the file is committed and public, so they stay
   obviously-local values and never resemble a real key.

## Consequences

**Easier.** One code path from a developer's laptop to production. The media
ITs stop asserting against a filesystem and start asserting against an object
store, so `NoSuchKey` and `NoSuchBucket` become reachable in a test. The
wrong-region and wrong-bucket class of defect becomes visible locally instead of
on first contact with AWS.

**Harder.** One more container in `docker compose up` and in the CI Docker job,
and the media ITs now require a Docker daemon — they did not before. A cold
`mvn verify` pulls the MinIO image once.

**A dependency falls out.** `commons-io` is imported by `FakeS3` and by nothing
else in `backend/src` (`FakeS3.java:3-4`). Deleting the stub makes the
dependency dead, and it is removed with it — which also clears the
`commons-io` 2.11.0 → 2.14.0 finding (CVE-2024-47554) that is step (b) of the
Trivy-gate item in [`todo.md`](../../TODO/todo.md). That was not a reason for
this decision; it is a consequence worth recording so the gate item can be
re-measured.

**Foreclosed.** Nothing. MinIO presigns, so if ADR-010 is ever revisited the
local store is no longer the obstacle it was when
[ADR-007](ADR-007-uploaded-media-is-streamed-by-the-api.md) rejected presigning
for reads. That argument is now spent and must not be reused.

## Revisit when

- **A developer cannot run Docker.** The media ITs and the compose stack both
  hard-require it now. The fallback is an S3-free test profile, not a second
  stub.
- **MinIO and AWS S3 disagree about something this code depends on.** Record
  the divergence in [`s3-media/SKILL.md`](../../skills/s3-media/SKILL.md) the
  way `FakeS3`'s divergence was recorded, rather than working around it
  silently.
- **LocalStack is already being run for another AWS service** — SES, for
  instance, which [ADR-006](ADR-006-official-email-verified-only-by-round-trip.md)
  is waiting on. Two local AWS emulators is one too many, and at that point the
  choice is worth re-making rather than accumulating.
