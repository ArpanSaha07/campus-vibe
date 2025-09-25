TODO:
- Create custom header style in layout.tsx

- stop overlap of event cards in event section
- only allow alphanumeric and space characters in title when creating a club
- return not found page when a club page url not found

---

Environment variables (local dev):

- NEXT_PUBLIC_API_URL=http://localhost:8080
- NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-google-oauth-client-id>

Notes:

- If NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set, the Google button falls back to a dev prompt to paste an id_token.
- Ensure the backend has GOOGLE_CLIENT_ID set so it validates the Google ID token audience.