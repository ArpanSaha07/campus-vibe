# Interests, club categories and event tags

**Status:** Proposed — only Arpan moves this to Accepted
**Date:** 2026-08-20
**Approved by:** — (pending)
**Implemented in:** [`user-profiles.md`](../architecture/user-profiles.md) covers
the interests half, which is built. The club and event halves are unbuilt; add
their doc link when they land.

> **Why one document rather than six ADRs.** `adr.md` asks for one decision per
> file, frozen. The decisions below are one interlocking choice about how this
> platform names things — each is unreadable alone, because the argument for
> giving events their own tag list *is* the argument for not giving them a
> category list on top of it. Splitting them would produce six files that each
> say *see the others*. If any single decision here is later reversed, that
> reversal gets its own numbered ADR and this document gets a pointer to it.

**Revised 2026-08-20, same day, after a first pass proposed a single shared
vocabulary.** That version is gone but its argument is preserved in *What
changed, and why* — it was rejected for reasons worth keeping, and the reasons
are not the ones the original generic recommendation gave.

---

## The six questions, and how this project answers them

| Question | Answered by | Vocabulary | Where |
|---|---|---|---|
| What is this student into? | user interests, several | `interest_catalogue` — 76 entries | **built** |
| What kind of organisation is this? | **one** club category | `club_categories` — 13 entries | D1 |
| What is this club about? | club tags, several | `interest_catalogue` — **shared with interests** | D7 |
| What is this event about? | topic tags, several | `interest_catalogue` + its groups — **shared** | D3 |
| What kind of thing is this event? | format tags, several | `event_formats` — 22 entries | D3 |
| ~~What category is this event?~~ | no taxonomy at all | none | D2 |

**Three vocabularies**, and only three: `interest_catalogue` with its groups,
`club_categories`, and `event_formats`. The interest vocabulary answers three of
the six questions, because a person's interests, a club's topics and an event's
subject are the same kind of word. Only *format* is genuinely events-only, and
only *kind of organisation* is genuinely clubs-only.

---

## What exists today

Grounded in the code as of 2026-08-20, not from memory.

| Thing | State |
|---|---|
| `interest_catalogue` (V19, seeded V20) | 76 entries, `slug` primary key, plus `label`, `category`, `sort_order`. The only vocabulary in the project with a stable key. |
| `user_interests` (V19) | `user_id` + `interest_slug`, foreign-keyed to the catalogue. **Built and live.** |
| `GET /api/v1/interests` | Public, returns the catalogue in order. Built. |
| Club categories | **Do not exist.** `clubs` (V2) has no such column and `Club.java` no such field. The intent is visible as a commented-out `// clubcategories: string[];` at `frontend/app/types/index.ts:65`. |
| `event_categories` (V3) | Exists, and is **free text with no key and no constraint**. Mock rows use `Dating`, `Research`, `Food`. |
| `EventDTO.categories` | On the wire and pinned by `contracts/api-dto-fields.json`. Mirrored at `frontend/app/types/index.ts:233` (`ApiEvent`) and `:30` (`EventInstance`), mapped at `frontend/app/lib/adapters.ts:27`, rendered under a heading literally reading *Categories* at `frontend/app/(main)/events/[eventId]/page.tsx:152`. |
| `CategoriesSectionMainPage.tsx` | **Dead code.** Exports `CategoriesSection` and is imported nowhere — `(main)/page.tsx` does not render it. Its private list of eight tiles linked to `/events?q=<name>`, a full-text search dressed as a taxonomy. Retired; the file is kept only as a UI shell worth reusing. |
| `user_preferred_categories` (V4) | Dropped in V22. Never mapped, never read, zero rows in every environment. |

---

## D1 — Clubs get their own category list, separate from interests

### Options considered

