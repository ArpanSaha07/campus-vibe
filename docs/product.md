# CampusVibe — product scope

**Code as of:** `2132063` · checked against the routes, [`tasks-completed.md`](TODO/tasks-completed.md), [`todo.md`](TODO/todo.md) and the controllers, 2026-11-24.

What the product is meant to be, area by area, and how much of each exists. The
overview and the roles are in [`CLAUDE.md`](../.claude/CLAUDE.md); *what is next* is in
[`STATUS.md`](STATUS.md); *why the code is shaped this way* is in
[`architecture/`](README.md). This file answers only **is this feature a thing
we have, a thing we decided to build, or neither** — which is the question that
otherwise gets answered by guessing.

Shipped means it works end to end against the running stack. Planned means it is
in [`todo.md`](TODO/todo.md) with a priority; nothing here is a promise. An
idea is neither: raised, not decided, and listed under
[Ideas — not decided](#ideas--not-decided) at the end.

---

## Public website

**Shipped.** Homepage with a hero banner slider, category section, event card
sections, a club promotion section and the AI planner card: a prompt box with
suggestion chips, where a signed-out visitor's prompt is kept while they are
asked to sign in. `/events` lists upcoming events and, with `?q=`, shows search
results for events and clubs together; `/clubs` is a grid of every club. The
event page (Server Component, real `not-found`/`error` boundaries) carries its
photos, Save, Share and an Add to Google Calendar link. The club page, rebuilt
2026-09-16, has Upcoming and Past event tabs from real data, a Follow button and
contact links including LinkedIn and Linktree. An event card's Save (the heart)
and Share show on touch devices too ([BUG-062](bugs/fixed_bugs.md#bug-062)).
About, Terms of Service and Privacy Policy pages. Responsive throughout, under
the *ticket stock* direction in [`design-guidelines.md`](design-guidelines.md).

**Planned.** Like and Share counts: neither is stored today, so an event shows
no count of either. Event *categories* on the public site were dropped
deliberately — events carry formats and topics, not a category
([ADR-001](decisions/ADR-001-three-taxonomy-vocabularies.md)).

## Authentication

**Shipped.** Email + password and Google sign-in, both through one modal reached
at `/?auth=<view>`; JWT issuing and per-request verification, bcrypt at a pinned
cost, rate limiting and account lockout, password reset and email verification
end to end — [`authentication.md`](architecture/authentication.md). Google
sign-in works in production since 2026-09-15
([BUG-057](bugs/fixed_bugs.md#bug-057)).

**Planned.** Passwordless email-code login and persistent login
([todo.md › Backend / Features](TODO/todo.md#backend--features)). Route
protection on the frontend is built but never executes
([BUG-003](bugs/bugs.md#bug-003)) and the JWT transport decision —
`localStorage` versus an httpOnly cookie — is still open.

## User features

**Shipped.** Save (the heart) and RSVP, from a card, the event page or the
planner; following a club, where a signed-out click raises a sign-up prompt and
writes nothing; `/my-events` with Upcoming and Past tabs and `/my-clubs`;
Google Calendar export (client-side, no backend, with the event's real end
time); `/invitations`, where a person accepts or declines an invitation to
administer a club or an offer of a club's ownership; and the profile:
`/profile` plus the settings sections at `/profile/edit` (edit profile,
program, interests, notifications, account), persisted through a full-replace
`PUT` with a slug-keyed interest catalogue —
[`user-profiles.md`](architecture/user-profiles.md). The planner ranks events by
a person's saved interests.

**Planned.** Notifications, and with them the notification preferences: the
switches on `/profile/edit/notifications` are saved, but nothing reads them and
no reminder, announcement or digest email is ever sent. Changing an account's
email address (needs a confirm-the-new-address round trip, since the address is
the login identifier); account closure, which has no endpoint and cannot simply
delete an owner's rows — its confirmation panel is built with the button
disabled.

## Club dashboard

**Shipped.** Anyone signed in can propose a new club at `/create-club`, contact
links included, for a platform admin to approve; a platform admin creates one
directly from the same page and becomes its owner. The club's official email is
seeded from the contact email the form collects. `/manage` picks a club when a
person manages more than one; `/manage/[clubId]`, with per-request
authorisation, has a Club tab (details, interest tags, logo and banner), an
Events tab (create, edit, delete, up to ten photos, choose the banner photo),
the Administrators tab (invite by address, remove, cancel), ownership transfer,
and an Activity tab over an append-only audit log —
[`club-administration.md`](architecture/club-administration.md). Every event
has a required end, at most 14 days after its start, entered in Montreal time;
the dashboards file an event as past once it ends (2026-09-16).

**Planned.** **Events imported from a club's Instagram page** — the next big
feature: a club's posts become events on that club's page. A form for claiming
an existing club: the backend endpoint and the `/admin` approval exist, but no
page lets a person send a claim. Event lifecycle status (`DRAFT` / `PUBLISHED` /
`ARCHIVED`), whose trap is that *every* public read path must filter to
`PUBLISHED`; deleting, archiving or deactivating a club (CEM-04). Items 6 and
11–15 of the governance spec
([`club_admin_governance.md`](architecture/club_admin_governance.md)) are unbuilt.

## Admin dashboard

**Shipped.** `/admin` holds one Pending requests list, oldest first, merging
club claims and club proposals, each with Approve and Reject, plus a Create a
club control. Platform admins bypass club-scoped checks, can manage every club
and alone set a club's `official_email`; approving a club-admin request writes
the first `CLUB_OWNER` assignment; the admin account itself arrives from the
bootstrap runner under the `dev` profile —
[`user-roles.md`](architecture/user-roles.md).

**Planned.** Managing users and moderating events
([todo.md › Backend / Features](TODO/todo.md#backend--features)).

## Search

**Shipped.** A search bar whose dropdown lists matching events and clubs, with
a See all results link to `/events?q=`. Hybrid search over events and clubs —
keyword rank plus OpenAI embeddings in pgvector — with per-IP budget, a
query-length cap and a query-embedding cache; taxonomy tables joined into the
query ([`search.md`](architecture/search.md), a pre-implementation note).

Since 2026-09-16 an event appears in search until it **ends**, so one that is
running is still found ([ADR-020](decisions/ADR-020-event-attendable-until-its-end-time.md)).

**Planned.** The semantic half is not yet trustworthy
([BUG-001](bugs/bugs.md#bug-001)), all 8 clubs still have a null embedding
pending a `POST /api/v1/search/reindex` backfill, and a club's interest tags are
not indexed into its embedding at all
([todo.md › AI & Search](TODO/todo.md#ai--search)).

## AI planner

**Shipped, live in production since 2026-11-23.** `/planner` is a chat page:
saved chats in a sidebar (at most 15 per person, the least recently active
deleted to make room, with a warning first), 15 messages a day across all
chats, and a streamed answer grounded in events that have not ended — a short
intro, one row of real event or club cards, a line per card and follow-up
prompts. It also acts for the person: follows and unfollows clubs, RSVPs and
cancels, saves and unsaves events, and offers an Add to Google Calendar link,
each through a server-validated tool call with a status line per step
([ADR-023](decisions/ADR-023-planner-acts-through-server-validated-tool-calls.md),
[`ai-planner.md`](architecture/ai-planner.md),
[spec](specs/2026-11-16-planner-agent.md)).

**Planned.** Nothing decided. Event summaries, event description generation,
recommendations and moderation help are P3 candidates in
[todo.md › AI & Search](TODO/todo.md#ai--search).

---

## Ideas — not decided

Features raised but not decided. An idea here has **no todo item and no
priority**, and no session builds it or treats it as agreed. Deciding it is
Arpan's: it then moves to the **Planned** paragraph of its area above (or a new
area), gains a [`todo.md`](TODO/todo.md) item with a priority, and its line
here is deleted. Rejecting it deletes the line too, or keeps it with the
reason, if the reason will matter when someone raises it again.

One line each: the idea, who raised it and when, and any open question already
known.

- **Adding friends** — students connect with each other on the platform. Raised
  by Arpan, 2026-11-16. Open: what being friends gives a student (seeing who is
  going to an event, shared plans, the planner suggesting events friends
  attend), whether it is a mutual request or a one-way follow, and what a
  student can hide. Would likely be a new **Social** area, with its own data
  model and an ADR at its `/start`.
