# ADR-010 — Uploads keep streaming through the API, not presigned PUT

**Status:** ✅ Accepted 2026-09-12
**Date:** 2026-09-12
**Raised by:** [BUG-039](../../bugs/fixed_bugs.md#bug-039) was closed on
2026-09-11 by a narrow fix — server-generated keys, content sniffed, 5MB cap —
and Arpan chose to decide the [`reference.md`](../../skills/s3-media/reference.md)
§9 model separately, as its own unit. It has been the first item in
[`STATUS.md`](../../STATUS.md) since.
**Approved by:** Arpan, 2026-09-12
**Implemented in:** nothing changes — this record ratifies the shape
`ClubController` and `EventController` already have.

## Context

[ADR-007](ADR-007-uploaded-media-is-streamed-by-the-api.md) decided how an
uploaded image gets *out* of S3 and to a browser: the API streams the bytes.
It deliberately did not decide how they get *in*. Today they arrive as a
multipart `POST` to the backend, which reads them into memory, derives the
object key and writes with `S3Service.putObject`
(`ClubController.java:225-231`, `:257-271`, `EventController.java:104-118`).

`reference.md` §9 describes a different shape, and describes it as a
requirement: the backend authorises, mints a short-lived presigned `PUT` URL,
and the browser uploads to S3 directly. Thirty-eight sections of that document
assume it. Nothing in the codebase implements it — `S3Service` has three
methods and none of them signs anything.

So the question is not *should we build §9 eventually*. It is whether the
shipped shape is a gap to be closed or a decision to be recorded, and that has
been ambiguous long enough that the skill file had to carry a paragraph warning
readers not to quote the reference at the code.

## Options considered

### A. Presigned PUT, per `reference.md` §9

The browser uploads to S3 directly, so image bytes never touch the app server —
the objection ADR-007 named as the real cost of streaming.

**Rejected, and the reason is specific rather than general: it would undo the
BUG-039 fix.** That fix works by reading the file's leading bytes and refusing
anything that is not PNG, JPEG or WebP before a byte is stored
(`MediaKeys.extensionOf`, `MediaKeys.java:107-127`), and deriving the extension
from those same bytes. A presigned PUT hands S3 whatever the browser sends. The
backend can validate the *intent* — a declared content type and length, both
written by the caller, which §12 already says not to trust — but it cannot
validate the *content*, because at signing time the content does not exist yet.

Recovering the check means a confirm step that fetches the object back and
sniffs it, which re-introduces the byte transfer presigning existed to avoid,
on top of a window in which an unvalidated object is sitting in the bucket.
Refusing it then is a delete, not a rejection, and BUG-039's whole point was
that the file never lands.

Presigning also needs bucket CORS for every origin that uploads, localhost
included, and an expiry to reason about.

### B. Presigned PUT for large media only, streaming for logos

Split by size: a logo is small, a future high-resolution photo is not.

Rejected as the worst of both. It is two upload paths, two authorisation
surfaces and two validation stories, chosen by a threshold nobody can defend,
at a point where the largest thing this platform accepts is 5MB
(`application.yml:34`).

### C. Keep streaming through the API — chosen

Extend ADR-007's answer from reads to writes, and say so, so the shape stops
looking like an omission.

## Decision

**Uploaded media is written by the API, as it is read by the API.** A client
sends multipart to an endpoint that has already resolved its authorisation,
the backend sniffs the bytes, generates the key and calls `putObject`. No
presigned URL is minted anywhere, for reads or for writes.

`reference.md` §9 is therefore not a to-do. It gets a banner pointing here, so
the next reader does not open a unit of work to close a gap that was closed by
deciding it is not one.

The cost ADR-007 accepted for reads is accepted again for writes, and is the
same cost: every image byte goes through the app server, capped at 5MB per file
and 10MB per request (`application.yml:34-35`), with no CDN.

## Consequences

**Easier.** One upload path, exercised identically in every environment. The
content check that BUG-039 turned on stays the only gate media passes, and it
runs before anything is stored. No bucket CORS rule is needed for uploads at
all — which makes the `GET,PUT` rule currently on `campusvibe-prod-media`
([`rules/aws-handling.md`](../../rules/aws-handling.md)) wider than anything
requires.

**Harder.** Upload bytes count against app-server throughput and memory: the
controller holds the whole file as a `byte[]` to sniff it, so a 10MB request is
10MB of heap on a 1 GiB instance ([`aws-deployment.md`](../architecture/aws-deployment.md)).
That is the number to watch, and it is what makes the cap load-bearing rather
than a nicety.

**Foreclosed.** Nothing here scales to video or original-resolution photography,
exactly as ADR-007 said of reads. This is a decision for logos and banners.

## Revisit when

- **Media grows past 5MB items** — video, or originals rather than display
  copies. At that size streaming through the app server stops being defensible
  and the validation argument above stops being decisive, because sniffing a
  200MB upload in memory is not viable either.
- **Upload traffic is a measurable share of backend memory or throughput.**
  Reads have the same trigger in ADR-007; whichever fires first, the answer is
  presigned or CDN URLs for *all* media at once, not one kind.
- **An image pipeline appears** — re-encoding to WebP (§14), thumbnails, EXIF
  stripping. Server-side processing needs the bytes anyway, which strengthens
  this decision rather than reopening it, but it changes where the work happens.
