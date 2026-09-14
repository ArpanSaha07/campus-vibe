# Product review — club and event management

**Code as of:** `10efaa8` · 2026-09-10 · branch `feature/club-governance`

**This is a dated snapshot, not a living document.** It is what club and event
management looked like on 2026-09-10, read from the code rather than from the
queue. It does not get maintained: when an item here is built, it is
[`tasks-completed.md`](../../TODO/tasks-completed.md) that records it, and this
file keeps saying what was true on the day it was written.

**It is also not a second queue.** [`todo.md`](../../TODO/todo.md) is the queue.
Items already there are linked, not restated; items marked **NEW** are gaps this
review found that nothing in the repo had recorded, and those are the ones that
need adding to `todo.md`.

## How to read an item

Each carries a stable id (`CEM-nn`), a priority on the repo's scale
(**P0** blocking · **P1** next up · **P2** planned · **P3** backlog), and four
things: what exists today with the `file:line` proving it, what is missing, why
that matters to somebody using the product, and whether it is queued or **NEW**.

Twenty-seven gaps are recorded, and eleven of them wait on a product decision.
Those decisions are not guessed at here — they are collected in
[Decisions this review cannot make](#decisions-this-review-cannot-make), and each
one names the item it blocks.

Ids are stable and are never reused, which is why section B starts at CEM-10 with
no CEM-09: the number was left free when the sections were split, and renumbering
would break the references already written above it.

## The shape of the gap, in one paragraph

Club *governance* is largely built — who runs a club, how they are invited,
removed and replaced, and an audit log recording it
([`club-administration.md`](../architecture/club-administration.md), items 1–5
and 7–10 of the governance spec). Club and event *management* is not. A club can
be created and its administrators managed, and from that moment neither the club
nor its events can be changed by anyone: there is no club editor on any screen,
no event update path in the backend at all, no attendee list, no capacity
enforcement, and nothing that tells anybody that anything ever happened. The
governance layer answers *who is responsible for this club*; almost nothing yet
lets them act on it.

---

## A. Club management

### CEM-01 · P1 · A club cannot be edited after creation, from anywhere

*Queued — [`todo.md` › Frontend / Features](../../TODO/todo.md#frontend--features),
[BUG-043](../../bugs/bugs.md#bug-043). Listed here because several items below
fold into it.*

**Exists.** `PUT /api/v1/clubs/{id}` (`ClubController.java:106-108`), guarded by
`canManageClub`, and `ClubService.update` (`ClubService.java:136-167`) already
handles name, description, social links, category and interests correctly —
including the re-index-after-tags ordering. Logo and banner uploads exist too
(`ClubController.java:208-218`).

**Missing.** Any screen that calls it. The only frontend writer is
`updateClubSocialLinks` (`clubService.ts:159-169`), which sends one field; there
is no `updateClub`. `ManageSidebar.tsx:27-32` lists four sections — Overview,
Events, Administrators, Activity — and **none of them is the Club Page** that
§29 of the governance spec names.

**Why it matters.** Name, description, category, tags, logo and banners are all
fixed at the moment of creation, permanently. It also leaves
[ADR-004](../decisions/ADR-004-two-paths-create-a-club.md)'s own promise
unfulfilled: a proposal deliberately carries no logo because the requester was to
add one from `/manage/[clubId]` after approval, and that screen does not exist.
This is the single item most other work here waits behind.

### CEM-02 · P2 · The club update endpoint validates nothing · **NEW**

**Exists.** `ClubCreateRequest` is fully constrained and the controller applies
it — `@Valid` at `ClubController.java:88`, with `@Email` and `@Size` on the
record's fields.

**Missing.** The update half has neither. `ClubUpdateRequest.java` declares five
fields and not one constraint annotation, and `ClubController.java:108` takes
`@RequestBody ClubUpdateRequest` with **no `@Valid`**. So a club created through
a validated path can be renamed to an unbounded string immediately afterwards.

**Why it matters.** Nothing sends unbounded values today only because no editor
exists. CEM-01 is precisely the screen that will start sending them, so this is a
prerequisite of that work rather than a separate task. Note also that `PUT` here
has patch semantics — null means untouched, stated at `ClubUpdateRequest.java:8-10`
— which is worth keeping deliberate rather than letting an editor that posts the
whole form make it accidentally true.

### CEM-03 · P2 · A club's slug is its public URL and can never change · **NEW**

**Exists.** `Club.id` is the assigned slug (`Club.java:21`) and is what
`/clubs/{clubId}` addresses.

**Missing.** `ClubService.update` never touches it, and no endpoint does. A club
that renames itself keeps its original address forever, and there is no redirect
from an old slug to a new one.

**Why it matters.** Student clubs rename — a department changes, a merger
happens, a name was mistyped at creation. Today the visible name and the URL
drift apart permanently. Blocked on **D-3**.

### CEM-04 · P2 · Nothing can delete, archive or deactivate a club · **NEW**

**Exists.** Nothing. A grep of every `@DeleteMapping` in the backend returns
admin assignments, ownership transfers, events, saved events, RSVPs and followed
clubs — **there is no club delete at any level, including platform admin**.

**Missing.** Any way to remove a club, retire one that has folded, or take a
duplicate off the public listing.

**Why it matters.** Every club ever created is public and permanent. A duplicate
approved by mistake, a club created with a typo in its slug (which CEM-03 means
cannot be corrected either), a society that dissolves — all stay on `/clubs` and
in search indefinitely. It also removes the platform admin's stated recourse in
[ADR-004](../decisions/ADR-004-two-paths-create-a-club.md), whose option A was
rejected partly because *the platform admin's only recourse is to notice and
delete it afterwards* — that recourse does not exist. Blocked on **D-4**.

### CEM-05 · P3 · A club is public the instant it exists · **NEW**

**Exists.** Both creation paths write a live `clubs` row —
`ClubService.createOwnedBy` (`ClubService.java:85`) on the admin path, and
approval on the proposal path.

**Missing.** Any draft, unlisted or pending state for a club itself.

**Why it matters.** It bites hardest on the admin path, where the admin creates
the club and then fills it in: between those two moments a club with no logo, no
links and possibly a placeholder description is live on `/clubs` and in search.
Blocked on **D-7**.

### CEM-06 · P2 · Club-page edits and event changes are not audited

*Queued — [`todo.md` › Club governance](../../TODO/todo.md#club-governance),
items 9–10 follow-up. Restated because this review found the gap is wider than
recorded.*

**Exists.** The audit machinery is complete: `ClubAuditService.record`,
`recordAssignment` and `recordTransfer` (`ClubAuditService.java:51-91`), eleven
actions in `ClubAuditAction.java`, and `AuditEntityType.EVENT` at
`AuditEntityType.java:13`.

**Missing.** Call sites. Every one of the thirteen `record*` calls in the backend
is an assignment, a transfer, a creation or an official-email write —
`ClubService.update` (`:136`) records nothing at all, and `EventService` never
records anything, so **`AuditEntityType.EVENT` is an enum constant no code path
can ever write**.

**Why it matters.** A club with a stable team has a permanently empty Activity
tab, and §30 of the governance spec illustrates the log with exactly the entry
that cannot occur — somebody changing an event's location. Fold this into CEM-01
and CEM-10, both of which have to touch those methods anyway.

### CEM-07 · P2 · A club admin cannot resign · **NEW**

**Exists.** `DELETE /api/v1/clubs/{clubId}/admins/{assignmentId}`, guarded by
`isClubOwner` (`ClubAdminController.java:105-107`).

**Missing.** Any path by which an administrator removes themselves. Only the
owner can remove anyone, so an admin who has graduated, left the club, or was
added by mistake stays until the owner acts — and if the owner has gone silent,
indefinitely.

**Why it matters.** §38 of the governance spec is titled *Protect Against Former
Executives Retaining Access*, and this is that case from the other side: the
person who wants out cannot get out. It is also a smaller change than it looks,
since the assignment row and the audit action both already exist. Blocked on
**D-8**.

### CEM-08 · P1 · The official-email round trip, and a blocker worth re-checking

*Queued — [`todo.md` › Club governance](../../TODO/todo.md#club-governance),
item 6, half done.
[ADR-006](../decisions/ADR-006-official-email-verified-only-by-round-trip.md).*

**Exists.** More than the queue records. The address is now seeded at creation on
both paths and writable by a platform admin (`ClubAdminController.java:126-127`),
and the mail layer is **live, not pending** — `mail/MailSender.java` with
`SmtpMailSender` and `LoggingMailSender` behind it, already sending club-admin
invitations (`ClubAdminService.java:348`), ownership mail (`:513`) and a notice
to the official address itself (`:550`).

**Missing.** The verification round trip, so `official_email_verified_at` stays
NULL for every club by design.

**Why it matters here.** The queue records this as *blocked on AWS SES*, and that
is worth re-reading in light of the above: the interface, both implementations
and three live senders already exist, so what SES supplies is a production
provider, not the machinery. The round trip is testable end to end locally today
the way password reset already is, with the link in `docker compose logs backend`.
**Not a licence to change the decision** — ADR-006 forecloses an administrative
*mark as verified* control by name, and
[`rules/backend-clubs.md`](../../rules/backend-clubs.md) carries that as a rule.

---

## B. Event management

### CEM-10 · P1 · There is no event update path at all

*Queued — [`todo.md` › Backend / Features](../../TODO/todo.md#backend--features),
[BUG-006](../../bugs/bugs.md#bug-006).*

**Exists.** `EventService` has list, listByOrganizer, get, create, delete and
addImages (`EventService.java:30-70`). `EventController` mirrors it —
`@PostMapping`, `@DeleteMapping`, `@PostMapping /images`
(`EventController.java:77-106`).

**Missing.** `update`, on both sides. Not a screen this time: **the endpoint does
not exist**.

**Why it matters.** A typo in an event title is permanent. A room change means
deleting the event and creating a new one, which silently discards every RSVP
(CEM-14). And because `SearchIndexService` is only called on create, nothing
re-indexes an event that never changes — which is the part BUG-006 names.
Everything else in this section depends on this landing first.

### CEM-11 · P1 · An event has no lifecycle — no draft, no published, no archived

*Queued — [`todo.md` › Backend / Features](../../TODO/todo.md#backend--features),
with the migration shape and the read-path trap already written up there.*

**Exists.** `Event.java` has no status column, so
`/manage/[clubId]/events/page.tsx:47-64` splits on `dateTime` into upcoming and
past — the only lifecycle the data supports, and the file says so in its own
comment.

**Missing.** `DRAFT` / `PUBLISHED` / `ARCHIVED`, and therefore any way to draft
an event before announcing it or retire one without destroying it.

**Why it matters.** A club cannot prepare an event ahead of announcing it, which
is how student clubs actually work — the poster and the date firm up before the
listing should be public. The trap that makes it P1 rather than P2 is already
recorded: **every** public read path must filter to `PUBLISHED`, or drafts leak
onto the homepage, the club page and search. Pair it with CEM-10, which is a
prerequisite — there is no update path to set a status through.

### CEM-12 · P1 · A club cannot see who is coming to its own event · **NEW**

**Exists.** The data, and an index built for exactly this question.
`user_event_rsvps` (`V9__create_event_rsvps.sql`) carries the RSVPs, and V9's own
closing comment introduces `idx_user_event_rsvps_event` as covering *who is going
to this event*. `MyEventService.rsvp` (`:83`) writes the rows.

**Missing.** Any endpoint that reads that direction. Every RSVP query in the
backend is user-scoped (`MyEventController.java:27-53`). No organiser-facing
screen exists, and `/manage/[clubId]/events` renders the public `EventCard` with
no attendee affordance at all.

**Also missing, and worse.** `Event.registered` (`Event.java:58`) is served to the
client as `EventDTO.registered` (`EventDTO.java:23`) and **is never incremented
anywhere** — a grep for it across the whole backend returns the field declaration
and the DTO line and nothing else. So the attendance number the API publishes is
permanently 0 while the RSVP rows pile up beside it.

**Why it matters.** This is the most basic thing a club needs from an event
platform: how many people are coming, and who. Without it a club cannot plan
catering, book a room of the right size, or chase attendance — the whole reason
to run the event through CampusVibe rather than a poster. The index was built for
it a month ago. Blocked on **D-9** for what the list may show.

### CEM-13 · P2 · Capacity is collected, published, and never enforced · **NEW**

**Exists.** `capacity` travels the whole way — `EventCreateRequest.java:13` →
`EventController.java:86` → `Event.java:55` → `EventDTO.java:22`.

**Missing.** Any read of it. `MyEventService.rsvp` (`:83-86`) checks that the
event exists and adds the row; it never looks at capacity, and no other code does.

**Why it matters.** A club setting a capacity of 40 gets no cap: the 41st RSVP
succeeds exactly like the 40th, and neither the club nor the students find out
until the room is full. A field that is collected and displayed but not honoured
is worse than an absent one, because it makes a promise. Waitlisting is the
natural follow-on and is a separate decision — **D-6**.

### CEM-14 · P2 · Deleting an event silently erases every RSVP, and tells nobody · **NEW**

**Exists.** `EventService.delete` (`:62-64`) is a hard delete, and V9's foreign
key is `ON DELETE CASCADE`, so the RSVP rows go with it.

**Missing.** Any distinction between *cancelled* and *deleted*, and any notice to
the people who had said they were going.

**Why it matters.** Cancelling an event is a normal, frequent act with an
audience; deleting a row is a database operation. Today they are the same button.
Everyone who RSVPed loses the event from `/my-events` with no explanation, and
their calendar export still points at something that no longer exists. Note this
is also the current *workaround* for CEM-10: with no update path, delete and
recreate is the only way to change an event, which makes every edit today
silently an attendee wipe. Blocked on **D-2**.

### CEM-15 · P2 · Event creation validates nothing · **NEW**

**Exists.** `EventCreateRequest.java` — nine fields, zero constraint annotations
— and `EventController.java:79` takes it with **no `@Valid`**.

**Missing.** A bound on title and description, a required title, and any check
that the date is not in the past.

**Why it matters.** `events.title` is `NOT NULL` in the schema
(`Event.java:25-26`), so a missing title is a data-integrity violation surfacing
as a 500 rather than a 400 naming the field. A negative capacity is accepted. An
event can be created for last March. The taxonomy slugs beside them **are**
validated properly (`EventController.java:88-93`, with a comment explaining
exactly why) — the gap is that everything else on the same record is not.

### CEM-16 · P2 · An event cannot be given a banner from the UI, and could not display one

*Queued — [`todo.md` › Frontend / Features](../../TODO/todo.md#frontend--features),
[BUG-006](../../bugs/bugs.md#bug-006) and [BUG-042](../../bugs/bugs.md#bug-042).*

**Exists.** `POST /api/v1/events/{id}/images` (`EventController.java:103-105`),
reachable by the creator, and simply unwired.

**Missing.** Both halves — the upload control, and the read path clubs got on
2026-09-09 and events did not.

**Why it matters.** Wiring only the upload arms
[BUG-040](../../bugs/fixed_bugs.md#bug-040) on a second surface: a stored S3 key
reaching `next/image` throws **during render**, where no `onError` can catch it,
so one uploaded banner takes the page down. Do both together, following the club
shape rather than inventing a second one.

### CEM-17 · P2 · An event has no end time

*Queued — [`todo.md` › Frontend / Features](../../TODO/todo.md#frontend--features).*

`Event.java:31-32` carries `dateTime` and nothing else, so
`buildGoogleCalendarUrl` assumes every event runs two hours. Every *Add to
calendar* link is that guess. It is listed here because it is an event-model gap
rather than a frontend one: the fix is a column.

### CEM-18 · P3 · No recurring events · **NEW**

Nothing in `Event.java` expresses recurrence, and the event page's hardcoded
weekly line was dropped rather than faked. A weekly club meeting — the single
most common thing a student club runs — has to be created by hand every week.
Worth deciding whether that is deliberate for the MVP.

### CEM-19 · P3 · One organiser per event, so nothing can be co-hosted · **NEW**

`Event.organizer` is a single `@ManyToOne` (`Event.java:40-42`). Two clubs running
something together means one of them does not appear on it, and the event shows
on only one club page. Common enough at a university to name. Blocked on **D-10**.

### CEM-20 · P3 · No way to repeat or duplicate a past event · **NEW**

With CEM-18 unbuilt, duplicating last term's event is the cheap substitute — and
it does not exist either. Small once CEM-10 lands.

---

## C. The club dashboard, as a surface

### CEM-21 · P1 · The dashboard has no Club Page section

Covered by CEM-01 — recorded separately because it is a **navigation** gap as much
as a feature one. §29 of the governance spec lists five sections: Overview,
**Club Page**, Events, Administrators, Activity Log. `ManageSidebar.tsx:27-32`
has four. The missing one is the club itself.

### CEM-22 · P2 · The Events tab is read-only · **NEW**

`/manage/[clubId]/events/page.tsx` lists the club's events as public `EventCard`s,
which link to the public event page. There is no edit, no delete, no attendee
count, no status control — the only action on the screen is *Create event*. So a
club's own events area shows it exactly what a visitor sees. Everything it needs
is CEM-10 through CEM-14.

### CEM-23 · P3 · The Overview answers almost nothing · **NEW**

`/manage/[clubId]/page.tsx` renders two things: a *Next up* strip of at most four
upcoming events (`:96-121`) and the official-email panel (`:124`), which is
read-only for everyone except a platform admin (`:145-160`). No follower count,
no pending-invitation count, no recent activity, no attendance. It is a landing
page rather than an overview. Low priority because it is only worth building once
the numbers behind it exist.

### CEM-24 · P2 · Invitations, handovers and proposals never expire

*Queued — [`todo.md` › Club governance](../../TODO/todo.md#club-governance),
items 5 and 8 follow-ups, plus the proposal expiry under Frontend / Features.*

Three sweeps of the same shape, and they want one implementation: a PENDING
invitation holds the `one_live_invite_per_club_email` slot, a PENDING handover
holds the club's one transfer slot, and an unreviewed proposal holds its slug
reservation forever. `EXPIRED` already exists in `AssignmentStatus` and nothing
ever sets it. Record the sweep in the audit log.

---

## D. The platform admin dashboard

### CEM-25 · P1 · The admin dashboard is one queue and a button · **NEW**

**Exists.** `/admin` renders a *Pending requests* list merging the club-admin
claim queue and the club-proposal queue (`admin/page.tsx:174-176`), with approve
and reject, plus a *Create a club* control. That is the whole screen.

**Missing.** Everything else an operator needs: a club directory, any view of
which clubs are ownerless, a user list, event moderation, and any route to a
club's audit log other than typing its URL.

**Why it matters.** The platform admin is the only role that can act across
clubs, and their dashboard shows them nothing about the platform — only what is
waiting for approval. The two queues are the *inbox*; there is no *directory*.
Blocked in part on **D-11**.

### CEM-26 · P2 · No user management

*Queued — [`todo.md` › Backend / Features](../../TODO/todo.md#backend--features).*

There is still no way to grant or revoke `ROLE_ADMIN` through the product.
`AdminBootstrapRunner` creates the first admin from environment variables and
nothing promotes a second one — and it must never revoke, which is a deliberate
rule in [`database-lifecycle`](../../skills/database-lifecycle/SKILL.md).
Revocation being a manual act is fine; having no product path for the grant is
what leaves a single point of failure.

### CEM-27 · P2 · No event moderation

*Queued — [`todo.md` › Backend / Features](../../TODO/todo.md#backend--features).*

A platform admin can already reach any event through `canManageEvent`, which
resolves via the club — so the *authority* is there. What is missing is a surface
listing events across clubs, and any action other than deletion, which is
CEM-14's problem exactly. Depends on **D-5**: whether an event needs approval
before it is public at all, or whether club trust is the boundary.

---

## E. Notifications — the blocker under a third of this file

### CEM-28 · P1 · Nothing tells anybody that anything happened

**Exists.** More than the queue implies, and worth being precise about because
*notifications do not exist* is recorded in several places as though nothing at
all were built:

- The **mail layer is live** — `mail/MailSender.java`, `SmtpMailSender`,
  `LoggingMailSender`, `MailConfig` — and three club paths already send through
  it (`ClubAdminService.java:348`, `:513`, `:550`).
- **User email preferences persist** — `user_notification_preferences` (V21),
  five switches, with an editor at `/profile/edit/notifications`.

**Missing.**

- **Any enforcement of those preferences.** `NotificationPreferences` is read and
  written only by its own service in `user/profile/`; no mail path consults it.
  So the five switches a user sets today govern nothing.
- **Notification records** (§23.7 of the governance spec) — no table, so there is
  no in-app notifications view and no record of what was sent.
- **Club notification preferences** (§23.6) and the personal/club separation
  (§13–16).
- **The mandatory security notices to the official club email** (§17), which are
  additionally gated behind CEM-08.
- **Any event-driven notice at all** for the things this file is about: a
  proposal approved or rejected, an event cancelled or moved, an event you
  RSVPed to happening tomorrow.

**Why it matters.** It is the dependency under CEM-14, CEM-27 and governance
items 11–13.

**It is also where an accepted decision becomes a bug.**
[ADR-004](../decisions/ADR-004-two-paths-create-a-club.md) accepted *nothing
tells the requester* as a cost of putting club creation behind review — **on the
explicit condition that it stops being a consequence and becomes a bug the day
notifications exist.** Whoever builds this owns that. The same day, a requester
being unable to see their own pending proposal stops being deliberate and starts
being an omission
([`todo.md` › Frontend / Features](../../TODO/todo.md#frontend--features)).

---

## Decisions this review cannot make

Each blocks the item named. Several are real either/or choices with lasting
consequences, which by the rule in [`CLAUDE.md`](../../CLAUDE.md) makes them
**Proposed ADRs** rather than spec lines — flagged below where that applies.

| # | Question | Blocks |
|---|---|---|
| **D-1** | Does a club have **members**, distinct from its followers and its administrators? Following is a public, one-click act; membership is a roster. §43 rules out granular admin roles but says nothing about a member list. | A club roster, member-only events, and whether *followers* is the right word on the club page |
| **D-2** | Is **cancelling** an event different from deleting it? If so, does a cancelled event stay visible with a banner, and what happens to its RSVPs? | CEM-14, CEM-11 |
| **D-3** | May a club's **slug** change after creation, and if so does the old URL redirect or 404? | CEM-03 |
| **D-4** | Can a club be **deleted or archived**, by whom, and what happens to its events, its followers and its audit log? Note §22 forbids club administrators deleting audit history, which points at archive rather than delete. **Likely an ADR.** | CEM-04 |
| **D-5** | Does an event need **platform approval** before it is public, or is a club's own trust the boundary? ADR-004 put *clubs* behind review for exactly this reason; events were never asked. **Likely an ADR.** | CEM-27, CEM-11 |
| **D-6** | Is **capacity** a hard cap? If it is, what happens to the 41st person — refused, or waitlisted? | CEM-13 |
| **D-7** | Should a club have a **draft or unlisted state** before its page goes public? | CEM-05 |
| **D-8** | May a club admin **resign** without the owner acting? And may an owner resign, given the one-owner invariant means they cannot simply leave? | CEM-07 |
| **D-9** | Who may see the **attendee list**, and what does it show — a count, first names, or email addresses? §39 separates personal identity from club data, so this is a privacy decision, not a UI one. | CEM-12 |
| **D-10** | Are events permanently tied to one club, or can an event be **moved or co-hosted**? | CEM-19 |
| **D-11** | Does the platform admin need a **club directory with moderation actions**, or is the public `/clubs` listing plus the approval queue enough? | CEM-25 |

---

## Deliberately not in this review

Named so they are not mistaken for oversights. None is queued, and none was found
while reading the code above.

- **Ticketing and payments.** `Event.price` is a free-text string
  (`Event.java:38`) and nothing charges anyone. `todo.md` carries a P3 marker.
- **Attendance and check-in** — QR codes, door lists, no-show tracking. Depends on
  CEM-12 existing first.
- **Club analytics** — follower growth, attendance over time, which events worked.
- **Calendar feeds (`.ics`)** for a whole club or a whole tab. Queued P3 under
  Frontend / Features; the current export is one Google link per event.
- **Search, taxonomy, the AI planner, authentication and deployment.** All have
  their own sections in `todo.md` and their own docs.

---

## A suggested order, and why

Not a commitment — the reasoning is the useful part.

1. **CEM-01 with CEM-02** — the club editor, validated. It is the single
   unblocker: it closes ADR-004's own outstanding promise, gives the taxonomy
   items under `todo.md` the screen they need, and is the only item here that is
   pure frontend against endpoints that already work.
2. **CEM-10 + CEM-11 + CEM-15 as one unit** — event update, lifecycle status and
   validation. They touch the same controller and service, and the status work
   needs an update path to set a status through. Doing them separately means
   writing `EventService.update` twice.
3. **CEM-12 with CEM-13** — attendees and capacity. The data has been there since
   V9, and this is what a club actually came for.
4. **CEM-06** — the audit call sites, riding on 1 and 2, which have to touch
   those exact methods anyway.
5. **CEM-28** — notifications, which unblocks the ADR-004 trigger, CEM-14's
   notice, and governance items 11–13.
6. **CEM-04 and CEM-14** — the destructive paths, once **D-2** and **D-4** are
   answered. Deliberately last: they are the ones where getting the decision
   wrong is expensive to undo.

CEM-08's round trip can slot in anywhere after a mail provider is chosen; it is
independent of everything above.
