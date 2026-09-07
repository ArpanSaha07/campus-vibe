# CampusVibe — product scope

**Code as of:** `0fc7773` · checked against [`tasks-completed.md`](../TODO/tasks-completed.md) and the architecture docs, 2026-09-07.

What the product is meant to be, area by area, and how much of each exists. The
overview and the roles are in [`CLAUDE.md`](../CLAUDE.md); *what is next* is in
[`STATUS.md`](../STATUS.md); *why the code is shaped this way* is in
[`architecture/`](README.md). This file answers only **is this feature a thing
we have, a thing we decided to build, or neither** — which is the question that
otherwise gets answered by guessing.

Shipped means it works end to end against the running stack. Planned means it is
in [`todo.md`](../TODO/todo.md) with a priority; nothing here is a promise.

---

## Public website

**Shipped.** Homepage with a hero banner slider, category section, event card
sections and a club promotion section; the event page (Server Component, real
`not-found`/`error` boundaries) and the club page; responsive throughout, under
the *ticket stock* direction in [`design-guidelines.md`](../design-guidelines.md).

**Planned.** The AI planner card is the homepage entry point the planner feature
still needs ([todo.md › AI & Search](../TODO/todo.md#ai--search)). Event
*categories* on the public site were dropped deliberately — events carry formats
and topics, not a category ([ADR-001](decisions/ADR-001-three-taxonomy-vocabularies.md)).

## Authentication

**Shipped.** Email + password and Google sign-in, both through one modal reached
at `/?auth=<view>`; JWT issuing and per-request verification, bcrypt at a pinned
cost, rate limiting and account lockout, password reset and email verification
end to end — [`authentication.md`](architecture/authentication.md).

**Planned.** Passwordless email-code login and persistent login
([todo.md › Backend / Features](../TODO/todo.md#backend--features)). Route
protection on the frontend is built but never executes
([BUG-003](../bugs/bugs.md#bug-003)) and the JWT transport decision —
`localStorage` versus an httpOnly cookie — is still open.

## User features

**Shipped.** Bookmarks and RSVPs, following a club, `/my-events` and
`/my-clubs`, Google Calendar export (client-side, no backend), and the profile:
`/profile` plus five settings sections at `/profile/edit`, persisted through a
full-replace `PUT` with a slug-keyed interest catalogue —
[`user-profiles.md`](architecture/user-profiles.md).

**Planned.** Notifications; changing an account's email address (needs a
confirm-the-new-address round trip, since the address is the login identifier);
account closure, which has no endpoint and cannot simply delete an owner's rows.

## Club dashboard

**Shipped.** `/manage/[clubId]` with per-request authorisation, the
Administrators tab (invite by address, remove, cancel), ownership transfer, an
append-only audit log and an Activity tab, and the club create form —
[`club-administration.md`](architecture/club-administration.md).

**Planned.** `EventService.update` — there is no update path at all, so events
cannot be edited and their embeddings go stale
([BUG-006](../bugs/bugs.md#bug-006)); event delete; banner and logo upload
reachable from the dashboard; event lifecycle status (`DRAFT` / `PUBLISHED` /
`ARCHIVED`), whose trap is that *every* public read path must filter to
`PUBLISHED`. Items 6 and 11–15 of the governance spec
([`club_admin_governance.md`](architecture/club_admin_governance.md)) are unbuilt.

## Admin dashboard

**Shipped.** Platform admins bypass club-scoped checks and can manage every
club; approving a club-admin request writes the first `CLUB_OWNER` assignment;
the admin account itself arrives from the bootstrap runner under the `dev`
profile — [`user-roles.md`](architecture/user-roles.md).

**Planned.** Creating clubs from an admin surface, managing users, moderating
events, setting a club's `official_email`
([todo.md › Club governance](../TODO/todo.md#club-governance)).

## Search

**Shipped.** Hybrid search over events and clubs — keyword rank plus OpenAI
embeddings in pgvector — with per-IP budget, a query-length cap and a
query-embedding cache; taxonomy tables joined into the query
([`search.md`](architecture/search.md), a pre-implementation note).

**Planned.** The semantic half is not yet trustworthy
([BUG-001](../bugs/bugs.md#bug-001)), all 8 clubs still have a null embedding
pending a `POST /api/v1/search/reindex` backfill, and a club's interest tags are
not indexed into its embedding at all
([todo.md › AI & Search](../TODO/todo.md#ai--search)).

## AI planner

**Not built.** Only the foundation exists — the `com.campusvibe.ai` package and
`OpenAiProperties` for key handling
([`llm-api-key-management.md`](architecture/llm-api-key-management.md)).
`LlmClient` / `PromptTemplateService` / `AIController` are deliberately *not*
scaffolded until the first generative feature lands; embeddings are not
generative. The intended experience is written up in
[`ai-planner.md`](architecture/ai-planner.md), which predates any code.
