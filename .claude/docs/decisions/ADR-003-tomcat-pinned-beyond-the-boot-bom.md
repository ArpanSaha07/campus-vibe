# ADR-003 — Tomcat is pinned past the Boot BOM until a parent catches up

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-09-07
**Raised by:** the knowledge-base audit. The decision was taken on 2026-09-03
while fixing [BUG-035](../../bugs/fixed_bugs.md#bug-035); this records it,
because a property override with no ADR reads as an accident to whoever finds
it next.
**Approved by:** — (pending)
**Implemented in:** `backend/pom.xml` `<properties>` — already shipped

## Context

`tomcat-embed-core` appears nowhere in `backend/pom.xml`. It arrives
transitively through `spring-boot-starter-web`, and its version is dictated by
whatever `spring-boot-starter-parent` sets `<tomcat.version>` to.

Twice now, a build that was green went red with nothing in this repository
having changed, because new advisories were published against the pinned
version and the Trivy gate in `_docker.yml` fails on fixable CRITICALs:

- [BUG-019](../../bugs/fixed_bugs.md#bug-019) (2026-08-07) — four CRITICALs.
  Fixed by moving the parent 3.5.5 → 3.5.16, and recorded at the time that the
  parent version was *the only lever*, because overriding `<tomcat.version>` by
  hand would leave the rest of the tree on 3.5.5's matrix.
- [BUG-035](../../bugs/fixed_bugs.md#bug-035) (2026-09-03) — three CRITICALs in
  `tomcat-embed-core` 10.1.55, all fixed at 10.1.58.

Two occurrences from newly published advisories rather than newly reached code
makes this a property of pinning a framework, not an incident. And the lever
BUG-019 relied on is gone: **3.5.16 is the newest 3.5.x published**, so there is
no parent above it short of a major.

## Options considered

### Bump the parent again, as BUG-019 did

Not available. There is no 3.5.x above 3.5.16.

### Move to Spring Boot 4.0.x

The only parent above 3.5.16. It fails **both** CI tiers as of 2026-09-03 —
Dependabot `#17`, tracked at `todo.md:224`. Taking a framework migration as a
CVE remedy is exactly what BUG-019 refused to do, and that refusal still holds:
the migration is worth doing on its own schedule, not under advisory pressure.

### Suppress the three findings in the Trivy gate

Rejected. The gate is the only thing that caught either occurrence, both times
before release. A suppression outlives the CVE it was written for and silences
the next one too.

### Override `<tomcat.version>` in the child pom — chosen

Spring Boot's own documented mechanism. The BOM declares all four
`tomcat-embed-*` artifacts at that single property, so a child override moves
them together rather than desynchronising the set — which is the specific
failure BUG-019 was worried about when it called the override unsafe. That
worry was correct for a stale parent and does not apply to a parent that is
current in every other respect.

## Decision

`<tomcat.version>10.1.59</tomcat.version>` in `backend/pom.xml` `<properties>`,
with the parent left at 3.5.16.

**10.1.59, not the 10.1.58 that every advisory names.** 10.1.58 was never
published to Maven Central — the line runs 55, 56, 57, 59, and the `10.1.58/`
directory returns 404. Copying the fixed-version number out of the scanner
report produces a build that cannot resolve, with an error that says nothing
about why.

## Consequences

- **Dependabot will not maintain this.** It bumps declared dependencies, not a
  property that overrides a BOM, so the pin goes stale silently. The Trivy gate
  is the only backstop, and it runs on a Docker build rather than every push.
- The parent `<version>` comment had to be corrected in the same change: it
  claimed 3.5.16 was the floor for the Trivy gate, which pointed the next reader
  at a lever that no longer moves.
- **Drop the override once a parent manages 10.1.58 or newer, and not before.**
  Removing it while the BOM still says 10.1.55 quietly reintroduces three
  CRITICALs, which is why the condition is written on the property itself.

## Revisit when

A 3.5.x above 3.5.16 ships, or Spring Boot 4 passes both CI tiers — whichever
comes first. Either one makes the override removable, and leaving a stale
override in place is its own hazard.
