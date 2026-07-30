TODO:
- Create custom header style in layout.tsx

- stop overlap of event cards in event section
- only allow alphanumeric and space characters in title when creating a club
- return not found page when a club page url not found

---

Environment variables (local dev):

All variables live in `docker/.env` — copy `docker/.env.example` to get started.

- NEXT_PUBLIC_API_URL=http://localhost:8080
- NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>

Notes:

- If NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set, the Google button falls back to a dev prompt to paste an id_token.
- Ensure the backend has GOOGLE_CLIENT_ID set so it validates the Google ID token audience.
- **Never put a secret behind a `NEXT_PUBLIC_` prefix.** These values are inlined
  into the JavaScript bundle at build time and served to every visitor. That is
  fine for an API URL or a Google *client* id (both are public by design), and
  is a disclosure for anything else. LLM provider keys in particular must never
  appear here — all AI calls go through the Spring backend. See
  `.claude/docs/architecture/llm-api-key-management.md`.