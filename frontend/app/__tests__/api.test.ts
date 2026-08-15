import { apiFetch, setToken, clearToken } from "@/app/lib/api";
import { PUBLIC_READ_CACHE } from "@/app/lib/cache";

// A 200 with a JSON body, which is the only shape these tests care about.
function ok(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as unknown as Response;
}

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(ok());
  global.fetch = mockFetch as unknown as typeof fetch;
  clearToken();
});

/**
 * The guard that keeps per-user data out of the shared data cache.
 *
 * Next keys the data cache on the URL; the bearer token is not part of that
 * key. So a cached authenticated response is literally one user's data handed
 * to whoever asks next — a cross-account leak, not a stale page. These tests
 * exist because that failure is silent: nothing crashes, the wrong name just
 * appears on someone else's screen.
 */
describe("apiFetch refuses to cache authenticated responses", () => {
  it("throws when auth is combined with revalidate", async () => {
    await expect(
      apiFetch("/api/v1/users/me/clubs", { auth: true, revalidate: 60 }),
    ).rejects.toThrow(/Refusing to cache an authenticated response/);
  });

  it("throws when auth is combined with tags", async () => {
    await expect(
      apiFetch("/api/v1/users/me/clubs", { auth: true, tags: ["clubs"] }),
    ).rejects.toThrow(/Refusing to cache an authenticated response/);
  });

  it("refuses before issuing the request, so nothing is sent or stored", async () => {
    await expect(
      apiFetch("/api/v1/users/me/clubs", { auth: true, revalidate: 60 }),
    ).rejects.toThrow();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still allows an ordinary authenticated read", async () => {
    setToken("jwt-123");

    await expect(apiFetch("/api/v1/users/me/clubs", { auth: true })).resolves.toBeDefined();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt-123");
    // No cache directive at all, rather than one with a zero TTL.
    expect(init.next).toBeUndefined();
  });
});

describe("apiFetch cache options", () => {
  it("passes a public read's policy through to Next", async () => {
    await apiFetch("/api/v1/clubs", PUBLIC_READ_CACHE.clubs);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.next).toEqual({ revalidate: 300, tags: ["clubs"] });
  });

  it("hands Next a mutable copy of the readonly tag list", async () => {
    await apiFetch("/api/v1/clubs", PUBLIC_READ_CACHE.clubs);

    const [, init] = mockFetch.mock.calls[0];
    expect(Array.isArray(init.next.tags)).toBe(true);
    // Not the same array the shared policy object holds: Next types `tags` as
    // mutable, and a caller mutating it would rewrite the policy for every
    // other call site.
    expect(init.next.tags).not.toBe(PUBLIC_READ_CACHE.clubs.tags);
  });

  it("omits next entirely when no cache options are given", async () => {
    await apiFetch("/api/v1/clubs");

    const [, init] = mockFetch.mock.calls[0];
    expect(init.next).toBeUndefined();
  });
});
