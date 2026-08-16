# Authentication

**Code as of:** `01e3b30`, **plus the uncommitted V10 provider work of
2026-08-15** — every claim below was read from the code, and the endpoint
behaviours were measured against a running stack the same day. Re-stamp with the
real sha once that work is committed.

**Authors:** written by the agent that switched on Google sign-in and removed
the old `/login` page. **No `security` agent has reviewed it.** The findings in
*Known gaps* are one engineer's reading, not a security review — treat them as a
starting list, not a clearance.

**State:** live. Both sign-in methods, password reset and email verification
all work end to end against Postgres, and all four findings from the 2026-08-15
review are fixed (BUG-028 ... BUG-031). The one remaining structural gap is
revocation: a token cannot be withdrawn before it expires. See *Known gaps*.

> This document replaces the 2026-08-06 *Authentication Implementation Guide*,
> which was a plan rather than a description and had drifted badly — it
> documented an email + verification-code flow that has never existed, and
> `/login`, `OAuthButtons.tsx`, `AuthForm.tsx` and `AuthCard.tsx`, all deleted
> on 2026-08-14.

---

## In one paragraph

There are exactly two ways to get into CampusVibe: a Google account, or an email
address with a password. Both hand back the same thing — a signed token the
browser keeps and sends with every later request — so nothing downstream cares
which one you used. A forgotten password can be reset by email, new accounts are
sent a confirmation link, and repeated wrong guesses lock an account for fifteen
minutes. Locally no mail is actually sent: the links are written to the backend
log, so the whole thing can be exercised without a mail account. **Two things
still matter before real students use this.** A token that has been issued
cannot be taken back before it expires fifteen days later, so signing out does
not truly end a session. And no mail provider has been chosen or tested for
production, so today the reset flow only works for someone who can read the
server log. Both are written up in the todo.

---

## Read this before you change anything here

- **The token is the contract.** `JWTUtil.issueToken` (`JWTUtil.java:54`) is the
  only place a session is created, and all three entry points funnel through
  `AuthenticationService.respondWithToken` (`AuthenticationService.java:86`).
  Change the claim shape and you change `JWTAuthenticationFilter`,
  `user-roles.md` and the frontend at once.
- **The JWT deliberately carries identity and roles only** — no club ids, no
  permissions. Ownership is re-checked against the database on every request
  (`ClubPermissionService`). Putting authorisation data in the token would make
  a stale token an authorisation bug.
- **`users.auth_provider` and a nullable `users.password` are load-bearing**
  (V10). Three check constraints enforce the model: provider is LOCAL or GOOGLE,
  LOCAL has a hash and GOOGLE has none, and email is always lowercase. Any code
  reading `getPassword()` must cope with null.
- **Only one endpoint may confirm an account exists** - `GET /api/v1/auth/email-status`,
  because signup needs it. Login answers an identical 401 for unknown email and
  wrong password, and `forgot-password` answers 204 for everything. Both must
  stay true.
- **Reset and verification tokens are one mechanism**, in `auth/token/`. Only
  the SHA-256 reaches the database; the raw token exists once, in the email.
  Issuing a new one deletes the previous one of that purpose.
- **`MailSender` is an interface with two implementations chosen by config.**
  No SMTP host configured means messages are logged, not sent - that is how the
  flows are tested locally. Never make it throw on a delivery failure: a
  `forgot-password` that 500s tells the caller the address exists.
- **Auth is a modal, not a route.** There is no `/login`. Server-side redirects
  go to `/?auth=<view>` and `AuthModalUrlTrigger.tsx` reopens the modal.
- **Bound docs:** [`user-roles.md`](user-roles.md) owns the role model and is
  cited as authority by four source files; [`api-and-caching.md`](api-and-caching.md)
  owns `apiFetch` and the rule that authenticated responses never enter the
  shared cache.
- **The one invariant that is easy to break:** every user must have `ROLE_USER`.
  `defaultRole()` (`AuthenticationService.java:92`) throws at runtime rather
  than creating it, because the row is seeded by Flyway V7.

---

## Overview

Authentication is stateless and bearer-token based. Two credential types are
accepted at the edge — a Google ID token, or an email and password — and both
are exchanged for the same internal artefact: an HS256 JWT signed with
`JWT_SECRET`, valid for 15 days, carrying the user id as subject plus `email`
and `roles` claims. There are no server-side sessions
(`SessionCreationPolicy.STATELESS`) and no refresh tokens. The browser stores the JWT in `localStorage` under `cv_jwt` and
`apiFetch` attaches it as `Authorization: Bearer …` when a caller passes
`auth: true`.

The asymmetry worth holding in mind: **Google is an identity provider, not a
session provider.** Google's token is verified once, at the moment of sign-in,
and then discarded. Nothing about the resulting CampusVibe session distinguishes
it from a password session — same token, same lifetime, same claims. This is why
signing out of Google does not sign you out of CampusVibe, and why revoking the
app's Google access does nothing to an already-issued JWT.

Every request after sign-in is authenticated by `JWTAuthenticationFilter`, which
parses the bearer token, loads the user **from the database by id**, and only
then populates the security context. The database round-trip on every request is
deliberate: it means a deleted user's token stops working immediately
(`AuthenticationFlowIT.tokenForDeletedUserIsRejected`), which is the only
revocation mechanism the system currently has.

---

## File-by-file breakdown

### Backend

