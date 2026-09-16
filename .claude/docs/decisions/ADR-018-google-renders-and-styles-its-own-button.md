# ADR-018 — Google renders and styles its own sign-in button; we stop proxying clicks into it

**Status:** Accepted 2026-09-15
**Date:** 2026-09-15
**Decided in:** implementation, after a defect reproduced in the browser — no
meeting note
**Participants:** implementing agent · **Approved by:** awaiting Arpan
**Implemented in:** [`authentication.md`](../architecture/authentication.md) —
2026-09-15

## Context

- The backend verifies a Google **ID token** (`GoogleTokenVerifier`), and Google
  Identity Services issues one only through `accounts.id`, whose rendered button
  cannot be restyled. `GoogleAuthButton` therefore rendered Google's real button
  into a visually hidden box and forwarded clicks to it with `.click()`, so the
  design could own the visible button. Its header comment recorded that
  reasoning from the start.
- **On 2026-09-15 that stopped working in production.** Every click answered
  *Google sign-in is not ready yet. Try again in a moment.* It failed on all of
  Arpan's devices, in incognito and after a cache clear, while other people
  signed in normally against the same URL ([BUG-057](../../bugs/fixed_bugs.md#bug-057)).
- Reproduced in the browser on `https://www.campusvibe-mcgill.com`. The script
  answered 200, `window.google.accounts.id` was present, the console was clean —
  no CSP violation and no `GSI_LOGGER` origin error — and both apex and `www`
  were registered as authorized origins. What the hidden box held was
  `div > div > div > iframe`, the iframe served from
  `accounts.google.com/gsi/button`. There was no `div[role=button]` anywhere on
  the page.
- Nothing in a page can click into a cross-origin iframe. The technique had no
  remaining move: the selector was not too narrow, the assumption underneath it
  was wrong.
- **The shape is not a contract, and varies by context, not just by browser.**
  In the same Chrome within the same minute, `http://localhost:3000` painted the
  light-DOM markup while production painted the iframe — which is why localhost
  kept working throughout and hid the failure during development.
- The old code proves the diagnosis by construction: the visible button was
  disabled until `ready`, and `ready` was set immediately after `renderButton`
  returned. The message could therefore only appear once GIS had loaded and been
  called. The script was never the problem.

## Options considered

### A. Google renders and styles the button — chosen

Delete the proxy. GIS paints into a visible container and whatever it paints is
the real control, whatever internal shape it chooses. We keep only the options
the API exposes — `theme`, `size`, `shape`, `text`, `width` — and lose the rest.
Nothing in our code depends on Google's private DOM again, which is the property
that failed. Frontend only: the ID token still arrives at the same callback, so
`GoogleTokenVerifier` and `AuthenticationService` are untouched.

Costs, and they are visible in the auth modal: Google's button is 40px tall
against our 48px `lg`, sets its label in Roboto rather than Figtree, and brings
its own hover — so the border-only hover of the `outline` variant, the entire
reason `GoogleAuthButton` was written, is gone. The label wording is Google's
too: *Log in with Google* is not on offer, so login now reads *Sign in with
Google*.

### B. Keep our button and overlay Google's invisibly on top

Our button as the visual, Google's real one positioned over it at `opacity: 0`
and matched width, so a genuine user click lands on Google's control through the
browser rather than through `.click()`. Keeps the design and the backend, and is
indifferent to the internal shape.

Rejected as the first move, not as wrong. It keeps a second fragile coupling —
the invisible hit area must track the visible one through every width, zoom and
font change, and when it drifts the failure is once again a button that looks
fine and does nothing. This ADR exists because a clever coupling to Google's
button broke silently in production days before a demo; replacing it with a
different clever coupling is the same bet. Kept as the recorded fallback if the
design mismatch proves unacceptable.

### C. The OAuth code flow (`accounts.oauth2`)

A fully custom button, because we open Google's popup ourselves rather than
embedding a widget. It returns an authorization **code**, not an ID token, so the
backend must exchange the code at Google's token endpoint using a **client
secret** — a new endpoint, a new secret to provision in Elastic Beanstalk, and a
rewrite of `GoogleTokenVerifier` and `AuthenticationService`. The header comment
had already rejected it on that basis. Rejected again: it is days of work in the
authentication path, and it introduces a secret where today there is only a
public client id (`application.yml:77`).

### D. Widen the selector and keep the proxy

Look for an iframe as well as `div[role=button]`. Rejected outright: a
cross-origin iframe cannot be clicked programmatically, so this does not work at
all, and it would re-commit to reading Google's private DOM.

## Decision

The Continue with Google control **is** Google's button. GIS renders it into a
visible container, styled only through the options GIS exposes, and no code of
ours inspects, wraps or clicks anything inside that container.

## Consequences

- Two buttons in the auth modal no longer match: Google's is 8px shorter, in a
  different typeface, with a different hover. Accepted deliberately — that is the
  price of the control being real.
- Login copy changes from *Log in with Google* to *Sign in with Google*, because
  Google owns the wording. `text` is the only lever, and the call sites now pass
  a GIS option rather than a free-text label.
- The width is measured from the container rather than hardcoded; GIS clamps to
  200-400, so in a container wider than 400 the button is centred, not stretched.
- **A button that never paints now says so.** GIS reports nothing when it paints
  nothing, so the container is watched and an empty one after 8 seconds reports
  that sign-in could not load, naming the email alternative. The previous message
  blamed timing for a structural failure and invited the user to retry forever.
- Keyboard and screen-reader behaviour improve: focus lands on Google's real
  control, which carries its own accessible name, instead of on a button of ours
  that then failed.
- No backend change, no contract change, no new secret.

## Revisit when

- Google changes the button API, or GIS is deprecated in favour of FedCM
  outright — at which point the rendering question reopens from scratch.
- The design decides the mismatch in the auth modal is not acceptable. Option B
  above is the recorded fallback and needs no backend work.
- A future surface needs a Google control the button API cannot express. That is
  the trigger for option C, and it should be taken deliberately, with the client
  secret planned rather than discovered.
