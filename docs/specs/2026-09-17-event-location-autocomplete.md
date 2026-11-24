# Event location suggestions from Google Places, and a Maps link

**Status:** draft · **Date:** 2026-09-17

## Goal

Today an event's location is free text typed into a plain input (`CreateEventForm.tsx:424-433`), stored as `events.location TEXT` (`V3__create_event_table.sql:8`) and shown as plain text on the event page (`events/[eventId]/page.tsx:95-100`); `EventInstance.location.mapUrl` exists and is always the empty string (`adapters.ts:135-139`). After this ships, the Location field on both the create form and the `/manage` edit form suggests Google places as the organiser types, favouring Montreal. Picking one fills the text and records the place's id, and the event page links the location to Google Maps. Typing a room, a TBA or anything else still works; such an event simply has no link.

## Out of scope

- An embedded map, coordinates, distance, or any map on the event page.
- Place Details calls of any kind, and so session-token pricing (see Decisions).
- Refreshing stored place ids. Google suggests re-checking ids older than 12 months; not now.
- Location on the club page, the search dropdown, `EventCard` or `MyEventCard` becoming a link. Only the event page links.
- Changing what search, the planner prompt or the Calendar export read: they keep reading the `location` text (`SearchableText.java:28`, `PlannerPromptBuilder.java:122`, `google-calendar.ts:38-40`).
- A browser Maps JavaScript SDK, a `NEXT_PUBLIC_` key, or any CSP change.
- A per-IP rate limit on the suggestion endpoint. Queued in `TODO/todo.md` under *Security*.

## Decisions taken

