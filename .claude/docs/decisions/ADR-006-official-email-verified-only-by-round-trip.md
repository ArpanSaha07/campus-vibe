# ADR-006 — A club's official email is verified only by a round trip to that address

**Status:** Accepted 2026-09-10
**Date:** 2026-09-08
**Raised by:** [`2026-09-08-club-ownership-spine.md`](../../specs/2026-09-08-club-ownership-spine.md),
on building the platform-admin write for `official_email` (governance item 6).
Decided by Arpan on 2026-09-08.
**Approved by:** — Arpan
**Implemented in:** `ClubAdminService.setOfficialEmail` and `PATCH /clubs/{clubId}/official-email` — the admin-write half, shipped 2026-09-09. The round trip is queued under the SES item and is **not** built.

## Context

V13 added `clubs.official_email` and `clubs.official_email_verified_at`, and its
own comment says why the address exists: it belongs to the organisation rather
than to whoever runs the club this year, and it is the durable channel for
verifying administrator changes, delivering security notices, and recovering a
club whose owner graduated without transferring ownership. Only a platform admin
may write it, enforced by keeping it out of `ClubUpdateRequest` entirely rather
than by a runtime check.

**Nothing has ever written either column.** Every club has `NULL` for both. That
made the semantics of *verified* an open question the moment the admin write was
built, because the same form field could plausibly stamp the timestamp or leave
it alone.

What the column does today is display only:

- `ClubAdminService.java:588` and `ClubOwnershipService.java:340` turn it into
  the `officialEmailVerified` boolean on `ManagedClubDTO`.
- `manage/[clubId]/page.tsx:131` uses that boolean to pick one of two sentences.
- `notifyClubInbox` (`ClubAdminService.java:534-540`) checks only that the
  address is non-blank. **Verification gates nothing** — mail goes to an
  unverified address exactly as it would to a verified one.

What it was *meant* to gate is in `club_admin_governance.md:1402-1403`:
official-email confirmation as a step when adding an administrator and when
transferring ownership. Both are unbuilt, and both were skipped because no club
has an address.

## Options considered

### A. The admin write stamps it

`setOfficialEmail` sets `official_email_verified_at = now()`. The argument is
that a platform admin typing the address is a stronger claim than a link
someone clicked, and there is precedent in the codebase:
`AdminBootstrapRunner.createAccount` sets `emailVerified` true because *the
address was supplied by whoever controls the environment, which is a stronger
claim than a confirmation link proves*.

Rejected because the precedent does not transfer. In the bootstrap case the
address is the operator's own, arriving through a deployment environment
variable. Here the admin is naming a **third party's** mailbox —
`robotics@campus.com` — typically copied from a student's message or a form.
Typing it proves the admin believes it, not that mail arrives there. A typo
would read as *Verified* permanently, and §6 and §8 are meant to build
administrator confirmation and ownership transfer on top of it.

### B. Leave it NULL until a real round trip exists

Ship the admin write; the panel goes on saying the address is not verified,
which is true. Honest but incomplete: it defines *verified* by what does not set
it, and leaves the next session to invent the mechanism.

### C. Verified means a round trip, defined now and built with SES — chosen

Setting the address issues a single-use token and mails an accept link to that
address. Redeeming the link stamps `official_email_verified_at`. Anyone holding
the club inbox can complete it; no CampusVibe account is required, because the
inbox is shared and its holder may not be a user at all.

## Decision

`official_email_verified_at` is stamped **only** when a link mailed to that
address is redeemed. An administrative write never stamps it.

Two consequences are binding on the work shipping now, before the round trip
exists:

1. **`setOfficialEmail` always writes `official_email_verified_at = NULL`.**
   Today that reads as a no-op because the column is NULL everywhere. Once
   verification exists, an admin correcting a typo must not inherit the proof
   that belonged to the previous address.
2. **The round trip is not built in this unit of work.** It ships with the AWS
   SES work queued under Security. Until then every club reads as unverified,
   which is accurate.

**The shape when it is built**, recorded so it is not re-derived: a new
`club_email_verifications` table — `club_id`, the `address` the link was sent
to, `token_hash`, `expires_at`, `used_at`. Not `auth_tokens`, whose `user_id` is
`NOT NULL` (`V11:10`), whose `purpose` CHECK constrains the enum
(`V11:15`), and whose `AuthTokenService.issue` deletes previous tokens per
*user*. A club inbox is not a user. Recording the address on the row is what
lets a later change of address invalidate an earlier proof rather than carry it
over. The redeem endpoint is `permitAll`, and its matcher must sit **above** the
broad public-GET block in `SecurityFilterChainConfig` — first match wins.

## Consequences

**Easier.** *Verified* has one meaning and it is the strong one, so the §6 and
§8 confirmation steps can be built on it without re-auditing how the flag got
set. A compromised club-admin account cannot manufacture a verified recovery
channel, which is the property V13 exists to protect.

**Harder.** Nothing is verified until SES is wired, so the two confirmation
steps stay blocked and the club dashboard shows every club as unverified
indefinitely. That is a visible incompleteness with no local workaround short of
writing the column by hand.

**Foreclosed.** There is no administrative override — no *mark as verified*
control for a platform admin. That is deliberate: an override would be the same
trust claim as option A wearing a different label, and it would be reached for
exactly when someone is impatient.

**A note on testability.** The round trip is exercisable locally without SES
once built. `LoggingMailSender` writes the message to the backend log, which is
already how password reset is tested — the link appears in
`docker compose logs backend`. So the deferral is about not building it in this
unit of work, not about being unable to.

## Revisit when

- SES lands. That is the trigger to build the round trip, and the point at which
  the deferral in this ADR is spent.
- A club is genuinely unable to complete verification — a shared inbox nobody
  can open, an address that bounces — and recovery is blocked by it. The answer
  is a recovery procedure with an audit trail, not an override switch.
- Anyone proposes marking addresses verified in bulk, for instance to unblock
  the §17 notices. That is option A returning, and the reasoning above applies
  unchanged.
