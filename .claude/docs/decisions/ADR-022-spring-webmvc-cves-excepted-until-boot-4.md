# ADR-022 — Two Spring MVC CVEs are excepted from the Trivy gate, scoped and expiring, until Spring Boot 4

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-11-07
**Raised by:** PR #71 (`develop` → `main`). Its Docker job failed the Trivy gate
on four fixable CRITICALs. Two were `next` 16.3.8 in the frontend, fixed the
same day by moving the lockfile to 16.4.5. The other two are the subject of
this record. Arpan accepted the recommendation in session: the exception
first, then the migration.
**Approved by:** — (pending)
**Implemented in:** — not yet built. Nothing is suppressed until this is
accepted.

## Context

**What the gate found.** `app/app.jar` in `campusvibe-backend` carries
`org.springframework:spring-webmvc` 6.2.19, managed by
`spring-boot-starter-parent` 3.5.16. Trivy 0.74.0 reports two fixable
CRITICALs against it, both with 7.0.9 as the only fixed version it names:

- **CVE-2026-47884.** `XsltView` loads a stylesheet from a path the caller
  can influence: SSRF, and RCE because the stylesheet executes. It needs a
  catch-all `/**` mapping that renders a view without an explicit view name.
- **CVE-2026-47890.** Server-Sent Events corrupt the stream when used with
  view fragments, in Spring MVC and WebFlux.

**Severity is disputed.** NVD and OSV score both 9.8. Third-party write-ups say
Spring's own advisories rate the first Medium and the second Low. Spring's
advisory pages were not read when this was written; confirm there before
acceptance.

**No public fix exists on the line this repository is on.**
- `spring-webmvc` 6.2.19 is the newest 6.2.x on Maven Central (read
  2026-11-07). The reported 6.2.20 fix is commercial support only.
- `spring-boot-starter-parent` 3.5.16 is the newest 3.5.x, as it already was
  for [ADR-003](ADR-003-tomcat-pinned-beyond-the-boot-bom.md).
- So there is no parent to bump and no version property to override: the
  lever ADR-003 and [ADR-008](ADR-008-netty-pinned-beyond-the-boot-bom.md)
  used has nothing to point at. The only public fix is Spring Framework 7.0.x
  (7.0.10 is published), which means Spring Boot 4.

**Neither vulnerable feature is used here** (searched 2026-11-07):
- There is no `XsltView`, no `ViewResolver`, no `ModelAndView` and no template
  engine anywhere under `backend/`. The backend is a JSON API.
- The one SSE endpoint, the planner reply (`PlannerController.java:83`), sends
  named events whose data is JSON (`SseReplySink.java:94`), never a view
  fragment.

**The red gate has a cost of its own.** `CI` is a required check on `main`. The
same red gate blocks the `next` 16.4.5 fix, and the live Vercel site builds
from `main` with two unauthenticated Next.js RCEs. Production's backend is
paused (`rules/aws-handling.md`), so the Spring findings are not reachable
there today either way.

## Options considered

### A. Migrate to Spring Boot 4 now

The real fix: Spring Framework 7.0.10. **Not chosen as the immediate step.**
- It is a framework major: Jackson 3, Spring Security 7, and whatever else
  Dependabot `#17` failed on in both CI tiers as of 2026-09-03.
- That makes it a unit of its own through `/start`, measured in days, while
  `main` stays blocked.
- ADR-003 refused a framework migration *under advisory pressure*; that
  reasoning still holds for the timing.

It is chosen as the second step, below.

### B. A scoped, expiring exception in the gate — chosen, as the first step

A `.trivyignore.yaml` entry per CVE, each pinned three ways:
- **by id:** only these two CVEs;
- **by package version:** `purls` set to
  `pkg:maven/org.springframework/spring-webmvc@6.2.19`, so any other version,
  or any other package, is still gated;
- **by date:** `expired_at`, after which Trivy stops honouring the entry and
  the gate fails again by itself.

Each entry's `statement` carries the not-used evidence above.

**This departs from ADR-003, which rejected suppression outright**, on the
ground that *a suppression outlives the CVE it was written for and silences the
next one too*. The three pins answer that objection directly:
- a new CVE has a new id, so it is still gated;
- a version change drops out of the `purls` scope;
- the expiry date ends the exception without anyone remembering to.

ADR-003 also had a lever this case lacks: Tomcat 10.1.59 existed.

### C. Paid extended support for Spring Framework 6.2

A commercial 6.2.x build (for example HeroDevs) carries the fix today.
**Not chosen:** a recurring cost, and a non-Central artifact source on a
public repository's build, for a project with no users while paused.

### D. Leave the gate red until Boot 4 lands

**Not chosen:** it holds the Next.js RCE fix off the live site for the length
of a framework migration, to guard against two findings the code cannot reach.

## Decision

1. **Except CVE-2026-47884 and CVE-2026-47890** in a repository-root
   `.trivyignore.yaml`:
   - scoped to `pkg:maven/org.springframework/spring-webmvc@6.2.19`;
   - `expired_at` **2026-12-31** — Arpan's to change at acceptance;
   - a `statement` naming this ADR and the not-used evidence.
2. **Pass `--ignorefile .trivyignore.yaml`** to both `trivy image` calls in
   `.github/workflows/_docker.yml`, the HIGH+CRITICAL report and the CRITICAL
   gate, so the report and the gate agree.
3. **Migrate to Spring Boot 4 before the expiry**, as its own unit through
   `/start`. That migration deletes both entries; the file goes with them if
   nothing else is in it.

## Consequences

**Easier.**
- `main` can take the `next` 16.4.5 fix as soon as this is accepted.
- The gate keeps failing on every other fixable CRITICAL, in both images.

**Harder.**
- The first exception in this repository, so the `.trivyignore.yaml` file now
  exists for the next person to reach for. Its scope and expiry are the
  precedent, and anything broader needs its own ADR.
- Two findings rated 9.8 by NVD ship in the backend jar until the migration.
  That is acceptable only because the features they need are absent.
- A deadline: Spring Boot 4 by 2026-12-31, or the gate goes red again on its
  own. Dependabot `#17` already failed both tiers once, so the migration has
  known breakage to work through.

**Foreclosed.** Nothing. Deleting two entries restores the gate exactly as it
was.

## Revisit when

- **Any view rendering arrives in the backend**: a `ViewResolver`, a template
  engine, `XsltView`, or SSE carrying view fragments. The not-used argument is
  void the moment that lands, so the exception ends with it.
- **The expiry date arrives** without Boot 4 merged — extend by a new decision,
  never by quietly moving the date.
- **Spring publishes a free 6.2.x fix** to Maven Central, which would make a
  version override possible and the exception unnecessary.
- **Spring's own advisories rate either CVE higher** than this record assumes,
  or show a path that does not need the features above.