**Reuse `interest_catalogue`.** The previous version of this document proposed
it: one list, one endpoint, no chance of two vocabularies drifting. Rejected,
and the granularity is why. The catalogue is written at the grain of *Chess*,
*Hiking*, *Web development* — reasonable things for a person to like, strange
things to call an organisation. A club is not a hobby.

**Free text on `clubs`.** Cheapest and rejected outright: it is what
`event_categories` already does, and the result is that no two clubs can be
matched against each other. `Board games`, `board games` and `Boardgames` are
three groups of one.

**A dedicated `club_categories` vocabulary — chosen.**

### Decision

A club has **one** category, drawn from this fixed list of thirteen. **Settled
2026-08-20** — labels tidied, and this is the seeding list.

| # | Label |
|---|---|
| 1 | Athletic and Recreational Sports Clubs |
| 2 | Charity and Environment Clubs |
| 3 | Community Outreach and Volunteering Clubs |
| 4 | Fine Art, Dance, and Performance Clubs |
| 5 | Health and Wellness Clubs |
| 6 | Language and Publications Clubs |
| 7 | Leisure Activity and Hobby Clubs |
| 8 | Networking and Leadership Development Clubs |
| 9 | Political and Social Activism Clubs |
| 10 | Religion and Culture Clubs |
| 11 | Departmental Clubs |
| 12 | Off-campus |
| 13 | General |

**`Technology` was removed from this list in the same pass**, and it belongs
gone: it named a subject, not a kind of organisation, which is the same
objection that retired `General events`. A technology club is now a
*Departmental* or *General* club **tagged** `technology` — which is D7, and
which finds it more precisely than a category ever could.

Stored as a `club_categories` reference table keyed on a slug, with
`clubs.category_slug` foreign-keyed to it — the same slug-not-label reasoning as
the interest catalogue, so that rewording a label never moves a club.

**One category, not several.** These are broad and close to mutually exclusive,
which is what makes *browse clubs by category* a clean grouping rather than a
list where most clubs appear three times. A single column is also cheaper to
reverse than a join table: promoting one-to-many later is a migration, demoting
many-to-one means deciding which of a club's three categories was the real one.

### Consequences

Makes easy: club discovery by kind of organisation, which is what a student
browsing a club directory actually wants.

Makes hard: clubs that genuinely straddle — a Computer Science Undergraduate
Society is a departmental club *and* a technology club. **D7 is the answer to
that**, and it is why one category is survivable: the category records what the
organisation fundamentally is, and the tags record everything else about it.
Without D7, one category would be too blunt to ship.

Costs: a second vocabulary to seed and serve. That is real, and it is the thing
the previous version of this document was trying to avoid — see *What changed*.

---

## D2 — Events get no category taxonomy. Format is a tag

### The question this answers

Given that an event already carries tags, and already belongs to a club that
already has a category — is a separate event-category taxonomy still needed?

**No.** The reasoning changed when D3 did, and it is now stronger than it was.

### Options considered

**A separate `event_categories` taxonomy with `events.category_id`.** Ten to
twenty broad formats — *Workshop*, *Networking*, *Social*, *Study session*,
*Nightlife*. Genuinely a different question from *what is this about*. Rejected.

**Keep the existing free-text `event_categories`.** Rejected: unconstrained, and
it currently renders under a *Categories* heading on the event page, so it is
user-visible incoherence rather than dormant debt.

**No event category; format words live in the event-tag list — chosen.**

### Decision

There is no event-category taxonomy and no `events.category_id`. Format is
expressed as a tag, drawn from `event_formats` — the one vocabulary that is
genuinely the event's own (D3). What an event is *about* comes from the shared
interest vocabulary instead, so the two questions are answered by two tables
rather than by one taxonomy sitting on top of another.

### Why this is safe now and was not before

The standing objection to format-as-tag was **contamination**: putting *Workshop*
beside *Photography* in the list students pick their interests from makes one
column answer two questions. **That objection died with the single shared
vocabulary.** Event tags are now a separate list serving only events, so
*Workshop*, *Networking* and *Study session* belong in it naturally. There is
nothing left to pollute.

