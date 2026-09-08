# Architecture Decision Records

An ADR records **one decision at the moment it was made**, and is then frozen. A
change of mind gets a *new* ADR that supersedes it — never an edit, because
editing destroys the record of what was believed at the time. The template, the
numbering rule and the evidence standard live in
[`adr.md`](../../skills/implementation-docs/adr.md).

**Status starts at `Proposed`, and only Arpan moves it to `Accepted`.** An
`Accepted` record he never approved is a process failure, not a shortcut.

**Adding a record without adding its row here makes it invisible** — nobody
reads a folder, they read an index.

---

## The records

| # | Date | Status | Decides | Implemented in |
|---|---|---|---|---|
| [ADR-001](ADR-001-three-taxonomy-vocabularies.md) | 2026-08-20 | 📝 Proposed — awaiting Arpan | Three naming vocabularies and only three: one shared `interest_catalogue` behind student interests, club tags **and** event topics · 13 `club_categories` · 22 events-only `event_formats` · **events get no category taxonomy at all** | [`user-profiles.md`](../architecture/user-profiles.md) — the interests half only; the club and event halves are unbuilt |
| [ADR-002](ADR-002-club-id-is-an-assigned-slug.md) | 2026-09-07 | 📝 Proposed — awaiting Arpan | `Club` keeps its assigned slug id and implements `Persistable`, so `save()` stops silently merging and handing back a different instance · rejected a surrogate id (nine foreign keys, a route and the DTO contract) and rule-only mitigation | — not yet built |
| [ADR-003](ADR-003-tomcat-pinned-beyond-the-boot-bom.md) | 2026-09-07 | 📝 Proposed — awaiting Arpan | `<tomcat.version>` is overridden past the Boot BOM until a parent manages 10.1.58 or newer · rejected a Boot 4 migration as a CVE remedy and a Trivy suppression outright | `backend/pom.xml` — shipped 2026-09-03 |

**ADR-001 holds seven decisions rather than one**, against `adr.md`'s
one-per-file rule, and argues the exception in its own header: they are a single
interlocking choice about how this platform names things, so each is unreadable
alone. A reversal of any one of them gets its own numbered ADR.

---

## Waiting to be written

Each of these constrains future work and has a real alternative, which is the
`adr.md` bar. None is recorded anywhere durable today — they sit in a queue item
or a bug that will be closed and lost.

| Decision | Forced by | Where it sits today |
|---|---|---|
| How the JWT reaches the browser — `localStorage` or an httpOnly cookie | [BUG-003](../../bugs/bugs.md#bug-003) — frontend route protection never executes, and two of its three stated causes may be stale after the Next 16 upgrade | `bugs.md`, open |
| Whether the creator of a club becomes its `CLUB_OWNER` at create, or club creation moves behind admin approval | The open **P0** in [`todo.md`](../../TODO/todo.md): `POST /api/v1/clubs` grants the creator nothing, so they get a 403 on their own logo upload | `todo.md`, stated as *a decision, not code* |
| Whether to adopt shadcn/ui alongside the bespoke Tailwind v4 tokens | New UI surfaces keep re-deciding it per component | Nowhere |
| The deployment target and container registry | Elastic Beanstalk config exists under `docker/`; nothing is provisioned | [`CampusVibe_AWS_Deployment_Guide.md`](../architecture/CampusVibe_AWS_Deployment_Guide.md), as a plan rather than a decision |

---

## Decided without an ADR

Recorded where the decision was made rather than here, because each was forced
by a defect rather than chosen between attractive alternatives. Listed so a
later session does not read the silence as *nobody decided*.

- **`saveAndFlush`, never `save`, in `ClubService`** — [BUG-034](../../bugs/fixed_bugs.md#bug-034).
  `indexClub` writes through `JdbcTemplate`, which neither flushes the persistence
  context nor checks its update count, so an unflushed insert silently indexed
  nothing.
- **Set a club's taxonomy *before* `saveAndFlush`, rather than tagging the
  returned instance after** — [BUG-037](../../bugs/fixed_bugs.md#bug-037). The
  reordering was chosen over re-tagging because `Club.id` is assigned, so `save`
  goes through `em.merge()` and returns a *different* managed instance; the
  argument stays detached. The underlying id strategy is [ADR-002](ADR-002-club-id-is-an-assigned-slug.md).
- **`ROLE_CLUB_ADMIN` deleted outright in `V14`** —
  [`user-roles.md`](../architecture/user-roles.md), which records the rejected
  option and its cost: a role claim in a JWT outlives the access it names, so a
  removed administrator keeps working access until their token expires.
