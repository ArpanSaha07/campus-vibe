export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Where a request should actually go, which differs by side.
 *
 * In the browser the public URL is right. On the server it is not: inside the
 * frontend container `localhost:8080` is that container, not the backend, so a
 * server-rendered page fetching the public URL would connect to itself.
 *
 * API_INTERNAL_URL is deliberately not NEXT_PUBLIC_ — a Docker service name is
 * unreachable from a browser, so it must never be inlined into the client
 * bundle. It falls back to the public URL for `npm run dev` outside Docker,
 * where localhost:8080 is correct from both sides.
 */
function baseUrl(): string {
  if (typeof window !== "undefined") return API_BASE_URL;
  return process.env.API_INTERNAL_URL || API_BASE_URL;
}

/**
 * A request that reached the server and came back with a non-2xx status.
 *
 * The status is kept as a field because callers need to tell "no such thing"
 * apart from "the server is broken" — a 404 on a club page is an ordinary
 * outcome that should render the not-found UI, while a 500 is an exception.
 * Before this existed the only clue was the response body, which is why
 * `parseApiError` has to JSON.parse it back out of `Error.message`.
 *
 * `message` stays the raw body text, so every existing caller and
 * `parseApiError` behave exactly as before.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(body || `Request failed: ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "cv_jwt";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

type FetchOptions = RequestInit & {
  auth?: boolean;
  /**
   * Seconds to keep this response in Next's data cache. Server-side only —
   * ignored in the browser, where `next` is not a fetch option.
   *
   * Opt-in because fetch is uncached by default in this version, so every
   * server render of a public page otherwise re-queries the backend.
   */
  revalidate?: number;
  /** Cache tags, so a future mutation can revalidateTag instead of waiting out the TTL. */
  tags?: string[];
};

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { auth, revalidate, tags, ...init } = opts;

  // A cached authenticated response is one user's data handed to the next
  // caller — the cache key is the URL, and the bearer token is not part of it.
  // Refusing loudly beats a comment nobody reads.
  if (auth && (revalidate !== undefined || tags !== undefined)) {
    throw new Error(
      `Refusing to cache an authenticated response: ${path}. ` +
        `Per-user data must not enter the shared data cache.`,
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    ...(revalidate !== undefined || tags !== undefined
      ? { next: { ...(revalidate !== undefined && { revalidate }), ...(tags && { tags }) } }
      : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  // A 204, or any non-JSON body, has nothing to parse. The cast is the honest
  // shape of that: the caller's T states what it expects, and an empty response
  // has no value to satisfy it. Callers of endpoints that can return no body
  // should type T accordingly (e.g. `apiFetch<void>`).
  return undefined as T;
}