A second taxonomy would also immediately raise *is Workshop a category or a
tag?*, and the honest answer would be *both, and they disagree* — the same
failure that made `user_preferred_categories` worth dropping in V22.

### One premise worth correcting

*Events inherit their club's category* is true but weaker than it sounds. A
Technology club runs workshops, socials and networking nights alike, so a club
category predicts what kind of **organisation** is behind an event and says
almost nothing about what kind of **event** it is. Club category is good for
browsing and a poor format signal. It is the tag list, not the inheritance, that
makes a separate event category unnecessary.

### Consequences

Makes easy: one fewer vocabulary to design, seed, expose, version and keep the
frontend from duplicating.

**Makes hard, and this is the honest cost:** a flat tag list mixes topic and
format, so *workshops about AI* is not cleanly expressible as a filter — both
are just tags, and nothing distinguishes them. Filtering, ranking and analytics
all treat them alike.

**Superseded by the final form of D3, and improved by it.** This document at one
point proposed a `kind` column on a single event-tag table, holding `topic` or
`format`. D3 now separates them by *table* instead: formats live in
`event_formats`, topics live in the interest vocabulary.

That is strictly better than the column. A format tag can no longer be applied
to a person or a club **by construction** rather than by everyone remembering to
filter on `kind`, and *show me workshops about AI* is a join against two
different tables rather than a `WHERE` clause someone has to know to write.

The separation is real, so nothing is lost by dropping the column. What D2
rejects is a third vocabulary of event *categories* on top of both — and that
remains rejected.

Evidence the need is real, though not yet urgent: `(main)/page.tsx:27` already
hardcodes a homepage section titled **Workshops**, and `:30` one titled
**Outdoors** — one format, one topic. The product already wants to browse by
format, which is the argument for making sure format words exist as tags from
the start.

---

## D3 — Events carry format tags of their own, and topic tags from the interest vocabulary

**Revised 2026-08-20**, twice in one day. It first proposed one shared list for
everything, then a fully separate `event_tags` list. This is where it landed,
and the difference between the second and third versions is the resolution of
what used to be the last open question.

### Decision

An event carries two kinds of tag, chosen by the club admin at creation:

| | Vocabulary | Why |
|---|---|---|
| **Format** — what kind of thing is it | `event_formats`, **22 entries, events only** | *Workshop* and *Panel* are meaningless as a student interest. This half genuinely belongs to events. |
| **Topic** — what is it about | `interest_catalogue` and its groups, **shared** | A student interest and an event subject are the same kind of word. |

**The governing rule: every event topic tag is either an interest or an interest
group.** Nothing else is taggable. When an event needs a topic the catalogue
does not have, **the catalogue gains an interest** — so adding an event topic
and adding a student interest are the same act, and the two vocabularies cannot
drift because there is only one.

### Why the topic half is not its own table

Because a table of event topics that must always be a subset of the interests
is **two lists that have to agree with nothing checking that they do** — the
failure this whole document exists to prevent, and one this project has already
shipped once with `INTEREST_CATEGORIES`. A mirror needs syncing; an identity
does not.

The two objections that had argued for a separate list are both answered:

1. **It has to hold format words.** True, and that is exactly why `event_formats`
   exists. The split is by *table*, which is stronger than the `kind` column
   this document proposed an hour earlier — a format tag now cannot be applied
   to a person by construction, rather than by convention.
2. **It must not hold some interest words.** *Make friends* and *New in town*
   are absurd on an event. But that is a judgement the club admin makes when
   picking tags, not something schema should enforce — exactly as it is for
   clubs under D7. Nobody tags a careers fair *New in town*, and no constraint
   is needed to stop them.

### Consequences

