# ADR-008 — Netty is pinned past the Boot BOM, not excluded

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-11
**Raised by:** [BUG-050](../../bugs/fixed_bugs.md#bug-050) — the Trivy gate
blocked [PR #45](https://github.com/ArpanSaha07/campus-vibe/pull/45) on a
CRITICAL in `netty-handler`. Decided by Arpan on 2026-09-11.
**Approved by:** — (pending)
**Implemented in:** `backend/pom.xml` `<properties>` — 2026-09-11

## Context

`io.netty` appears nowhere in `backend/pom.xml`. It reaches the jar through one
path only — `software.amazon.awssdk:s3` 2.20.26 → `netty-nio-client`, the SDK's
**async** HTTP client — and its version is set by `spring-boot-starter-parent`
3.5.16, whose BOM imports `netty-bom` at `4.1.135.Final`.

The application never uses that client. `s3/S3Config.java:18-26` builds the
synchronous `S3Client`, which runs on the SDK's Apache client; nothing builds an
`S3AsyncClient`. So netty is shipped, scanned and never executed.

CVE-2026-75595 (CRITICAL, `netty-handler`, fixed in 4.1.137.Final) was published
after the code was written, and the Trivy gate in `_docker.yml`, which fails on
fixable CRITICALs, turned PR #45 red with nothing in this repository having
changed. It is the third time a BOM-managed transitive version has done this
([BUG-019](../../bugs/fixed_bugs.md#bug-019),
[BUG-035](../../bugs/fixed_bugs.md#bug-035)), and the parent-version lever is
still exhausted: 3.5.16 is the newest 3.5.x
([ADR-003](ADR-003-tomcat-pinned-beyond-the-boot-bom.md)).

## Options considered

### Override `<netty.version>` in the child pom — chosen

The lever [ADR-003](ADR-003-tomcat-pinned-beyond-the-boot-bom.md) already uses for
Tomcat, and Spring Boot's documented mechanism. The BOM imports `netty-bom` at
that single property, so all ten `io.netty` artifacts move together — confirmed
with `dependency:tree -Dincludes=io.netty` after the change. One line, no
behavioural change, and a pattern the next reader has already seen once.
4.1.137.Final was checked on Maven Central before pinning, because ADR-003's
advisory named a Tomcat version that was never published.

Cost: it is a second property Dependabot will not maintain, and it has to be
removed by hand once a parent catches up.

### Exclude `netty-nio-client` from the `s3` dependency

Removes netty from the jar entirely. Because nothing executes it, this is the
more honest fix, and it ends netty advisories failing the gate for good rather
than until the next one.

Not taken, because the failure it trades for is silent until runtime: the day
anyone builds an `S3AsyncClient` — the natural choice for streaming large media,
which the presigned-upload work may reach for — it fails with a missing class
rather than a compile error. The override keeps that path working and costs one
property.

### Suppress the finding in the Trivy gate

Rejected for the reason ADR-003 gives: the gate is the only thing that catches
these, and a suppression outlives the CVE it was written for.

## Decision

`<netty.version>4.1.137.Final</netty.version>` in `backend/pom.xml`
`<properties>`, beside `<tomcat.version>`, with the parent left at 3.5.16. The
comment on the property names the CVE, the path netty arrives by, the rejected
exclusion and the removal condition.

## Consequences

- **Two BOM overrides now, both invisible to Dependabot.** The Trivy gate is the
  only backstop for either, and it runs on a Docker build rather than on every
  push.
- **Netty stays in the jar unused**, so future netty advisories will keep
  failing the gate for a library that never runs. Each one is this same one-line
  bump.
- **Drop the override once a parent manages 4.1.137 or newer**, and not before —
  removing it while the BOM says 4.1.135 quietly reintroduces the CRITICAL.

## Revisit when

- A 3.5.x above 3.5.16 ships, or Spring Boot 4 passes both CI tiers — the same
  trigger as ADR-003, and the override becomes removable.
- A second netty advisory fails the gate. Twice for a library that is never
  executed is the point at which excluding `netty-nio-client` stops being the
  riskier option.
- Anything adds an `S3AsyncClient`, which makes netty live code and settles the
  question the other way.
