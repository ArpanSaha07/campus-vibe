---
description: The CampusVibe AWS account — what a session may do unasked, what needs Arpan, and the shape of what is already deployed
paths:
  - "backend/src/main/java/com/campusvibe/s3/**"
  - "backend/src/main/resources/application-prod.yml"
  - "docker/Dockerrun.aws.json"
  - "docker/EB-DEPLOYMENT.md"
  - ".claude/docs/architecture/aws-deployment.md"
  - ".claude/docs/architecture/CampusVibe_AWS_Deployment_Guide.md"
---

# AWS

## Getting in

Profile `campusvibe-admin`, region `ca-central-1`, IAM Identity Center SSO with
temporary credentials, pinned as `env.AWS_PROFILE` in
[`settings.json`](../settings.json) so every tool call carries it. Do not rely
on a profile exported in a terminal — that does not reach a tool shell — and
never fall back to `default`, which holds a dead static key and fails
`InvalidClientTokenId`. Confirm with `aws sts get-caller-identity` before the
first write of a session.

Never request, create, display, store or commit AWS access keys.

**One named exception —
[ADR-013](../docs/decisions/ADR-013-ses-mail-over-smtp-credentials.md):** the
SES SMTP credentials production mail is sent with. Arpan creates them in the SES
console, never a session; the IAM user may only `ses:SendRawEmail` on the
`campusvibe-mcgill.com` identity; the values live in two Elastic Beanstalk
properties and nowhere else. It is not a precedent for any other key.

**Two ways in, one rulebook.** The AWS CLI, and the aws-core MCP tool
`aws___run_script`, which runs arbitrary boto3 and never passes through Bash.
Everything below binds to both.

## What is already there

- **`campusvibe-prod-media`** — the media bucket, currently empty. Public access
  blocked on all four, `BucketOwnerEnforced`, SSE-S3 with bucket keys, no
  bucket policy, and **no CORS rule** — the `GET,PUT` one was deleted
  2026-09-12, since no browser ever calls the bucket (ADR-010); do not put one
  back for anything that streams through the API. **No versioning and no
  lifecycle**, so an overwritten key is gone — which is what gives BUG-039 its
  edge.
- **`elasticbeanstalk-ca-central-1-<account>`** — created and owned by Elastic
  Beanstalk. Read it if you must; never write to it.
- **`CampusVibe-Backend-Prod`** on Elastic Beanstalk, whose EC2 role carries an
  inline grant (`CampusVibe-S3-Media-Access`) of
  `GetObject`/`PutObject`/`DeleteObject` on `campusvibe-prod-media/*`, and
  `ListBucket` on the bucket itself, and nothing wider. **`ListBucket` is
  load-bearing even though no code lists:** without it S3 answers a missing
  key with 403 AccessDenied rather than NoSuchKey, `S3Service.getObject`
  catches only `NoSuchKeyException`, and the read becomes a 500. MinIO's root
  credentials always list, so no test shows it. Added 2026-09-12. An unattached
  duplicate, `CampusVibeProdMediaS3Access`, still exists; deleting it is
  Arpan's. The environment proxies through **nginx**, whose 1 MB default body
  limit sits under the 5 MB upload cap. `deploy/eb/.platform/nginx/conf.d/`
  raises it to `10M` from 2026-09-12, but only once a bundle carrying it is
  deployed — proved by a 3 MB upload, never by a local test.
- **The backend reads one variable, `AWS_S3_BUCKET`**, and it has no default —
  an environment that does not set it fails to start (ADR-012, BUG-051).
  `AWS_REGION` defaults to `ca-central-1`, where the bucket actually is. The
  `CampusVibe-Backend-Prod` environment **sets both, since 2026-09-12**, and the
  never-read `S3_BUCKET_NAME` is gone. Nothing has run there yet — it still
  holds the sample application — so BUG-051 closes on the first deployed
  upload, not on the property.
- **Outside production nothing talks to AWS at all.** `AWS_S3_ENDPOINT` points
  the same real `S3Client` at MinIO locally and in CI (ADR-011); production
  leaves it unset and resolves the instance role. There is no mock flag any
  more.
- **`campusvibe-prod-db`** — PostgreSQL **18.3**, private, TLS forced,
  deletion protection on. Its master password is RDS-managed and **rotates every
  7 days** until switched to self-managed, and the database security group still
  admits one personal address.
- **The Elastic Beanstalk environment is load balanced** — an ALB on HTTP only,
  health check on `/` — not the single instance the guide describes. Kept on
  2026-09-12; HTTPS comes from ACM on that ALB.
- **SES is in the sandbox** with no verified identity.
- **What is left to connect, service by service:**
  [`connecting-rds.md`](../docs/architecture/connecting-rds.md),
  [`connecting-elastic-beanstalk.md`](../docs/architecture/connecting-elastic-beanstalk.md),
  [`connecting-s3.md`](../docs/architecture/connecting-s3.md),
  [`connecting-ses.md`](../docs/architecture/connecting-ses.md).

## Free — no approval

Read-only inspection: describe, list, get, logs, metrics, configuration.

Two carve-outs, because this repository is public:

- **Never read a secret value.** Names and ARNs yes;
  `secretsmanager get-secret-value` and `ssm get-parameter --with-decryption` no.
- **`elasticbeanstalk describe-configuration-settings` returns environment
  variables in plaintext.** Query `OptionName`, not `Value`.

## S3 — creating and writing is allowed

A session may create buckets and write objects without asking. A new bucket
matches the `campusvibe-prod-media` baseline: `ca-central-1`, all four public
access blocks on, `BucketOwnerEnforced`, SSE-S3 by default, tagged `Project`,
`Environment` and `ManagedBy`. Deleting a bucket or an object is still Arpan's.

## Ask first

Before anything that creates, modifies or deletes other infrastructure, say:
what changes, why, the cost, the security effect, and the exact command.

Explicit approval for: deleting any resource · terminating EC2 · deleting RDS ·
deleting S3 buckets or objects · IAM permissions · VPC networking · security
groups · replacing the Elastic Beanstalk environment · production environment
variables · backups and snapshots.

## Spend

**No new billable resource without approval** — S3 buckets are the one carve-out
above. Name the monthly cost when proposing one. Volunteering a cheaper shape,
or flagging spend that is not earning its keep, is welcome unprompted.

## Never

- Disable a security control to make a deployment work.
- Make RDS publicly accessible unless explicitly told to.
- Print a secret value into chat, into a file under `.claude/`, or into a
  commit. This repository is public and `.claude/` is committed.

## Enforced, not just written

`scripts/hooks/guard-aws.mjs` runs before every Bash call and every
`aws___run_script`, and refuses anything outside the allowlist above. It fails
closed: a service or verb it does not recognise is blocked, not waved through.
A refusal is a stop-and-ask, never a thing to work around — once Arpan has
approved the operation, `CAMPUSVIBE_ALLOW_AWS_WRITE=1` is the way through.
**The hook reads that from its own process environment**, the one Claude Code
was started in (`guard-aws.mjs:257`), so prefixing it to a command changes
nothing. For a one-off approved write, hand Arpan the exact command to run with
`!` rather than asking him to restart with the bypass on for the whole session.
**The S3 carve-out covers creating and configuring, not deleting:** every
`delete-*` is refused, `delete-bucket-cors` included, which matches *deleting
is still Arpan's* above.
`AWS_PROFILE` is pinned for every tool call in `.claude/settings.json`.

An infrastructure change is recorded in
[`docs/architecture/aws-deployment.md`](../docs/architecture/aws-deployment.md).
The bucket is tagged `ManagedBy=Manual`; nothing else tracks the drift.