**The interest-to-event mapping problem disappears.** It was the last open
question in this document, and the answer is that there is nothing to map:
matching a student to an event is the same identity join that D7 gives clubs.
The near-misses that made a naive join dangerous — `hackathons` against
`hackathon`, `tech` against `technology` — cannot occur, because there is only
one spelling of each concept.

**The interest catalogue grows, and that is a feature.** Measured against the
draft below: 20 of the 47 topics already exist as interests, 5 already exist as
groups, and **22 are genuinely new**. Those 22 are not an inconvenience — they
are a hole in the profile screen. A campus platform where an event can be about
*Finance* or *Careers* but no student can say they are interested in either is
missing something, and this rule finds it.

**Groups have to become referenceable.** Tagging an event *Music* means pointing
at a group, and `interest_catalogue.category` is a text column today — nothing
can foreign-key to it. Two ways:

- **A self-referencing `parent_slug`** on one topics table, where groups are the
  rows with no parent. One table, one foreign key everywhere, and the rollup
  needed for two-tier scoring is a single join. **Recommended.**
- **Two nullable columns plus a CHECK** on the join table, one pointing at an
  interest and one at a group. Less restructuring, but every reader now handles
  two cases forever.

Either is affordable **only while V19 and V20 are uncommitted**. After that it
is a migration and an entity change.

### The draft vocabulary

#### `event_formats` — 22, events only

| Group | Tags |
|---|---|
| Learning | Workshop · Talk · Panel · Info session · Study session |
| Social | Social · Party · Game night · Open mic · Trip |
| Competitive | Competition · Hackathon · Tournament |
| Showcase | Performance · Screening · Exhibition · Fair |
| Community | Networking · Fundraiser · Volunteering · General meeting · Orientation |

Slugs follow the rule V20 used: lowercase, `&` treated as a space, runs of
non-alphanumeric characters collapsed to one hyphen.

#### Topics — 47 drafted, and what each one costs

These are **not a new table**. They are the specification for what the interest
vocabulary must contain before events can be tagged.

| Status | Count | Entries |
|---|---|---|
| Already an interest | 20 | Entrepreneurship · Research · Public speaking · AI & machine learning · Data science · Cybersecurity · Robotics · Theatre · Film · Photography · Creative writing · Design · Mental health · Sustainability · Human rights · International students · LGBTQ+ · Faith & spirituality · Indigenous community · Women in STEM |
| Already a group | 5 | Music · Outdoors · Languages · Food & drink · Games |
| **New — add to the catalogue** | **22** | Careers · Graduate school · Technology · Software development · Engineering · Business · Finance · Consulting · Marketing · Dance · Visual art · Sports · Fitness · Health & wellness · Social impact · Politics · Activism · Equity & inclusion · Black community · French · English · Travel |

**Three of the 22 are really group work, not new interests.** *Technology*
duplicates the existing group `tech` under a different slug; *Sports* and
*Fitness* split the existing group `sports-fitness` in two. Settle those against
the group layer rather than adding near-duplicate leaf entries.

**Attributes were deliberately left out.** *Free food*, *Free entry* and
*Beginner friendly* are what students would really filter on, and they are
neither a topic nor a format. They would be a third thing — most naturally more
`event_formats` rows, since they describe the event rather than the person. Left
out because the ask was topic and format, and a vocabulary is easier to add to
than to prune.

---

## D4 — `event_categories` is superseded, and the wire field is renamed

### Decision

`event_categories` (V3) is retired by a new forward-only migration creating the
tag tables and dropping it — **not** by editing V3, which is applied. Deleting
from an applied migration leaves the `flyway_schema_history` row behind and
startup fails validation with *Detected applied migration not resolved locally*,
which is to say the application does not boot. Same supersede-never-edit route
V22 took for `user_preferred_categories`.

