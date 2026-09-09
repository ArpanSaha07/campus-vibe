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

**Two ways in, one rulebook.** The AWS CLI, and the aws-core MCP tool
`aws___run_script`, which runs arbitrary boto3 and never passes through Bash.
Everything below binds to both.

## What is already there

- **`campusvibe-prod-media`** — the media bucket, currently empty. Public access
  blocked on all four, `BucketOwnerEnforced`, SSE-S3 with bucket keys, CORS
  `GET,PUT` from the prod origin only, no bucket policy. **No versioning and no
  lifecycle**, so an overwritten key is gone — which is what gives BUG-039 its
  edge.
- **`elasticbeanstalk-ca-central-1-<account>`** — created and owned by Elastic
  Beanstalk. Read it if you must; never write to it.
- **`CampusVibe-Backend-Prod`** on Elastic Beanstalk, whose EC2 role carries an
  inline grant of `GetObject`/`PutObject`/`DeleteObject` on
  `campusvibe-prod-media/*` and nothing wider.
- The backend reads `AWS_S3_BUCKET_CLUBS` and `AWS_S3_BUCKET_EVENTS`
  (`application.yml:50-51`) and the environment sets neither; it sets
  `S3_BUCKET_NAME`, which no code reads. Do not wire S3 believing prod works.

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
`AWS_PROFILE` is pinned for every tool call in `.claude/settings.json`.

An infrastructure change is recorded in
[`docs/architecture/aws-deployment.md`](../docs/architecture/aws-deployment.md).
The bucket is tagged `ManagedBy=Manual`; nothing else tracks the drift.
