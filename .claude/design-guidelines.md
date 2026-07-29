# CampusVibe Design Guidelines

**Direction: "Ticket stock."** CampusVibe is where students find out what's happening this week and actually go. The interface borrows its language from the artifact at the center of that world: the event ticket. Cards are structured like ticket stubs with a perforated divider, all machine data (dates, times, prices, seat counts) is set in a mono "printed" voice, and the page itself stays white and quiet so event imagery and the lavender brand carry the energy.

## Research grounding

- **Eventbrite (Marmalade)** commits to one signature color pushed to full brightness ("Brite Orange") and a single typeface (Benton Sans) with restrained weights. Lesson adopted: one color family used with conviction; restraint in type weights.
- **Meetup (Swarm)** builds identity from a symbolic device (dots forming the "m") and duotone photography. Lesson adopted: a repeatable, ownable visual device — ours is the ticket perforation, which is subject-derived (events → tickets) rather than decorative.
- Differentiation: Eventbrite is orange, Meetup is red; both use dense, dark-saturated marketing surfaces. CampusVibe is **lavender on white** — airy, gallery-like, with the logo's berry outline as the only second voice.

Sources: [Eventbrite Marmalade](https://www.tnflnt.co/work/eventbrite-marmalade), [BUCK Eventbrite rebrand](https://buck.co/work/eventbrite), [Meetup rebrand](https://medium.com/meetup/meetup-rebrand-22087674d546), [Swarm design system](https://meetup.github.io/swarm-design-system/components/).

---

## Color

Both brand colors come from the logo itself: the lavender-violet script fill and its deep berry outline. Everything else is a violet-tinted neutral. **The background is always white.**

| Token | Hex | Use |
|---|---|---|
| `lavender-50` | `#F6F2FE` | Tint washes, hover fills, selected rows |
| `lavender-100` | `#EDE5FD` | Chips, badges, dropdown highlights |
| `lavender-200` | `#DCCEFB` | Decorative fills, progress tracks |
| `lavender-300` | `#C3A8F7` | Borders on active elements, focus rings |
| `lavender-500` | `#8B5CF6` | Logo match — large decorative fills, icons |
| `lavender-600` | `#7440E0` | **Primary actions, links** (4.9:1 on white) |
| `lavender-800` | `#4B2A9C` | Hover/pressed states, emphasis text |
| `berry-600` | `#A82F5E` | Secondary accent: prices, likes, "Almost full" |
| `berry-700` | `#8E2750` | Berry hover/pressed (logo outline match) |
| `ink-900` | `#201731` | Primary text, footer background |
| `ink-600` | `#5D5470` | Secondary text, captions |
| `mist-200` | `#E9E4F2` | Hairlines, card borders, dividers |
| `mist-100` | `#F5F3FA` | Section washes, input backgrounds |
| `go-600` | `#1E7F4F` | Success only |
| `alert-600` | `#C03A2E` | Errors only |
| `sun-300` | `#FFD166` | "Happening now" highlight only |

Rules: never place lavender text on lavender fills below 600-on-100. Berry is an accent, not a theme — if a screen has more berry than lavender, it's wrong. Status colors never decorate.

## Typography

| Role | Face | Weights | Where |
|---|---|---|---|
| Display | **Bricolage Grotesque** | 500–800 | Headlines, section titles, dashboard numbers, empty states |
| Body / UI | **Figtree** | 400 / 500 / 600 / 700 | Everything readable: paragraphs, buttons, nav, forms |
| Ticket data | **Spline Sans Mono** | 400 / 500 | Dates, times, prices, capacity counts, IDs — anything "printed on the ticket" |

Scale (rem): display-1 `clamp(2.25, 5vw, 3.25)/1.05` · h2 `1.5/1.2` · h3 `1.125/1.3` · body `0.9375` · caption `0.8125` · data `0.8125` (mono). Mono labels are UPPERCASE with `0.08em` tracking. Body text is `ink-900`; secondary is `ink-600`; never pure gray.

## Spacing & layout

4px base unit. Containers `max-w-7xl` with `px-4 sm:px-6 lg:px-8` gutters. Section rhythm: `py-10` mobile, `py-16` desktop. Card gap `24px` (`gap-6`). Nav height `64px`. Dashboards use a 12-col grid; tiles span 3 (stats) / 6 (lists).

## Sizing (cards keep current dimensions)

- **EventCard: 288px wide (`w-72`)** in horizontal rails; fluid (`w-full`) inside responsive grids. Image area 160px tall.
- **ClubCard: 240px wide (`w-60`)**, centered logo 64px circle.
- Banner carousel: 300px mobile / 400px desktop tall, radius 16.
- Stat tiles: min-height 112px.

## Radius & elevation

Radius: cards `16px`, inputs `12px`, buttons & chips `full`, in-card images `12px` top corners. Elevation: **flat at rest** — 1px `mist-200` border, no shadow. Hover: translate -2px + `0 12px 28px -12px rgb(32 23 49 / 0.25)`. Focus: 2px `lavender-300` ring, 2px offset, never removed.

## Signature: the ticket perforation

Every EventCard separates its image from its details with a perforation: a dashed `mist-200` hairline with two punched semicircle notches at the edges (`.ticket-divider` utility). Price and date on the stub side are mono. This is the one loud device — nothing else on the card decorates. Dashboard "admission" stat tiles may reuse the notch motif; nothing else does.

## Motion

- `--ease-snap: cubic-bezier(0.2, 0, 0, 1)`, durations 150ms (hover) / 300ms (reveals).
- Cards and tiles lift on hover (150ms). Buttons press to `scale(0.98)`.
- Sections fade-up 12px once on load, 60ms stagger (`.fade-up` utility). No scroll-jacking, no parallax.
- `prefers-reduced-motion: reduce` disables all transforms and reveals.

## Components

- **Button** — primary: `lavender-600` fill, white text, full radius, hover `lavender-800`; secondary: white, 1px `mist-200` border, `ink-900` text, hover `lavender-50`; berry variant reserved for destructive/love actions. Heights 40/48.
- **Chip** — `lavender-100` fill, `lavender-800` text, full radius; selected: `lavender-600`/white.
- **Inputs** — `mist-100` fill, 1px transparent border, radius 12; focus: white fill + `lavender-300` ring.
- **Badges** — mono, uppercase: "Almost full" = berry-600 text on `#F7E6EE`; "Happening now" = `ink-900` on `sun-300`.
- **Navbar** — white, 1px mist hairline, active link `lavender-600`; CTA = primary button.
- **Footer** — `ink-900` background, lavender-300 headings, mist links.
- **Stat tile (dashboards)** — Bricolage number `2rem`, mono uppercase label, white card, mist border.

## Voice

Sentence case everywhere. Buttons say what they do: "Save your spot", "Follow club", "Create event". Empty states invite: "No events yet — be the first to host one." Errors say what happened and what to do next. Mono labels are terse: `DATE`, `PRICE`, `SEATS LEFT`.