The rename reaches the wire, and **it becomes two fields, not one**, because D3
gives an event two kinds of tag from two different vocabularies:
`EventDTO.categories` is replaced by `topics` and `formats`. One merged array
would put `workshop` and `robotics` side by side with nothing saying which is
which, and every consumer would have to look each value up to find out.

That is **six coordinated edits in one commit** per field, because both contract tests
assert against `contracts/api-dto-fields.json` and each has a symmetry check:
the record, the contract file, `CONTRACTED` in `ApiContractTest.java`, the
TypeScript interface, the `Record<keyof T, true>` literal, and the `MIRRORS`
map. Plus `adapters.ts:27`, `EventInstance` at `types/index.ts:30`, and the
*Categories* heading at `events/[eventId]/page.tsx:152`.

### Consequences

The three existing mock values — `Dating`, `Research`, `Food` — are seeded data,
not anything a user created, and they are not tag slugs. The migration should
drop them rather than guess at a mapping, **and say so in a comment**. Losing
three mock values is not a cost; silently inventing a mapping for them would be.

---

## D5 — Withdrawn

The previous version proposed renaming `interest_catalogue` to something neutral
like `topics`, because it was about to serve interests, clubs and events at once.

**D1 and D3 make that unnecessary.** The catalogue serves exactly one thing
again, and `interest_catalogue` is the right name for it. Nothing to do.

The narrower half of that proposal still stands as a nicety and nothing more:
`interest_catalogue.category` — the twelve picker groups such as *Arts &
culture* — is now the only remaining overloaded use of the word *category* in
the schema, sitting beside `club_categories`. Renaming it `group_label` is free
while V19 and V20 are uncommitted and costs a migration afterwards. It is
cosmetic; skipping it is a legitimate call.

---

## D6 — Delete the homepage category tiles

### Decision

`CategoriesSectionMainPage.tsx` is dead code — it is imported nowhere and
renders on no page. It is not to be rewired to any of the three vocabularies.

Keep the file only if its layout is genuinely wanted as a shell for a future
component; otherwise delete it. What must **not** happen is that it comes back
holding a fourth private list of category names, or that its
`/events?q=<name>` links return as a taxonomy. Those were a full-text search
wearing a filter's clothes: clicking *Music* searched for the word, and would
have matched an event titled *Music-free study night*.

Browsing by club category or by event tag is a real filter against a real
foreign key, and it belongs on `/events` and `/clubs`, not in a private list on
the homepage.

---

## D7 — Clubs also carry interest tags, and those are shared with interests

### The question this answers

How does a departmental technology society, or a business club running tech
events, get found by a student searching for *tech clubs*?

Not by having more categories. **Thirteen broad labels cannot answer that at any
multiplicity** — even filed under both *Departmental* and a hypothetical
*Technology*, a student looking for **AI clubs** or **robotics clubs** still has
nothing to filter on. The vocabulary is too coarse by design. The fix is a
second axis, not more values on the first.

### Options considered

**Several categories per club.** Costs the same to build as tags — one join
table either way — and delivers materially worse discovery: it still cannot
express *AI*, it makes a club appear three times in a directory, and demoting
back to one later means deciding which of its categories was the real one.
Rejected.

**A dedicated club-tag vocabulary.** A third list to write, seed, serve and keep
the frontend from duplicating — and it would need a mapping to user interests,
which is exactly the cost D3 accepted for events and should not pay twice.
Rejected.

**Reuse `interest_catalogue` — chosen.**

### Decision

A club carries several tags — **cap 8** — drawn from `interest_catalogue`, in a
`club_interests` join table. This is *in addition to* its one category from D1,
not instead of it.

| Club | Category (one) | Tags (several) |
|---|---|---|
| CS Undergraduate Society | Departmental Clubs | `web-development` `ai-machine-learning` `hackathons` `open-source` |
| Robotics team | Departmental Clubs | `robotics` `hackathons` `open-source` |
| Entrepreneurship society | Networking and Leadership Development Clubs | `entrepreneurship` `case-competitions` `networking` |

