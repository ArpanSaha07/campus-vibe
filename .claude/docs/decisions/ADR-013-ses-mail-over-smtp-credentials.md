# ADR-013 — SES mail is sent over SMTP with SMTP credentials, not the SES API through the instance role

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-12
**Raised by:** connecting SES for the first production deployment —
[`connecting-ses.md`](../architecture/connecting-ses.md). Chosen by Arpan on
2026-09-12, alongside keeping secrets in Elastic Beanstalk environment
properties for that deployment.
**Approved by:** — (pending)
**Implemented in:** — not yet built. No code changes; `connecting-ses.md` §7–§8
are the whole implementation.

## Context

The backend already has two mail senders. `MailConfig` picks `SmtpMailSender`
when `spring.mail.host` is set and `LoggingMailSender` otherwise, and
`application.yml` already enables SMTP authentication and STARTTLS. Nothing in
the code talks to SES specifically.

SES offers two ways in. Its SMTP interface authenticates with **SMTP
credentials**, which SES derives from an **IAM user access key**. Its API
authenticates like any AWS SDK call, so on Elastic Beanstalk it can use the
instance role, the way S3 already does.

Two standing rules point one way. [`rules/aws-handling.md`](../../rules/aws-handling.md)
says never to request, create, display, store or commit AWS access keys, and
guide §9 and §22 ask for roles instead of long-lived credentials. The
first-deployment principle points the other: Arpan wants the fewest moving
parts before anything has run in production, which is why secrets stay in
environment properties rather than Secrets Manager.

## Options considered

### A. The SES v2 API through the instance role

A new `SesMailSender` on `software.amazon.awssdk:sesv2`, selected by a property
in `MailConfig`, with `ses:SendEmail` on the role scoped to the domain identity.
No key exists anywhere. Each send returns a message id and a typed error, which
is the failure visibility the queue already asks for. The client is synchronous,
so [ADR-008](ADR-008-netty-pinned-beyond-the-boot-bom.md)'s netty trigger does
not fire.

**Rejected for the first deployment.** It is a new class, a new dependency, new
tests and a new selection path, on a unit that otherwise needs no code at all.

### B. SMTP credentials — chosen

No Java change. Five environment properties and the existing sender.

### C. Defer mail

Leave `LoggingMailSender` in production. Rejected: password reset and email
verification would be unusable, because the links would exist only in a log
nobody reads.

## Decision

**Production mail goes through SES's SMTP interface with SES SMTP credentials.**
Because that means a long-lived access key, the key is fenced:

1. **Arpan creates it, in the SES console.** A session never does; the guard
   hook refuses `iam create-access-key` in any case.
2. **The IAM user may send and nothing else:** `ses:SendRawEmail` on the
   `campusvibe-mcgill.com` identity, replacing the broader managed policy the
   console attaches.
3. **The values live in two Elastic Beanstalk properties and a password manager**
   — never in a file, a chat or `.claude/`.
4. **`rules/aws-handling.md` carries this as a named exception**, so the rule
   and the account keep agreeing.

## Consequences

**Easier.** Mail works on the first deployment with configuration alone, and
local development is unchanged.

**Harder.** A long-lived key now exists, which is exactly what guide §9 and §22
avoid. If it leaks, the holder can send mail as the domain up to the sending
quota — reputation damage rather than data loss. Nothing expires it; rotation is
manual. A failed send is visible only in the application log, and there is no
message id to correlate a bounce with.

**Foreclosed.** Nothing. Option A remains a contained change behind `MailConfig`.

## Revisit when

- **A second environment exists**, which would mean a second key.
- **The key is suspected leaked** — rotate it, then reconsider this.
- **Per-message tracking is wanted**: message ids, bounce correlation,
  configuration-set events.
- **Secrets Manager is adopted, or the SES SDK arrives for another reason** —
  at that point the instance role is nearly free and the key buys nothing.