#### `auth/AuthenticationController.java`
Four public entry points under `api/v1/auth`: `login`, `register`, `google`, and
`GET email-status`. All three POSTs are `@Valid` and strongly typed. Each
success returns the token both in the body and in an `Authorization` response
header; the frontend reads the body and ignores the header.

The class carries `@Validated`, which is what makes the constraints on the
`email-status` `@RequestParam` fire - `@Valid` alone covers request bodies only.
The unused `GET /health` was removed; actuator already answers that.

#### `auth/AuthenticationService.java`
All three flows and the single token-issuing path.

- `login` (`:40`) delegates to Spring's `AuthenticationManager` and returns a
  token for the authenticated principal.
- `register` (`:52`) rejects a duplicate email with `DuplicateResourceException`
  (→ 409), bcrypt-hashes the password, attaches `ROLE_USER`, and signs the user
  straight in — there is no verification step between registering and having a
  valid session.
- `googleSignIn` (`:66`) verifies the ID token, then **finds or creates** a user
  keyed on the email in the token.
- `respondWithToken` (`:86`) is the only caller of `JWTUtil.issueToken`.

#### `auth/GoogleTokenVerifier.java`
Wraps Google's `GoogleIdTokenVerifier`, built once at startup with the audience
pinned to `google.clientId`, so a token issued to a different OAuth client is
rejected. `verify` returns the typed `GoogleIdToken.Payload`, or null for any
unusable token.