A search for *tech* now reaches all three by tag, where a category filter
reaches none of them. Every slug above is a real entry in the catalogue as
seeded by V20 — note that there is no `engineering` entry, which is the kind of
gap worth finding before clubs start tagging rather than after.

### Why sharing with interests is safe here, when it was not for events

This is the distinction that keeps the design coherent rather than arbitrary.

**A club's topics and a person's interests are the same kind of word.**
*Robotics* is both something a student is into and something a club is about.
Events were different on two counts: they also need **format** words
(*Workshop*, *Networking*) that are meaningless as an interest, and they must
**exclude** some interest words (*Make friends*, *New in town*) that are absurd
on an event. Neither applies to a club. A club has no format, and a club about
making friends is a perfectly ordinary social club.

### Consequences

**The recommender becomes one query with no mapping layer**, because
`user_interests` and `club_interests` hold literally the same slugs:

```sql
SELECT club_id, COUNT(*) AS overlap
FROM club_interests
WHERE interest_slug IN (:usersInterestSlugs)
GROUP BY club_id
ORDER BY overlap DESC;
```

That is a working *clubs you might like* with no embeddings and no machine
learning. Index `(interest_slug)` for the reverse lookup; at a few hundred clubs
it is not a query worth optimising.

**The cap is load-bearing, and belongs on the server.** A club that tags itself
with thirty interests matches every student, which helps that club not at all
and degrades everybody else's recommendations — the tag-spam failure that ruins
this pattern wherever it is left uncapped. `UserProfileService` already caps
subjects at 12 the same way, and the same 400-with-a-sentence applies.

