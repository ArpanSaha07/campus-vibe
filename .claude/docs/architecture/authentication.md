# Authentication Implementation Guide

**Code as of:** never — this document has not been reconciled with the
code. See the banner above; do not read a distance into this.

> ⚠ **Unverified — predates the documentation standard.** Moved here from
> `.claude/AUTH_IMPLEMENTATION.md` on 2026-08-06 without being re-checked against
> the code. It was written as a *guide to what should be built*, and parts of it
> describe endpoints as `Required` rather than as existing — so it may not
> describe what actually runs today. It does **not** yet follow
> [`implementation-docs`](../../skills/implementation-docs/SKILL.md): there is no
> verified status block, no design-decisions section and no known-gaps section.
>
> Do not trust a claim here without checking the file it refers to. Rewriting
> this against the real code is tracked in [`todo.md`](../../TODO/todo.md) and
> belongs to the `backend` agent with `security` reviewing.
>
> Known-good adjacent facts: the Google client-id type hole was
> [BUG-014](../../bugs/fixed_bugs.md#bug-014); the JWT transport question is open
> as [BUG-003](../../bugs/bugs.md#bug-003).

## Overview
This document explains the complete authentication implementation for CampusVibe, including email + code verification and Google OAuth 2.0 sign-in.

---

## Authentication Methods

### 1. Email + Verification Code Flow
Users enter their email address and receive a 6-digit code to verify ownership.

**Flow:**
```
User enters email → Backend sends code via email → User enters code → Backend verifies code → JWT token issued → User logged in
```

**Frontend Process:**
- EmailForm.tsx: User enters email → calls `sendVerificationCode(email)` → navigates to code verification
- CodeForm.tsx: User enters 6-digit code → calls `verifyCode(email, code)` → redirects to home

**Backend Endpoints Required:**
- `POST /api/v1/auth/send-code` - Generates and sends verification code
- `POST /api/v1/auth/verify-code` - Validates code and returns JWT token

### 2. Google OAuth 2.0 Sign-In
Users can sign in using their Google account via Google Identity Services.

**Flow:**
```
User clicks "Sign in with Google" → Google popup opens → User authenticates → Google returns ID token → Backend verifies token → JWT issued → User logged in
```

**Frontend Process:**
- OAuthButtons.tsx: Initializes Google Identity Services → User clicks button → Google callback receives ID token → calls `googleSignIn(idToken)` → redirects to home

**Backend Endpoints Required:**
- `POST /api/v1/auth/google` - Verifies Google ID token and returns JWT token

---

## Google Client ID Setup

### Where to Put It
The Google Client ID is **PUBLIC** and must be accessible on the browser. This is safe because:
- Google Client ID identifies which app is requesting authentication
- The actual secret (OAuth secret) never leaves the backend
- Client ID cannot be used to impersonate users without the secret

**Storage Location:** `.env.local` with `NEXT_PUBLIC_` prefix
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here
```

### How to Get Your Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable "Google Identity Services" API
4. Go to Credentials → Create OAuth 2.0 credentials
5. Choose "Web Application" type
6. Add Authorized Redirect URIs:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
7. Copy the **Client ID** and paste into `.env.local`

### Fixing 401 Invalid Client Error

The "Error 401: invalid_client" usually means:

1. **Client ID mismatch:** Client ID doesn't match any configured app in Google Cloud
   - Verify the Client ID in `.env.local` matches Google Cloud Console exactly
   - Check for extra spaces or typos

2. **Missing redirect URI:** The app's origin isn't in authorized URIs
   - Add `http://localhost:3000` for local development
   - Add your production domain for live app

3. **API not enabled:** Google Identity Services API is disabled
   - Go to Google Cloud Console → APIs → Enable "Google Identity Services"

4. **Token validation fails on backend:** Backend doesn't trust the token
   - Backend must verify token using Google's public keys
   - Ensure backend has Google Client ID configured

---

## Session Persistence (Browser Memory)

The app automatically remembers logged-in users across browser sessions.

**How it works:**

1. **Token Storage:** JWT token stored in `localStorage` with key `cv_jwt`
2. **On App Load:** AuthProvider checks for stored token
3. **Token Validation:** If token exists, fetches user data via `GET /api/v1/users/me`
4. **Auto-Login:** If token valid, user automatically logged in
5. **Persistent:** Token persists until:
   - User logs out (token cleared)
   - Browser storage is cleared manually

**Code Location:** `lib/auth-context.ts` - `useEffect` runs on component mount

---

## Authentication Flow Across Files

### File Structure
```
app/
├── lib/
│   ├── api.ts                    # API fetch utility, token management
│   ├── user.ts                   # Auth API functions
│   └── auth-context.ts           # Global auth state provider (NEW)
├── components/
│   ├── auth-components/
│   │   ├── EmailForm.tsx         # Email entry form (UPDATED)
│   │   ├── CodeForm.tsx          # Code verification form (UPDATED)
│   │   ├── OAuthButtons.tsx      # Google sign-in button (UPDATED)
│   │   ├── AuthCard.tsx          # UI wrapper
│   │   └── GoogleProvider.tsx    # Google Identity Services script loader
│   ├── ProtectedRoute.tsx        # Route protection wrapper (NEW)
│   └── ...other components
├── (auth)/
│   ├── layout.tsx
│   └── login/
│       └── page.tsx              # Login page
├── (protected)/
│   ├── create-event/
│   ├── my-events/
│   └── ...other protected routes
├── layout.tsx                    # Root layout (UPDATED)
└── .env.local                    # Environment variables (UPDATED)
```

### Flow Diagram

```
RootLayout
  ├── GoogleProvider (loads Google Identity Services script)
  └── AuthProvider (manages global auth state)
      ├── App checks for stored token
      ├── If token exists, validates with backend
      └── Components can use useAuth() hook
          ├── EmailForm → sendVerificationCode
          ├── CodeForm → verifyCode
          ├── OAuthButtons → googleSignIn
          └── ProtectedRoute → redirects if not authenticated
```

---

## Key Components

### AuthProvider (`lib/auth-context.ts`)
Central state management for authentication.

**Provides:**
- `user` - Logged-in user object
- `isAuthenticated` - Boolean indicating auth status
- `loading` - Boolean during initial auth check
- `login()` - Email/password login
- `register()` - Email/password registration
- `googleSignIn()` - Google OAuth sign-in
- `logout()` - Clear session and sign out

**Usage:**
```tsx
import { useAuth } from '@/app/lib/auth-context';

export function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();
  
  if (!isAuthenticated) return <p>Not logged in</p>;
  
  return (
    <>
      <p>Welcome, {user?.name}</p>
      <button onClick={logout}>Sign Out</button>
    </>
  );
}
```

### ProtectedRoute (`components/ProtectedRoute.tsx`)
Wrapper component to protect pages from unauthorized access.

**Usage:**
```tsx
// In a protected page (e.g., create-event/page.tsx)
import { ProtectedRoute } from '@/app/components/ProtectedRoute';

export default function CreateEventPage() {
  return (
    <ProtectedRoute>
      {/* Page content - only visible to authenticated users */}
    </ProtectedRoute>
  );
}
```

---

## API Functions

### `lib/user.ts`

#### `sendVerificationCode(email: string)`
Sends a verification code to user's email.
- Returns: `Promise<void>`
- Backend: `POST /api/v1/auth/send-code`

#### `verifyCode(email: string, code: string)`
Verifies code and completes email authentication.
- Returns: `Promise<User>` (auto-saves token)
- Backend: `POST /api/v1/auth/verify-code`

#### `googleSignIn(idToken: string)`
Verifies Google ID token and completes OAuth sign-in.
- Returns: `Promise<User>` (auto-saves token)
- Backend: `POST /api/v1/auth/google`

#### `login(email: string, password: string)`
Traditional email/password login (can be used for future password reset).
- Returns: `Promise<User>` (auto-saves token)
- Backend: `POST /api/v1/auth/login`

#### `register(name: string, email: string, password: string)`
Creates new account with email/password.
- Returns: `Promise<User>` (auto-saves token)
- Backend: `POST /api/v1/auth/register`

#### `me()`
Gets currently logged-in user's profile.
- Returns: `Promise<User>`
- Backend: `GET /api/v1/users/me` (requires auth header)

### `lib/api.ts`

#### `setToken(token: string)`
Saves JWT token to localStorage.

#### `getToken()`
Retrieves JWT token from localStorage (or null if not logged in).

#### `clearToken()`
Removes JWT token (used on logout).

#### `apiFetch<T>(path: string, opts: FetchOptions)`
Fetch wrapper that automatically includes auth token if needed.
- Sets `Authorization: Bearer {token}` header when `auth: true`
- Handles JSON parsing and error messages

---

## Backend Requirements

Your backend must implement these endpoints:

### Email + Code Authentication
```
POST /api/v1/auth/send-code
Body: { email: string }
Response: {}
```

```
POST /api/v1/auth/verify-code
Body: { email: string, code: string }
Response: { token: string; user: User }
```

### Google OAuth
```
POST /api/v1/auth/google
Body: { idToken: string }
Response: { token: string; user: User }
Note: Backend must verify idToken with Google's public keys
```

### User Profile
```
GET /api/v1/users/me
Headers: Authorization: Bearer {token}
Response: User
```

---

## Security Considerations

1. **Token Storage:** Stored in localStorage (accessible to JavaScript)
   - Safe because backend validates token on each request
   - Vulnerable to XSS attacks - ensure Content Security Policy configured

2. **Google Client ID:** Intentionally public in `.env.local`
   - Only works with configured redirect URIs
   - Actual OAuth secret never exposed

3. **HTTPS in Production:** Always use HTTPS to prevent token interception
   - Add production domain to Google Cloud authorized URIs
   - Add domain to NEXT_PUBLIC_API_BASE_URL

4. **CORS:** Backend should validate Origin header
   - Allow requests only from authorized domains
   - This prevents token misuse from other origins

---

## Testing the Implementation

### 1. Email + Code Flow
- Navigate to `/login`
- Enter email
- Check backend for code (or see in logs)
- Enter code on next screen
- Should redirect to home and be logged in

### 2. Google Sign-In
- Navigate to `/login`
- Click "Sign in with Google" button
- Authenticate with Google account
- Should redirect to home and be logged in

### 3. Session Persistence
- Log in using either method
- Refresh page - should stay logged in
- Close and reopen browser - should still be logged in
- Call logout - should redirect to login

### 4. Protected Routes
- While logged out, try to visit `/create-event`
- Should redirect to login page
- Log in, then visit `/create-event`
- Should show page content

---

## Environment Variables

Create `.env.local` with:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080  # or your backend URL
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

For production, update the API URL and ensure your Google Cloud project has the production domain configured.
