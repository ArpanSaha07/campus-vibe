# ADR-012 — One media bucket with prefixes, not one bucket per media kind

**Status:** ✅ Accepted 2026-09-12
**Date:** 2026-09-12
**Raised by:** [BUG-051](../../bugs/bugs.md#bug-051) — production resolves
`AWS_S3_BUCKET_CLUBS` and `AWS_S3_BUCKET_EVENTS`, the environment sets neither,
and both defaults name buckets that do not exist. The bug says in its own text
that fixing it is a choice rather than a rename.
**Approved by:** Arpan, 2026-09-12
**Implemented in:** `s3/MediaBucket.java` (replacing `S3Buckets.java`), `application.yml`,
`docker/docker-compose.yml` — this unit.

## Context

`S3Buckets.java` exposes two buckets, `clubs` and `events`, resolved from two
environment variables with two defaults (`application.yml:53-55`). The
`CampusVibe-Backend-Prod` environment sets neither. It sets `S3_BUCKET_NAME`,
which a repository-wide grep shows no code reads. `aws s3api list-buckets`
returns `campusvibe-prod-media` and the Elastic Beanstalk service bucket;
neither `campusvibe-clubs` nor `campusvibe-events` exists.

Two more facts make it a choice rather than a typo:

- The EC2 instance role carries an inline grant of `GetObject`, `PutObject` and
  `DeleteObject` on `arn:aws:s3:::campusvibe-prod-media/*` and nothing wider —
  no second bucket, no `ListBucket`.
- The Phase 3 plan in
  [`CampusVibe_AWS_Deployment_Guide.md`](../architecture/CampusVibe_AWS_Deployment_Guide.md)
  assumed two buckets. One was created, under a third name.

So code, environment, IAM and plan disagree four ways, and every pairing of
them is individually reasonable. Nothing in the repository could reveal it —
BUG-051 was found by reading the live account.

## Options considered

### A. Two buckets, as Phase 3 planned

Create `campusvibe-prod-clubs` and `campusvibe-prod-events` to the
[`rules/aws-handling.md`](../../rules/aws-handling.md) baseline, keep
`S3Buckets` as it is, widen the inline policy to both.

Rejected. It buys a blast-radius boundary between two media kinds owned by the
same application, served by the same endpoints, with the same lifecycle and the
same access rules — and pays for it with a second bucket to configure, a second
ARN in every policy, and an orphaned `campusvibe-prod-media`. The separation
would be real only if clubs and events had different retention, different
readers or different owners. They have none of those.

It also needs an IAM change, which is Arpan's approval under `aws-handling.md`,
to reach a state no worse than the one below.

### B. Two properties pointing at one bucket

Set both variables to `campusvibe-prod-media`. Zero code change, works
immediately.

Rejected. It is the cheapest fix and the one that regenerates the bug: the code
would keep claiming a two-bucket topology that no environment has, which is
precisely the shape that made BUG-051 invisible from inside the repository for
as long as it existed. A future reader would have no way to tell the two
properties apart from two real buckets.

### C. One bucket with prefixes — chosen

`S3Buckets` collapses to a single `media` property, resolved from
`AWS_S3_BUCKET`, pointing at `campusvibe-prod-media` — built as `MediaBucket`.

## Decision

**There is one media bucket. Media kinds are separated by key prefix, not by
bucket.**

The keys do not change. `MediaKeys` has written `clubs/{id}/logos/{uuid}.{ext}`,
`clubs/{id}/images/{uuid}.{ext}` and `events/{id}/banners/{uuid}.{ext}` since
2026-09-11 (`MediaKeys.java:32-42`), which is already the
[`reference.md`](../../skills/s3-media/reference.md) §7 layout and is already
prefix-separated. **Nothing is migrated, because nothing moves** — the prefixes
that make one bucket work were built before anything had written an object to
real S3 at all.

The existing inline grant on `CampusVibe-ElasticBeanstalk-EC2Role` already
describes exactly this bucket and exactly these three verbs, so **this decision
requires no IAM change and creates no new billable resource.** Of the three
options it is the only one true of both.

`S3_BUCKET_NAME` is removed from the environment as part of the same change: an
environment variable nothing reads is a claim that something does.

## Consequences

**Easier.** Code, environment, IAM and the bucket that exists all name one
thing. One variable to set, one ARN to grant, one bucket's settings — public
access blocks, `BucketOwnerEnforced`, SSE-S3 — to keep right. A future media
kind (profile avatars, which have nothing today) needs a prefix, not a bucket,
a policy edit and an approval.

**Harder.** There is no bucket-level boundary between club and event media, so
a policy cannot grant one without the other. Nothing wants that today; if
something does, it is expressible as a prefix condition before it is a reason
to split buckets.

**Also.** Any future bucket-wide setting — a lifecycle rule, versioning,
replication — applies to all media at once. For logos and banners that is
wanted, not a limitation.

## Revisit when

- **A media kind needs a different policy, retention or audience** — user
  uploads that are private per user, say, as opposed to club and event media
  which is all world-displayable through the API. A prefix condition is the
  first answer; a second bucket is the answer when the prefix condition starts
  appearing in more than one policy.
- **Environments multiply.** One bucket per environment (`campusvibe-dev-media`,
  `campusvibe-prod-media`) is a different axis from one bucket per media kind
  and is not decided here. MinIO covers local today
  ([ADR-011](ADR-011-minio-replaces-fakes3.md)); a shared staging environment is
  the trigger.
- **Anyone proposes re-splitting by media kind.** The reasoning above is the
  thing to answer, not re-derive.
