# ADR-015 — An event's banner is its first photo, chosen by the club

**Status:** Accepted 2026-09-15
**Date:** 2026-09-15
**Decided in:** the session plan for club and event management, with Arpan's
answers given in chat — no meeting note
**Participants:** implementing agent · **Approved by:** Arpan chose each option
in chat; the record's status is his to move
**Implemented in:** [`club-administration.md`](../architecture/club-administration.md),
[`api-and-caching.md`](../architecture/api-and-caching.md) — 2026-09-15

## Context

- On 2026-09-12 Arpan defined a banner as one of an event's photos rather than a
  stored kind, and queued a flow in which a club asks the platform owner to
  feature one: a request record, an admin queue, and approved banners as the
  event page hero and in the homepage carousel (`todo.md`, *The event banner
  request*). Its data shape was left for an ADR at its `/start`.
- On 2026-09-15, ahead of a demo, Arpan decided the club picks its banner itself,
  that it shows on the event page at once, and that an event holds at most ten
  photos, added at creation or later and removable.
- Every surface already draws the first photo: `events/[eventId]/page.tsx` takes
  `event.images[0]` as the hero, and the cards take the adapted first image.
- `event_images` had no order column. `V3__create_event_table.sql` keys it on
  `(event_id, url)`, so the order a read returned was physical row order —
  stable only until Postgres reused freed space.

## Options considered

### A. The first photo is the banner; choosing one reorders — chosen

A `sort_order` column (`V34__add_event_images_sort_order.sql`) mapped with
`@OrderColumn` on `Event.images`; `PUT /events/{id}/images/{index}/banner`
(`EventService.makeBanner`) moves that photo to position 0 in place. No DTO
field, no contract change, and every existing reader of `images[0]` is already
right.

Costs: order becomes data, so the table needs a real order column and a
migration. Reordering an `@OrderColumn` list rewrites `url` row by row, so the
`(event_id, url)` uniqueness has to be checked at commit
(`DEFERRABLE INITIALLY DEFERRED`), and the primary key moves to
`(event_id, sort_order)`.

### B. A `banner_image_key` column on `events`

Keeps photo order free and survives any reorder. Costs a new `EventDTO` field on
both sides of the contract, a change to every reader of `images[0]`, and a
pointer that has to be cleared or repaired when its photo is removed. Rejected
on the demo timeline, and because nothing yet needs photo order to mean
anything except the banner.

### C. Position, without a migration

No schema change at all. Put to Arpan with its risk — without an order column a
chosen banner can silently change later — and he chose the column instead.

### D. Build the queued approval flow first

Nothing shows until the platform owner approves it. Rejected for now: far more
than a day's work, and Arpan wants a club to control its own event page. The
approval survives, narrowed to the homepage carousel.

## Decision

An event holds at most ten photos in `event_images`, ordered by `sort_order`.
Position 0 is the banner, and the club team — anyone `canManageEvent` admits —
chooses it by moving a photo to the front. It shows on the event page
immediately, with no platform approval. Featuring an event in the homepage
carousel stays a request the platform owner approves.

## Consequences

- One endpoint, no DTO change, and correct on every surface that exists.
- The carousel request, when it is built, must not read position 0 as *approved*:
  a club can change its banner at any time. It needs a pointer of its own.
- Removing the banner photo silently promotes the next one. Accepted.
- A gallery order independent of the banner would need option B after all.
- Photos addressed by index now change under the same URL, which forced
  [ADR-016](ADR-016-media-urls-versioned-by-key-hash.md).
- V34 is immutable once pushed.

## Revisit when

- The homepage carousel request is built.
- Somebody asks for a gallery order separate from the banner.
- Club photos gain a banner or an order of their own — `club_images` has no
  order column either.