- **Google is called from the backend**, through a thin authenticated proxy to Places Autocomplete (New) `POST https://places.googleapis.com/v1/places:autocomplete`, set up like `ai/config/AiClientConfig.java`. The key never reaches the browser and the CSP (`next.config.ts:56-71`) is untouched. Arpan, 2026-09-17. **ADR at wrap-up** (Proposed): the browser SDK and Google's `PlaceAutocompleteElement` were real alternatives.
- **Stored: the text plus a nullable place id.** `location` stays as it is; a new `events.location_place_id` (V37) holds the id of the picked suggestion. Place ids are exempt from Google's caching restrictions. Arpan, 2026-09-17.
- **Free text stays allowed.** Picking a suggestion sets the id; any later edit to the text clears it. Arpan, 2026-09-17.
- **No link without a place id.** An event with only text shows plain text, as today. Arpan, 2026-09-17.
- **The link** is `https://www.google.com/maps/search/?api=1&query=<location>&query_place_id=<id>`, built in `adapters.ts` into the existing `mapUrl`. Maps URLs need no key and are not billed. Claude, from Google's Maps URLs docs.
- **Montreal is favoured by `locationBias`, not restricted**: a circle centred on McGill (about 45.5048, -73.5772), radius 30 km, with `includedRegionCodes` and `regionCode` both `ca`. Without a bias Google uses the caller's IP, and here the caller is the backend's server, so the bias is required, not optional. Arpan chose bias, 2026-09-17; the proxy detail is Claude's.
- **No Place Details call, so no session billing.** Each debounced request is billed as an Autocomplete Request (10,000 free a month, then $2.83 per 1,000). Arpan, 2026-09-17, on these findings: session pricing applies only when a session ends in a Place Details (New) call with the same token. Ending with a Pro field ($17 per 1,000 after 5,000 free) makes the typing free; an Essentials field ($5 per 1,000) still bills the first 12 requests; an IDs Only call does not end the session at all. So **no session token is sent**, since one that never ends in Details bills exactly as none does.
- **A place id arriving on create or update is not checked with Google.** Only its shape is checked (Google's ids are URL-safe characters; reject anything else or over 255 characters, 400). The worst a bad id does is point that club's own link at the wrong place. Consequence of the no-Details decision; Claude.
- **Picking a suggestion fills the text with the place name and a short address**, e.g. `Trottier Building, Rue University, Montréal`. Arpan, 2026-09-17.
- **The short address is cut from the suggestion alone**: `mainText, secondaryText` with a trailing `, QC, Canada` or `, Canada` dropped. Autocomplete carries no street number unless the organiser typed one, and no Details call is made to fetch it. Claude proposed, Arpan accepted, 2026-09-17.
- **That text is saved as the organiser's location, knowingly.** Google's terms exempt only place ids from their caching limits; the name and short address come from Google, but the organiser sees and can edit them before saving. Rejected: saving only what was typed (clearly compliant, but the text is only as good as the typing) and fetching the name on every page view (a paid Place Details call per view, undoing the no-Details decision). Arpan, 2026-09-17.
- **No rate limit in this unit.** The endpoint ships behind `canManageClub` alone; the per-IP cap is queued in `TODO/todo.md` under *Security*. Arpan, 2026-09-17.
- **Only people who run the chosen club get suggestions**: the request carries `clubId`, checked with `ClubPermissionService.canManageClub` (`:51`), as event create does. On the create form suggestions start once a club is chosen, which is automatic for someone running one club. Arpan, 2026-09-17.
- **Both forms**: the create page and `/manage/[clubId]/events/[eventId]/edit` share `CreateEventForm`. Edit prefills the id from `ApiEvent` and sends it back on save, since `PUT` is a full replacement (`EventUpdateRequest.java:11`, `EventService.java:79`) and leaving it out would clear it. Arpan, 2026-09-17.
- **No key means no suggestions, not an error**: with `GOOGLE_PLACES_API_KEY` blank the endpoint returns an empty list and logs once at startup, as the OpenAI client does. CI, `verify.mjs` and tests run keyless. Claude, following `AiClientConfig.java`.
- **Google attribution is shown** under the suggestion list, as the Places policies require when predictions appear without a map. Claude, from Google's policies.
- **The dropdown is ours**, styled per `design-guidelines.md`, with combobox, listbox and option roles, arrow keys, Enter and Escape. The 300 ms debounce and panel shape follow `SearchBar.tsx:12,30-71`. No combobox exists to reuse. Claude.
## Open questions

- **Key setup in Google Cloud** (Arpan): a key restricted to Places API (New), a daily request quota, and a budget alert. Blocks the local check against the real API, not the build.

## Files expected to change

- **Migration:** `backend/src/main/resources/db/migrations/V37__add_event_location_place_id.sql`, a nullable `TEXT` column. Confirm V37 is free on `origin/develop` and `origin/main` first.
- **Backend, new** `places/`: `GooglePlacesProperties`, a `RestClient` config bean, `PlacesAutocompleteService` (bias, field mask, mapping to `{placeId, mainText, secondaryText}`), `PlacesController` (`GET /api/v1/places/autocomplete?q=&clubId=`), `PlaceSuggestionDTO`.
- **Backend, changed:** `event/Event.java`, `EventCreateRequest.java`, `EventUpdateRequest.java`, `EventService.java` (set and shape-check), `EventMapper.java`, `EventDTO.java`, `security/SecurityConfig.java`, `application.yml`, `application-test.yml`.
- **Backend tests:** a unit test for the service against `MockRestServiceServer` (request body carries the bias, response maps, a Google error comes back as an empty list rather than a 500); an IT for the endpoint (401 signed out, 403 for someone who does not run the club, an empty list when there is no key); `EventUpdateIT` (id round-trips, a malformed id → 400, a `PUT` without it clears it).
- **Contract:** `contracts/api-dto-fields.json` (`EventDTO.locationPlaceId`, the new `PlaceSuggestionDTO`), `app/__tests__/api-contract.test.ts`.
- **Frontend:** `app/types/index.ts` (`ApiEvent.locationPlaceId`), `lib/event.tsx` (`NewEvent.locationPlaceId`), `lib/adapters.ts` (`mapUrl`), a new `lib/places.ts` through `apiFetch`, a new `components/event/LocationField.tsx`, `components/event/CreateEventForm.tsx`, `(main)/events/[eventId]/page.tsx` (the link, in a new tab with `noopener noreferrer`).
- **Frontend tests:** `adapters.test.ts` (link only with an id), `event.test.ts` (payload), a new `LocationField.test.tsx` (debounce, pick sets the id, editing clears it, no key gives a plain input).
- **Configuration:** `docker/.env.example`, `docker/docker-compose.yml` (backend `environment:`), `.github/workflows/_docker.yml` (blank), `scripts/verify.mjs` if the backend step needs it.
- **Docs and rules mapped:** `api-and-caching.md` (`event/`, `types/`, `contracts/`, `adapters.ts`), `llm-api-key-management.md` (the key pattern it copies), `connecting-elastic-beanstalk.md` (the property table), `rules/db-migrations.md`, `rules/contracts.md`, `skills/database-lifecycle`.

## Verification

- `node scripts/verify.mjs --full`: lint, type-check, Jest, the build with the backend down, unit tests and the Testcontainers ITs, all keyless.
- `docker compose up -d --build backend frontend` with a real key in `docker/.env`; Flyway logs V37 applied.
- curl, signed in as a club owner: `GET /api/v1/places/autocomplete?q=trottier&clubId=<id>` returns McGill's Trottier Building first; the same for a club they do not run → 403; signed out → 401; blank key → `[]`.
- Browser on `localhost:3000`, create form: typing `bell centre` suggests the Montreal arena first; picking fills the text and the saved event page links to Google Maps, which opens that place; typing `Trottier 1080` without picking saves and shows no link.
- `/manage` edit: the linked event opens with its text; saving without touching the location keeps the link; changing the text to free text removes it.
- Google Cloud console: requests appear under Autocomplete Requests, with no Place Details usage.

## To update at wrap-up

- A Proposed ADR, the next free number: location suggestions through a backend proxy, no Place Details, place id stored, link only with an id, and the saved-text trade-off with its two rejected options. Rows in `docs/decisions/README.md` and `docs/README.md`.
- `rules/frontend.md` or `rules/contracts.md`: a location edit must clear the place id, and the edit form must send it back or `PUT` erases it.
- `api-and-caching.md` (the new field, the endpoint), `connecting-elastic-beanstalk.md` (`GOOGLE_PLACES_API_KEY` in the property table), `product.md` (event creation and event page).
- `TODO/tasks-completed.md`, the `STATUS.md` shipped line, this spec to `shipped`.