**When the client id is blank it builds no verifier at all**, logs a startup
warning, and rejects every token - fail closed. It also catches
`IllegalArgumentException` alongside the checked exceptions, because Google's
parser rejects a structurally malformed token *before* verification with an
unchecked one. Those two behaviours are
[BUG-030](../../bugs/bugs.md#bug-030) and [BUG-028](../../bugs/bugs.md#bug-028);
both were defects here, so treat this file as the place where getting it wrong
is expensive.

#### `auth/GoogleSignInRequest.java` · `AuthenticationRequest.java` · `RegisterRequest.java` · `EmailStatusResponse.java`
Request and response records, all validated. `@Email`, `@NotBlank`, and
`@Size(min = 8, max = 72)` on the password (`RegisterRequest.java:10`). The 72
is not arbitrary: bcrypt silently truncates input beyond 72 bytes, so the
ceiling makes the truncation impossible rather than invisible.
`GoogleSignInRequest.idToken` is `@NotBlank`
([BUG-029](../../bugs/bugs.md#bug-029)). `EmailStatusResponse` carries
`exists` and `provider`.

#### `security/SecurityFilterChainConfig.java`
The filter chain. CSRF disabled — correct for a stateless bearer-token API with
no cookie auth, and the reasoning is now written next to the line rather than
implied by it, because CodeQL flags it (`java/spring-disabled-csrf-protection`)
and every reader after this one deserves the answer in place. In short: CSRF
tokens defend credentials the *browser* attaches unprompted, and a cross-site
form cannot set an `Authorization` header. **The condition under which this stops
being true is written down**: moving the JWT into a cookie
([BUG-003](../../bugs/bugs.md#bug-003)) must re-enable CSRF in the same change.
Three POST endpoints are `permitAll`; `/actuator/**`,
`/api/v1/auth/email-status` and public club/event reads are `permitAll` for
GET; everything else requires authentication.

#### `security/ratelimit/` — `AuthRateLimiter` · `AuthRateLimitFilter` · `RateLimitProperties`
Two independent controls over the unauthenticated surface.

`AuthRateLimitFilter` enforces a **per-IP request budget** across `/login`,
`/register`, `/google` and `/email-status`. It is a servlet filter rather than
an interceptor so it runs *before* bcrypt: a limiter that fires after the hash
has been computed does not protect the CPU it was added to protect. Over
budget answers 429 with `Retry-After`.

`AuthRateLimiter` also holds **per-account failed-login counts**, checked in
`AuthenticationService.login` — the only layer that has parsed the body and so
knows which address is being attempted. Over the limit throws
`TooManyAttemptsException`, mapped to 429 with `Retry-After`.

Both are Caffeine caches: bounded and self-expiring, because a map keyed by IP
or email with no eviction is an unbounded allocation an attacker controls.

#### `security/SecurityConfig.java`
Declares `BCryptPasswordEncoder` - **this is the entirety of the
password-hashing policy** - and wires the `ProviderManager`.

#### `security/EmailPasswordAuthenticationProvider.java`
Loads the user by email and compares with `passwordEncoder.matches`. **Rejects a
null stored password first**, because a Google account has none and
`matches(raw, null)` would throw. Throws `BadCredentialsException` on mismatch;
`UserDetailsServiceImpl` throws `UsernameNotFoundException` for an unknown
email, and the exception handler maps **all three** to a 401 reading `Invalid
credentials` - so login leaks neither which emails exist nor which provider owns
them. Verified: probes 3, 4 and 15 below.

#### `security/CorsConfig.java`
Origins from `cors.allowed-origins`, defaulting to `http://localhost:3000`
(`application.yml:39`). Applied to `/api/**` only. `Authorization` is both an
allowed and an exposed header.

#### `jwt/JWTUtil.java`
Issues and parses tokens. The constructor (`:29`) refuses to start on a missing
or under-32-byte secret — the comment at `:31` gives the reasoning: booting with
a weak secret silently issues forgeable tokens, which is worse than not booting.
HS256, 15-day expiry (`:61`), issuer pinned and required on parse (`:92`).

#### `jwt/JWTAuthenticationFilter.java`
Per-request authentication. Absent or non-`Bearer` header → pass through
unauthenticated (`:39`). A malformed, expired or forged token is caught and
treated as *not authenticated*, never a 500 (`:47-52`, and the comment at `:45`
says so). The user is loaded by id and the token re-validated against that id
(`:56-59`).

#### `exception/DefaultExceptionHandler.java`
Maps `BadCredentialsException` and `UsernameNotFoundException` to 401,
`DuplicateResourceException` to 409, and both `MethodArgumentNotValidException`
and `ConstraintViolationException` to 400. The catch-all now **logs** the
exception and returns a fixed string rather than echoing `e.getMessage()`:
echoing handed internal detail to the caller for anything unmapped, which is how
a null `idToken` leaked a JVM helpful-NPE naming a private field
([BUG-029](../../bugs/bugs.md#bug-029)). Anything a client legitimately needs to
act on deserves its own handler and its own status.

#### `auth/token/` — `AuthToken` · `AuthTokenPurpose` · `AuthTokenRepository` · `AuthTokenService`
One mechanism serving both password reset and email verification, because they
are the same object: a single-use secret with an expiry that proves the holder
controls an inbox. `AuthTokenService` owns every rule that must not drift —
32 bytes of `SecureRandom`, only the SHA-256 stored, single use, expiry, and
issuing invalidates the previous token of that purpose.

SHA-256 rather than bcrypt is deliberate and worth not 'fixing': the token is
already 256 bits of randomness, so there is no low-entropy secret for a slow
hash to protect, and lookup happens *by hash*, which a per-row salt would make
impossible without scanning the whole table.

#### `mail/` — `MailSender` · `LoggingMailSender` · `SmtpMailSender` · `MailConfig` · `AppMailProperties`
`MailSender` is one method. `MailConfig` picks the implementation from
configuration alone: `spring.mail.host` set selects SMTP, absent selects the
logging sender. They are `@Bean` methods rather than scanned `@Component`
classes because `@ConditionalOnMissingBean` is only dependable that way.

`AppMailProperties.appBaseUrl` is the **frontend** address, not the API — a
reset link has to open a page a human can type into, and it cannot be derived
from the request, which arrives from the frontend server rather than the
browser.

#### `user/User.java` · `user/AuthProvider.java`
`User` is the JPA entity *and* the Spring Security principal. `password` is
nullable since V10; `authProvider` is a `@Enumerated(EnumType.STRING)` field
defaulting to `LOCAL`. The four `UserDetails` status flags are still hardcoded
`true` - there is no disabled, locked or expired state anywhere in the system,
so account lockout and email-verification gating have no field to hang on yet.

`AuthProvider` is `LOCAL` or `GOOGLE`, and must be changed together with the
database check constraint that mirrors it.

#### `db/migrations/V1` · `V7` · `V10__auth_provider.sql` · `V11__auth_tokens_and_email_verification.sql`
V1 creates `users` with `email TEXT NOT NULL UNIQUE` and `password TEXT NOT
NULL`. V7 replaces the single `role` column with `roles` / `user_roles`, seeds
the three role rows, and guarantees every existing user `ROLE_USER`. V10 adds
`auth_provider`, drops the `NOT NULL` from `password`, lowercases every email,
and adds three check constraints binding those rules. **Rows created before V10
stay `LOCAL`**: the placeholder hashes the old code wrote are bcrypt output and
so cannot be told from real ones, and guessing would lock a real user out of
their password. V11 adds `auth_tokens` and `users.email_verified`, grandfathering
every existing account in as verified — they predate the feature, and treating
them as unverified would retroactively penalise people who did nothing wrong.

### Frontend

#### `app/components/auth-components/GoogleAuthButton.tsx`
The Google button used by the modal. Its header comment (`:8-20`) carries the
key reasoning: the backend verifies a Google **ID token**, and Google Identity
Services only issues one through `accounts.id`, whose rendered button cannot be
restyled. So Google's real button is rendered into a visually hidden box
(`:174`) and clicks are forwarded to it from the button the design calls for
(`:136-148`). `.click()` inside a real click handler preserves the user
activation Google needs to open its popup.

Gated on `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (`:60`): unset, it renders *Google
sign-in is not configured* (`:150`) instead of a dead button.

#### `app/components/auth-components/AuthModal.tsx` and its views
`LoginView`, `SignupChoiceView`, `EmailSignupView`, `RecoverPasswordView`, over
`AuthTextField` and `AuthDivider`. `SignupChoiceView` and `LoginView` each mount
a `GoogleAuthButton`.

**`RecoverPasswordView.tsx` is a deliberate stub and says so** (`:10-14`): it
validates the address and shows *Check your email*, and sends nothing. The
confirmation text it shows is a lie to the user today.

#### `app/components/auth-components/GoogleProvider.tsx`
Loads `https://accounts.google.com/gsi/client` once from the root layout. Note
`GoogleAuthButton` also loads the same script defensively (`:115-129`), guarding
on the existing tag — so the provider is not strictly required.

#### `app/components/auth-components/AuthModalUrlTrigger.tsx` · `AuthTrigger.tsx`
Added 2026-08-14 with the `/login` removal. The first turns `?auth=<view>` into
an open modal and strips the parameter; the second lets a Server Component
parent raise the modal. Both exist because middleware and Server Components
cannot call `useAuthModal`.

#### `app/lib/api.tsx`
`getToken` / `setToken` / `clearToken` over `localStorage['cv_jwt']` (`:42-57`),
and `apiFetch`, which attaches the bearer token when `auth: true` (`:98-101`)
and refuses to cache authenticated responses (`:87-92`).

#### `app/lib/user.tsx` · `app/lib/auth-context.tsx`
`login`, `register`, `googleSignIn` each POST and store the returned token;
`checkEmailStatus` backs the signup collision hint; `me()` re-reads the user
from the token on load.
`auth-context` holds `user`, `isAuthenticated`, `loading` and exposes the three
sign-in calls plus `logout`, which **only clears localStorage** — the token
stays valid server-side until it expires.

#### `app/lib/validators/authValidator.ts`
Client-side field checks, with the header comment stating the intent: name the
problem next to the field, while the backend stays the authority. `MIN_PASSWORD_LENGTH
= 8` mirrors `RegisterRequest`. Note `validateLogin` deliberately applies no
length rule (`:27`) — telling someone their existing password is too short is
nonsense.

---

## How Google sign-in works, end to end

```
Browser                          CampusVibe backend            Google
   │ click Continue with Google
   │  → forwarded to the hidden GIS button
   │────────────────────────────────────────────────────────────▶ popup
   │◀──────────────────────────────────────────── ID token (JWT, RS256)
   │ POST /api/v1/auth/google { idToken }
   │────────────────────────────▶
   │                    GoogleTokenVerifier.verify
   │                      ├ signature against Google's public keys ──▶
   │                      ├ issuer = accounts.google.com
   │                      ├ audience = google.clientId
   │                      └ not expired
   │                    find user by payload email, else create
   │                    issue CampusVibe JWT (HS256, 15 days)
   │◀──────────────────────────── { token, user }
   │ localStorage['cv_jwt'] = token
```

**Configuration, and why there are two variables for one value.** The same
public client id is needed in two places for two different reasons:
`GOOGLE_CLIENT_ID` is the audience the backend validates against
(`application.yml:54`, passed through at `docker-compose.yml:69`), and
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is inlined into the browser bundle so GIS can
start the flow. The second is a **build-time** inline, so changing it requires
recreating the frontend container, not just a `compose watch` sync. Both blank
is a supported mode: the button degrades to a message and the endpoint stays up.

In Google Cloud Console the client must be type **Web application** with the
app's origin registered under *Authorized JavaScript origins*. No redirect URI
is needed — the credential is delivered to a JavaScript callback, not a
redirect. Origins are currently registered for localhost and the production
domain.

**What Google's token is checked for, and what it is not.** The library verifies
signature, issuer, audience and expiry. The application then reads `email` and
`name` (`AuthenticationService.java:73-74`) and **does not read
`email_verified`** — see *Known gaps*.

---

## Design decisions

### General

| Decision | Problem it solves | Rejected alternative | If reverted |
|---|---|---|---|
| Stateless JWT, no server sessions | Backend must scale horizontally behind EB with no sticky sessions or shared session store | Server-side sessions in Postgres or Redis — correct, revocable, and a whole component to run | Revocation becomes possible; an infrastructure dependency appears |
| Identity + roles in the token, nothing else | A token outlives the state it describes; club ownership in a claim becomes an authorisation bug the moment ownership changes | Embedding permissions or club ids to save a query | Saves one DB read per request, buys stale-authorisation bugs. Explicitly reasoned at `JWTUtil.java:48-53` |
| Load the user from the DB on every request | Deleted or altered users must stop working immediately; it is the only revocation the system has | Trusting the claims and skipping the read | Faster; a deleted user's token keeps working for 15 days |
| bcrypt at library defaults | Standard, adaptive, well-understood; no tuning to get wrong | Argon2id — better, and another dependency plus parameter choices | See *Known gaps*: cost factor is undeclared |
| ID-token flow, not the OAuth code flow | The backend verifies an ID token; `accounts.id` is the only GIS surface that issues one | `accounts.oauth2` code flow — allows a fully custom button, returns a code, would mean rewriting `GoogleTokenVerifier` and `AuthenticationService`. Reasoning at `GoogleAuthButton.tsx:18-20` | The hidden-button hack disappears; two backend classes change |
| Fail fast on a missing or short `JWT_SECRET` | A default secret in a committed file signs forgeable tokens in every environment that forgets to set it | Generating a random secret at boot — every restart silently logs everyone out | Reasoned at `JWTUtil.java:31-33` |

### Task-specific

**A Google account has no password, and says so.** *(V10, 2026-08-15.)*
`users.auth_provider` is `LOCAL` or `GOOGLE`, and `users.password` is nullable,
with a check constraint tying the two together: LOCAL must have a hash, GOOGLE
must not. Before this, `password` was `NOT NULL` (V1) and `googleSignIn` stored
a bcrypt hash of `"google-login-" + System.nanoTime()` to satisfy it — which
made three things unanswerable: whether an account can log in with a password,
what *reset your password* should mean for a Google user, and whether a signup
collision should say *log in* or *continue with Google*.

The rejected alternative was a `user_identities` table, correct for a person who
arrives by two routes but premature while every account has exactly one origin.
Facebook sign-in is the trigger to revisit it, which is why that work is
sequenced after this migration rather than before.

**Consequence of reverting:** `EmailPasswordAuthenticationProvider` would call
`passwordEncoder.matches(raw, null)` for a Google account. The null guard at
`:29` is what makes the nullable column safe, and it rejects with the same
`Invalid credentials` as a wrong password — deliberately, so that login does not
become a way to ask which provider owns an address.

**Signup asks whether an address is taken; login never tells.**
`GET /api/v1/auth/email-status` confirms that an account exists and names its
provider. It is the one endpoint in the system that does this on purpose. The
signup form calls it when the email field loses focus, so someone who first
signed up with Google is told to continue with Google while they are still on
that field — rather than choosing a password, submitting, and being refused.
The cost is account enumeration on that endpoint; rate limiting is what bounds
it, and login keeps its identical-401 behaviour so the leak stays confined to
the one place the product needs it.

**Google sign-in links to an existing account by email, and now requires that
the email be verified.** `userRepository.findByEmail(email).orElseGet(...)`
means a Google sign-in for an address that already has a password account logs
into that account — expected behaviour, and it avoids one person holding two
accounts. Because the match is on email alone, `email_verified` is checked
first: without it, a token carrying an unproven address would sign in as the
existing user (BUG-031, fixed 2026-08-15).

**Emails are stored and matched lowercase.** V10 folds existing rows and adds a
check constraint; `register` and `emailStatus` normalise on the way in, and
`UserDetailsServiceImpl` folds the login input. Without this, `Ada@x.com` and
`ada@x.com` are two accounts and the collision check misses half of them — the
V1 `UNIQUE` constraint is case-sensitive and would have allowed both.

**A blank client id disables Google sign-in rather than disabling the audience
check.** `GoogleTokenVerifier` builds no verifier at all when `google.clientId`
is blank, logs a warning at startup, and rejects every token. The previous
version passed a `null` audience to the builder, and a null audience makes the
underlying `IdTokenVerifier` *skip* the audience check rather than reject
everything — so any Google ID token issued to any OAuth client authenticated
(BUG-030, fixed 2026-08-15). **If reverted:** the unconfigured mode becomes a
full authentication bypass again.

**Login does not distinguish unknown email from wrong password, but register
does.** `UsernameNotFoundException` is deliberately remapped to `Invalid
credentials` / 401 (`DefaultExceptionHandler.java:74-85`), closing enumeration
on login. `register` then reopens it by returning 409 *An account with this
email already exists*. Both measured below. The trade is real — a signup form
that cannot say *you already have an account* is worse UX — but it should be a
decision, and there is no evidence it was one.

---

### Password reset and email verification

**One token table, two purposes.** Rejected: separate tables per flow, which
duplicates hashing, expiry and single-use logic — the parts that must not
diverge. The `purpose` column keeps them apart, and it is enforced: a
verification token cannot be spent on a password reset or the reverse, and both
directions are tested.

**Only the hash is stored.** A database dump must not hand over working reset
links. **If reverted:** every leaked backup becomes a set of live credentials.

**Issuing invalidates the previous token.** Without it, every link ever mailed
stays live until it expires, so the number of working credentials for an
account grows with each request — including requests an attacker triggers.

**`forgot-password` always answers 204.** Unknown address, Google account, mail
server down: all identical. Unlike `email-status`, nothing in the product needs
this endpoint to answer, so it does not. The frontend deliberately swallows
errors for the same reason, and there is a test pinning that.

**A Google account gets no reset mail.** It has no password to reset, and
mailing a link anyway would turn a mailbox compromise into a way to bolt a
password onto a Google account.

**Redeeming a reset link also verifies the address and clears the lockout.**
Both follow from what the redemption proves: the person reached the inbox. Not
clearing the counter would leave someone locked out immediately after proving
who they are.

**Verification is enforced by a switch that is off.**
`campusvibe.auth.require-verified-email` refuses sign-in to an unconfirmed
LOCAL account. Off by default because it is a product decision, not a security
one: it trades a real barrier against throwaway addresses for locking out
anyone whose mail never arrives. When on, the refusal is **403 with its own
exception**, not 401 — the password *was* right, and answering 401 would send
the user round a loop retrying a correct password. The check runs *after*
authentication, never instead of it, so it cannot confirm an address to someone
who has not proven they hold the credentials.

**Mail failures are swallowed, not propagated.** A `forgot-password` that
returns 500 because SMTP is down is both an account oracle and a dead end for
the user. `SmtpMailSender` logs the recipient and never the body — the body
carries a working link.

### Rate limiting and lockout

**Two controls, not one.** The per-IP budget is what actually bounds guessing,
signup spam and enumeration through `email-status`. Per-account lockout catches
a distributed attempt that stays under the per-IP budget from any single
source. Either alone leaves an obvious hole.

**Counters are in memory.** One backend instance today, so a shared store would
be infrastructure bought for nothing. Rejected: Redis (a service in compose and
in the production deploy that nothing else needs) and Postgres columns (a write
on every failed login, and a migration). **If reverted to no limiter:** online
password guessing becomes unbounded again. **What breaks silently:** a second
instance doubles the effective limit, and a restart forgives every counter.
The `AuthRateLimiter` surface is deliberately small enough to swap.

**Lockout is time-boxed, not permanent.** A permanent lock hands an attacker a
way to deny a known user their account by failing on purpose. Fifteen minutes
bounds both the guessing and the denial.

**Failures against an unknown address are counted too.** Counting only real
accounts would make them distinguishable by whether the response ever becomes a
429 — reinstating, through the limiter, exactly the enumeration the identical
401 exists to prevent.

**X-Forwarded-For is trusted only when configured to be.** Behind an ALB the
remote address is the load balancer and every caller shares one bucket; on a
directly exposed app, trusting the header lets a caller forge an IP per request
and bypass the limit entirely. Neither default is safe everywhere, so it is
configuration (`trust-forwarded-header`) and **the safe one is the default**.
Production behind a load balancer must set it true or the limit applies to the
whole world at once.

**The limiter is off under the `test` profile.** The suite makes failed sign-in
attempts on purpose and would otherwise lock itself out and fail for reasons
unrelated to what it asserts. `AuthRateLimitIT` switches it back on with its
own small limits.

**The refusal is produced by `@ControllerAdvice`, not by the filter.** A filter
runs before `DispatcherServlet`, so the obvious implementation — write the JSON
in the filter — is what the first version did, and it drifted from the shape
every other error uses ([BUG-032](../../bugs/fixed_bugs.md#bug-032)).
`RateLimitResponses` now hands a `TooManyAttemptsException` to
`handlerExceptionResolver` and lets the existing advice answer it. **If you add
another filter that must refuse a request, do the same** rather than writing a
second body by hand; there is exactly one place that knows what an error looks
like, and it is not the filter.

## Measured behaviour

Probed against the Docker stack on 2026-08-15 at `01e3b30`. These are observed
responses, not assertions from reading code.

| # | Request | Result |
|---|---|---|
| 1 | `POST /register`, new email | 200, `{token, user}`, `roles: [ROLE_USER]` |
| 2 | `POST /register`, existing email | **409** `An account with this email already exists` |
| 3 | `POST /login`, wrong password | 401 `Invalid credentials` |
| 4 | `POST /login`, unknown email | 401 `Invalid credentials` — identical to 3 |
| 5 | `POST /register`, 3-char password | 400 `password size must be between 8 and 72` |
| 6 | `POST /google`, `aaa.bbb.ccc` | 401 `Invalid Google token` |
| 7 | `POST /google`, structurally valid JWT, wrong signer | 401 `Invalid Google token` |
| 8 | `POST /google`, `not-a-real-token` (no dots) | 401 `Invalid Google token` — was a 500 with a null body before BUG-028 |
| 9 | `POST /google`, `{}` (no idToken) | 400 — was a 500 leaking a JVM message before BUG-029 |

Re-measured after the V10 work (2026-08-15), same stack:

| # | Request | Result |
|---|---|---|
| 10 | `GET /email-status`, unknown address | 200 `{"exists":false,"provider":null}` |
| 11 | `GET /email-status`, a Google account | 200 `{"exists":true,"provider":"GOOGLE"}` |
| 12 | `GET /email-status`, same address in caps | 200, identical — normalisation holds |
| 13 | `GET /email-status?email=not-an-email` | 400 `email must be a well-formed email address` |
| 14 | `POST /register` over a Google account | 409 `This email is already registered through Google. Continue with Google to sign in.` |
| 15 | `POST /login` with a password, against a Google account | 401 `Invalid credentials` — no NPE on the null hash, and no provider disclosure |

Rate limiting, measured against the running stack with the shipped defaults
(20 requests/minute per IP, 5 failed logins, 15-minute lockout):

| # | Request | Result |
|---|---|---|
| 16 | 20 × `GET /email-status` from one IP | all 200 |
| 17 | 21st, 22nd, 23rd | 429, `Retry-After: 60` |
| 18 | `GET /actuator/health`, `GET /api/v1/clubs` while limited | 200 — the budget covers the auth endpoints only |
| 19 | 5 wrong passwords for one account | 401 each |
| 20 | 6th attempt | 429, `Retry-After: 900` |
| 21 | Correct password, while locked | **429** — guessing is not rescued by eventually guessing right |
| 22 | A different account, while the first is locked | 401 — lockout is per account |
| 23 | Six wrong passwords driven through the real login modal | attempts 1-5 show `Invalid credentials`, attempt 6 shows `Too many failed sign-in attempts. Try again later.` |

Password reset and verification, walked through the real UI against the running
stack with the logging mail sender:

| # | Step | Result |
|---|---|---|
| 24 | `POST /register` | 200, `user.emailVerified: false`, confirmation link logged |
| 25 | `POST /forgot-password` | 204, reset link logged |
| 26 | Opening the reset link | modal shows *Choose a new password*; **token stripped from the URL** |
| 27 | Submitting the new password | *Password updated* |
| 28 | Signing in with the new password | 200 |
| 29 | Signing in with the old password | 401 |
| 30 | Replaying the reset link | 401 — single use holds |
| 31 | Opening the confirmation link | *Email confirmed*, token stripped |
| 32 | Signing in afterwards | 200, `user.emailVerified: true` |
| 33 | Replaying the confirmation link | 401 |
| 34 | `POST /forgot-password` for an unknown address, and for a Google account | 204 both, and **no mail sent** in either case |

No console errors in any of the browser runs.

**Test coverage.** 21 unit and 67 integration tests pass at the time of writing.
`AuthenticationFlowIT` covers 11 cases: register success, duplicate 409,
validation, login with all roles, wrong password 401, unknown email 401,
`/users/me` with and without a token, and three token-integrity cases (garbage,
tampered, deleted user). `AuthRateLimitIT` adds 9 covering both limiter dimensions; `PasswordResetIT` 12,
`EmailVerificationIT` 11 and `RequireVerifiedEmailIT` 3 covering the two mail
flows — including that each token purpose refuses the other's token, and that a
superseded link is dead. Those three inject a `RecordingMailSender` and read the
token **out of the message body**, because the database holds only the hash and
the raw token exists exactly once, in the mail.
`AuthProviderIT` adds 18 covering the provider split,
`email-status`, case-insensitivity, the provider-aware collision message,
password login against a passwordless account, and — for the first time — the
Google endpoint itself, which is why BUG-028 and BUG-029 had survived. The
frontend hint was driven headlessly against the running stack: a Google-owned
address renders *Continue with Google*, a local one *Log in instead*, a free one
neither.

---

## Known deviations, gaps and blockers

Ordered by how much they matter. Items 1, 2, 8, 9 and 12 were **fixed on
2026-08-15** and are kept here, struck through, so the change log reads.

1. ~~A blank `GOOGLE_CLIENT_ID` accepts a Google ID token issued to any
   application.~~ **Fixed** — `GoogleTokenVerifier` now builds no verifier and
   rejects every token when unconfigured ([BUG-030](../../bugs/bugs.md#bug-030)).

2. ~~`email_verified` is never checked on the Google payload.~~ **Fixed** —
   `googleSignIn` rejects a token whose email is not verified
   ([BUG-031](../../bugs/bugs.md#bug-031)).

3. ~~No rate limiting or account lockout anywhere.~~ **Built 2026-08-15** —
   see *Rate limiting and lockout* below. Two residual limits, both accepted
   and both with the same trigger: counters live in memory, so they reset on
   restart and each instance would enforce its own budget. Move to Redis when a
   second instance exists. `User.isAccountNonLocked()` is still hardcoded
   `true` — lockout is enforced in the service, not through the `UserDetails`
   flag, because the flag has no backing column.

4. ~~Password reset does not exist.~~ **Built 2026-08-15**, end to end.

5. ~~No email verification.~~ **Built 2026-08-15.** Note the gate is **off** by
   default (`campusvibe.auth.require-verified-email`), so today an unverified
   account can still do everything a verified one can — the link is sent and
   works, but nothing yet depends on it. Turning it on is a product decision.

5a. **No mail provider is configured for production.** The logging sender is
   correct for local work and is what CI uses; nothing has been chosen or
   tested for a real deployment, and `SmtpMailSender` has never sent a message
   through a real server. Do not assume it works until it has.

5b. **Reset and verification mail is plain text only**, and delivery is
   fire-and-forget on the request thread. Fine at this volume; a slow SMTP
   server will slow the `forgot-password` response.

6. **A token cannot be revoked, and logout is client-side only.**
   `auth-context.logout` clears `localStorage`; the token stays valid for the
   rest of its 15 days. Deleting the user is the only revocation. 15 days is
   long for a token with no refresh mechanism.

7. **The JWT lives in `localStorage`** (`api.tsx:42-57`), readable by any script
   on the page. Tracked as [BUG-003](../../bugs/bugs.md#bug-003). A
   Content-Security-Policy was added 2026-08-15 (`next.config.ts`) and narrows
   what an injected script may load and where it may send anything it takes —
   but **it does not fix this**, and `'unsafe-inline'` on `script-src` (Next
   inlines bootstrap scripts) weakens it further. Only the cookie migration
   fixes it.

8. ~~[BUG-028](../../bugs/bugs.md#bug-028) — malformed Google token → 500.~~
   **Fixed** — `GoogleTokenVerifier.verify` now catches the parser's unchecked
   `IllegalArgumentException` and returns null, so the 401 path runs.

9. ~~[BUG-029](../../bugs/bugs.md#bug-029) — `GoogleSignInRequest` is
   unvalidated.~~ **Fixed** — `@NotBlank` plus `@Valid`, and the catch-all
   handler no longer echoes `e.getMessage()`: it logs the exception and returns
   a fixed string, so no unmapped exception can disclose internals. A
   `ConstraintViolationException` handler was added at the same time, because
   `@RequestParam` constraints bypass `MethodArgumentNotValidException` and were
   answering 500 for an ordinary malformed query parameter.

10. **Signup deliberately confirms which emails have accounts**, via
    `email-status` and the provider-aware 409. This is now a decision rather
    than an oversight — see *Design decisions* — but it is still an enumeration
    surface, and it is unbounded until rate limiting exists.

11. ~~No test covers Google sign-in.~~ **Fixed** — `AuthProviderIT` covers the
    endpoint. Still no unit test for `GoogleTokenVerifier` in isolation, and
    **no test exercises a genuinely valid Google token**, which cannot be minted
    in a test; the verified-payload path is covered only by manual sign-in.

12. **The V10 check constraints are not exercised by any test.** Tests run on
    H2 with `ddl-auto: create-drop` and Flyway disabled
    (`application-test.yml`), so the schema under test comes from the entity
    mapping, not from the migration. `AuthProviderIT` proves the *application*
    never writes an illegal combination; nothing proves the *database* would
    refuse one. The migration itself was applied to the real Postgres by hand
    and all three constraints are present there. Closing this properly means
    the `_database.yml` CI job asserting them, or Testcontainers for this class.

13. ~~bcrypt cost is undeclared.~~ **Fixed 2026-08-15** — pinned at 10 in
    `SecurityConfig.BCRYPT_COST`, with a note that raising it is safe for
    existing hashes but does not re-hash on login. Superseded text:
    **bcrypt cost was undeclared** (`SecurityConfig.java:18`), so it is whatever
    the Spring Security default is at the version in use — fine today, but it
    is a security parameter left implicit and unpinned.

14. **`GoogleProvider` and `GoogleAuthButton` both inject the GIS script.**
    Harmless (both guard on the existing tag) but redundant.

15. ~~`AuthenticationController` exposes an unused `GET /api/v1/auth/health`.~~
    **Removed 2026-08-15.**

---

## Possible improvements

Prioritised, each with the trigger for doing it.

**Before any real user account exists — these are the ones that matter.**

| # | Change | Why now |
|---|---|---|
| P0 | Fail closed on a blank `GOOGLE_CLIENT_ID` | Gap 1. A few lines; removes a silent full-authentication bypass from the deployment failure modes |
| P0 | Check `email_verified` on the Google payload | Gap 2. One condition; closes account takeover via silent email linking |
| P1 | Rate-limit `/login`, `/register`, `/google`; lock an account after N failures | Gap 3. Needs a decision on in-memory vs Redis — the only item here with an infrastructure choice attached |
| P1 | Fix BUG-028 and BUG-029, and add Google endpoint tests | Cheap, and the absent test is why they existed |
| P1 | Password reset, end to end | Gap 4. The UI already lies to users. Needs a mail sender — the first external dependency — and a decision on what reset means for a Google-only account |

**Before launch.**

| # | Change | Why not yet |
|---|---|---|
| P2 | Email verification on signup, gated by a real `enabled` flag | Needs the same mail sender as password reset; do them together |
| P2 | Short-lived access token + refresh token, with server-side revocation | Gap 6. A real design change — pair it with [BUG-003](../../bugs/bugs.md#bug-003) rather than doing them separately |
| P2 | Move the JWT to an httpOnly, Secure, SameSite cookie | BUG-003. Brings CSRF back into scope, currently disabled |
| P2 | An `auth_provider` column, and a nullable password | Removes the fake-password hack and makes *reset password for a Google account* answerable |
| P2 | Make signup stop confirming which emails exist | Trade against UX; make it a decision either way |
| P3 | Pin the bcrypt cost factor explicitly | Cheap; do it while touching `SecurityConfig` |
| P3 | Content-Security-Policy on the frontend | Reduces the blast radius of the localStorage token while it is still there |
| P3 | Breach-password check (HIBP k-anonymity) at signup | An outbound dependency on the signup path; only worth it once signup is otherwise solid |

**Later.**

| # | Change | Why not yet |
|---|---|---|
| P3 | Facebook / Meta sign-in | Requested; queued in [`todo.md`](../../TODO/todo.md). Adding a third provider *before* the `auth_provider` column exists would make the identity model worse, so it should follow that migration |
| P3 | Change-password and change-email flows for signed-in users | No UI surface for them yet |
| P3 | MFA / TOTP | Not proportionate to a campus events app until admin accounts control real money or PII |
| P3 | Session listing and per-device revoke | Needs refresh tokens first |
| P3 | Auth event audit log (sign-in, failure, reset, role change) | Cheap to add, most valuable once there is traffic worth reading |
| P3 | Account deletion / data export | Needed before any real-user launch under GDPR-like rules; no legal deadline yet |

---

## Change log

- 2026-08-16 — **CodeQL findings from [PR #31](https://github.com/ArpanSaha07/campus-vibe/pull/31)
  worked through.** Two touch this document: the rate-limit refusal no longer
  writes its own JSON ([BUG-032](../../bugs/fixed_bugs.md#bug-032)), and the
  reason CSRF is disabled is now stated in the code with the condition that
  revokes it. Neither was a live vulnerability — the XSS finding was unreachable
  because of a constraint held two classes away — but both were the kind of
  latent shape that becomes one on the next edit.
- 2026-08-06 — moved from `.claude/AUTH_IMPLEMENTATION.md`, unverified.
- 2026-08-14 — banner noting the `/login` page and its components were deleted.
- 2026-08-15 (d) — **Password reset and email verification shipped.** V11 adds
  `auth_tokens` (one table, two purposes, hash-only) and `users.email_verified`.
  A `MailSender` abstraction picks SMTP or a logging sender from configuration,
  so both flows work locally with no mail account. Four new endpoints, two new
  modal views, and the `RecoverPasswordView` stub is now real. 26 new tests.
  Fixed a self-inflicted regression on the way: `spring-boot-starter-mail` plus
  an empty-string `spring.mail.host` default made the mail health indicator
  report the application DOWN, so `/actuator/health` answered 503 and the Docker
  healthcheck would never have passed.
- 2026-08-15 (c) — **Rate limiting and account lockout shipped.** Per-IP budget
  across the four unauthenticated auth endpoints, per-account lockout after five
  failed passwords, both in-memory via Caffeine, both configurable, both off
  under the test profile. 9 new tests (`AuthRateLimitIT`) and a live probe of
  the running stack.
- 2026-08-15 (b) — **V10 provider split shipped.** `auth_provider` column, a
  nullable `password` bound to it by check constraint, lowercase-email
  normalisation, `GET /api/v1/auth/email-status` and the signup-time collision
  hint that tells a Google user to continue with Google. BUG-028 … BUG-031 all
  fixed with it, plus a `ConstraintViolationException` handler and a catch-all
  that no longer echoes exception messages to callers. 18 new integration tests
  (`AuthProviderIT`), the first ever to touch the Google endpoint.
- 2026-08-15 (a) — **rewritten from the code at `01e3b30`.** Removed the
  email-verification-code flow, which has never existed. Documented Google
  sign-in as built, added measured endpoint behaviour, recorded 14 known gaps
  including two new bugs (BUG-028, BUG-029) and two latent security findings.
  Author: the agent that switched on Google sign-in. Not security-reviewed.
