/**
 * Turns something a user typed into an href, or into null.
 *
 * This was `normaliseProfileLink` in `app/lib/profile.ts` and moved here when
 * clubs needed it too: a club's contact links reach an href on its public page,
 * and a proposal now collects them from any signed-in user.
 *
 * Kept out of the component, and pure, so the refusals below can be tested
 * directly — every one of them is a case where getting it wrong is a security
 * bug rather than a cosmetic one.
 *
 * **This is not the control.** It runs in the browser, so anything holding a
 * token writes straight past it; `WebLinks.normalise` on the server is what
 * refuses. This stays because it guards the *render*, and a row written before
 * the server rule existed would still reach an href.
 *
 * Two jobs, in this order and not the other:
 *
 *  1. Reject any scheme that is not http or https. `javascript:alert(1)` is a
 *     perfectly valid URL and React will happily put it in an href, so a
 *     stored link is an XSS vector unless something refuses it. This runs on
 *     read rather than only on write because that is where the harm would
 *     happen — the edit form should refuse it too, but a row already in the
 *     database from before that form existed would still render.
 *  2. Only then, accept `instagram.com/someone` by assuming https. Trying the
 *     bare string as a URL first is what makes this safe: `javascript:...`
 *     parses on the first attempt and is rejected on its scheme, so it never
 *     reaches the line that would prepend https and disguise it.
 */
export function normaliseWebLink(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    // Not absolute — the usual way someone types a link.
    try {
      parsed = new URL(`https://${raw}`);
    } catch {
      return null;
    }
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

/** Letters, digits, full stops and underscores, up to 30 — Instagram's own rule. */
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

/**
 * The handle behind whatever was typed or stored, or null if there is not one.
 *
 * The Instagram field asks for a handle and the **server** builds the URL
 * (`WebLinks.normaliseInstagram`) — a handle is what somebody knows about their
 * own account, and `instagram.com/` in front of it is bookkeeping a form should
 * not make them do.
 *
 * This has both jobs the browser needs:
 *
 *  - **validating** what was typed, so a refusal appears beside the field
 *    instead of arriving as a 400 from a server the user cannot see;
 *  - **displaying** what was stored, so the profile editor shows `yourclub` in
 *    a handle field rather than the full URL the database holds.
 *
 * A pasted Instagram URL is reduced to its handle rather than refused, matching
 * the server: people paste, and refusing what the address bar gave them looks
 * broken. Any other host is null — `evil.com/someone` must not quietly become
 * an Instagram link that is not one.
 */
export function instagramHandle(value: string | null | undefined): string | null {
  let raw = value?.trim() ?? "";
  if (raw.startsWith("@")) raw = raw.slice(1);
  if (!raw) return null;

  if (INSTAGRAM_HANDLE.test(raw)) return raw;

  const url = normaliseWebLink(raw);
  if (!url) return null;
  const parsed = new URL(url);
  if (!INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const handle = parsed.pathname.split("/")[1] ?? "";
  return INSTAGRAM_HANDLE.test(handle) ? handle : null;
}

/**
 * The one shape check for a contact email, matching the server's.
 *
 * A club's contact email is not a link and must never go through
 * {@link normaliseWebLink}: it has no scheme, so it would be read as a bare
 * host and become `https://hello@club.ca`.
 */
export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