**`SearchableText.forClub` should include the tags.** It currently embeds only
name and description, while `forEvent` already folds its categories in. Adding
them means a semantic search for *tech* reaches a society whose description
never uses the word. One line. Treat tags-as-filter as the load-bearing path and
embeddings as the bonus, given that the semantic leg is currently unreliable
([BUG-001](../../bugs/bugs.md#bug-001)).

**Cost.** One migration and one form field. `InterestPicker` is reused unchanged
— it already fetches the vocabulary, filters by group and stores slugs.

---

## What changed, and why

This document has been through three positions in one day. All are recorded,
because each only makes sense against the one before it.

**First pass: one shared vocabulary for everything.** The argument was that a
second list is a second thing to seed, serve, version and stop the frontend from
duplicating — and that this project had already shipped exactly that bug, with
`INTEREST_CATEGORIES` living in both the database and `lib/profile-options.ts`.
That reasoning was sound about the *cost* of extra vocabularies. It was wrong
about whether the cost was worth paying.

**What it got wrong: granularity, in both directions at once.** A list good
enough to describe what a student likes is too fine to name an organisation
(*Chess* is not a kind of club) and too narrow to describe an event (*Make
friends* is not a kind of event). Sharing it would have forced every entry to
serve three audiences, and the escape hatch — per-use applicability flags — is
more machinery than simply having the lists be separate.

**Second pass: three fully separate vocabularies**, including an `event_tags`
list of its own holding both topic and format words. Right about clubs and
events needing their own words, wrong about the topic half — it left a list of
event topics that had to stay a subset of the interests, which is two lists that
must agree with nothing checking that they do. It also left a genuine mapping
problem behind it.

**Third and current: separate where the words differ, shared where they do
not.** Formats are events-only because *Workshop* is not an interest. Club
categories are clubs-only because *Departmental Clubs* is not an interest. Event
topics and club topics **are** interests, so they are the same rows, and an
event needing a topic the catalogue lacks adds it as an interest. The mapping
problem dissolved rather than being solved.

**Where this lands relative to the original generic recommendation.** Close
to it, but not identical, and the difference is the interesting part:

| Its claim | This project |
|---|---|
| Interests and event topics are different concepts | **Agreed.** Separate vocabularies, D3. |
| Club categories should be their own taxonomy | **Agreed**, D1 — with a specific 14-entry list rather than a generic one. |
| Events need a category taxonomy separate from topics | **Rejected**, D2. Format is a tag. It proposed splitting them because the topic list was shared and could not hold format words; once the event list is the event's own, the split buys nothing and costs a vocabulary. |
| Use `is_user_selectable` / `is_event_applicable` flags if applicability diverges | **Not needed.** Separate lists solve it without flags. |

---

## Open questions

**None. All four were settled on 2026-08-20** and are recorded above rather than
here: the event vocabulary is D3, the tidied club labels are D1, one category
per club is D1 plus D7, and the interest-to-event-tag mapping is D3 — which
resolved it by removing the need for a mapping rather than by designing one.

Two smaller things are noted rather than open. Whether attribute tags such as
*Free food* become `event_formats` rows (D3), and whether
`interest_catalogue.category` is worth renaming now that `club_categories`
exists (D5) — the latter partly answered by D3, since that column is becoming a
referenceable group layer either way.

---

## Revisit when

- **The interest catalogue stops being a good fit for events**, which would show
  up as club admins repeatedly wanting a topic no student would ever pick. That
  is the signal the shared topic vocabulary has run out, and the answer would be
  the applicability flags this document has twice declined to build.
- **A club category is genuinely unassignable**, or the same club keeps being
  filed under two *and its tags do not rescue it*. That is the signal D1's
  one-category rule has run out — but check the tags first, because that is what
  they are for.
- **Club tags start being spammed** — clubs sitting on the cap of 8 with tags
  they do not earn. Recommendation quality dies quietly here, so it needs
  watching rather than waiting for a complaint.
- **Attribute tags are wanted** (*Free food*, *Beginner friendly*). One more
  value in `kind`, not a new table.

---

## Implementation checklist

Nothing below is built. In dependency order:

Content and schema are now settled. In dependency order:

1. Migration: `club_categories` reference table, then its seed of thirteen
   labels **in a separate file** per `database-lifecycle` — reference-data
   inserts do not share a migration with the `CREATE TABLE`. Then
   `clubs.category_slug` foreign-keyed to it.
2. Migration: `club_interests` (D7), foreign-keyed to `interest_catalogue`.
3. Make the interest groups referenceable — the self-referencing `parent_slug`
   of D3 is the recommendation, and it is cheap only while V19 and V20 are
   uncommitted.
4. Extend the interest catalogue with the 22 new topics from D3, settling
   *Technology*, *Sports* and *Fitness* against the group layer first. This is
   reference data, so it is its own migration.
5. Migration: `event_formats` reference table plus its seed of 22, then
   `event_format_assignments` and `event_topic_assignments`, then drop
   `event_categories`. Foreign keys use `ON DELETE RESTRICT` on the vocabulary
   side and `CASCADE` on the owner side, matching `user_interests` — retiring a
   vocabulary entry must fail loudly rather than silently deleting it from
   everything that used it.
4. Backend: club category, club tags and event tags — read and write. All
   validate slugs against their vocabulary and answer 400 for an unknown one,
   the way `UserProfileService` does, rather than letting the foreign key
   surface as a 500. Cap club tags at 8 server-side. Two new public endpoints
   for the two new lists, alongside `GET /api/v1/interests`.
5. Add club tags to `SearchableText.forClub`, which currently embeds only name
   and description (D7).
6. Contract: rename `EventDTO.categories` to `tags` across all six touch points
   in one commit; add the club category and club tags fields.
7. Frontend: a category select and a tag picker on the club form, a tag picker
   on the event form. `InterestPicker` is reused as-is for club tags and
   generalised for event tags — it already fetches a vocabulary, filters by
   group and stores slugs, so lift it rather than writing a third picker.
8. Delete or deliberately keep `CategoriesSectionMainPage.tsx` (D6).
